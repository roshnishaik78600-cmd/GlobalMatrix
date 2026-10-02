import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { X } from "lucide-react";
import { useQuery } from "convex/react";
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
  Search,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useAuthAction } from "@/hooks/use-auth-action";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
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

  const stats = useQuery(api.intel.corpusStats);
  const health = useQuery(api.observations.sourceHealth);

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
        {/* Command bar + status */}
        <header className="sticky top-0 z-20 border-b border-rule bg-background/95 backdrop-blur">
          <div className="flex h-12 items-center gap-3 px-3">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 min-w-0 flex-1 items-center gap-2 border border-rule bg-card px-2.5 text-left transition-colors hover:border-foreground/40 sm:max-w-md"
            >
              <Search className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate text-[12px] text-muted-foreground">
                Search events, countries, sectors, infrastructure…
              </span>
              <kbd className="num ml-auto hidden shrink-0 border border-rule px-1 text-[9px] text-muted-foreground sm:block">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-3 overflow-x-auto">
              <StatusStrip stats={stats} health={health} />
              <div className="hidden items-center gap-2 border-l border-rule pl-3 sm:flex">
                {isAuthenticated ? (
                  <>
                    <span className="hidden max-w-[14ch] truncate text-[11px] text-muted-foreground lg:block">
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
                    className="label bg-foreground px-2.5 py-1 text-background transition-opacity hover:opacity-85"
                  >
                    Sign in to save
                  </button>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* The current selection follows you between pages, so drilling in and
            coming back never loses what you were looking at. */}
        {focus ? (
          <div className="sticky top-12 z-20 flex items-center gap-2 border-b border-signal/40 bg-signal/10 px-3 py-1.5">
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
      <FocusDrawer />
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

/**
 * Status strip.
 *
 * Every value here is read from something real: how many connected sources are
 * answering, when the last one answered, and how many events and places the
 * corpus covers. Nothing is hardcoded, and nothing claims to be live when it
 * is not — a quiet source says so.
 */
function StatusStrip({
  stats,
  health,
}: {
  stats:
    | { events: number; signals: number; actors: number; nodes: number; countries: number }
    | undefined;
  health:
    | { sourceId: string; ok: boolean; status: string; retrievedAt: number; problem?: string }[]
    | undefined;
}) {
  const live = (health ?? []).filter((h) => h.ok).length;
  const total = health?.length ?? 0;
  const lastUpdate = (health ?? []).reduce((max, h) => Math.max(max, h.retrievedAt), 0);
  const anyLive = live > 0;

  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="flex items-center gap-1.5 whitespace-nowrap">
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            anyLive ? "bg-stable" : "bg-muted-foreground/50",
          )}
          aria-hidden
        />
        <span className="label text-muted-foreground">Live data</span>
        <span className="num text-[12px] font-medium">
          {total === 0 ? "connecting" : `${live}/${total}`}
        </span>
      </span>

      <span className="hidden items-baseline gap-1.5 whitespace-nowrap lg:flex">
        <span className="label text-muted-foreground">Last updated</span>
        <span className="num text-[12px] font-medium">
          {lastUpdate ? timeAgo(lastUpdate) : "not yet"}
        </span>
      </span>

      {[
        ["Sources", total],
        ["Events", stats?.events],
        ["Countries", stats?.countries],
      ].map(([label, value]) => (
        <span
          key={label as string}
          className="hidden items-baseline gap-1.5 whitespace-nowrap md:flex"
        >
          <span className="label text-muted-foreground">{label}</span>
          <span className="num text-[12px] font-medium">{value ?? "—"}</span>
        </span>
      ))}

      <span
        className="label hidden text-muted-foreground xl:block"
        title="The event corpus is a scenario, not a live feed. The live figures are the source counts above."
      >
        {CORPUS_LABEL}
      </span>
    </div>
  );
}

/** Compact relative time for the header, where space is tight. */
function timeAgo(ms: number): string {
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
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