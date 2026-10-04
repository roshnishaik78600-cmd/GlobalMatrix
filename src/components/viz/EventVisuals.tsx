import { useMemo, useState } from "react";
import type { EventAssessment } from "@/lib/intel/types";
import { Panel } from "@/components/viz/core";
import { WorldMap, MapLegend } from "@/components/viz/WorldMap";
import { riskColorForScore } from "@/lib/intel/visual";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { cn } from "@/lib/utils";

/**
 * An event, shown.
 *
 * Two pictures do the work that a paragraph of prose does badly: how the score
 * moves as the horizon lengthens, and where on the planet it actually lands.
 * Both read straight off the assessment that is already published on the event
 * page, so the analyst's charts and its text cannot drift apart.
 */

/** Score by horizon, with the 80% interval drawn as the width of the mark. */
export function RiskTrajectory({
  assessment,
  className,
}: {
  assessment: EventAssessment;
  className?: string;
}) {
  const horizons = [7, 30, 90];
  const marks = horizons.map((h) => assessment.risk[h]).filter(Boolean);

  return (
    <Panel
      title="Risk by horizon"
      meta="80% interval shown as bar width"
      className={cn("min-w-0", className)}
    >
      <ul className="divide-y divide-rule">
        {marks.map((r) => (
          <li key={r.horizonDays} className="px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="label text-muted-foreground">
                {r.horizonDays} days out
              </span>
              <span
                className="num text-[13px] font-semibold"
                style={{ color: riskColorForScore(r.score) }}
              >
                {r.score.toFixed(1)}
              </span>
            </div>
            <div className="relative mt-2 h-2.5 w-full bg-[var(--exec-surface)]">
              <span
                className="absolute top-0 h-full"
                style={{
                  left: `${Math.max(0, (r.low / 100) * 100)}%`,
                  width: `${Math.max(2, ((r.high - r.low) / 100) * 100)}%`,
                  backgroundColor: `color-mix(in oklch, ${riskColorForScore(r.score)} 32%, transparent)`,
                }}
              />
              <span
                className="absolute top-0 h-full w-[2px]"
                style={{
                  left: `${Math.min(99.5, (r.score / 100) * 100)}%`,
                  backgroundColor: riskColorForScore(r.score),
                }}
              />
            </div>
            <p className="num mt-1 text-[12px] text-muted-foreground">
              80% interval {r.low.toFixed(0)}–{r.high.toFixed(0)} · wider means
              less certain, not worse
            </p>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Where the event lands, on real country geometry. */
export function EventFootprintMap({
  assessment,
  className,
}: {
  assessment: EventAssessment;
  className?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const nodes = useMemo(() => {
    const byNode = new Map<string, number>();
    for (const pathway of assessment.scenario.pathways) {
      for (const exposure of pathway.exposures) {
        const term = exposure.impact * pathway.magnitude * pathway.confidence;
        byNode.set(exposure.nodeId, (byNode.get(exposure.nodeId) ?? 0) + term);
      }
    }
    const max = Math.max(...byNode.values(), 0.0001);
    return [...byNode.entries()].map(([nodeId, load]) => ({
      nodeId,
      label: nodeId,
      load: load / max,
      eventCount: 0,
      criticality: 0,
    }));
  }, [assessment]);

  const channels = Object.entries(assessment.channelPressure)
    .filter(([, value]) => value > 0.01)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Panel
      title="Where it lands"
      meta={`${nodes.length} exposed places`}
      className={cn("min-w-0", className)}
    >
      <WorldMap
        nodes={nodes}
        height={300}
        selected={selected}
        onSelect={(id) => setSelected(id === selected ? null : id)}
      />
      <div className="border-t border-rule">
        <MapLegend />
      </div>
      {channels.length > 0 ? (
        <div className="border-t border-rule px-3 py-2">
          <p className="label text-muted-foreground">Transmission channels</p>
          <ul className="mt-1.5 space-y-1">
            {channels.map(([channel, value]) => (
              <li key={channel} className="flex items-center gap-2">
                <span className="w-20 shrink-0 text-[12px]">
                  {CHANNEL_LABEL[channel as Channel]}
                </span>
                <span className="h-1.5 flex-1 bg-[var(--exec-surface)]">
                  <span
                    className="block h-full"
                    style={{
                      width: `${Math.min(100, value * 100)}%`,
                      backgroundColor: riskColorForScore(value * 100),
                    }}
                  />
                </span>
                <span className="num w-8 shrink-0 text-right text-[12px] text-muted-foreground">
                  {(value * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  );
}