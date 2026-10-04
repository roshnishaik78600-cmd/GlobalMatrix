import { useEffect, useRef } from "react";
import { NavLink } from "react-router";
import { X } from "lucide-react";
import { NAV_GROUPS, type NavItem } from "@/components/viz/navigation";
import { cn } from "@/lib/utils";

/**
 * The complete directory.
 *
 * One list, rendered into a grid of labelled cards. It is what sits behind
 * "Explore" in the top bar, and it is the only place the full set of
 * destinations appears — so a reader either learns the five primary ones or
 * finds the whole product, and never has to guess which of two menus is stale.
 */
export function NavDirectory({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {NAV_GROUPS.map((group) => (
        <section key={group.id} className="card p-4">
          <h3 className="exec-label mb-3">{group.label}</h3>
          <ul className="flex flex-col gap-1">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavRow item={item} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function NavRow({
  item,
  onNavigate,
}: {
  item: NavItem;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;

  if (item.unavailable) {
    // Greyed, not hidden: the reader learns the product's scope and the exact
    // reason, rather than finding a hole in the navigation and guessing.
    return (
      <span
        title={`Unavailable — ${item.unavailable}`}
        aria-disabled="true"
        className="flex min-w-0 cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-[var(--exec-ink-dim)] opacity-50"
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 truncate">{item.label}</span>
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] transition-colors",
          isActive
            ? "bg-[color-mix(in_srgb,var(--exec-cyan)_12%,transparent)] text-[var(--exec-ink)]"
            : "text-[var(--exec-ink-dim)] hover:bg-[var(--exec-surface)] hover:text-[var(--exec-ink)]",
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{item.label}</span>
    </NavLink>
  );
}

/**
 * The Explore panel.
 *
 * A dialog rather than a dropdown: it holds eighteen destinations in six groups,
 * and a dropdown that tall would extend past the bottom of the viewport on a
 * laptop and become unreachable. As a dialog it can scroll, it traps Escape,
 * and it closes on a click outside or on navigation.
 */
export function ExplorePanel({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Explore GlobalMatrix">
      <button
        type="button"
        aria-label="Close explore panel"
        onClick={onClose}
        className="absolute inset-0 bg-black/65"
      />
      <div
        ref={ref}
        className="absolute inset-x-0 top-0 max-h-[min(78vh,44rem)] overflow-y-auto border-b border-[var(--exec-hairline-strong)] bg-[var(--exec-base)] px-4 pt-4 pb-8 sm:px-6"
      >
        <div className="gm-width">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="t-card">Explore GlobalMatrix</h2>
              <p className="t-meta mt-1 text-[var(--exec-ink-dim)]">
                Every destination, grouped by the question it answers.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close explore panel"
              className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)]"
            >
              <X className="size-4" />
            </button>
          </div>
          <NavDirectory onNavigate={onClose} />
        </div>
      </div>
    </div>
  );
}