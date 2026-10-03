import { useState, type ReactNode, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, Menu, X } from "lucide-react";
import { SystemBar } from "@/components/viz/exec/SystemBar";
import { CountryDrawer } from "@/components/viz/exec/CountryDrawer";
import { useAuth } from "@/hooks/use-auth";
import { useAuthAction } from "@/hooks/use-auth-action";
import { CommandPalette } from "@/components/intel/CommandPalette";
import { NavList, NavSheet } from "@/components/viz/NavRail";
import { FocusDrawer } from "@/components/viz/FocusPanel";
import { useFocus } from "@/lib/focus";
import { getNode } from "@/lib/intel/nodes";
import { cn } from "@/lib/utils";


export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAuthenticated } = useAuthAction();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
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
        // Hidden outright below lg. A 212px rail inside a 390px viewport
        // leaves 178px for content, so the rail collapses into the sheet
        // instead of squeezing the page it is meant to frame.
        className={cn(
          "sticky top-0 z-30 hidden h-screen shrink-0 flex-col border-r border-rule bg-[var(--sidebar)] transition-[width] duration-200 lg:flex",
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
          <NavList collapsed={collapsed} />
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
          {/* The menu button occupies exactly the sidebar's width so the
              content beneath it does not shift when navigation moves between
              the rail and the sheet. */}
          <div className="flex items-center border-b border-rule lg:hidden">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="Open navigation"
              aria-expanded={navOpen}
              className="flex h-12 w-12 shrink-0 items-center justify-center border-r border-rule text-muted-foreground transition-colors hover:text-foreground"
            >
              <Menu className="size-4" />
            </button>
            <span className="min-w-0 truncate px-3 text-[11px] font-semibold tracking-[0.18em] uppercase">
              GlobalMatrix
            </span>
          </div>
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

      <NavSheet open={navOpen} onClose={() => setNavOpen(false)} />
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