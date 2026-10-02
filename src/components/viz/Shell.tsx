import { useState, type ReactNode, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { X } from "lucide-react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronLeft,
  Database,
  Factory,
  Globe2,
  LayoutGrid,
  Network,
  Radar,
  type LucideIcon,
} from "lucide-react";
import { SystemBar } from "@/components/viz/exec/SystemBar";
import { CountryDrawer } from "@/components/viz/exec/CountryDrawer";
import { useAuth } from "@/hooks/use-auth";
import { useAuthAction } from "@/hooks/use-auth-action";
import { CommandPalette } from "@/components/intel/CommandPalette";
import { FocusDrawer } from "@/components/viz/FocusPanel";
import { useFocus } from "@/lib/focus";
import { getNode } from "@/lib/intel/nodes";
import { cn } from "@/lib/utils";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Shown greyed with a reason instead of linking, because no data exists. */
  unavailable?: string;
}

const NAV: NavItem[] = [
  { to: "/app", label: "Overview", icon: LayoutGrid, end: true },
  { to: "/app/data", label: "Sources", icon: Database },
  { to: "/app/chain", label: "Event → world", icon: Network },
  { to: "/app/events", label: "Events", icon: Activity },
  { to: "/app/world", label: "World", icon: Globe2 },
  { to: "/app/countries", label: "Countries", icon: Globe2 },
  { to: "/app/companies", label: "Companies", icon: Factory, unavailable: "no company-level data connected" },
  { to: "/app/industries", label: "Industries", icon: Boxes },
  { to: "/app/trade", label: "Trade", icon: Boxes },
  { to: "/app/supply", label: "Supply chains", icon: Boxes },
  { to: "/app/markets", label: "Markets", icon: Activity },
  { to: "/app/policy", label: "Policy", icon: AlertTriangle, unavailable: "no policy registry connected" },
  { to: "/app/risk", label: "Risk", icon: AlertTriangle },
  { to: "/app/graph", label: "Graph", icon: Network },
  { to: "/app/scenarios", label: "Scenarios", icon: Radar },
  { to: "/app/analogues", label: "Analogues", icon: Boxes, unavailable: "no historical corpus connected" },
  { to: "/app/analyst", label: "AI analyst", icon: Activity },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAuthenticated } = useAuthAction();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const { focus, clear } = useFocus();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Any surface can raise the command palette without owning it.
  useEffect(() => {
    function onOpenSearch() {
      setSearchOpen(true);
    }
    window.addEventListener("gm:open-search", onOpenSearch);
    return () => window.removeEventListener("gm:open-search", onOpenSearch);
  }, []);

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar */}
      <aside
        className={cn(
          "sticky top-0 z-30 flex h-screen shrink-0 flex-col border-r border-rule bg-[var(--sidebar)] transition-[width] duration-200",
          collapsed ? "w-[52px]" : "w-[212px]",
        )}
      >
        <Link
          to="/app"
          className="flex h-12 shrink-0 items-center gap-2 border-b border-rule px-3"
        >
          <span className="size-2 shrink-0 bg-signal" aria-hidden />
          {!collapsed ? (
            <span className="truncate text-[12px] font-semibold tracking-[0.18em] uppercase">
              GlobalMatrix
            </span>
          ) : null}
        </Link>

        <nav className="min-h-0 flex-1 overflow-y-auto py-1" aria-label="Primary">
          <ul>
            {NAV.map((item) => {
              const Icon = item.icon;
              if (item.unavailable) {
                return (
                  <li key={item.to}>
                    <button
                      type="button"
                      disabled
                      title={`Unavailable — ${item.unavailable}`}
                      className="flex w-full cursor-not-allowed items-center gap-2.5 px-3 py-1.5 text-left text-muted-foreground/45"
                    >
                      <Icon className="size-3.5 shrink-0" aria-hidden />
                      {!collapsed ? (
                        <span className="truncate text-[12px]">{item.label}</span>
                      ) : null}
                      {!collapsed ? (
                        <span
                          className="ml-auto text-[8px] tracking-wider uppercase"
                          title="Not measured yet — the page explains why"
                        >
                          soon
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              }
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2.5 border-l-2 px-3 py-1.5 text-[12px] transition-colors",
                        isActive
                          ? "border-signal bg-white/6 text-foreground"
                          : "border-transparent text-muted-foreground hover:bg-white/4 hover:text-foreground",
                      )
                    }
                  >
                    <Icon className="size-3.5 shrink-0" aria-hidden />
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex h-9 shrink-0 items-center gap-2 border-t border-rule px-3 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft
            className={cn("size-3.5 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed ? <span className="label">Collapse</span> : null}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Persistent system bar: source state, search, global map layer. */}
        <header className="sticky top-0 z-20">
          <SystemBar onOpenSearch={() => setSearchOpen(true)} />
          <div className="flex min-h-0 items-center justify-end gap-2 border-b border-rule bg-background/95 px-3 py-1">
            {isAuthenticated ? (
              <>
                <span className="truncate text-[11px] text-muted-foreground">
                  {user?.name ?? user?.email ?? "Member"}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="label border border-rule px-2 py-1 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  navigate(
                    `/auth?returnTo=${encodeURIComponent(window.location.pathname)}`,
                  )
                }
                className="label border border-rule px-2 py-1 transition-colors hover:border-foreground hover:text-foreground"
              >
                Sign in to save a watchlist
              </button>
            )}
          </div>
        </header>

        {/* The current selection follows you between pages, so drilling in and
            coming back never loses what you were looking at. */}
        {focus ? (
          <div className="sticky top-[4.25rem] z-20 flex items-center gap-2 border-b border-signal/40 bg-signal/10 px-3 py-1.5">
            <span className="label text-signal">Inspecting</span>
            <span className="min-w-0 truncate text-[12px]">{focusLabel(focus)}</span>
            <Link
              to={focusRoute(focus)}
              className="label ml-auto shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              Open profile →
            </Link>
            <button
              type="button"
              onClick={clear}
              title="Clear selection (Esc)"
              className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : null}

        {children}
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
      {/* Countries get the ten-module board; every other entity keeps the
          six-question drawer. One drawer per kind, not two competing ones. */}
      {focus?.kind === "node" ? (
        <CountryDrawer nodeId={focus.id} />
      ) : (
        <FocusDrawer />
      )}
    </div>
  );
}

/** Plain-language name for whatever is currently selected. */
function focusLabel(focus: NonNullable<ReturnType<typeof useFocus>["focus"]>) {
  switch (focus.kind) {
    case "node":
      return getNode(focus.id).label;
    case "event":
      return `Event ${focus.id}`;
    case "industry":
      return focus.id;
    case "channel":
      return `${focus.id} channel`;
  }
}

function focusRoute(focus: NonNullable<ReturnType<typeof useFocus>["focus"]>) {
  switch (focus.kind) {
    case "node":
      return `/app/country/${focus.id}`;
    case "event":
      return `/app/event/${focus.id}`;
    case "industry":
      return `/app/industry/${focus.id}`;
    case "channel":
      return "/app/risk";
  }
}

/** Standard page header — compact, no marketing typography. */
export function PageHead({
  title,
  lede,
  actions,
}: {
  title: string;
  lede: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 border-b border-rule px-4 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-6">
      <div className="max-w-3xl">
        <h1 className="h-display">{title}</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
          {lede}
        </p>
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}