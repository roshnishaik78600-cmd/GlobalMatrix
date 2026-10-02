import { useState, type ReactNode } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import {
  Activity,
  AlertTriangle,
  Boxes,
  ChevronLeft,
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
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import { CommandPalette } from "@/components/intel/CommandPalette";
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
  { to: "/app/events", label: "Events", icon: Activity },
  { to: "/app/world", label: "World", icon: Globe2 },
  { to: "/app/countries", label: "Countries", icon: Globe2 },
  { to: "/app/companies", label: "Companies", icon: Factory, unavailable: "no company graph in v1" },
  { to: "/app/industries", label: "Industries", icon: Boxes },
  { to: "/app/trade", label: "Trade", icon: Boxes, unavailable: "no trade-flow data in v1" },
  { to: "/app/supply", label: "Supply chains", icon: Boxes },
  { to: "/app/markets", label: "Markets", icon: Activity, unavailable: "no market feed in v1" },
  { to: "/app/policy", label: "Policy", icon: AlertTriangle, unavailable: "no policy registry in v1" },
  { to: "/app/risk", label: "Risk", icon: AlertTriangle },
  { to: "/app/graph", label: "Graph", icon: Network },
  { to: "/app/scenarios", label: "Scenarios", icon: Radar },
  { to: "/app/analogues", label: "Analogues", icon: Boxes, unavailable: "no historical corpus in v1" },
  { to: "/app/analyst", label: "AI analyst", icon: Activity },
];

export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  const stats = useQuery(api.intel.corpusStats);

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
              Globalmatrix
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
                        <span className="ml-auto text-[8px] tracking-wider uppercase">
                          n/a
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
                Search events, countries, industries…
              </span>
              <kbd className="num ml-auto hidden shrink-0 border border-rule px-1 text-[9px] text-muted-foreground sm:block">
                ⌘K
              </kbd>
            </button>

            <div className="ml-auto flex items-center gap-3 overflow-x-auto">
              <StatusStrip stats={stats} />
              <div className="hidden items-center gap-2 border-l border-rule pl-3 sm:flex">
                <span className="hidden max-w-[14ch] truncate text-[11px] text-muted-foreground lg:block">
                  {user?.name ?? user?.email ?? "Researcher"}
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    navigate("/");
                  }}
                  className="label border border-rule px-2 py-1 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  Exit
                </button>
              </div>
            </div>
          </div>
        </header>

        {children}
      </div>

      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

/**
 * Status strip. Every value is a real count from the corpus. There is no
 * ingestion pipeline behind this app, so no freshness or uptime is claimed.
 */
function StatusStrip({
  stats,
}: {
  stats: { events: number; signals: number; actors: number; nodes: number } | undefined;
}) {
  return (
    <div className="flex items-center gap-3 sm:gap-4">
      <span className="flex items-center gap-1.5">
        <span className="size-1.5 bg-stable" aria-hidden />
        <span className="label text-muted-foreground">Corpus loaded</span>
      </span>
      {[
        ["Events", stats?.events],
        ["Signals", stats?.signals],
        ["Actors", stats?.actors],
        ["Nodes", stats?.nodes],
      ].map(([label, value]) => (
        <span key={label as string} className="hidden items-baseline gap-1.5 md:flex">
          <span className="label text-muted-foreground">{label}</span>
          <span className="num text-[12px] font-medium">
            {value ?? "—"}
          </span>
        </span>
      ))}
      <span className="label hidden text-muted-foreground lg:block">
        {CORPUS_LABEL}
      </span>
    </div>
  );
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