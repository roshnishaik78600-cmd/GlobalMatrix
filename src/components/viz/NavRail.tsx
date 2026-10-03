import { NavLink, useLocation } from "react-router";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, type NavItem } from "@/components/viz/navigation";

/**
 * The one navigation list.
 *
 * Desktop rail and mobile sheet both render this, so a destination cannot be
 * reachable on one and missing on the other — which is exactly the drift that
 * made the old flat list feel like two different products on two screen sizes.
 */

export function NavList({
  collapsed,
  onNavigate,
}: {
  collapsed?: boolean;
  onNavigate?: () => void;
}) {
  const { pathname } = useLocation();
  return (
    <>
      {NAV_GROUPS.map((group) => (
        <div key={group.id} className="px-2 py-2">
          {/* The group label is the primary scan target on desktop and the
              section heading on mobile; it is never interactive itself. */}
          {!collapsed ? (
            <p className="exec-label px-2 pb-1.5 text-[8.5px] text-[var(--exec-ink-dim)]/70">
              {group.label}
            </p>
          ) : (
            <div
              className="mx-auto mb-1.5 h-px w-5 bg-[var(--exec-hairline)]"
              aria-hidden
            />
          )}
          <ul className="space-y-px">
            {group.items.map((item) => (
              <li key={item.to}>
                <NavRow
                  item={item}
                  active={pathname === item.to}
                  collapsed={collapsed}
                  onNavigate={onNavigate}
                />
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  );
}

function NavRow({
  item,
  active,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
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
        className={cn(
          "flex min-w-0 cursor-not-allowed items-center gap-2.5 rounded-sm px-2 py-1.5 text-[12px] text-[var(--exec-ink-dim)]/40",
          collapsed && "justify-center px-0",
        )}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
      </span>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-w-0 items-center gap-2.5 rounded-sm px-2 py-1.5 text-[12px] transition-colors",
        collapsed && "justify-center px-0",
        active
          ? "bg-[color-mix(in_srgb,var(--exec-cyan)_12%,transparent)] text-[var(--exec-ink)]"
          : "text-[var(--exec-ink-dim)] hover:bg-[var(--exec-surface)] hover:text-[var(--exec-ink)]",
      )}
    >
      {({ isActive }) => (
        <>
          {/* The active marker is a rail, not a fill: it reads at a glance
              without adding another coloured surface to the page. */}
          <span
            className={cn(
              "h-4 w-0.5 shrink-0 rounded-full transition-opacity",
              isActive
                ? "bg-[var(--exec-cyan)] opacity-100"
                : "opacity-0",
            )}
            aria-hidden
          />
          <Icon className="size-3.5 shrink-0" aria-hidden />
          {!collapsed ? <span className="min-w-0 truncate">{item.label}</span> : null}
        </>
      )}
    </NavLink>
  );
}

/**
 * The mobile navigation.
 *
 * Below `lg` the sidebar is removed from flow entirely rather than narrowed: a
 * 212px rail inside a 390px viewport leaves 178px of content, which is not a
 * layout, it is a squeeze. This sheet is a dialog so it traps focus, closes on
 * Escape, and does not let the page behind it scroll.
 */
export function NavSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 lg:hidden"
      role="dialog"
      aria-modal="true"
      aria-label="Navigation"
    >
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
      />
      <div className="absolute inset-y-0 left-0 flex w-[min(17rem,82vw)] flex-col border-r border-[var(--exec-hairline-strong)] bg-[var(--exec-base)]">
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[var(--exec-hairline)] px-3">
          <span className="text-[12px] font-semibold tracking-[0.18em] text-[var(--exec-ink)] uppercase">
            GlobalMatrix
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="flex size-8 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
          >
            <X className="size-4" />
          </button>
        </div>
        <nav className="min-h-0 flex-1 overflow-y-auto py-1" aria-label="Primary">
          <NavList onNavigate={onClose} />
        </nav>
      </div>
    </div>
  );
}