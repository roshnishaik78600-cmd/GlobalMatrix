import { useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import type { ChokepointRow } from "@/convex/chokepoints";
import { getNode } from "@/lib/intel/nodes";
import { cn } from "@/lib/utils";
import { pct } from "@/lib/format";
import {
  BasisTag,
  NoDataAvailable,
  SegmentedControl,
} from "./system";
import { loadColour } from "./Topology";

/**
 * The chokepoint analyzer.
 *
 * The flow is the flagship: declared industry dependencies on the left, the
 * chokepoint in the middle, and the economies that share its exposure on the
 * right. Edges are crimson only where the link is genuinely critical — a
 * bottleneck visualisation in which everything is red tells the reader nothing.
 *
 * Nothing here animates. Particle motion would imply traffic on a lane the data
 * does not measure, and this product does not fake liveness.
 */
type Row = ChokepointRow;

export function ChokepointBoard({
  rows,
  selected,
  onSelect,
}: {
  rows: Row[];
  selected: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const row = rows.find((r) => r.nodeId === selected) ?? rows[0] ?? null;
  const [stage, setStage] = useState<"dependency" | "exposure">("dependency");

  if (!row) {
    return (
      <NoDataAvailable
        title="No chokepoint carries exposure in this corpus"
        reason="The board is built by walking the corpus propagation graph to every chokepoint and corridor. Nothing in the current corpus reaches one, so the analyzer stays empty rather than showing a generic diagram of chokepoints in general."
      />
    );
  }

  return (
    <div>
      {/* Bottleneck selector: the reader picks the single point of failure. */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--exec-hairline)] px-3 py-2">
        <span className="exec-label">Bottleneck</span>
        <SegmentedControl
          options={rows.map((r) => ({ id: r.nodeId, label: r.short }))}
          value={row.nodeId}
          onChange={onSelect}
        />
        <Link
          to={`/app/country/${row.nodeId}`}
          className="exec-label ml-auto flex items-center gap-1 transition-colors hover:text-[var(--exec-ink)]"
        >
          Full node profile <ArrowUpRight className="size-3" />
        </Link>
      </div>

      {/* Header: what this node is and how hard it is being pressed. */}
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--exec-hairline)] px-3 py-2.5">
        <div className="min-w-0">
          <h3 className="text-[15px] leading-tight font-semibold text-[var(--exec-ink)]">
            {row.label}
          </h3>
          <p className="exec-label mt-1">
            {row.kind} · {row.region} · {row.eventCount} events
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Meter label="Node load" value={row.load} note="derived" />
          <Meter label="Criticality" value={row.criticality} note="structural" />
        </div>
      </div>

      <div className="border-b border-[var(--exec-hairline)] px-3 py-2">
        <SegmentedControl
          options={[
            { id: "dependency", label: "WHO DEPENDS ON IT", hint: "Declared sector dependencies" },
            { id: "exposure", label: "WHAT IT EXPOSES", hint: "Economies sharing this node's events" },
          ]}
          value={stage}
          onChange={setStage}
        />
      </div>

      {stage === "dependency" ? (
        <DependencyFlow row={row} />
      ) : (
        <ExposureFlow row={row} onSelect={onSelect} />
      )}
    </div>
  );
}

/** Compact radial meter. The only meters on this page, so they stay rare. */
function Meter({ label, value, note }: { label: string; value: number; note: string }) {
  const pctValue = Math.max(0, Math.min(1, value));
  const colour = loadColour(pctValue);
  const R = 15;
  const C = 2 * Math.PI * R;
  return (
    <div className="flex items-center gap-2">
      <svg viewBox="0 0 40 40" className="size-9 shrink-0" aria-hidden>
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke="var(--exec-hairline)"
          strokeWidth="4"
        />
        <circle
          cx="20"
          cy="20"
          r={R}
          fill="none"
          stroke={colour}
          strokeWidth="4"
          strokeLinecap="butt"
          strokeDasharray={`${pctValue * C} ${C}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <div className="min-w-0">
        <p className="exec-label">{label}</p>
        <p className="exec-num text-[15px] leading-tight font-bold" style={{ color: colour }}>
          {(pctValue * 100).toFixed(0)}
          <span className="exec-label ml-0.5">/100</span>
        </p>
        <p className="exec-label normal-case">{note}</p>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- Dependency flow */

interface FlowStage {
  id: string;
  label: string;
  members: { id: string; label: string; note: string; weight: number }[];
}

/**
 * The declared chain: sectors that route through or consume from this node.
 *
 * The criticality of a link is the sector's own share of this node — a sector
 * that takes 28% of its input here is genuinely dependent on it, and one that
 * merely transits the corridor is not. Crimson is reserved for the former.
 */
function DependencyFlow({ row }: { row: Row }) {
  const stages = useMemo<FlowStage[]>(() => {
    const inputs = row.industries.filter((i) => i.role === "input");
    const routes = row.industries.filter((i) => i.role === "route");
    return [
      {
        id: "input",
        label: "Direct inputs",
        members: inputs.map((i) => ({
          id: i.id,
          label: i.label,
          note: i.note,
          weight: i.share,
        })),
      },
      {
        id: "chokepoint",
        label: row.label,
        members: [
          {
            id: row.nodeId,
            label: row.label,
            note: `${row.kind} · criticality ${row.criticality.toFixed(2)}`,
            weight: 1,
          },
        ],
      },
      {
        id: "route",
        label: "Routes through",
        members: routes.map((i) => ({
          id: i.id,
          label: i.label,
          note: i.note,
          weight: i.sectorLoad,
        })),
      },
    ].filter((s) => s.members.length > 0);
  }, [row]);

  if (stages.length < 2) {
    return (
      <NoDataAvailable
        title="No sector declares a dependency on this node"
        reason="The structural reference layer names sectors as inputs of, or routes through, each chokepoint. This node has none in the current corpus, and none are invented to make the diagram look complete."
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 gap-px sm:grid-cols-3">
        {stages.map((stage, i) => (
          <div key={stage.id} className="min-w-0">
            <div className="border-b border-[var(--exec-hairline)] px-3 py-1.5">
              <span className="exec-label text-[var(--exec-ink)]">
                {i + 1}. {stage.label}
              </span>
            </div>
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {stage.members.map((m) => {
                const critical = stage.id !== "chokepoint" && m.weight >= 0.2;
                return (
                  <li key={m.id} className="px-3 py-1.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[11.5px] text-[var(--exec-ink)]">
                        {m.label}
                      </span>
                      <span
                        className="exec-num shrink-0 text-[10px]"
                        style={{ color: critical ? "var(--exec-crimson)" : "var(--exec-ink-dim)" }}
                      >
                        {stage.id === "chokepoint" ? "—" : pct(m.weight)}
                      </span>
                    </div>
                    <p className="exec-label mt-0.5 line-clamp-2 normal-case">{m.note}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--exec-hairline)] px-3 py-1.5">
        <span className="exec-label flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: "var(--exec-crimson)" }}
          />
          critical dependency (≥20% of the node&apos;s declared input share)
        </span>
        <span className="exec-label flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4"
            style={{ background: "var(--exec-hairline-strong)" }}
          />
          routed through, share not declared
        </span>
        <BasisTag basis="model" className="ml-auto" />
      </div>
    </div>
  );
}

/* ----------------------------------------------------------- Exposure flow */

/** What a shock here actually reaches, ranked by shared-event coupling. */
function ExposureFlow({
  row,
  onSelect,
}: {
  row: Row;
  onSelect: (nodeId: string) => void;
}) {
  if (row.exposed.length === 0) {
    return (
      <NoDataAvailable
        title="No tracked economy shares this node&apos;s events"
        reason="Coupling is measured by the events both places are exposed to. Nothing in the current corpus touches this node and an economy at the same time, so no economy is listed as downstream."
      />
    );
  }
  const peak = Math.max(...row.exposed.map((e) => e.coupling), 0.01);

  return (
    <div>
      <ul className="divide-y divide-[var(--exec-hairline)]">
        {row.exposed.map((e) => (
          <li key={e.nodeId} className="flex items-center gap-2.5 px-3 py-1.5">
            <span className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => onSelect(e.nodeId)}
                className="truncate text-left text-[11.5px] text-[var(--exec-ink)] transition-colors hover:underline"
              >
                {e.label}
              </button>
              <span className="mt-1 block h-1 w-full bg-[var(--exec-hairline)]">
                <span
                  className="block h-full transition-[width] duration-500"
                  style={{
                    width: `${(e.coupling / peak) * 100}%`,
                    background: loadColour(e.coupling),
                  }}
                />
              </span>
            </span>
            <span className="exec-num w-10 shrink-0 text-right text-[10.5px] text-[var(--exec-ink)]">
              {e.coupling.toFixed(2)}
            </span>
            <span
              className="exec-num w-9 shrink-0 text-right text-[10.5px]"
              style={{ color: loadColour(e.load) }}
            >
              {pct(e.load)}
            </span>
          </li>
        ))}
      </ul>
      <div className="border-t border-[var(--exec-hairline)] px-3 py-1.5">
        <p className="exec-label normal-case">
          Left bar: shared-event coupling with this chokepoint. Right figure:
          that economy&apos;s own live load. Coupling is not a trade flow and not
          a shipping lane — it says these two are pulled by the same events.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- The roster */

export function ChokepointRoster({
  rows,
  selected,
  onSelect,
  onInspect,
}: {
  rows: Row[];
  selected: string | null;
  onSelect: (nodeId: string) => void;
  onInspect: (nodeId: string) => void;
}) {
  if (rows.length === 0) {
    return (
      <NoDataAvailable
        title="No chokepoint in the current corpus"
        reason="Chokepoints and corridors only appear once the corpus exposes one, so the roster is empty until it does."
      />
    );
  }
  return (
    <ul className="divide-y divide-[var(--exec-hairline)]">
      {rows.map((r) => (
        <li key={r.nodeId} className="flex items-stretch">
          <button
            type="button"
            onClick={() => onSelect(r.nodeId)}
            aria-pressed={selected === r.nodeId}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-[var(--exec-surface-strong)]",
              selected === r.nodeId && "bg-[var(--exec-surface-strong)]",
            )}
          >
            <span className="exec-num w-9 shrink-0 text-[10.5px] font-bold text-[var(--exec-cyan)]">
              {r.short}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12px] text-[var(--exec-ink)]">
                {r.label}
              </span>
              <span className="exec-label mt-0.5 block truncate">
                {r.region} · {r.industries.length} sectors · {r.exposed.length} economies
              </span>
            </span>
            <span className="h-1.5 w-16 shrink-0 bg-[var(--exec-hairline)]">
              <span
                className="block h-full"
                style={{ width: pct(r.load), background: loadColour(r.load) }}
              />
            </span>
            <span
              className="exec-num w-9 shrink-0 text-right text-[11px] font-semibold"
              style={{ color: loadColour(r.load) }}
            >
              {pct(r.load)}
            </span>
          </button>
          <Link
            to={`/app/country/${r.nodeId}`}
            onDoubleClick={() => onInspect(r.nodeId)}
            className="flex w-7 shrink-0 items-center justify-center border-l border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
            title={`Open ${getNode(r.nodeId).label}`}
          >
            <ArrowUpRight className="size-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
