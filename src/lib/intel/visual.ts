import type { Channel, RiskBand } from "@/lib/intel/types";

/**
 * Shared visual vocabulary.
 *
 * Every colour here maps to a meaning, never to decoration: the risk ramp is
 * calibrated to the same band thresholds the engine uses, so a colour on a
 * gauge and a band chip always agree.
 */

export const RISK_COLOR: Record<RiskBand, string> = {
  low: "var(--stable)",
  moderate: "var(--warning)",
  elevated: "var(--elevated)",
  high: "var(--critical)",
  severe: "var(--signal)",
};

export const RISK_FILL: Record<RiskBand, string> = {
  low: "color-mix(in oklch, var(--stable) 26%, transparent)",
  moderate: "color-mix(in oklch, var(--warning) 26%, transparent)",
  elevated: "color-mix(in oklch, var(--elevated) 28%, transparent)",
  high: "color-mix(in oklch, var(--critical) 30%, transparent)",
  severe: "color-mix(in oklch, var(--signal) 34%, transparent)",
};

/** Channels get a stable hue so the same channel is the same colour everywhere. */
export const CHANNEL_COLOR: Record<Channel, string> = {
  energy: "var(--elevated)",
  trade: "var(--cyan)",
  finance: "var(--chart-5)",
  diplomatic: "var(--stable)",
};

/** Node category glyphs — distinct shape, restrained colour. */
export const KIND_GLYPH: Record<string, string> = {
  economy: "circle",
  bloc: "square",
  chokepoint: "diamond",
  corridor: "triangle",
  institution: "circle",
};

export function riskColorForScore(score: number): string {
  if (score >= 65) return RISK_COLOR.severe;
  if (score >= 52) return RISK_COLOR.high;
  if (score >= 42) return RISK_COLOR.elevated;
  if (score >= 30) return RISK_COLOR.moderate;
  return RISK_COLOR.low;
}

export function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/** Equirectangular projection into an SVG viewBox. */
export function project(
  lat: number,
  lon: number,
  width: number,
  height: number,
): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * width,
    y: ((90 - lat) / 180) * height,
  };
}

/** Great-circle-ish arc for flow edges; bows away from the equator. */
export function arcPath(
  a: { x: number; y: number },
  b: { x: number; y: number },
  lift = 0.22,
): string {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy) || 1;
  const nx = -dy / dist;
  const ny = dx / dist;
  const bow = dist * lift;
  return `M ${a.x.toFixed(1)} ${a.y.toFixed(1)} Q ${(mx + nx * bow).toFixed(1)} ${(my + ny * bow).toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
}