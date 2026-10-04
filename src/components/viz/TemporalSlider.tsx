import { useMemo, useState, type ReactNode } from "react";
import { Panel } from "@/components/viz/core";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { cn } from "@/lib/utils";

/**
 * Step through a real series in time.
 *
 * The slider never interpolates and never invents a point it does not have: it
 * moves between observations that actually exist, and the marker sits on the
 * axis at the timestamp of the reading being shown. What the axis means is
 * always stated next to it, because a scrubber over invented history would be
 * indistinguishable from one over reported history.
 */

export interface TemporalPoint {
  at: number;
  value: number;
  /** Human label for the reading itself, not for the date. */
  note?: string;
}

export interface TemporalSeries {
  title: string;
  /** What one step along the axis means, in words. */
  axisLabel: string;
  /** Why this series is being replayed. */
  caption: string;
  points: TemporalPoint[];
  format: (value: number) => string;
  /** Draw against a zero line, for series that can go negative. */
  zeroBased?: boolean;
  /** Optional rendered content shown beside the readout. */
  aside?: ReactNode;
}

const shortTime = (ms: number) =>
  new Date(ms).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export function TemporalSlider({
  series,
  className,
}: {
  series: TemporalSeries;
  className?: string;
}) {
  const points = series.points;
  const lastIndex = Math.max(0, points.length - 1);
  const [index, setIndex] = useState(lastIndex);

  const bounded = Math.min(index, lastIndex);
  const current = points[bounded];

  const scale = useMemo(() => {
    const values = points.map((p) => p.value);
    const max = Math.max(...values, series.zeroBased ? 0 : -Infinity);
    const min = Math.min(...values, series.zeroBased ? 0 : Infinity);
    const span = max - min || 1;
    return { max, min, span };
  }, [points, series.zeroBased]);

  if (points.length < 2) {
    return (
      <Panel title={series.title} meta={series.axisLabel} className={className}>
        <NoVerifiedData
          title={series.title}
          domain={`a series long enough to step through (${series.axisLabel.toLowerCase()})`}
        />
      </Panel>
    );
  }

  const w = 100;
  const h = 100;
  const y = (v: number) => h - 6 - ((v - scale.min) / scale.span) * (h - 12);
  const x = (i: number) => (i / (points.length - 1)) * w;
  const line = points.map((p, i) => `${x(i).toFixed(2)},${y(p.value).toFixed(2)}`).join(" ");
  const area = `0,${h} ${line} ${w},${h}`;

  return (
    <Panel
      title={series.title}
      meta={`stepping through ${points.length} observations`}
      className={cn("min-w-0", className)}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule px-3 py-2.5">
        <div>
          <p className="label text-muted-foreground">At this point</p>
          <p className="num mt-1 text-[17px] leading-none font-semibold">
            {series.format(current.value)}
          </p>
        </div>
        <div className="text-right">
          <p className="num text-[12px] text-foreground/85">{shortTime(current.at)}</p>
          {current.note ? (
            <p className="mt-0.5 text-[12px] text-muted-foreground">{current.note}</p>
          ) : null}
        </div>
      </div>

      <div className="px-3 pt-3">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="h-[70px] w-full"
          aria-hidden
        >
          <polygon points={area} fill="var(--signal)" opacity={0.1} />
          {series.zeroBased ? (
            <line
              x1={0}
              y1={y(0)}
              x2={w}
              y2={y(0)}
              stroke="var(--rule)"
              strokeWidth={0.6}
              vectorEffect="non-scaling-stroke"
            />
          ) : null}
          <polyline
            points={line}
            fill="none"
            stroke="var(--signal)"
            strokeWidth={1.4}
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1={x(bounded)}
            y1={0}
            x2={x(bounded)}
            y2={h}
            stroke="var(--foreground)"
            strokeWidth={0.8}
            opacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
          <circle
            cx={x(bounded)}
            cy={y(current.value)}
            r={1.6}
            fill="var(--foreground)"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>

      <div className="px-3 pt-2 pb-3">
        <input
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={bounded}
          onChange={(e) => setIndex(Number(e.target.value))}
          aria-label={series.axisLabel}
          className="h-1 w-full cursor-pointer appearance-none bg-rule accent-[var(--signal)]"
        />
        <div className="mt-1.5 flex items-baseline justify-between">
          <span className="num text-[12px] text-muted-foreground">
            {shortTime(points[0].at)}
          </span>
          <span className="label text-muted-foreground">{series.axisLabel}</span>
          <span className="num text-[12px] text-muted-foreground">
            {shortTime(points[points.length - 1].at)}
          </span>
        </div>
        <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
          {series.caption}
        </p>
      </div>
    </Panel>
  );
}