import { useMemo } from "react";
import { Panel, Skeleton } from "@/components/viz/core";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { SourceLine, SourceNote, StatusBadge } from "@/components/viz/Provenance";
import { macroSeries, useMacroData } from "@/hooks/use-verified-data";
import { SCENARIOS } from "@/lib/intel/scenarios";
import { getNode } from "@/lib/intel/nodes";
import { cn } from "@/lib/utils";

/**
 * Reported growth over time, with the corpus's own dates marked on the axis.
 *
 * The markers are a statement about timing only. An event dated in the same
 * year as a growth reading is a coincidence of dates until someone shows a
 * mechanism, so the panel says exactly that in writing rather than letting the
 * alignment of two graphics imply something it cannot support.
 */

export function MacroTrend({
  nodeId,
  className,
}: {
  nodeId?: string;
  className?: string;
}) {
  const macro = useMacroData();

  const entries = useMemo(() => {
    const series: ReturnType<typeof macroSeries> = macro.data
      ? macroSeries(macro.data)
      : new Map();
    if (nodeId) {
      const hit = series.get(`${nodeId}:gdpGrowth`);
      return hit ? [{ nodeId, ...hit }] : [];
    }
    return [...series.values()]
      .filter((s) => s.latest.indicatorKey === "gdpGrowth")
      .map((s) => ({ nodeId: s.latest.node, ...s }));
  }, [macro.data, nodeId]);

  const eventsByYear = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const scenario of SCENARIOS) {
      const year = scenario.detectedAt.slice(0, 4);
      map.set(year, [...(map.get(year) ?? []), scenario.reference]);
    }
    return map;
  }, []);

  if (macro.data === null) {
    return (
      <Panel title="Growth trend" meta="reported" className={className}>
        <Skeleton className="m-3 h-48 w-full" />
      </Panel>
    );
  }

  if (entries.length === 0) {
    return (
      <Panel title="Growth trend" meta="reported" className={className}>
        <NoVerifiedData
          title="Growth trend"
          domain={`World Bank real GDP growth for ${nodeId ? getNode(nodeId).label : "this selection"}`}
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Growth trend"
      meta={`${entries.length} ${entries.length === 1 ? "economy" : "economies"} · reported`}
      className={cn("min-w-0", className)}
    >
      <div className="space-y-1 border-b border-rule px-3 py-2">
        <SourceLine
          provenance={entries[0].latest.provenance}
        />
        <SourceNote note="Annual real GDP growth, exactly as reported. Revisions land without notice and the most recent year is often partial." />
      </div>

      <div className="min-w-0 overflow-x-auto px-3 py-3">
        <div className="min-w-[420px] space-y-3">
          {entries.map((entry) => (
            <SeriesChart
              key={entry.nodeId}
              label={getNode(entry.nodeId).label ?? entry.nodeId}
              years={entry.history.map((h) => h.period ?? "")}
              values={entry.history.map((h) => h.value)}
              eventsByYear={eventsByYear}
            />
          ))}
        </div>
      </div>

      <div className="space-y-1.5 border-t border-rule px-3 py-2">
        <StatusBadge status="scenario" />
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Dashed markers are years in which this scenario corpus dates an event.
          A marker beside a growth reading shows the two happened in the same
          period. That is a correlation in time, not a demonstrated cause — the
          model does not claim the event produced the reading.
        </p>
      </div>
    </Panel>
  );
}

function SeriesChart({
  label,
  years,
  values,
  eventsByYear,
}: {
  label: string;
  years: string[];
  values: number[];
  eventsByYear: Map<string, string[]>;
}) {
  const W = 420;
  const H = 96;
  const padL = 30;
  const padB = 16;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (i: number) =>
    padL + (i / Math.max(1, years.length - 1)) * (W - padL - 6);
  const y = (v: number) => H - padB - ((v - min) / span) * (H - padB - 8);

  const line = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const marked = years
    .map((year, i) => ({ year, i }))
    .filter((p) => eventsByYear.has(p.year));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px]">{label}</span>
        <span className="num text-[11px] text-muted-foreground">
          {values[values.length - 1].toFixed(1)}% in {years[years.length - 1]}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 h-[96px] w-full"
        role="img"
        aria-label={`Reported annual real GDP growth for ${label} from ${years[0]} to ${years[years.length - 1]}.`}
      >
        {marked.map((p) => (
          <line
            key={p.year}
            x1={x(p.i)}
            y1={4}
            x2={x(p.i)}
            y2={H - padB + 2}
            stroke="var(--signal)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.7}
          >
            <title>
              {`${p.year}: ${eventsByYear.get(p.year)?.join(", ")} — timing only, not a cause`}
            </title>
          </line>
        ))}
        <line
          x1={padL}
          y1={y(0)}
          x2={W - 6}
          y2={y(0)}
          stroke="var(--rule)"
          strokeWidth={1}
        />
        <polyline
          points={line}
          fill="none"
          stroke="var(--foreground)"
          strokeWidth={1.4}
          vectorEffect="non-scaling-stroke"
        />
        {values.map((v, i) => (
          <circle
            key={years[i]}
            cx={x(i)}
            cy={y(v)}
            r={1.8}
            fill="var(--foreground)"
          >
            <title>{`${years[i]}: ${v.toFixed(2)}% reported`}</title>
          </circle>
        ))}
        <text x={2} y={y(max) + 4} className="num" fill="var(--muted-foreground)" style={{ fontSize: 8 }}>
          {max.toFixed(1)}
        </text>
        <text
          x={2}
          y={y(min) + 3}
          className="num"
          fill="var(--muted-foreground)"
          style={{ fontSize: 8 }}
        >
          {min.toFixed(1)}
        </text>
        <text
          x={padL}
          y={H - 3}
          className="num"
          fill="var(--muted-foreground)"
          style={{ fontSize: 8 }}
        >
          {years[0]}
        </text>
        <text
          x={W - 6}
          y={H - 3}
          textAnchor="end"
          className="num"
          fill="var(--muted-foreground)"
          style={{ fontSize: 8 }}
        >
          {years[years.length - 1]}
        </text>
      </svg>
    </div>
  );
}