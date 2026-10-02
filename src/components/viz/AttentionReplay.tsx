import { Panel } from "@/components/viz/core";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { SourceNote } from "@/components/viz/Provenance";
import { TemporalSlider, type TemporalPoint } from "@/components/viz/TemporalSlider";
import { useAttentionData, type AttentionPoint } from "@/hooks/use-verified-data";
import { WINDOW_MS, useFocus } from "@/lib/focus";

/**
 * Step through the last hours of measured coverage.
 *
 * This is the only honest kind of time axis available in this build: real
 * hours, with real counts behind every position, taken from the media index's
 * own hourly volume series. It is attention, not events — the caption under the
 * slider says so every time it is shown.
 */
export function AttentionReplay({ className }: { className?: string }) {
  const attention = useAttentionData();
  const { window: windowId } = useFocus();

  // The window chosen on the live-change timeline narrows the replay too, so
  // one control describes the same period in both places.
  const span = WINDOW_MS[windowId];
  const all = hourlySeries(attention.data ?? []);
  const newest = all.length > 0 ? all[all.length - 1].at : 0;
  const points = all.filter((p) => p.at >= newest - span);

  if (points.length < 2) {
    return (
      <Panel
        title="Replay the last hours"
        meta="measured coverage"
        className={className}
      >
        <NoVerifiedData
          title="Hourly coverage"
          domain={`hourly attention in the last ${windowId}`}
          action={
            <SourceNote
              note={
                attention.refreshing
                  ? "Contacting the media index now."
                  : (attention.problem ??
                    `Not enough hourly coverage is stored inside the last ${windowId}. Widen the window on the live-change timeline to see more.`)
              }
            />
          }
        />
      </Panel>
    );
  }

  return (
    <TemporalSlider
      className={className}
      series={{
        title: "Replay the last hours",
        axisLabel: `one step = one hour · last ${windowId}`,
        caption:
          "How much news coverage the watched topics were receiving, hour by hour, as measured by the GDELT media index. It measures attention, not events — a spike can be a press conference.",
        format: (v) => `${Math.round(v).toLocaleString("en-GB")} mentions`,
        points,
      }}
    />
  );
}

/** All watched topics summed into one hourly series, oldest first. */
export function hourlySeries(points: AttentionPoint[]): TemporalPoint[] {
  const totals = new Map<number, number>();
  for (const p of points) {
    const hour = parseHour(p.at);
    if (!Number.isFinite(hour)) continue;
    totals.set(hour, (totals.get(hour) ?? 0) + p.attention);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, value]) => ({ at, value }));
}

function parseHour(stamp: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})\d{2}\d{2}Z?$/.exec(stamp);
  if (!m) return NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]));
}