import { cn } from "@/lib/utils";

/**
 * Structural fragility, as a half-dial.
 *
 * A percentage alone hides whether the number is moving. The dial gives the
 * band instantly; the trace behind it gives direction. Where no trend series
 * exists the trace is absent rather than drawn flat, because a flat line is a
 * claim — "unchanged" — and we do not have one.
 */

export type FragilityBand = "low" | "moderate" | "high";

export function fragilityBand(value: number): FragilityBand {
  if (value >= 0.75) return "high";
  if (value >= 0.4) return "moderate";
  return "low";
}

const BAND_COLOUR: Record<FragilityBand, string> = {
  high: "var(--exec-crimson)",
  moderate: "var(--exec-amber)",
  low: "var(--exec-emerald)",
};

const BAND_LABEL: Record<FragilityBand, string> = {
  high: "High",
  moderate: "Moderate",
  low: "Low",
};

export function FragilityArc({
  value,
  trend,
  size = 116,
  className,
}: {
  /** 0..1 structural fragility. */
  value: number;
  /** Optional daily series; oldest first. Drives direction only. */
  trend?: number[];
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, value));
  const band = fragilityBand(clamped);
  const colour = BAND_COLOUR[band];

  const w = size;
  const h = size * 0.62;
  const cx = w / 2;
  const cy = h - 6;
  const r = Math.min(cx, cy) - 8;

  // Half-dial: 180° across the top.
  const angle = Math.PI * (1 - clamped);
  const endX = cx + Math.cos(angle) * r;
  const endY = cy - Math.sin(angle) * r;

  const direction = trendDirection(trend);
  const pathId = `frag-${band}`;

  return (
    <div className={cn("relative", className)} style={{ width: w }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        style={{ width: w, height: h }}
        role="img"
        aria-label={`Structural fragility ${(clamped * 100).toFixed(0)} percent, ${BAND_LABEL[band].toLowerCase()} risk`}
      >
        <defs>
          <linearGradient id={pathId} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--exec-emerald)" />
            <stop offset="45%" stopColor="var(--exec-amber)" />
            <stop offset="100%" stopColor="var(--exec-crimson)" />
          </linearGradient>
        </defs>

        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke="var(--exec-hairline)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* The filled portion uses the gradient but is masked to the reading,
            so the dial colour always agrees with the band thresholds. */}
        <path
          d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
          fill="none"
          stroke={`url(#${pathId})`}
          strokeWidth={6}
          strokeLinecap="round"
          strokeDasharray={`${clamped * Math.PI * r} ${Math.PI * r}`}
        />
        <circle cx={endX} cy={endY} r={3} fill={colour} />

        {trend && trend.length > 1 ? (
          <TrendTrace values={trend} x={cx} y={cy - 4} width={r * 1.7} />
        ) : null}

        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          className="exec-num"
          fill="var(--exec-ink)"
          style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}
        >
          {(clamped * 100).toFixed(0)}%
        </text>
        <text
          x={cx}
          y={cy + 8}
          textAnchor="middle"
          className="exec-label"
          style={{ fontSize: 12 }}
        >
          {BAND_LABEL[band]}
          {direction ? ` · ${direction}` : ""}
        </text>
      </svg>
    </div>
  );
}

/** Up, down or flat, measured on the mean of the first and last thirds. */
function trendDirection(trend?: number[]): "rising" | "easing" | "flat" | null {
  if (!trend || trend.length < 4) return null;
  const third = Math.max(1, Math.floor(trend.length / 3));
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const head = mean(trend.slice(0, third));
  const tail = mean(trend.slice(-third));
  if (head === 0 && tail === 0) return "flat";
  const change = (tail - head) / Math.max(head, 0.05);
  if (change > 0.15) return "rising";
  if (change < -0.15) return "easing";
  return "flat";
}

/** The 14-day trace, drawn behind the number as direction only. */
function TrendTrace({
  values,
  x,
  y,
  width,
}: {
  values: number[];
  x: number;
  y: number;
  width: number;
}) {
  const max = Math.max(...values, 0.0001);
  const w = width;
  const h = 16;
  const left = x - w / 2;
  const top = y - h;
  const points = values
    .map((v, i) => {
      const px = left + (i / Math.max(1, values.length - 1)) * w;
      const py = top + h - (v / max) * h;
      return `${px.toFixed(1)},${py.toFixed(1)}`;
    })
    .join(" ");
  const last = points.split(" ").slice(-1)[0].split(",");

  return (
    <g aria-hidden>
      <polygon
        points={`${left},${top + h} ${points} ${left + w},${top + h}`}
        fill="color-mix(in srgb, var(--exec-cyan) 10%, transparent)"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--exec-cyan)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
        opacity={0.85}
      />
      <circle cx={last[0]} cy={last[1]} r={1.6} fill="var(--exec-cyan)" />
    </g>
  );
}