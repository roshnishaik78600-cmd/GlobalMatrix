import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { RISK_COLOR, RISK_FILL, clamp01, riskColorForScore } from "@/lib/intel/visual";
import type { RiskBand } from "@/lib/intel/types";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ *
 * Core visualisation primitives. Every one is driven by real values and
 * degrades to an explicit "no data" state rather than inventing content.
 * ------------------------------------------------------------------ */

export function Panel({
  title,
  meta,
  actions,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  meta?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section className={cn("panel flex flex-col", className)}>
      <div className="panel-head">
        <span className="label text-foreground/85">{title}</span>
        <div className="flex items-center gap-3">
          {meta ? (
            <span className="label text-muted-foreground">{meta}</span>
          ) : null}
          {actions}
        </div>
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/** Explicit, non-fabricated empty state. */
export function NoData({
  reason,
  className,
}: {
  reason: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-1.5 px-4 py-8 text-center",
        className,
      )}
    >
      <span className="label text-muted-foreground">No data</span>
      <p className="max-w-xs text-[11px] leading-relaxed text-muted-foreground/80">
        {reason}
      </p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-none", className)} aria-hidden />;
}

/**
 * A panel row that opens in place.
 *
 * Deeper detail should cost one click, not one navigation — otherwise reading
 * past the fourth row means losing everything else on screen. The expansion is
 * a height transition because that is the only motion here that carries
 * meaning: something is now occupying space that was not there before.
 */
export function Expandable({
  summary,
  children,
  defaultOpen = false,
  className,
  openLabel = "Show more",
  closeLabel = "Show less",
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  openLabel?: string;
  closeLabel?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/4"
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <span className="label flex shrink-0 items-center gap-1 text-muted-foreground">
          {open ? closeLabel : openLabel}
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              open && "rotate-180",
            )}
            aria-hidden
          />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/** Compact horizontal meter with a threshold tick. */
export function Bar({
  value,
  max = 1,
  tone,
  className,
  height = 4,
}: {
  value: number;
  max?: number;
  tone?: string;
  className?: string;
  height?: number;
}) {
  const ratio = clamp01(value / (max || 1));
  return (
    <div
      className={cn("w-full bg-white/8", className)}
      style={{ height }}
      role="meter"
      aria-valuenow={Math.round(ratio * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full transition-[width] duration-500"
        style={{
          width: `${ratio * 100}%`,
          backgroundColor: tone ?? "var(--foreground)",
        }}
      />
    </div>
  );
}

/**
 * Risk gauge. Compact by design: a name, a band-coloured meter and the
 * numeric score — never a bare oversized number.
 */
export function Gauge({
  label,
  score,
  band,
  detail,
  className,
}: {
  label: string;
  score: number;
  band: RiskBand;
  detail?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label text-muted-foreground">{label}</span>
        <span className="num text-[13px] font-semibold">{score.toFixed(0)}</span>
      </div>
      <div className="relative">
        <Bar value={score} tone={RISK_COLOR[band]} height={6} />
        <div className="pointer-events-none absolute inset-0 flex justify-between">
          {[0, 1, 2, 3, 4].map((t) => (
            <span key={t} className="h-full w-px bg-white/10" />
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span
          className="chip"
          style={{
            color: RISK_COLOR[band],
            backgroundColor: RISK_FILL[band],
            borderColor: "transparent",
          }}
        >
          {band}
        </span>
        {detail ? (
          <span className="text-[10px] text-muted-foreground">{detail}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Radial domain radar — the "shock radar". */
export function Radar({
  axes,
  size = 220,
  onSelect,
  selected,
}: {
  axes: { label: string; value: number; count?: number }[];
  size?: number;
  onSelect?: (label: string) => void;
  selected?: string | null;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 34;
  const n = axes.length;
  if (n < 3) return null;

  const point = (i: number, ratio: number) => {
    const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(angle) * r * ratio, cy + Math.sin(angle) * r * ratio];
  };

  const poly = axes
    .map((a, i) => point(i, clamp01(a.value)).join(","))
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="w-full"
      role="img"
      aria-label={`Domain activity radar: ${axes
        .map((a) => `${a.label} ${Math.round(a.value * 100)}%`)
        .join(", ")}`}
    >
      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <polygon
          key={ring}
          points={axes
            .map((_, i) => point(i, ring).join(","))
            .join(" ")}
          fill="none"
          stroke="var(--grid)"
          strokeWidth={1}
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
            stroke="var(--grid)"
            strokeWidth={1}
          />
        );
      })}
      <polygon
        points={poly}
        fill="color-mix(in oklch, var(--signal) 22%, transparent)"
        stroke="var(--signal)"
        strokeWidth={1.5}
      />
      {axes.map((a, i) => {
        const [x, y] = point(i, clamp01(a.value));
        const [lx, ly] = point(i, 1.19);
        const active = selected === a.label;
        return (
          <g
            key={a.label}
            className={onSelect ? "cursor-pointer" : undefined}
            onClick={() => onSelect?.(a.label)}
          >
            <circle
              cx={x}
              cy={y}
              r={active ? 4 : 2.5}
              fill={riskColorForScore(a.value * 100)}
            />
            <text
              x={lx}
              y={ly}
              textAnchor="middle"
              dominantBaseline="middle"
              className="label"
              fill={active ? "var(--foreground)" : "var(--muted-foreground)"}
              style={{ fontSize: 9 }}
            >
              {a.label}
            </text>
            <text
              x={lx}
              y={ly + 10}
              textAnchor="middle"
              className="num"
              fill="var(--muted-foreground)"
              style={{ fontSize: 9 }}
            >
              {Math.round(a.value * 100)}
              {a.count !== undefined ? ` · ${a.count}` : ""}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/** Compact trend line over an explicit series. */
export function Sparkline({
  series,
  height = 28,
  tone = "var(--foreground)",
  fill = true,
}: {
  series: number[];
  height?: number;
  tone?: string;
  fill?: boolean;
}) {
  if (series.length < 2) return <Skeleton className="w-full" />;
  const max = Math.max(...series, 0.0001);
  const points = series
    .map((v, i) => {
      const x = (i / (series.length - 1)) * 100;
      const y = height - 2 - (v / max) * (height - 4);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
      aria-hidden
    >
      {fill ? (
        <polygon points={`0,${height} ${points} 100,${height}`} fill={tone} opacity={0.14} />
      ) : null}
      <polyline
        points={points}
        fill="none"
        stroke={tone}
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={100}
        cy={height - 2 - (series[series.length - 1] / max) * (height - 4)}
        r={1.6}
        fill={tone}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/** Vertical timeline of dated, clickable entries. */
export function Timeline({
  items,
  className,
}: {
  items: { time: string; title: string; detail?: string; tone?: string }[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <ol className={cn("relative", className)}>
      <span className="absolute top-1.5 bottom-1.5 left-[5px] w-px bg-rule" aria-hidden />
      {items.map((item, i) => (
        <li key={i} className="relative flex gap-3 py-2 pl-0">
          <span
            className="relative z-10 mt-1.5 size-[11px] shrink-0 border-2 bg-background"
            style={{ borderColor: item.tone ?? "var(--foreground)" }}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[12.5px] font-medium">
                {item.title}
              </span>
              <span className="num shrink-0 text-[10px] text-muted-foreground">
                {item.time}
              </span>
            </div>
            {item.detail ? (
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
                {item.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}