import {
  Activity,
  Bell,
  Bookmark,
  Boxes,
  Compass,
  Database,
  Factory,
  GitBranch,
  Globe2,
  Home,
  LayoutGrid,
  Network,
  Radar,
  Route,
  ScrollText,
  Share2,
  Search,
  TrendingUp,
  User,
  type LucideIcon,
} from "lucide-react";

/**
 * The information architecture of GlobalMatrix.
 *
 * Three tiers, and the reason they are three rather than one is legibility. A
 * single flat list of eighteen destinations is past the point where a reader can
 * hold it in their head — every item looks equally important, so none of them
 * is. The tiers each answer one question:
 *
 *   1. `PRIMARY`   — the five a visitor is most likely to want. Top bar, always
 *                    visible, never more than five of them.
 *   2. `NAV_GROUPS` — the complete directory, grouped by *kind of question*
 *                    rather than by feature. Reached from Explore.
 *   3. `MOBILE`    — the five that survive a 390px viewport.
 *
 * Two rules the grouping enforces:
 *
 * 1. A destination with no connected source is shown greyed with its reason
 *    rather than hidden. Hiding it would imply the capability does not exist;
 *    showing it greyed states the honest reason and still teaches the reader
 *    what the product is *for*.
 * 2. Every route reachable from the old rail is still reachable from the
 *    Explore panel. The navigation was restructured, not reduced.
 *
 * This module holds no JSX so the top bar, the explore panel, the mobile bar and
 * the command palette can all render from one definition and cannot drift.
 */

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  /** Set when no source is connected behind this destination. */
  unavailable?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: "global",
    label: "Global",
    items: [
      { to: "/app", label: "Overview", icon: LayoutGrid, end: true },
      { to: "/app/world", label: "World map", icon: Globe2 },
      { to: "/app/events", label: "Events", icon: Activity },
    ],
  },
  {
    id: "economy",
    label: "Economy",
    items: [
      { to: "/app/countries", label: "Countries", icon: Globe2 },
      { to: "/app/trade", label: "Trade", icon: Boxes },
      { to: "/app/markets", label: "Markets", icon: TrendingUp },
      { to: "/app/supply", label: "Supply chains", icon: Network },
    ],
  },
  {
    id: "propagation",
    label: "Impact",
    items: [
      // The signature feature: the nine-stage propagation chain. Labelled for
      // what the page actually is — it was called "Energy" while rendering the
      // event→world chain, which sent readers looking for a commodity view that
      // has no connected price feed behind it.
      { to: "/app/chain", label: "Impact graph", icon: Route },
      { to: "/app/graph", label: "Knowledge graph", icon: Share2 },
    ],
  },
  {
    id: "networks",
    label: "Networks",
    items: [
      { to: "/app/industries", label: "Industries", icon: Boxes },
      { to: "/app/companies", label: "Companies", icon: Factory, unavailable: "no company-level data connected" },
    ],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    items: [
      { to: "/app/risk", label: "Risk", icon: Radar },
      { to: "/app/scenarios", label: "Scenarios", icon: Radar },
      { to: "/app/analyst", label: "AI analyst", icon: Activity },
      { to: "/app/policy", label: "Policy", icon: ScrollText, unavailable: "no policy registry connected" },
      { to: "/app/analogues", label: "Analogues", icon: Boxes, unavailable: "no historical corpus connected" },
    ],
  },
  {
    id: "personal",
    label: "Personal",
    items: [
      // What you are tracking: events, countries and industries you have
      // bookmarked, gathered in one place.
      { to: "/app/watchlist", label: "Watchlist", icon: Bookmark },
    ],
  },
  {
    id: "data",
    label: "Data",
    items: [
      { to: "/app/data", label: "Sources", icon: Database },
      { to: "/methodology", label: "Methodology", icon: GitBranch },
    ],
  },
];

/** Flat view, used by the command palette and anywhere that just needs routes. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** How many destinations are actually reachable — stated, not implied. */
export const NAV_AVAILABLE_COUNT = NAV_ITEMS.filter((i) => !i.unavailable).length;

/**
 * The top bar: the seven questions the product answers, in the order a reader
 * asks them — explore the world, see what happened, follow the impact, check
 * who is exposed, run a scenario, open your watchlist, read the intelligence.
 *
 * Rendered as labels only (icons live in the Explore panel and the mobile bar)
 * so all seven fit without wrapping: the first five show from `lg`, all seven
 * from `xl`. A wrapped centre section would push the wordmark and the account
 * cluster out of alignment, so the later items yield on narrow desktops rather
 * than overlap them.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/app", label: "Explore", icon: Compass, end: true },
  { to: "/app/events", label: "Events", icon: Activity },
  { to: "/app/chain", label: "Impact", icon: Route },
  { to: "/app/risk", label: "Exposure", icon: Radar },
  { to: "/app/scenarios", label: "Scenarios", icon: Radar },
  { to: "/app/watchlist", label: "Watchlist", icon: Bookmark },
  { to: "/app/analyst", label: "Intelligence", icon: TrendingUp },
];

/** Index in `PRIMARY_NAV` from which the bar waits for `xl` before showing. */
export const PRIMARY_NAV_XL_FROM = 5;

/**
 * The mobile bar. Same rule, and the same reason: Explore and Profile are the
 * two things you want from anywhere, and only three slots remain, so the three
 * that remain are the three answers — what is happening, where, and the map.
 * Search is here because on a phone the most common action is jumping to a
 * specific country, not reading an index.
 */
export const MOBILE_NAV: NavItem[] = [
  { to: "/app", label: "Explore", icon: Home, end: true },
  { to: "/app/events", label: "Events", icon: Activity },
  { to: "/app/world", label: "Map", icon: Globe2 },
  { to: "/app", label: "Search", icon: Search },
  { to: "/login", label: "Profile", icon: User },
];

/** The right-hand cluster, in the order it is rendered. */
export const UTILITY_NAV = {
  search: { label: "Search", icon: Search },
  alerts: { label: "Alerts", icon: Bell, to: "/app/events" },
  profile: { label: "Profile", icon: User, to: "/login" },
} as const;