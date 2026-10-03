import { useState, type ReactNode, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ChevronLeft, X } from "lucide-react";
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

/**
 * The console shell.
 *
 * One flex row, two children, and exactly one scroll container:
 *
 *     [ w-64 shrink-0 sidebar ][ flex-1 min-w-0 column ]
 *                                        ├ h-14 command bar (shrink-0)
 *                                        └ flex-1 min-w-0 overflow-y-auto
 *
 * Three invariants make the difference between this and a layout that collapses
 * under pressure, and each one is load-bearing rather than decorative:
 *
 * 1. `h-dvh` + `overflow-hidden` on the root, and a single `overflow-y-auto`
 *    viewport. The document itself never scrolls, so a sticky sidebar cannot
 *    drift, a sticky header cannot detach from its own column, and a page that
 *    is taller than the viewport cannot push its own footer out of reach.
 * 2. `shrink-0` on the sidebar. Without it the rail is a flex item competing for
 *    space with the page, and it loses — squeezing the main column toward zero
 *    width, which is what makes text degrade into one-character columns.
 * 3. `min-w-0` on the column and on the viewport. A flex item's default
 *    `min-width: auto` is its content's min-content width, so a single wide
 *    table or map propagates upward and refuses to let the column shrink. One
 *    `min-w-0` at the boundary is what stops that reaching the text.
 */
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
    <div className="flex h-dvh w-full overflow-hidden bg-background text-foreground">
      {/* Rail. Removed from flow below `lg` rather than narrowed: a 256px rail
          inside a 390px viewport would leave 134px of content, which is a
          squeeze, not a layout. */}
      <aside
        className={cn(
          "hidden shrink-0 flex-col border-r border-rule bg-[var(--sidebar)] transition-[width] duration-200 lg:flex",
          collapsed ? "w-[60px]" : "w-64",
        )}
      >
        <Link
          to="/app"
          className="flex h-14 shrink-0 items-center gap-2.5 border-b border-rule px-4"
        >
          <span
            className="size-2 shrink-0 rounded-sm bg-[var(--exec-cyan)]"
            aria-hidden
          />
          {/* `min-w-0` before `truncate`: truncation only engages on a flex item
              that is allowed to shrink in the first place. */}
          {!collapsed ? (
            <span className="min-w-0 flex-1 truncate text-[12px] font-semibold tracking-[0.18em] text-[var(--exec-ink)] uppercase">
              GlobalMatrix
            </span>
          ) : null}
        </Link>

        <nav
          className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto py-1"
          aria-label="Primary"
        >
          <NavList collapsed={collapsed} />
        </nav>

        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          className={cn(
            "flex h-10 shrink-0 items-center gap-2 border-t border-rule px-4 text-muted-foreground transition-colors hover:bg-[var(--exec-surface)] hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
        >
          <ChevronLeft
            className={cn("size-3.5 shrink-0 transition-transform", collapsed && "rotate-180")}
          />
          {!collapsed ? <span className="label truncate">Collapse</span> : null}
        </button>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <SystemBar
          onOpenSearch={() => setSearchOpen(true)}
          onOpenNav={() => setNavOpen(true)}
          account={
            isAuthenticated ? (
              <>
                <span className="hidden min-w-0 truncate text-[11px] text-muted-foreground xl:inline">
                  {user?.name ?? user?.email ?? "Member"}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="label shrink-0 rounded border border-rule px-2 py-1 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  Sign out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() =>
                  navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`)
                }
                className="label shrink-0 rounded border border-rule px-2 py-1 transition-colors hover:border-foreground hover:text-foreground"
              >
                Sign in
              </button>
            )
          }
        />

        {/* The current selection follows you between pages, so drilling in and
            coming back never loses what you were looking at. Part of the normal
            flow rather than sticky: inside the scroll viewport, a sticky strip
            would overlay the first row of every table it appeared above. */}
        {focus ? (
          <div className="flex min-w-0 shrink-0 items-center gap-2 border-b border-signal/40 bg-signal/10 px-3 py-1.5">
            <span className="label shrink-0 text-signal">Inspecting</span>
            <span className="min-w-0 flex-1 truncate text-[12px]">
              {focusLabel(focus)}
            </span>
            <Link
              to={focusRoute(focus)}
              className="label shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              Open profile →
            </Link>
            <button
              type="button"
              onClick={clear}
              title="Clear selection (Esc)"
              aria-label="Clear selection"
              className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          </div>
        ) : null}

        {/* The one scroll container. Everything above is fixed height, so a long
            page scrolls here and nowhere else. */}
        <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain">
          {children}
        </div>
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