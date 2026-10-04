import {
  Activity,
  Bell,
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
    label: "Propagation",
    items: [
      // Labelled for what the page actually is. It was called "Energy" while
      // rendering the event→world chain, which sent readers looking for a
      // commodity view that has no connected price feed behind it.
      { to: "/app/chain", label: "Event → world", icon: Route },
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
 * The top bar. Five, because a sixth would start to wrap at 1280px and a wrapped
 * centre section pushes the wordmark and the account cluster out of alignment.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/app", label: "Explore", icon: Compass, end: true },
  { to: "/app/world", label: "World", icon: Globe2 },
  { to: "/app/events", label: "Events", icon: Activity },
  { to: "/app/markets", label: "Markets", icon: TrendingUp },
  { to: "/app/supply", label: "Supply chain", icon: Network },
];

/**
 * The mobile bar. Same rule, and the same reason: Home and Profile are the two
 * things you want from anywhere, and only three slots remain, so the three that
 * remain are the three answers — what is happening, where, and what changed.
 * Search is here rather than Markets because on a phone the most common action
 * is jumping to a specific country, not reading an index.
 */
export const MOBILE_NAV: NavItem[] = [
  { to: "/app", label: "Home", icon: Home, end: true },
  { to: "/app/events", label: "Explore", icon: Compass },
  { to: "/app/world", label: "Map", icon: Globe2 },
  { to: "/app", label: "Search", icon: Search },
  { to: "/auth", label: "Profile", icon: User },
];

/** The right-hand cluster, in the order it is rendered. */
export const UTILITY_NAV = {
  search: { label: "Search", icon: Search },
  alerts: { label: "Alerts", icon: Bell, to: "/app/events" },
  profile: { label: "Profile", icon: User, to: "/auth" },
} as const;