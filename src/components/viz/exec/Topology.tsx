import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { bandOf } from "@/lib/intel/engine";
import { CHANNEL_COLOR } from "@/lib/intel/visual";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { cn } from "@/lib/utils";
import { BasisTag, FreshnessTag, SectionTitle, SegmentedControl } from "./system";
import type { TopologyCategory, TopologyResult } from "@/convex/macroTopology";

/**
 * The Overview's three visual instruments: a composite gauge cluster, a macro
 * risk topology, and a real-time threat ticker.
 *
 * Every number here is MODEL OUTPUT derived from the scenario corpus, and every
 * component says so. The gauges are the only gauges in the product; using them
 * everywhere would flatten the hierarchy, so the rest of the app uses bars.
 */

/* ------------------------------------------------------------- Gauge cluster */

/** Status band, taken from the engine's own thresholds so nothing disagrees. */
function gaugeBand(value: number) {
  return bandOf(value);
}

const BAND_COLOUR: Record<string, string> = {
  low: "var(--exec-emerald)",
  moderate: "var(--exec-cyan)",
  elevated: "var(--exec-amber)",
  high: "var(--exec-crimson)",
  severe: "var(--exec-crimson)",
};

/**
 * One semi-circular gauge: value, trend arrow, 30-day sparkline and status.
 *
 * Deliberately minimal — a 180° dial, a needle-free reading, and the trace that
 * says how it got here. No gauge is drawn for a metric with no series, because
 * a dial with no history behind it is decoration.
 */
export function CompositeGauge({
  label,
  value,
  series,
  change,
  note,
  basis = "model",
  active,
  onClick,
}: {
  label: string;
  /** 0..1 */
  value: number;
  series: number[];
  change: number;
  note: string;
  basis?: "observed" | "model" | "scenario";
  active?: boolean;
  onClick?: () => void;
}) {
  const pct = Math.max(0, Math.min(1, value));
  const band = gaugeBand(pct * 100);
  const colour = BAND_COLOUR[band];

  const rising = change > 0.02;
  const falling = change < -0.02;
  const Trend = rising ? ArrowUpRight : falling ? ArrowDownRight : Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "glass glass-hover flex min-w-0 flex-col gap-1.5 px-3 py-2.5 text-left",
        !onClick && "cursor-default",
        active && "border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)]",
      )}
    >
      <span className="flex min-w-0 items-center justify-between gap-2">
        <span className="exec-label min-w-0 max-w-[16ch] truncate">{label}</span>
        <BasisTag basis={basis} />
      </span>

      <span className="flex items-end gap-2">
        {/* 180° dial: an arc filled to the reading, with the band thresholds
            marked so the number is never a bare percentage. */}
        <svg viewBox="0 0 64 38" className="h-[38px] w-[64px] shrink-0" aria-hidden>
          <path
            d="M 5 33 A 27 27 0 0 1 59 33"
            fill="none"
            stroke="var(--exec-hairline)"
            strokeWidth={5}
            strokeLinecap="butt"
          />
          <path
            d="M 5 33 A 27 27 0 0 1 59 33"
            fill="none"
            stroke={colour}
            strokeWidth={5}
            strokeLinecap="butt"
            pathLength={100}
            strokeDasharray={`${pct * 100} 100`}
          />
          {/* Threshold ticks at the engine's own band edges. */}
          {[0.3, 0.42, 0.52, 0.65].map((t) => {
            const angle = Math.PI * (1 - t);
            return (
              <line
                key={t}
                x1={32 + Math.cos(angle) * 22}
                y1={33 - Math.sin(angle) * 22}
                x2={32 + Math.cos(angle) * 27}
                y2={33 - Math.sin(angle) * 27}
                stroke="var(--exec-base)"
                strokeWidth={1.4}
              />
            );
          })}
        </svg>

        <span className="flex min-w-0 flex-col">
          <span className="flex items-baseline gap-1">
            <span
              className="exec-num text-[26px] leading-none font-bold tracking-[-0.03em]"
              style={{ color: colour }}
            >
              {(pct * 100).toFixed(0)}
            </span>
            <span className="exec-num text-[11px] text-[var(--exec-ink-dim)]">/100</span>
          </span>
          <span className="exec-label mt-1 flex items-center gap-1 normal-case">
            <Trend className="size-3" style={{ color: colour }} aria-hidden />
            {rising ? "rising" : falling ? "easing" : "flat"} over the last third
          </span>
        </span>
      </span>

      <Sparkline values={series} colour={colour} />

      <span className="exec-label mt-0.5 block normal-case">{note}</span>
    </button>
  );
}

/** 30-day trace. Scaled to the series' own peak, and labelled as such. */
function Sparkline({ values, colour }: { values: number[]; colour: string }) {
  if (values.length < 2) {
    return (
      <p className="exec-label text-[9px] normal-case">
        No series available for this window.
      </p>
    );
  }
  const max = Math.max(...values, 0.0001);
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * 100;
      const y = 26 - (v / max) * 22;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = values[values.length - 1];
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="h-7 w-full"
      aria-hidden
    >
      <title>{`30-day trace. Peak ${(max * 100).toFixed(0)} index points.`}</title>
      <polyline
        points={points}
        fill="none"
        stroke={colour}
        strokeWidth={1.2}
        vectorEffect="non-scaling-stroke"
        opacity={0.85}
      />
      <circle
        cx={100}
        cy={26 - (last / max) * 22}
        r={1.8}
        fill={colour}
      />
    </svg>
  );
}

export function GaugeCluster({ data }: { data: TopologyResult }) {
  const [active, setActive] = useState<string | null>(null);
  const supply = data.categories.find((c) => c.id === "supply-chain");
  const trade = data.categories.find((c) => c.id === "trade-bottlenecks");
  const frag = data.fragility;

  return (
    <div className="flex min-w-0 flex-col">
      <SectionTitle
        meta="30-day model output"
        right={
          <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
            as of {data.latest}
          </span>
        }
      >
        Composite gauges
      </SectionTitle>
      <div className="grid min-w-0 grid-cols-1 gap-2 p-2 sm:grid-cols-3">
        <CompositeGauge
          label="Global supply chain stress"
          value={supply?.intensity ?? 0}
          series={supply?.values ?? []}
          change={supply?.change ?? 0}
          note={supply?.measure ?? "No series."}
          active={active === "supply-chain"}
          onClick={() =>
            setActive((a) => (a === "supply-chain" ? null : "supply-chain"))
          }
        />
        <CompositeGauge
          label="Trade velocity"
          value={trade?.intensity ?? 0}
          series={trade?.values ?? []}
          change={trade?.change ?? 0}
          note={trade?.measure ?? "No series."}
          active={active === "trade-bottlenecks"}
          onClick={() =>
            setActive((a) => (a === "trade-bottlenecks" ? null : "trade-bottlenecks"))
          }
        />
        <CompositeGauge
          label="Sovereign fragility"
          value={frag.latest}
          series={frag.values}
          change={frag.change}
          note={frag.measure || "No series."}
          active={active === "fragility"}
          onClick={() => setActive((a) => (a === "fragility" ? null : "fragility"))}
        />
      </div>
      <p className="px-3 pb-2.5 text-[11px] leading-relaxed text-[var(--exec-ink-dim)]">
        Each dial is scaled to its own 30-day peak, so a high reading means
        &ldquo;near the top of its own recent range&rdquo; rather than &ldquo;high
        in absolute terms&rdquo;. These are indices derived from the scenario
        corpus, not published statistics, and no probability of anything is
        implied by them.
      </p>
    </div>
  );
}

/* --------------------------------------------------------- Risk topology */

/**
 * Six heat tiles. Intensity is the fill, change is the arrow, the sparkline is
 * the trend, and the timestamp is the corpus's own latest observation.
 *
 * Clicking a tile filters the connected visualisations, which is the whole
 * point of the board: a topology you cannot act on is a chart.
 */
export function RiskTopology({
  data,
  onSelect,
  selected,
  columns = 3,
}: {
  data: TopologyResult;
  onSelect: (id: string | null) => void;
  selected: string | null;
  /**
   * Tiles per row. Explicit rather than viewport-driven: this board is placed
   * in a 4-column region on one page and a full-width region on another, and a
   * viewport breakpoint cannot tell the difference — three tiles in a narrow
   * region land at roughly 120px each, which is not a layout.
   */
  columns?: 1 | 2 | 3;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <SectionTitle
        meta="daily model output"
        right={
          <span className="exec-num shrink-0 text-[9.5px] text-[var(--exec-ink-dim)]">
            as of {data.latest}
          </span>
        }
      >
        Macro risk topology
      </SectionTitle>
      <div
        className={cn(
          "grid min-w-0 gap-2 p-2",
          columns === 1 && "grid-cols-1",
          columns === 2 && "grid-cols-1 sm:grid-cols-2",
          columns === 3 && "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
        )}
      >
        {data.categories.map((c) => (
          <HeatTile
            key={c.id}
            category={c}
            latest={data.latest}
            selected={selected === c.id}
            onClick={() => onSelect(selected === c.id ? null : c.id)}
          />
        ))}
      </div>
    </div>
  );
}

function HeatTile({
  category,
  latest,
  selected,
  onClick,
}: {
  category: TopologyCategory;
  latest: string;
  selected: boolean;
  onClick: () => void;
}) {
  const intensity = Math.max(0, Math.min(1, category.intensity));
  const colour = BAND_COLOUR[gaugeBand(intensity * 100)];
  const rising = category.change > 0.04;
  const falling = category.change < -0.04;
  const Trend = rising ? ArrowUpRight : falling ? ArrowDownRight : Minus;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      title={category.measure}
      className={cn(
        "glass glass-hover relative flex min-w-0 flex-col gap-1 overflow-hidden px-2.5 py-2 text-left",
        selected && "border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)]",
      )}
    >
      {/* Intensity as fill, so a glance ranks the board before any text is read. */}
      <span
        className="pointer-events-none absolute inset-0"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${colour} ${Math.round(
            6 + intensity * 26,
          )}%, transparent), transparent 78%)`,
        }}
        aria-hidden
      />
      <span className="relative flex min-w-0 items-center justify-between gap-2">
        <span className="exec-label min-w-0 max-w-[15ch] truncate text-[var(--exec-ink)]">
          {category.label}
        </span>
        <Trend
          className="size-3 shrink-0"
          style={{ color: rising ? colour : falling ? "var(--exec-cyan)" : "var(--exec-ink-dim)" }}
          aria-hidden
        />
      </span>
      <span className="relative flex items-baseline gap-1.5">
        <span
          className="exec-num text-[22px] leading-none font-bold tracking-[-0.03em]"
          style={{ color: colour }}
        >
          {(intensity * 100).toFixed(0)}
        </span>
        <span className="exec-num text-[10px] text-[var(--exec-ink-dim)]">
          {category.change >= 0 ? "+" : ""}
          {category.change.toFixed(2)}
        </span>
      </span>
      <Sparkline values={category.values} colour={colour} />
      <span className="relative flex items-center justify-between gap-2">
        <span className="exec-num text-[9px] text-[var(--exec-ink-dim)]">
          {category.values.length}d trace
        </span>
        <span className="exec-num text-[9px] text-[var(--exec-ink-dim)]">
          {latest}
        </span>
      </span>
    </button>
  );
}

/* -------------------------------------------------------------- Ticker */

export interface TickerEvent {
  id: string;
  title: string;
  location: string;
  at: string;
  score: number;
  band: string;
  channel: Channel;
  confidence: number;
  source: string;
  /** False when the event sits outside the reader's active time window. */
  inWindow: boolean;
}

/**
 * The real-time threat ticker: a horizontally scrollable timeline of events.
 *
 * Scrollable rather than auto-advancing, because a readout that moves on its own
 * cannot be read carefully, and this is the one surface where careful reading is
 * the point. Events outside the active window are dimmed rather than removed:
 * the reader chose a window to narrow attention, not to lose the record.
 */
export function ThreatTicker({
  events,
  onSelect,
  selected,
  windowLabel,
}: {
  events: TickerEvent[];
  onSelect: (id: string) => void;
  selected: string | null;
  windowLabel: string;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const inWindow = events.filter((e) => e.inWindow).length;
  return (
    <div>
      <SectionTitle
        meta={`${inWindow} of ${events.length} inside ${windowLabel} · scroll for more`}
        right={<FreshnessTag freshness="historical" className="exec-label" />}
      >
        Threat ticker
      </SectionTitle>
      <div className="flex min-w-0 snap-x gap-px overflow-x-auto p-2">
        {events.map((e) => {
          const colour = CHANNEL_COLOR[e.channel];
          return (
            <button
              key={e.id}
              type="button"
              onClick={() => onSelect(e.id)}
              onMouseEnter={() => setHovered(e.id)}
              onMouseLeave={() => setHovered(null)}
              aria-pressed={selected === e.id}
              className={cn(
                "glass glass-hover flex w-[15rem] shrink-0 snap-start flex-col gap-1 px-2.5 py-2 text-left",
                selected === e.id && "border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)]",
                hovered === e.id && !selected && "bg-[var(--exec-surface-strong)]",
                !e.inWindow && "opacity-45",
              )}
            >
              <span className="flex min-w-0 items-center justify-between gap-2">
                <span
                  className="exec-label min-w-0 max-w-[11ch] truncate"
                  style={{ color: colour }}
                >
                  {CHANNEL_LABEL[e.channel]}
                </span>
                <span
                  className="exec-num text-[11px] font-semibold"
                  style={{ color: BAND_COLOUR[gaugeBand(e.score)] }}
                >
                  {e.score.toFixed(0)}
                </span>
              </span>
              <span className="line-clamp-2 text-[12px] leading-snug font-medium text-[var(--exec-ink)]">
                {e.title}
              </span>
              <span className="exec-num mt-auto text-[9.5px] text-[var(--exec-ink-dim)]">
                {e.location} · {e.at}
              </span>
              <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
                impact {e.score.toFixed(0)} · confidence{" "}
                {(e.confidence * 100).toFixed(0)}% · {e.source}
              </span>
              {!e.inWindow ? (
                <span className="exec-label text-[9px] text-[var(--exec-amber)]">
                  outside {windowLabel}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------ Shared utilities */

/** Intensity → the accent, exported so pages colour their own loads the same way. */
export function loadColour(value: number): string {
  return BAND_COLOUR[gaugeBand(Math.max(0, Math.min(1, value)) * 100)];
}

/** Domain switcher for the Overview map's six layers. */
export function DomainSwitch({
  value,
  onChange,
}: {
  value: Channel | "risk";
  onChange: (next: Channel | "risk") => void;
}) {
  const options = useMemo(
    () => [
      {
        id: "risk" as const,
        label: "RISK",
        hint: "Blended load across every channel, plus every event and coupling.",
      },
      {
        id: "trade" as const,
        label: "TRADE",
        hint: "Shade by trade-channel load; show only trade-dominant events.",
      },
      {
        id: "energy" as const,
        label: "ENERGY",
        hint: "Shade by energy-channel load; show only energy-dominant events.",
      },
      {
        id: "finance" as const,
        label: "FINANCE",
        hint: "Shade by finance-channel load; show only finance-dominant events.",
      },
      {
        id: "diplomatic" as const,
        label: "GEOPOLITICAL",
        hint: "Shade by diplomatic-channel load; show only diplomatic events.",
      },
    ],
    [],
  );
  return <SegmentedControl options={options} value={value} onChange={onChange} />;
}

/** Link that keeps a reader inside the console rather than bouncing to a new tab. */
export function InlineNextAction({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="exec-label inline-flex items-center gap-1 border border-[var(--exec-hairline)] px-2 py-1 transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)]"
    >
      {children} →
    </Link>
  );
}
