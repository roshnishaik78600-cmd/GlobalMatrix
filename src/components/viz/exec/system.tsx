import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";
import {
  FRESHNESS_COLOUR,
  FRESHNESS_HELP,
  FRESHNESS_LABEL,
  utcStamp,
  type Freshness,
} from "@/lib/freshness";
import { sourceById } from "@/lib/sources";

/**
 * The executive surface kit.
 *
 * Everything a page needs to sit on the design language: one page frame, one
 * card, one status chip, one provenance foot. Keeping them in one file is the
 * point — a hierarchy that is re-implemented per page is a hierarchy that will
 * drift.
 */

/* ---------------------------------------------------------------- Layout -- */

export function ExecPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("min-w-0", className)}
      style={{ background: "var(--exec-base)", color: "var(--exec-ink)" }}
    >
      {children}
    </div>
  );
}

/** Strict 12-column grid with one gutter, used by every page body. */
export function ExecGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-4 gap-3 px-4 py-3 lg:grid-cols-12", className)}
    >
      {children}
    </div>
  );
}

/** A 12-column span. Named so the dominant/supporting/detail balance is explicit. */
export function Col({
  span,
  children,
  className,
}: {
  span: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        {
          "col-span-4": span === 3 || span === 4,
          "col-span-6": span === 5 || span === 6,
          "col-span-8": span === 7 || span === 8,
          "col-span-9": span === 9,
          "col-span-12": span === 12,
          "lg:col-span-3": span === 3,
          "lg:col-span-4": span === 4,
          "lg:col-span-5": span === 5,
          "lg:col-span-6": span === 6,
          "lg:col-span-7": span === 7,
          "lg:col-span-8": span === 8,
          "lg:col-span-9": span === 9,
        },
        className,
      )}
    >
      {children}
    </div>
  );
}

/* ------------------------------------------------------------ Typography -- */

export function PageTitle({
  title,
  lede,
  right,
}: {
  title: string;
  lede?: string;
  right?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 px-4 pt-4 pb-1">
      <div className="min-w-0 max-w-3xl">
        <h1 className="text-[19px] leading-tight font-semibold tracking-[-0.02em] text-[var(--exec-ink)]">
          {title}
        </h1>
        {lede ? (
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
            {lede}
          </p>
        ) : null}
      </div>
      {right ? <div className="flex min-w-0 flex-wrap items-center gap-2">{right}</div> : null}
    </div>
  );
}

export function SectionTitle({
  children,
  meta,
  right,
  className,
}: {
  children: ReactNode;
  meta?: ReactNode;
  right?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center justify-between gap-3 border-b border-[var(--exec-hairline)] px-3 py-2",
        className,
      )}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <h2 className="exec-label min-w-0 shrink text-[var(--exec-ink)]">{children}</h2>
        {meta ? <span className="exec-label min-w-0 truncate">{meta}</span> : null}
      </div>
      {right ? <div className="flex min-w-0 shrink-0 items-center gap-2">{right}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- Surfaces -- */

export function ExecCard({
  children,
  className,
  bodyClassName,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  interactive?: boolean;
}) {
  return (
    <section
      className={cn(
        "glass flex min-w-0 flex-col",
        interactive && "glass-hover cursor-pointer",
        className,
      )}
    >
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/** The single dominant visual on a page, sized to be read first. */
export function DominantCard({
  title,
  meta,
  right,
  children,
  className,
  bodyClassName,
}: {
  title: string;
  meta?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <section
      className={cn("glass flex min-w-0 flex-col", className)}
      style={{
        boxShadow:
          "0 0 0 1px color-mix(in srgb, var(--exec-cyan) 12%, transparent), 0 18px 60px -40px rgba(0,0,0,0.9)",
      }}
    >
      <SectionTitle meta={meta} right={right}>
        {title}
      </SectionTitle>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </section>
  );
}

/* ----------------------------------------------------------------- Status -- */

/** LIVE / RECENT / DELAYED / HISTORICAL / UNAVAILABLE. Never decorative. */
export function FreshnessTag({
  freshness,
  className,
}: {
  freshness: Freshness;
  className?: string;
}) {
  const colour = FRESHNESS_COLOUR[freshness];
  return (
    <span
      title={FRESHNESS_HELP[freshness]}
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap",
        className,
      )}
    >
      <span
        className={cn("size-1.5 shrink-0 rounded-full", freshness === "live" && "live-dot")}
        style={{ background: colour }}
        aria-hidden
      />
      <span
        className="exec-label"
        style={{ color: colour }}
      >
        {FRESHNESS_LABEL[freshness]}
      </span>
    </span>
  );
}

/**
 * The provenance line every major visual must carry: what reported it, when we
 * pulled it, and how current that makes it.
 */
export function ProvenanceFoot({
  sourceId,
  retrievedAt,
  freshness,
  note,
  period,
}: {
  sourceId?: string;
  retrievedAt?: number;
  freshness: Freshness;
  note?: string;
  period?: string;
}) {
  const source = sourceId ? sourceById(sourceId) : undefined;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--exec-hairline)] px-3 py-1.5">
      {source ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="exec-label transition-colors hover:text-[var(--exec-ink)]"
        >
          {source.label}
        </a>
      ) : null}
      {period ? <span className="exec-label">as of {period}</span> : null}
      {retrievedAt ? (
        <span className="exec-num text-[10px] text-[var(--exec-ink-dim)]">
          UPDATED {utcStamp(retrievedAt)}
        </span>
      ) : null}
      <FreshnessTag freshness={freshness} className="ml-auto" />
      {note ? (
        <span className="w-full text-[10.5px] leading-snug text-[var(--exec-ink-dim)]">
          {note}
        </span>
      ) : null}
    </div>
  );
}

/** OBSERVED DATA / MODEL OUTPUT / SCENARIO, stated wherever a figure appears. */
export function BasisTag({
  basis,
  className,
}: {
  basis: "observed" | "model" | "scenario";
  className?: string;
}) {
  const color =
    basis === "observed"
      ? "var(--exec-emerald)"
      : basis === "model"
        ? "var(--exec-cyan)"
        : "var(--exec-amber)";
  const label =
    basis === "observed"
      ? "OBSERVED DATA"
      : basis === "model"
        ? "MODEL OUTPUT"
        : "SCENARIO";
  return (
    <span
      className={cn("exec-label whitespace-nowrap", className)}
      style={{ color }}
      title={
        basis === "observed"
          ? "Reported by a named external source."
          : basis === "model"
            ? "Computed by GlobalMatrix from its own stated formula."
            : "Hypothetical. This has not happened."
      }
    >
      {label}
    </span>
  );
}

/* ---------------------------------------------------------------- Metrics -- */

export function StatTile({
  label,
  value,
  unit,
  basis,
  tone,
  note,
  trend,
  onClick,
  active,
}: {
  label: string;
  value: string;
  unit?: string;
  basis?: "observed" | "model" | "scenario";
  tone?: string;
  note?: ReactNode;
  trend?: number[];
  onClick?: () => void;
  active?: boolean;
}) {
  const max = trend && trend.length > 0 ? Math.max(...trend, 0.0001) : 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "glass glass-hover flex min-w-0 flex-col gap-1 px-3 py-2 text-left",
        !onClick && "cursor-default",
        active && "border-[var(--exec-cyan)]/60",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="exec-label truncate">{label}</span>
        {basis ? <BasisTag basis={basis} /> : null}
      </span>
      <span className="flex items-baseline gap-1">
        <span
          className="exec-num text-[20px] leading-none font-bold tracking-[-0.02em]"
          style={{ color: tone ?? "var(--exec-ink)" }}
        >
          {value}
        </span>
        {unit ? (
          <span className="exec-label">{unit}</span>
        ) : null}
      </span>
      {trend && trend.length > 1 ? (
        <svg viewBox="0 0 100 16" preserveAspectRatio="none" className="h-4 w-full">
          <polyline
            points={trend
              .map(
                (v, i) =>
                  `${((i / (trend.length - 1)) * 100).toFixed(1)},${(
                    15 -
                    (v / max) * 14
                  ).toFixed(1)}`,
              )
              .join(" ")}
            fill="none"
            stroke="var(--exec-cyan)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : null}
      {note ? (
        <span className="exec-label mt-0.5 block truncate normal-case">{note}</span>
      ) : null}
    </button>
  );
}

/* ----------------------------------------------------------- Empty states -- */

/**
 * The one empty state. "No verified data" with the reason, styled like the rest
 * of the board rather than as a broken panel.
 */
export function NoDataAvailable({
  title,
  reason,
  hint,
  className,
}: {
  title: string;
  reason: string;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-[132px] flex-col justify-center gap-1.5 p-4", className)}>
      <div className="flex items-center gap-2">
        <span
          className="size-1.5 shrink-0 rounded-full"
          style={{ background: "var(--exec-crimson)" }}
          aria-hidden
        />
        <span className="exec-label text-[var(--exec-ink)]">NO VERIFIED DATA AVAILABLE</span>
      </div>
      <p className="text-[12.5px] font-medium text-[var(--exec-ink)]">{title}</p>
      <p className="max-w-md text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
        {reason}
      </p>
      {hint}
    </div>
  );
}

/* --------------------------------------------------------------- Controls -- */

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cn("flex min-w-0 items-center gap-px overflow-x-auto", className)}
      role="group"
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === value}
          title={o.hint}
          className={cn(
            "exec-label shrink-0 rounded-sm border px-2 py-1 whitespace-nowrap transition-colors",
            o.id === value
              ? "border-[color-mix(in_srgb,var(--exec-cyan)_60%,transparent)] bg-[color-mix(in_srgb,var(--exec-cyan)_12%,transparent)] text-[var(--exec-ink)]"
              : "border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] hover:text-[var(--exec-ink)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ExecLink({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "exec-label transition-colors hover:text-[var(--exec-ink)]",
        className,
      )}
    >
      {children}
    </Link>
  );
}