import { useMemo, useState } from "react";
import { useMacroData, macroSeries } from "@/hooks/use-verified-data";
import { freshnessOf } from "@/lib/freshness";
import { getNode } from "@/lib/intel/nodes";
import { cn } from "@/lib/utils";
import type { TradeFlow } from "@/hooks/use-verified-data";
import {
  BasisTag,
  FreshnessTag,
  NoDataAvailable,
  SectionTitle,
} from "./system";

/**
 * The trade flow engine.
 *
 * The honest constraint shapes this file. UN Comtrade's public preview tier
 * returns *total* merchandise trade per reporter — the counterparty is always
 * "World" — so there is no verified bilateral corridor to draw and no commodity
 * split to slice. What that leaves is still substantial and completely real:
 * each reporter's own exports, its own imports, and the balance between them.
 *
 * So the dominant visual is a Sankey of reported exports and reported imports
 * into world trade, where every ribbon's width is a published dollar figure. A
 * bilateral chord diagram is deliberately absent; drawing one from a source that
 * does not contain counterparties would be the single most misleading thing this
 * page could do.
 */

const EXPORT_COLOUR = "var(--exec-cyan)";
const IMPORT_COLOUR = "color-mix(in srgb, var(--exec-amber) 78%, transparent)";

function usd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(0)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return value.toFixed(0);
}

/* ------------------------------------------------------------------ Sankey */

/**
 * Two-sink Sankey: every reporter on the left, world exports and world imports
 * on the right. Ribbons are cubic bands whose thickness is proportional to the
 * reported value, so the picture cannot disagree with the table beneath it.
 */
export function TradeSankey({ flows }: { flows: TradeFlow[] }) {
  const [hover, setHover] = useState<string | null>(null);

  const W = 760;
  const H = 400;
  const PAD_TOP = 16;
  const PAD_BOTTOM = 26;
  const NODE_W = 11;
  const usable = H - PAD_TOP - PAD_BOTTOM;

  const rows = useMemo(
    () =>
      [...flows]
        .map((f) => ({
          ...f,
          node: getNode(f.reporter),
          total: f.exportsUsd + f.importsUsd,
        }))
        .sort((a, b) => b.total - a.total),
    [flows],
  );

  const totalExports = rows.reduce((s, r) => s + r.exportsUsd, 0);
  const totalImports = rows.reduce((s, r) => s + r.importsUsd, 0);
  const grand = totalExports + totalImports;
  if (grand <= 0 || rows.length === 0) {
    return (
      <NoDataAvailable
        title="No reported trade values to flow"
        reason="UN Comtrade returned no usable merchandise totals for this period, so there is nothing to draw. The absence is reported rather than filled."
      />
    );
  }

  // Every piece of geometry comes from one pure layout call, so no cursor is
  // advanced during render and the bands cannot drift between renders.
  const layout = layoutSankey(rows, { grand, totalExports, totalImports, usable });
  const { leftNodes, sinks, ribbons, SINK_X } = layout;

  return (
    <div className="min-w-0">
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[34rem]"
          role="img"
          aria-label={`Sankey of reported exports and imports to world trade. Total ${usd(grand)}.`}
        >
          <defs>
            <linearGradient id="gm-exp" x1="0" x2="1">
              <stop offset="0%" stopColor={EXPORT_COLOUR} stopOpacity={0.16} />
              <stop offset="100%" stopColor={EXPORT_COLOUR} stopOpacity={0.5} />
            </linearGradient>
            <linearGradient id="gm-imp" x1="0" x2="1">
              <stop offset="0%" stopColor={IMPORT_COLOUR} stopOpacity={0.14} />
              <stop offset="100%" stopColor={IMPORT_COLOUR} stopOpacity={0.46} />
            </linearGradient>
          </defs>

          {/* Ribbons first, so nodes and labels sit on top of them. */}
          {ribbons.map((band) => {
            const { row, y, h, expH, impH, expY, impY } = band;
            const dim = hover !== null && hover !== row.reporter;
            return (
              <g key={row.reporter} opacity={dim ? 0.18 : 1}>
                <path
                  d={ribbon(y, y + expH, SINK_X, expY, expH)}
                  fill="url(#gm-exp)"
                />
                <path
                  d={ribbon(y + expH, y + h, SINK_X, impY, impH)}
                  fill="url(#gm-imp)"
                />
              </g>
            );
          })}

          {/* Left nodes */}
          {leftNodes.map(({ row, y, h }) => (
            <g key={`n-${row.reporter}`}>
              <rect
                x={150}
                y={y}
                width={NODE_W}
                height={Math.max(2, h)}
                fill={EXPORT_COLOUR}
                opacity={hover === null || hover === row.reporter ? 0.9 : 0.3}
              />
              <text
                x={144}
                y={y + Math.min(12, h / 2 + 4)}
                textAnchor="end"
                className="exec-num"
                fill="var(--exec-ink)"
                style={{ fontSize: 11, paintOrder: "stroke", stroke: "var(--exec-base)", strokeWidth: 3 }}
              >
                {row.node.label}
              </text>
              <text
                x={144}
                y={y + Math.min(12, h / 2 + 4) + 11}
                textAnchor="end"
                className="exec-num"
                fill="var(--exec-ink-dim)"
                style={{ fontSize: 9, paintOrder: "stroke", stroke: "var(--exec-base)", strokeWidth: 3 }}
              >
                ${usd(row.total)}
              </text>
            </g>
          ))}

          {/* Right sinks */}
          {sinks.map((s) => (
            <g key={s.key}>
              <rect
                x={SINK_X}
                y={s.y}
                width={NODE_W}
                height={s.h}
                fill={s.key === "exports" ? EXPORT_COLOUR : IMPORT_COLOUR}
                opacity={0.9}
              />
              <text
                x={SINK_X - 10}
                y={s.y + 12}
                textAnchor="end"
                className="exec-label"
                fill="var(--exec-ink)"
                style={{ paintOrder: "stroke", stroke: "var(--exec-base)", strokeWidth: 3 }}
              >
                {s.label}
              </text>
              <text
                x={SINK_X - 10}
                y={s.y + 25}
                textAnchor="end"
                className="exec-num"
                fill="var(--exec-ink-dim)"
                style={{ fontSize: 10, paintOrder: "stroke", stroke: "var(--exec-base)", strokeWidth: 3 }}
              >
                ${usd(s.value)}
              </text>
            </g>
          ))}

          {/* Invisible hover targets, so the ribbons are selectable. */}
          {leftNodes.map(({ row, y, h }) => (
            <rect
              key={`h-${row.reporter}`}
              x={140}
              y={y}
              width={W - 320}
              height={Math.max(3, h)}
              fill="transparent"
              onMouseEnter={() => setHover(row.reporter)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
      </div>

      {/* Read-out: the hovered reporter's own numbers, never inferred. */}
      <div className="flex min-h-[2.5rem] flex-wrap items-center gap-x-5 gap-y-1 border-t border-[var(--exec-hairline)] px-3 py-2">
        {hover ? (
          <>
            <span className="text-[12px] font-medium text-[var(--exec-ink)]">
              {getNode(hover).label}
            </span>
            <Readout label="Exports" value={rows.find((r) => r.reporter === hover)?.exportsUsd ?? 0} colour={EXPORT_COLOUR} />
            <Readout label="Imports" value={rows.find((r) => r.reporter === hover)?.importsUsd ?? 0} colour={IMPORT_COLOUR} />
            <Readout
              label="Balance"
              value={(rows.find((r) => r.reporter === hover)?.exportsUsd ?? 0) - (rows.find((r) => r.reporter === hover)?.importsUsd ?? 0)}
              signed
            />
            <span className="exec-label">period {rows.find((r) => r.reporter === hover)?.period}</span>
          </>
        ) : (
          <span className="exec-label normal-case">
            Hover a reporter to isolate its two reported streams. Every ribbon
            width is a published merchandise value; the counterparty is always
            World, because that is all this source reports.
          </span>
        )}
      </div>
    </div>
  );
}

function Readout({
  label,
  value,
  colour,
  signed,
}: {
  label: string;
  value: number;
  colour?: string;
  signed?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="exec-label">{label}</span>
      <span
        className="exec-num text-[12px] font-semibold"
        style={{
          color:
            signed && value < 0
              ? "var(--exec-crimson)"
              : signed
                ? "var(--exec-emerald)"
                : colour ?? "var(--exec-ink)",
        }}
      >
        {signed && value > 0 ? "+" : ""}${usd(value)}
      </span>
    </span>
  );
}

/**
 * The whole Sankey layout, in one pure pass.
 *
 * Left column: one node per reporter, stacked in the same order as the table
 * beside it. Right column: the two world sinks. Ribbons attach by accumulating
 * down each sink, so the bands tile without overlapping and every thickness is
 * exactly the reported value divided by the grand total.
 */
function layoutSankey<R extends { exportsUsd: number; total: number }>(
  rows: R[],
  totals: {
    grand: number;
    totalExports: number;
    totalImports: number;
    usable: number;
  },
) {
  const W = 760;
  const PAD_TOP = 16;
  const GAP = 5;
  const NODE_W = 11;
  const { grand, totalExports, totalImports, usable } = totals;
  const SINK_X = W - 190;
  const rightGap = 22;

  const leftUsable = usable - GAP * (rows.length - 1);
  const leftNodes: { row: R; y: number; h: number }[] = [];
  let cursorY = PAD_TOP;
  for (const row of rows) {
    const h = (row.total / grand) * leftUsable;
    leftNodes.push({ row, y: cursorY, h });
    cursorY += h + GAP;
  }

  const rightUsable = usable - rightGap;
  const sinks = [
    { key: "exports", label: "Reported exports", value: totalExports },
    { key: "imports", label: "Reported imports", value: totalImports },
  ].map((n) => {
    const h = (n.value / grand) * rightUsable;
    const node = { ...n, y: PAD_TOP, h };
    return node;
  });
  // Stack the two sinks by offsetting the second, without mutating in place.
  const [exportSink, importSink] = [
    { ...sinks[0], y: PAD_TOP },
    { ...sinks[1], y: PAD_TOP + sinks[0].h + rightGap },
  ];

  let expCursor = exportSink.y;
  let impCursor = importSink.y;
  const ribbons: {
    row: R;
    y: number;
    h: number;
    expH: number;
    impH: number;
    expY: number;
    impY: number;
  }[] = [];
  for (const { row, y, h } of leftNodes) {
    const expH = (row.exportsUsd / row.total) * h;
    const impH = h - expH;
    ribbons.push({ row, y, h, expH, impH, expY: expCursor, impY: impCursor });
    expCursor += expH;
    impCursor += impH;
  }

  return { W, SINK_X, NODE_W, leftNodes, sinks: [exportSink, importSink], ribbons };
}

/** A cubic band from a source edge to a target edge. */function ribbon(
  y0: number,
  y1: number,
  tx: number,
  ty: number,
  thickness: number,
): string {
  const x0 = 161;
  const cx = (x0 + tx) / 2;
  return [
    `M ${x0} ${y0}`,
    `C ${cx} ${y0}, ${cx} ${ty}, ${tx} ${ty}`,
    `L ${tx} ${ty + thickness}`,
    `C ${cx} ${ty + thickness}, ${cx} ${y1}, ${x0} ${y1}`,
    "Z",
  ].join(" ");
}

/* ---------------------------------------------------------------- Balance */

/**
 * Trade balance, diverging from zero.
 *
 * Exports rise, imports fall, and the net is marked on the same axis, so a
 * deficit is visible as a shape rather than as a minus sign. Everything is
 * arithmetic on the two reported totals.
 */
export function TradeBalance({ flows }: { flows: TradeFlow[] }) {
  const [hover, setHover] = useState<string | null>(null);
  const rows = useMemo(
    () =>
      [...flows]
        .map((f) => ({
          ...f,
          node: getNode(f.reporter),
          balance: f.exportsUsd - f.importsUsd,
          total: f.exportsUsd + f.importsUsd,
        }))
        .sort((a, b) => b.balance - a.balance),
    [flows],
  );

  if (rows.length === 0) {
    return (
      <NoDataAvailable
        title="No balances to show"
        reason="Balance is exports minus imports on the two totals each reporter publishes. With no totals stored there is no balance to compute."
      />
    );
  }
  const peak = Math.max(...rows.map((r) => Math.abs(r.balance)), 1);

  return (
    <div>
      <SectionTitle
        meta="exports minus imports"
        right={<BasisTag basis="observed" />}
      >
        Trade balance
      </SectionTitle>
      <ul className="divide-y divide-[var(--exec-hairline)]">
        {rows.map((r) => {
          const surplus = r.balance >= 0;
          const dim = hover !== null && hover !== r.reporter;
          return (
            <li
              key={r.key}
              onMouseEnter={() => setHover(r.reporter)}
              onMouseLeave={() => setHover(null)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-1.5 transition-opacity",
                dim && "opacity-45",
              )}
            >
              <span className="exec-num w-9 shrink-0 text-[10px] text-[var(--exec-ink-dim)]">
                {r.node.short}
              </span>
              <span className="min-w-0 flex-1">
                {/* Zero line at the centre; the bar grows left for a deficit. */}
                <span className="relative block h-3.5 w-full">
                  <span className="absolute inset-y-0 left-1/2 w-px bg-[var(--exec-hairline-strong)]" />
                  <span
                    className="absolute inset-y-0"
                    style={{
                      background: surplus
                        ? "color-mix(in srgb, var(--exec-emerald) 55%, transparent)"
                        : "color-mix(in srgb, var(--exec-crimson) 55%, transparent)",
                      left: surplus ? "50%" : undefined,
                      right: surplus ? undefined : "50%",
                      width: `${(Math.abs(r.balance) / peak) * 50}%`,
                    }}
                  />
                </span>
              </span>
              <span
                className="exec-num w-[4.5rem] shrink-0 text-right text-[11.5px] font-semibold"
                style={{
                  color: surplus ? "var(--exec-emerald)" : "var(--exec-crimson)",
                }}
              >
                {surplus ? "+" : "-"}${usd(r.balance)}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[11px] leading-relaxed text-[var(--exec-ink-dim)]">
        Mirrored flows do not sum to a world total: Comtrade records each
        direction as reported by its own reporter, so summing surpluses across
        countries is not a meaningful aggregate. The ranking is the claim here,
        not the sum.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- Openness */

/** Reported trade share of GDP — an observed figure, not a derived one. */
export function TradeOpenness() {
  const macro = useMacroData();
  const series = useMemo(() => macroSeries(macro.data ?? []), [macro.data]);
  const rows = useMemo(
    () =>
      [...series.entries()]
        .filter(([key]) => key.endsWith(":tradeOpen"))
        .map(([, { latest, history }]) => ({
          label: latest.label,
          node: getNode(latest.node),
          value: latest.value,
          period: latest.period,
          first: history[0]?.value,
        }))
        .sort((a, b) => b.value - a.value),
    [series],
  );

  if (rows.length === 0) {
    return (
      <NoDataAvailable
        title={macro.data === null ? "World Bank has not returned a reading" : "No openness series stored"}
        reason={
          macro.problem ??
          "Trade share of GDP is the World Bank's own indicator. Where it has not been retrieved for an economy, that economy is absent from this ranking rather than estimated."
        }
      />
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div>
      <SectionTitle
        meta="World Bank"
        right={
          <>
            <FreshnessTag freshness={freshnessOf(macro.retrievedAt, "worldbank")} />
            <BasisTag basis="observed" />
          </>
        }
      >
        Trade openness
      </SectionTitle>
      <ul className="divide-y divide-[var(--exec-hairline)]">
        {rows.map((r) => (
          <li key={`${r.node.id}-${r.period}`} className="flex items-center gap-2.5 px-3 py-1.5">
            <span className="w-28 shrink-0 truncate text-[11.5px] text-[var(--exec-ink)]">
              {r.node.label}
            </span>
            <span className="h-1.5 min-w-0 flex-1 bg-[var(--exec-hairline)]">
              <span
                className="block h-full"
                style={{ width: `${(r.value / max) * 100}%`, background: "var(--exec-cyan)" }}
              />
            </span>
            <span className="exec-num w-11 shrink-0 text-right text-[11px] text-[var(--exec-ink)]">
              {r.value.toFixed(0)}%
            </span>
            <span className="exec-num w-9 shrink-0 text-right text-[9.5px] text-[var(--exec-ink-dim)]">
              {r.period}
            </span>
          </li>
        ))}
      </ul>
      <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[11px] leading-relaxed text-[var(--exec-ink-dim)]">
        Merchandise trade as a share of GDP, as reported by the World Bank. This
        is an annual national-account indicator, so it is never live — it
        describes a closed year.
      </p>
    </div>
  );
}
