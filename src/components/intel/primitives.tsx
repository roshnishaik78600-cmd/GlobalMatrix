import type { ReactNode } from "react";
import { CHANNEL_LABEL, RISK_BANDS, BAND_LABEL, type Channel, type RiskBand } from "@/lib/intel/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Shared Swiss primitives.
 * Square corners, hairline rules, tabular numerals, one accent colour.
 * ------------------------------------------------------------------ */

export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cn("label text-muted-foreground", className)}>{children}</span>;
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-rule", className)} />;
}

/** Big editorial numeral. */
export function Figure({
  value,
  suffix,
  className,
}: {
  value: string | number;
  suffix?: string;
  className?: string;
}) {
  return (
    <span className={cn("num display text-[2.75rem] leading-none", className)}>
      {value}
      {suffix ? (
        <span className="ml-1 align-super text-[0.9rem] font-medium tracking-normal">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

/** Proportion bar drawn as a flat rectangle. */
export function Meter({
  value,
  tone = "ink",
  className,
}: {
  value: number;
  tone?: "ink" | "signal" | "blue";
  className?: string;
}) {
  const colour =
    tone === "signal"
      ? "bg-signal"
      : tone === "blue"
        ? "bg-[oklch(0.44_0.185_262)]"
        : "bg-ink";
  return (
    <div className={cn("h-1.5 w-full bg-rule", className)}>
      <div
        className={cn("h-full origin-left animate-sweep", colour)}
        style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
      />
    </div>
  );
}

/** Risk band chip. Severity is carried by the colour chip alone. */
export function BandChip({ band }: { band: RiskBand }) {
  const intensity: Record<RiskBand, string> = {
    low: "bg-ink/15 text-ink",
    moderate: "bg-[oklch(0.72_0.13_70)] text-ink",
    elevated: "bg-[oklch(0.63_0.2_45)] text-white",
    high: "bg-signal text-white",
    severe: "bg-signal text-white ring-1 ring-ink ring-offset-2 ring-offset-paper",
  };
  return (
    <span
      className={cn(
        "label inline-flex items-center px-2 py-1 text-[9px]",
        intensity[band],
      )}
    >
      {BAND_LABEL[band]}
    </span>
  );
}

/**
 * The interval bar: the model's central estimate with its 80% range drawn
 * around it. Uncertainty is therefore always visible, never implied.
 */
export function IntervalBar({
  score,
  low,
  high,
  band,
  showTicks = true,
  className,
}: {
  score: number;
  low: number;
  high: number;
  band: RiskBand;
  showTicks?: boolean;
  className?: string;
}) {
  const left = Math.max(0, Math.min(100, low));
  const width = Math.max(1.5, Math.min(100 - left, high - low));
  const marker = Math.max(0, Math.min(100, score));
  const colour =
    band === "severe" || band === "high"
      ? "bg-signal"
      : band === "elevated"
        ? "bg-[oklch(0.63_0.2_45)]"
        : band === "moderate"
          ? "bg-[oklch(0.72_0.13_70)]"
          : "bg-ink";

  return (
    <div className={cn("relative h-6 w-full bg-rule/50", className)}>
      {showTicks ? (
        <div className="pointer-events-none absolute inset-0 flex justify-between">
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} className="h-full w-px bg-rule" />
          ))}
        </div>
      ) : null}
      <div
        className={cn("absolute top-1/2 h-2 -translate-y-1/2", colour)}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
      <div
        className="absolute top-0 h-full w-[2px] bg-ink"
        style={{ left: `${marker}%` }}
      />
    </div>
  );
}

/** Cumulative evidence-mass sparkline for the detection feed. */
export function Sparkline({
  series,
  className,
  stroke = "var(--foreground)",
}: {
  series: number[];
  className?: string;
  stroke?: string;
}) {
  if (series.length < 2) return null;
  const max = Math.max(...series, 0.0001);
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = 26 - (v / max) * 24;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `0,26 ${points} 100,26`;

  return (
    <svg
      viewBox="0 0 100 26"
      preserveAspectRatio="none"
      className={cn("h-6 w-full", className)}
      aria-hidden="true"
    >
      <polygon points={area} fill="var(--foreground)" opacity="0.08" />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Compact per-channel pressure readout used in list rows and board cells. */
export function ChannelBars({
  pressure,
  className,
}: {
  pressure: Record<Channel, number>;
  className?: string;
}) {
  const entries = (Object.keys(pressure) as Channel[]).map((c) => [
    c,
    pressure[c],
  ]) as [Channel, number][];

  return (
    <div className={cn("grid grid-cols-4 gap-px", className)}>
      {entries.map(([channel, value]) => (
        <div key={channel} className="space-y-1">
          <div className="flex h-6 w-full flex-col justify-end bg-rule/60">
            <div
              className="w-full bg-ink"
              style={{ height: `${Math.max(2, value * 100)}%` }}
            />
          </div>
          <span className="label text-[8px] text-muted-foreground">
            {CHANNEL_LABEL[channel].slice(0, 3).toUpperCase()}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Heat-cell used by the risk board matrix. */
export function HeatCell({ value }: { value: number }) {
  const intensity = value <= 0.001 ? 0 : Math.min(1, value);
  const style =
    intensity === 0
      ? { backgroundColor: "var(--rule)" }
      : {
          backgroundColor: `color-mix(in oklch, var(--signal) ${Math.round(
            12 + intensity * 88,
          )}%, var(--paper))`,
        };
  return (
    <div
      className="relative h-full min-h-9 w-full"
      style={style}
      title={`${(intensity * 100).toFixed(0)}% pressure`}
    >
      <span
        className={cn(
          "num absolute inset-0 flex items-center justify-center text-[10px]",
          intensity > 0.55 ? "text-white" : "text-ink/70",
        )}
      >
        {intensity === 0 ? "—" : Math.round(intensity * 100)}
      </span>
    </div>
  );
}

/** Legend for the matrix intensity ramp. */
export function HeatLegend() {
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="flex items-center gap-2">
      <span className="label text-muted-foreground">Low</span>
      <div className="flex gap-px">
        {steps.map((s) => (
          <span
            key={s}
            className="h-2.5 w-6"
            style={{
              backgroundColor:
                s === 0
                  ? "var(--rule)"
                  : `color-mix(in oklch, var(--signal) ${Math.round(12 + s * 88)}%, var(--paper))`,
            }}
          />
        ))}
      </div>
      <span className="label text-muted-foreground">Severe</span>
    </div>
  );
}

/** Ordered band scale used as a key next to the headline score. */
export function BandScale({ band }: { band: RiskBand }) {
  const index = RISK_BANDS.indexOf(band);
  return (
    <div className="flex gap-px">
      {RISK_BANDS.map((b, i) => (
        <span
          key={b}
          className={cn(
            "h-1.5 w-6",
            i <= index ? (i >= 3 ? "bg-signal" : "bg-ink") : "bg-rule",
          )}
          title={BAND_LABEL[b]}
        />
      ))}
    </div>
  );
}