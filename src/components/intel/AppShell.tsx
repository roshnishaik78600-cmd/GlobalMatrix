import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Legacy layout helpers retained for the screens built before the workstation
 * shell existed. They now emit the compact dark treatment so those screens
 * match the rest of the console without a full rewrite.
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
    <div className="flex flex-col gap-4 border-b border-rule px-4 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-6">
      <div className="max-w-3xl">
        <div className="flex items-center gap-2.5">
          <span className="num text-[10px] font-semibold tracking-[0.16em] text-signal">
            {index}
          </span>
          <span className="h-px w-8 bg-rule" />
          <span className="label text-muted-foreground">
            Propagation model
          </span>
        </div>
        <h1 className="h-display mt-3">{title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {lede}
        </p>
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
        "label border px-2.5 py-1.5 transition-colors",
        active
          ? "border-foreground bg-foreground text-background"
          : "border-rule text-muted-foreground hover:border-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

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
    <section className={cn("panel", className)}>
      <div className="panel-head">
        <span className="label text-foreground/85">{caption}</span>
        {aside ? (
          <span className="label text-muted-foreground">{aside}</span>
        ) : null}
      </div>
      {children}
    </section>
  );
}