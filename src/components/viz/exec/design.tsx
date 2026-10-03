import type { ReactNode } from "react";
import { Link } from "react-router";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BasisTag,
  ExecCard,
  ExecPage,
  FreshnessTag,
  ProvenanceFoot,
  SectionTitle,
} from "@/components/viz/exec/system";
import { delta, num } from "@/lib/numbers";
import {
  BASIS_COLOUR,
  BASIS_HELP,
  BASIS_LABEL,
  type Basis,
} from "@/lib/basis";

/**
 * The presentation system.
 *
 * One page frame, one header, one metric, one filter bar, one chart frame, one
 * table, three states. Everything a page can show is composed from these, which
 * is the only way "where do I look?" gets a single answer across sixteen
 * routes: a reader learns the grammar once.
 *
 * Three rules the components below enforce structurally rather than by
 * convention:
 *
 * 1. **One dominant object.** A page has at most one `Dominant` region, so the
 *    eye lands somewhere specific instead of on eight equal cards.
 * 2. **Provenance travels with the figure.** `Metric` and `ChartFrame` both
 *    render their own source line, so a number can never appear on screen
 *    without saying what produced it. Repeating it inside the body is then
 *    forbidden rather than merely discouraged.
 * 3. **Density is a choice, not an accident.** `Level` sets the typographic
 *    register, so a Level-1 answer and a Level-6 coefficient note cannot end up
 *    the same size.
 */

export { ExecPage, ExecCard, FreshnessTag, ProvenanceFoot, SectionTitle, BasisTag };

/* ------------------------------------------------------------ Page frame -- */

/**
 * The single page shell.
 *
 * `Header → Controls → Body`, with the body on the one 12-column grid every
 * page shares. The gutters are set here and nowhere else, which is what makes
 * the left edge of a chart line up with the left edge of the table beneath it.
 */
export function PageFrame({
  eyebrow,
  title,
  lede,
  actions,
  controls,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  /** One sentence. A paragraph here is a Level-6 statement in a Level-1 slot. */
  lede: string;
  actions?: ReactNode;
  /** The filter/time/source row. Sits between header and body, always. */
  controls?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <ExecPage className="flex min-h-screen flex-col">
      <header className="border-b border-[var(--exec-hairline)] px-4 pt-5 pb-4 lg:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0 max-w-2xl">
            <p className="exec-label text-[var(--exec-cyan)]">{eyebrow}</p>
            <h1 className="mt-1.5 text-[1.45rem] leading-[1.15] font-semibold tracking-[-0.025em] text-[var(--exec-ink)]">
              {title}
            </h1>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--exec-ink-dim)]">
              {lede}
            </p>
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
          ) : null}
        </div>
      </header>

      {controls ? (
        <div className="border-b border-[var(--exec-hairline)] px-4 lg:px-6">
          {controls}
        </div>
      ) : null}

      <main className="min-w-0 flex-1 px-4 py-4 lg:px-6">
        {/* The one grid, inlined: 12 columns on desktop, one on mobile, a
            single gutter. Not exported, because every page reaches it through
            PageFrame and a second entry point would be a second thing to drift. */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">{children}</div>
      </main>

      {footer ? (
        <footer className="border-t border-[var(--exec-hairline)] px-4 py-3 lg:px-6">
          {footer}
        </footer>
      ) : null}
    </ExecPage>
  );
}

/**
 * A span on the grid.
 *
 * Named by what it carries rather than by width, so a page's shape reads as
 * intent (`Dominant` = the one big thing) instead of arithmetic (`span={8}`).
 */
export function Region({
  width = 12,
  dominant,
  className,
  children,
}: {
  width?: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
  /** Marks the page's single dominant object. Visually and semantically. */
  dominant?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        width === 3 && "lg:col-span-3",
        width === 4 && "lg:col-span-4",
        width === 5 && "lg:col-span-5",
        width === 6 && "lg:col-span-6",
        width === 7 && "lg:col-span-7",
        width === 8 && "lg:col-span-8",
        width === 9 && "lg:col-span-9",
        width === 12 && "lg:col-span-12",
        className,
      )}
    >
      {dominant ? (
        <section
          className="glass flex h-full min-w-0 flex-col"
          style={{
            boxShadow:
              "0 0 0 1px color-mix(in srgb, var(--exec-cyan) 12%, transparent), 0 18px 60px -40px rgba(0,0,0,0.9)",
          }}
        >
          {children}
        </section>
      ) : (
        <section className="glass flex h-full min-w-0 flex-col">{children}</section>
      )}
    </div>
  );
}

/* --------------------------------------------------------------- Headers -- */

/**
 * The in-page section header. Every panel on every page uses this, so panel
 * titles always sit on the same baseline and the same hairline.
 */
export function PanelHead({
  title,
  meta,
  actions,
  children,
}: {
  title: string;
  /** One short qualifier — the unit, the window, the count. Never a sentence. */
  meta?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-3 border-b border-[var(--exec-hairline)] px-3 py-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 className="exec-label shrink-0 text-[var(--exec-ink)]">{title}</h2>
          {meta ? <span className="exec-label truncate">{meta}</span> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-1.5">{actions}</div>
        ) : null}
      </div>
      {children}
    </>
  );
}

/* ---------------------------------------------------------------- Metric -- */

/**
 * The one metric.
 *
 * Fixed internal order — label, value, trend, period, basis — so a column of
 * these scans as a column. Optional slots collapse rather than reorder, which
 * is what stops a page from presenting "value / source / trend / timestamp" in
 * whatever order that page's author felt like.
 */
export function Metric({
  label,
  value,
  unit,
  trend,
  period,
  basis,
  tone,
  hint,
  onClick,
  active,
}: {
  label: string;
  value: string;
  unit?: string;
  /** Fractional change, e.g. 0.042 → `+4.2%`. Rendered beside the value. */
  trend?: number;
  /** The window or period the value describes: "30D", "2025", "Jul 2026". */
  period?: string;
  basis?: Basis;
  tone?: string;
  /** What the number measures. Shown as a tooltip, never as body text. */
  hint?: string;
  onClick?: () => void;
  active?: boolean;
}) {
  const interactive = typeof onClick === "function";
  const Tag = interactive ? "button" : "div";
  return (
    <Tag
      {...(interactive ? { type: "button" as const, onClick } : {})}
      title={hint}
      className={cn(
        "glass flex min-w-0 flex-col gap-1 px-3 py-2 text-left",
        interactive && "glass-hover cursor-pointer",
        active && "border-[var(--exec-cyan)]/60",
      )}
    >
      <span className="flex items-baseline justify-between gap-2">
        <span className="exec-label truncate">{label}</span>
        {basis ? <DataType type={basis} /> : null}
      </span>
      <span className="flex items-baseline gap-1.5">
        <span
          className="exec-num text-[1.55rem] leading-none font-bold tracking-[-0.02em]"
          style={{ color: tone ?? "var(--exec-ink)" }}
        >
          {value}
        </span>
        {unit ? <span className="exec-label">{unit}</span> : null}
        {trend !== undefined ? <Trend value={trend} /> : null}
      </span>
      {period ? (
        <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">{period}</span>
      ) : null}
    </Tag>
  );
}

/** A row of metrics that share a baseline and wrap as one strip. */
export function MetricGrid({
  children,
  className,
  columns = 4,
}: {
  children: ReactNode;
  className?: string;
  columns?: 2 | 3 | 4 | 6;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 && "grid-cols-2",
        columns === 3 && "grid-cols-2 sm:grid-cols-3",
        columns === 4 && "grid-cols-2 lg:grid-cols-4",
        columns === 6 && "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Direction is colour-coded and always signed, so it reads without the arrow. */
export function Trend({ value }: { value: number }) {
  const up = value > 0.0005;
  const down = value < -0.0005;
  const colour = up
    ? "var(--exec-crimson)"
    : down
      ? "var(--exec-emerald)"
      : "var(--exec-ink-dim)";
  return (
    <span
      className="exec-num ml-auto shrink-0 text-[10px] font-semibold"
      style={{ color: colour }}
      title={up ? "Rising" : down ? "Falling" : "Unchanged"}
    >
      {up ? "▲" : down ? "▼" : "—"}
      {delta(value)}
    </span>
  );
}

/* ------------------------------------------------------------ Data types -- */

/**
 * What kind of number this is.
 *
 * Four values, one badge design, used everywhere. This is the single most
 * important label in the product: it is the difference between "this happened"
 * and "we computed this", and it is deliberately impossible to omit silently
 * because every metric and chart frame renders it.
 */
export type { Basis };
export { BASIS_LABEL, BASIS_COLOUR, BASIS_HELP };

/** The one data-type badge. Rendered by every metric and chart frame. */
export function DataType({ type }: { type: Basis }) {
  return (
    <span
      className="exec-label shrink-0 whitespace-nowrap"
      style={{ color: BASIS_COLOUR[type] }}
      title={BASIS_HELP[type]}
    >
      {BASIS_LABEL[type]}
    </span>
  );
}

/* -------------------------------------------------------------- Controls -- */

/**
 * The filter bar.
 *
 * One row, one hairline, controls left and the active scope right. Every page
 * that filters uses this, so `[24H] [7D]` means the same thing everywhere and
 * the reader learns the control grammar once.
 */
export function FilterBar({ children, scope }: { children: ReactNode; scope?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      <div className="flex flex-wrap items-center gap-2">{children}</div>
      {scope ? (
        <div className="exec-label ml-auto flex items-center gap-2 truncate">
          {scope}
        </div>
      ) : null}
    </div>
  );
}

/** Segmented selector. Identical on every page that offers a choice of scope. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
  label?: string;
}) {
  return (
    <div
      className="flex items-center gap-px"
      role="group"
      aria-label={label}
    >
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === value}
          title={o.hint}
          className={cn(
            "exec-label border px-2.5 py-1 transition-colors",
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

/** A link that reads as an action rather than as navigation. */
export function Action({
  to,
  children,
  onClick,
}: {
  to?: string;
  children: ReactNode;
  onClick?: () => void;
}) {
  const cls =
    "exec-label inline-flex items-center gap-1.5 border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]";
  if (to) {
    return (
      <Link to={to} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cls}>
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- Chart -- */

/** The 30-point sparkline used inside metrics and dense table rows. */
export function Sparkline({
  values,
  colour = "var(--exec-cyan)",
  className,
  height = 16,
}: {
  values: number[];
  colour?: string;
  className?: string;
  height?: number;
}) {
  if (values.length < 2) {
    return <div className={cn("w-full", className)} style={{ height }} />;
  }
  return (
    <svg
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      style={{ height }}
      aria-hidden
    >
      <polyline
        points={values
          .map((v, i) => {
            // Clamped to the viewBox: a share outside 0..1 would otherwise plot
            // outside the frame and draw over the neighbouring cell.
            const clamped = Math.min(1, Math.max(0, v));
            const y = 1 + (1 - clamped) * (height - 2);
            return `${((i / (values.length - 1)) * 100).toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")}
        fill="none"
        stroke={colour}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ----------------------------------------------------------------- Table -- */

/**
 * The one table.
 *
 * Tables are for precise comparison, so they are used only where a reader needs
 * to line numbers up against each other. Numeric columns are right-aligned and
 * tabular so digits form a true column; the name column is left-aligned; the
 * header is sticky so a long list keeps its labels while scrolling.
 */
export function DataTable({
  columns,
  rows,
  onRowClick,
  empty,
}: {
  columns: {
    key: string;
    label: string;
    /** Numbers align right and use tabular figures; text aligns left. */
    numeric?: boolean;
    width?: string;
  }[];
  rows: Record<string, ReactNode>[];
  onRowClick?: (index: number) => void;
  empty?: ReactNode;
}) {
  if (rows.length === 0 && empty) return <>{empty}</>;
  return (
    <div className="min-w-0 overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10 bg-[var(--exec-base)]">
          <tr className="border-b border-[var(--exec-hairline-strong)]">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={c.width ? { width: c.width } : undefined}
                className={cn(
                  "exec-label px-3 py-2 whitespace-nowrap",
                  c.numeric ? "text-right" : "text-left",
                )}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={i}
              onClick={onRowClick ? () => onRowClick(i) : undefined}
              className={cn(
                "border-b border-[var(--exec-hairline)] transition-colors last:border-b-0",
                onRowClick && "cursor-pointer hover:bg-[var(--exec-surface-strong)]",
              )}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={cn(
                    "px-3 py-2 text-[12px] whitespace-nowrap",
                    c.numeric
                      ? "exec-num text-right text-[var(--exec-ink)]"
                      : "text-[var(--exec-ink)]",
                  )}
                >
                  {row[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------------------------------------------------------------- States -- */

/**
 * The whole-page loading state.
 *
 * Pages used to each invent their own centred "Loading…" line with its own
 * margins and type size, so a slow query looked like a different site. This
 * renders the page header at its final size and then a skeleton of the
 * dominant region, which means nothing reflows when the data lands.
 */
export function PageLoading({
  eyebrow,
  title,
  lede,
  dominant = "lg:col-span-8",
}: {
  eyebrow: string;
  title: string;
  lede: string;
  /** Width class for the dominant skeleton, matching the real layout. */
  dominant?: string;
}) {
  return (
    <div className="min-w-0 px-4 py-5 lg:px-6">
      <p className="exec-label text-[var(--exec-cyan)]">{eyebrow}</p>
      <h1 className="mt-1.5 text-[1.45rem] leading-[1.15] font-semibold tracking-[-0.025em] text-[var(--exec-ink)]">
        {title}
      </h1>
      <p className="mt-1.5 max-w-2xl text-[12.5px] leading-relaxed text-[var(--exec-ink-dim)]">
        {lede}
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className={dominant}>
          <div className="glass h-[420px] w-full animate-pulse" />
        </div>
        <div className="lg:col-span-4">
          <div className="glass h-[200px] w-full animate-pulse" />
          <div className="glass mt-4 h-[204px] w-full animate-pulse" />
        </div>
      </div>
    </div>
  );
}

/**
 * The empty state.
 *
 * One component, used wherever there is nothing verified to show. The rule it
 * encodes: never substitute a plausible-looking number for a missing reading.
 * The reason is mandatory because "no data" without a reason reads as a bug.
 */
export function EmptyState({
  title,
  reason,
  action,
}: {
  title: string;
  reason: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[132px] flex-col justify-center gap-1.5 p-4">
      <div className="flex items-center gap-2">
        <Inbox className="size-3.5 shrink-0 text-[var(--exec-ink-dim)]" aria-hidden />
        <span className="exec-label text-[var(--exec-ink)]">NO VERIFIED DATA</span>
      </div>
      <p className="text-[12.5px] font-medium text-[var(--exec-ink)]">{title}</p>
      <p className="max-w-md text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
        {reason}
      </p>
      {action}
    </div>
  );
}

/** The error state. Distinct from empty: this one failed, it is not absent. */
export function ErrorState({
  title = "Could not load this view",
  reason,
  action,
}: {
  title?: string;
  reason?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-[132px] flex-col justify-center gap-1.5 p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle
          className="size-3.5 shrink-0 text-[var(--exec-crimson)]"
          aria-hidden
        />
        <span className="exec-label text-[var(--exec-crimson)]">ERROR</span>
      </div>
      <p className="text-[12.5px] font-medium text-[var(--exec-ink)]">{title}</p>
      {reason ? (
        <p className="max-w-md text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
          {reason}
        </p>
      ) : null}
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ Typography -- */


/** Re-export so pages never import from two places for one number. */
export { num };