import type { ReactNode } from "react";
import { SectionTitle } from "@/components/viz/exec/system";
import { cn } from "@/lib/utils";

/**
 * Layout helpers retained for the screens built before the workstation shell
 * existed.
 *
 * These used to be a second, parallel design system with its own surface, its
 * own header treatment and its own spacing. They now resolve to the single card
 * and the single section header the rest of the product uses, so a page written
 * against these names is visually indistinguishable from one written against the
 * executive kit. Nothing here introduces a style; it only forwards to the one.
 */

export function SectionHeader({
  index,
  title,
  lede,
  actions,
}: {
  index: string;
  title: string;
  lede: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-[var(--exec-hairline)] px-4 py-6 lg:flex-row lg:items-end lg:justify-between lg:px-8">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2.5">
          <span className="exec-num text-[12px] font-semibold tracking-[0.16em] text-[var(--exec-cyan)]">
            {index}
          </span>
          <span className="h-px w-8 bg-[var(--exec-hairline)]" />
          <span className="exec-label">Propagation model</span>
        </div>
        <h1 className="t-page mt-2 text-[var(--exec-ink)]">{title}</h1>
        <p className="t-body mt-2 text-[var(--exec-ink-dim)]">{lede}</p>
      </div>
      {actions ? <div className="shrink-0">{actions}</div> : null}
    </div>
  );
}

export function FilterToggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors",
        active
          ? "border-[var(--exec-cyan)] bg-[color-mix(in_srgb,var(--exec-cyan)_12%,transparent)] text-[var(--exec-ink)]"
          : "border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The card. Delegates its header to the shared `SectionTitle` so the two header
 * treatments the product once had are now one.
 */
export function Panel({
  caption,
  aside,
  children,
  className,
}: {
  caption: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("card flex min-w-0 flex-col", className)}>
      <SectionTitle meta={aside}>{caption}</SectionTitle>
      {children}
    </section>
  );
}
