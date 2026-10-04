import { useState, type ReactNode, useEffect } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import { Bell, Search, User, X, LogOut } from "lucide-react";
import { CountryDrawer } from "@/components/viz/exec/CountryDrawer";
import { useAuth } from "@/hooks/use-auth";
import { useAuthAction } from "@/hooks/use-auth-action";
import { CommandPalette } from "@/components/intel/CommandPalette";
import { ExplorePanel } from "@/components/viz/NavRail";
import { FocusDrawer } from "@/components/viz/FocusPanel";
import { useFocus } from "@/lib/focus";
import { getNode } from "@/lib/intel/nodes";
import { MOBILE_NAV, PRIMARY_NAV, type NavItem } from "@/components/viz/navigation";
import { cn } from "@/lib/utils";

/**
 * The application shell.
 *
 *     [ sticky top bar, h-16 ]
 *     [ one scroll viewport      ]
 *
 * Three invariants make the difference between this and a layout that collapses
 * under pressure, and each one is load-bearing rather than decorative:
 *
 * 1. `h-dvh` + `overflow-hidden` on the root, and a single `overflow-y-auto`
 *    viewport. The document itself never scrolls, so a sticky header cannot
 *    detach from its own column, and a page taller than the viewport cannot
 *    push its own footer out of reach.
 * 2. `min-w-0` on the column and on the viewport. A flex item's default
 *    `min-width: auto` is its content's min-content width, so a single wide
 *    table or map propagates upward and refuses to let the column shrink. One
 *    `min-w-0` at the boundary is what stops that reaching the text.
 * 3. The bottom padding on the viewport is sized to the mobile bar's height on
 *    small screens and released above `lg`. A fixed bottom bar that overlays the
 *    content is the single most common way a mobile layout hides its own last
 *    row; here the content is padded out of its way instead.
 */
export function Shell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const { isAuthenticated } = useAuthAction();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
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

  const signIn = () =>
    navigate(`/auth?returnTo=${encodeURIComponent(window.location.pathname)}`);

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-background text-foreground">
      {/* Top navigation. `shrink-0` so it never takes part in the scroll, and the
          page body below is the one and only scroll container. */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-[var(--exec-hairline)] bg-[var(--exec-base)]">
        <div className="gm-width flex h-16 items-center gap-3 px-4 lg:gap-6 lg:px-8">
          {/* Left — the wordmark. */}
          <Link
            to="/app"
            className="flex min-w-0 shrink-0 items-center gap-2.5"
            aria-label="GlobalMatrix, overview"
          >
            <span
              className="size-2 shrink-0 rounded-sm bg-[var(--exec-cyan)]"
              aria-hidden
            />
            <span className="truncate text-[14px] font-semibold tracking-[0.2em] text-[var(--exec-ink)] uppercase">
              Globalmatrix
            </span>
          </Link>

          {/* Centre — the five primary destinations. Hidden below `lg`, where the
              bottom bar and the Explore button take over. */}
          <nav
            className="hidden min-w-0 flex-1 items-center justify-center gap-1 lg:flex"
            aria-label="Primary"
          >
            {PRIMARY_NAV.map((item) => (
              <TopLink key={item.to} item={item} />
            ))}
          </nav>

          {/* Right — search, alerts, profile. Each is an icon button with a
              tooltip and an accessible name, because the icons are only
              meaningful once you already know the product. */}
          <div className="ml-auto flex shrink-0 items-center gap-1.5">
            <IconButton
              label="Search"
              hint="Search countries, events, industries and screens (⌘K)"
              onClick={() => setSearchOpen(true)}
            >
              <Search className="size-4" />
            </IconButton>

            <Link
              to="/app/events"
              title="Alerts — the watchlist filter on the events observatory"
              aria-label="Alerts"
              className="hidden size-9 items-center justify-center rounded-lg border border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)] sm:flex"
            >
              <Bell className="size-4" />
            </Link>

            {isAuthenticated ? (
              <div className="hidden items-center gap-2 lg:flex">
                <span className="max-w-[12ch] truncate text-[13px] text-[var(--exec-ink-dim)]">
                  {user?.name ?? user?.email ?? "Member"}
                </span>
                <button
                  type="button"
                  onClick={handleSignOut}
                  title="Sign out"
                  className="flex size-9 items-center justify-center rounded-lg border border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)]"
                >
                  <LogOut className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={signIn}
                className="hidden shrink-0 rounded-lg border border-[var(--exec-hairline-strong)] px-3 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)] lg:block"
              >
                Sign in
              </button>
            )}

            {/* The whole directory, one tap away on every viewport. */}
            <button
              type="button"
              onClick={() => setExploreOpen(true)}
              title="Explore every destination"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--exec-hairline)] px-2.5 text-[13px] text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-hairline-strong)] sm:px-3"
            >
              <User className="size-4 lg:hidden" aria-hidden />
              Explore
            </button>
          </div>
        </div>

        {/* The current selection follows you between pages, so drilling in and
            coming back never loses what you were looking at. Part of the normal
            flow rather than fixed, so it can never overlap the page beneath it. */}
        {focus ? (
          <div className="border-t border-[var(--exec-hairline)] bg-[var(--exec-surface)]">
            <div className="gm-width flex min-w-0 items-center gap-2 px-4 py-2 lg:px-8">
              <span className="exec-label shrink-0 text-[var(--exec-cyan)]">
                Inspecting
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--exec-ink)]">
                {focusLabel(focus)}
              </span>
              <Link
                to={focusRoute(focus)}
                className="exec-label shrink-0 text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
              >
                Open profile →
              </Link>
              <button
                type="button"
                onClick={clear}
                title="Clear selection (Esc)"
                aria-label="Clear selection"
                className="flex size-6 shrink-0 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </header>

      {/* The one scroll container. Everything above is fixed height, so a long
          page scrolls here and nowhere else. `pb-24 lg:pb-0` reserves the space
          the fixed mobile bar occupies rather than letting it cover a row. */}
      <div className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain pb-20 lg:pb-0">
        {children}
      </div>

      {/* Mobile: the same five, as a bar. */}
      <MobileBar onOpenSearch={() => setSearchOpen(true)} />

      <ExplorePanel open={exploreOpen} onClose={() => setExploreOpen(false)} />
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

/** A top-bar link. Active state is a text colour plus an underline, not a fill. */
function TopLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          "relative flex min-w-0 shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-[14px] transition-colors",
          isActive
            ? "text-[var(--exec-ink)]"
            : "text-[var(--exec-ink-dim)] hover:text-[var(--exec-ink)]",
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon className="size-4 shrink-0" aria-hidden />
          <span className="whitespace-nowrap">{item.label}</span>
          <span
            aria-hidden
            className={cn(
              "absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[var(--exec-cyan)] transition-opacity",
              isActive ? "opacity-100" : "opacity-0",
            )}
          />
        </>
      )}
    </NavLink>
  );
}

/** Icon button with a tooltip and an accessible name, on a bordered well. */
function IconButton({
  label,
  hint,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      aria-label={label}
      className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)]"
    >
      {children}
    </button>
  );
}

/**
 * The mobile bar.
 *
 * Fixed to the bottom, five items, and the viewport above it is padded to match,
 * so it never covers a card, a table row or a form control. Search and Profile
 * are actions rather than destinations here, so they are buttons; the other
 * three are routes.
 */
function MobileBar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { isAuthenticated } = useAuthAction();
  const signIn = () =>
    window.location.assign(
      `/auth?returnTo=${encodeURIComponent(window.location.pathname)}`,
    );

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 shrink-0 items-stretch border-t border-[var(--exec-hairline)] bg-[var(--exec-base)] lg:hidden"
      aria-label="Primary"
    >
      {MOBILE_NAV.map((item) => {
        const Icon = item.icon;
        // Search and Profile are actions on mobile, not routes: a fifth tab that
        // navigated nowhere would be a worse answer than one that opens the
        // thing it is named after.
        if (item.icon === Search) {
          return (
            <MobileButton key="search" label="Search" onClick={onOpenSearch}>
              <Icon className="size-5" />
            </MobileButton>
          );
        }
        if (item.icon === User) {
          return isAuthenticated ? (
            <MobileLink key="profile" to={item.to} label={item.label}>
              <Icon className="size-5" />
            </MobileLink>
          ) : (
            <MobileButton key="profile" label="Profile" onClick={signIn}>
              <Icon className="size-5" />
            </MobileButton>
          );
        }
        return (
          <MobileLink key={item.to} to={item.to} label={item.label} end={item.end}>
            <Icon className="size-5" />
          </MobileLink>
        );
      })}
    </nav>
  );
}

function MobileLink({
  to,
  label,
  end,
  children,
}: {
  to: string;
  label: string;
  end?: boolean;
  children: ReactNode;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[12px] transition-colors",
          isActive
            ? "text-[var(--exec-cyan)]"
            : "text-[var(--exec-ink-dim)]",
        )
      }
    >
      {children}
      <span>{label}</span>
    </NavLink>
  );
}

function MobileButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[12px] text-[var(--exec-ink-dim)] transition-colors"
    >
      {children}
      <span>{label}</span>
    </button>
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