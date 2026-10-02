import type { Channel } from "@/lib/intel/types";
import { CHANNEL_CODE, CHANNEL_LABEL } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";

/**
 * Node risk radar.
 *
 * Four axes, one polygon: how a single place is exposed across trade, energy,
 * finance and diplomacy at once. A bar per channel can only ever say "this
 * channel is high" — the radar says the shape of the exposure, which is the
 * thing an analyst actually compares between countries.
 */
export function NodeRiskRadar({
  pressure,
  size = 108,
  className = "",
}: {
  pressure: Partial<Record<Channel, number>>;
  size?: number;
  className?: string;
}) {
  const axes: Channel[] = ["trade", "energy", "finance", "diplomatic"];
  const cx = size / 2;
  const cy = size / 2 + 2;
  const r = size / 2 - 15;

  const value = (c: Channel) => Math.max(0, Math.min(1, pressure[c] ?? 0));
  const peak = Math.max(...axes.map(value), 0.01);
  const point = (i: number, ratio: number) => {
    const angle = (i / axes.length) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * r * ratio, cy + Math.sin(angle) * r * ratio];
  };

  const polygon = axes.map((c, i) => point(i, value(c)).join(",")).join(" ");
  const fillColour = riskColorForScore(peak * 100);

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ width: size, height: size }}
      role="img"
      aria-label={axes
        .map(
          (c) =>
            `${CHANNEL_LABEL[c]} ${Math.round(value(c) * 100)} percent of the modelled ceiling`,
        )
        .join(", ")}
    >
      {/* Grid rings and spokes: three rings is enough to read shape without
          competing with the polygon for attention. */}
      {[0.33, 0.66, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes.map((_, i) => point(i, ring).join(",")).join(" ")}
          fill="none"
          stroke="var(--exec-hairline)"
          strokeWidth={0.8}
        />
      ))}
      {axes.map((_, i) => {
        const [x, y] = point(i, 1);
        return (
          <line
            key={i}
            x1={cx}
            y1={cy}
            x2={x}
            y2={y}
            stroke="var(--exec-hairline)"
            strokeWidth={0.8}
          />
        );
      })}

      <polygon
        points={polygon}
        fill={`color-mix(in srgb, ${fillColour} 26%, transparent)`}
        stroke={fillColour}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
      {axes.map((c, i) => {
        const [x, y] = point(i, value(c));
        return <circle key={c} cx={x} cy={y} r={1.9} fill={fillColour} />;
      })}

      {axes.map((c, i) => {
        const [x, y] = point(i, 1.2);
        const active = value(c) === peak;
        return (
          <text
            key={c}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="exec-num"
            fill={active ? "var(--exec-ink)" : "var(--exec-ink-dim)"}
            style={{ fontSize: 8.5, letterSpacing: "0.08em", fontWeight: 600 }}
          >
            {CHANNEL_CODE[c]}
          </text>
        );
      })}
    </svg>
  );
}

/** The same four numbers as text, for readers who cannot use the shape. */
export function RadarLegend({
  pressure,
  className = "",
}: {
  pressure: Partial<Record<Channel, number>>;
  className?: string;
}) {
  const axes: Channel[] = ["trade", "energy", "finance", "diplomatic"];
  return (
    <dl className={`grid grid-cols-4 gap-1 ${className}`}>
      {axes.map((c) => {
        const v = Math.max(0, Math.min(1, pressure[c] ?? 0));
        return (
          <div key={c} className="min-w-0">
            <dt className="exec-label">{CHANNEL_CODE[c]}</dt>
            <dd
              className="exec-num mt-0.5 text-[12px] font-semibold"
              style={{ color: v > 0.001 ? riskColorForScore(v * 100) : "var(--exec-ink-dim)" }}
            >
              {Math.round(v * 100)}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}