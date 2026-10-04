import type { ReactNode } from "react";
import {
  RISK_COLOR,
  RISK_FILL,
  riskColorForScore,
} from "@/lib/intel/visual";
import {
  BAND_LABEL,
  CHANNEL_LABEL,
  RISK_BANDS,
  type Channel,
  type RiskBand,
} from "@/lib/intel/types";
import { cn } from "@/lib/utils";

/* Shared primitives, re-pointed at the dark workstation tokens.
   Retained so existing pages inherit the new theme without a rewrite. */

export function Label({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("label text-muted-foreground", className)}>{children}</span>
  );
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-rule", className)} />;
}

/** Compact editorial numeral. Never a hero-scale number inside the console. */
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
    <span className={cn("exec-num text-[1.75rem] leading-none font-semibold tracking-[-0.02em]", className)}>
      {value}
      {suffix ? (
        <span className="ml-1 text-[12px] font-normal text-muted-foreground">
          {suffix}
        </span>
      ) : null}
    </span>
  );
}

export function Meter({
  value,
  tone = "foreground",
  className,
}: {
  value: number;
  /** `ink` / `blue` are legacy aliases kept for screens predating the new ramp. */
  tone?: "foreground" | "ink" | "signal" | "cyan" | "blue" | "stable";
  className?: string;
}) {
  const colour =
    tone === "signal"
      ? "var(--signal)"
      : tone === "cyan" || tone === "blue"
        ? "var(--cyan)"
        : tone === "stable"
          ? "var(--stable)"
          : "var(--foreground)";
  return (
    <div className={cn("h-1 w-full bg-[var(--exec-surface)]", className)}>
      <div
        className="h-full transition-[width] duration-500"
        style={{
          width: `${Math.min(100, Math.max(0, value * 100))}%`,
          backgroundColor: colour,
        }}
      />
    </div>
  );
}

/** Band chip. Colour is derived from the engine's own band thresholds. */
export function BandChip({ band }: { band: RiskBand }) {
  return (
    <span
      className="chip"
      style={{
        color: RISK_COLOR[band],
        backgroundColor: RISK_FILL[band],
        borderColor: "transparent",
      }}
    >
      {BAND_LABEL[band]}
    </span>
  );
}

/**
 * Interval bar: central estimate with its 80% range drawn around it.
 * Uncertainty is always visible, never implied.
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

  return (
    <div className={cn("relative h-5 w-full bg-[var(--exec-surface)]", className)}>
      {showTicks ? (
        <div className="pointer-events-none absolute inset-0 flex justify-between">
          {[0, 25, 50, 75, 100].map((t) => (
            <span key={t} className="h-full w-px bg-[var(--exec-surface)]" />
          ))}
        </div>
      ) : null}
      <div
        className="absolute top-1/2 h-1.5 -translate-y-1/2"
        style={{
          left: `${left}%`,
          width: `${width}%`,
          backgroundColor: RISK_COLOR[band],
        }}
      />
      <div
        className="absolute top-0 h-full w-[2px] bg-foreground"
        style={{ left: `${marker}%` }}
      />
    </div>
  );
}

/** Cumulative evidence-mass trend. */
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
  const height = 24;
  const max = Math.max(...series, 0.0001);
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = height - 2 - (v / max) * (height - 4);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const area = `0,${height} ${points} 100,${height}`;

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <polygon points={area} fill={stroke} opacity={0.14} />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Per-channel micro-bars used in list rows. */
export function ChannelBars({
  pressure,
  className,
}: {
  pressure: Record<Channel, number>;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-4 gap-px", className)}>
      {(Object.keys(pressure) as Channel[]).map((channel) => {
        const value = pressure[channel];
        return (
          <div key={channel} className="space-y-1">
            <div className="flex h-5 w-full flex-col justify-end bg-[var(--exec-surface)]">
              <div
                className="w-full transition-[height] duration-500"
                style={{
                  height: `${Math.max(2, value * 100)}%`,
                  backgroundColor: value > 0.55 ? "var(--signal)" : "var(--foreground)",
                }}
              />
            </div>
            <span className="label text-[12px] text-muted-foreground">
              {CHANNEL_LABEL[channel].slice(0, 3).toUpperCase()}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/** Heat cell for the event × channel matrix. */
export function HeatCell({ value }: { value: number }) {
  const intensity = value <= 0.001 ? 0 : Math.min(1, value);
  return (
    <div
      className="relative min-h-9 w-full"
      style={{
        backgroundColor:
          intensity === 0
            ? "var(--rule)"
            : `color-mix(in oklch, ${riskColorForScore(intensity * 100)} ${Math.round(
                16 + intensity * 72,
              )}%, var(--card))`,
      }}
      title={`${(intensity * 100).toFixed(0)}% pressure`}
    >
      <span
        className={cn(
          "num absolute inset-0 flex items-center justify-center text-[12px]",
          intensity > 0.55 ? "text-background" : "text-muted-foreground",
        )}
      >
        {intensity === 0 ? "—" : Math.round(intensity * 100)}
      </span>
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-2">
      <span className="label text-muted-foreground">Low</span>
      <div className="flex gap-px">
        {[0, 0.25, 0.5, 0.75, 1].map((s) => (
          <span
            key={s}
            className="h-2.5 w-5"
            style={{
              backgroundColor:
                s === 0
                  ? "var(--rule)"
                  : `color-mix(in oklch, ${riskColorForScore(s * 100)} ${Math.round(
                      16 + s * 72,
                    )}%, var(--card))`,
            }}
          />
        ))}
      </div>
      <span className="label text-muted-foreground">Severe</span>
    </div>
  );
}

export function BandScale({ band }: { band: RiskBand }) {
  const index = RISK_BANDS.indexOf(band);
  return (
    <div className="flex gap-px">
      {RISK_BANDS.map((b, i) => (
        <span
          key={b}
          className="h-1.5 w-5"
          style={{
            backgroundColor:
              i <= index ? RISK_COLOR[b] : "var(--rule)",
          }}
          title={BAND_LABEL[b]}
        />
      ))}
    </div>
  );
}