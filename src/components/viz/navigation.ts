import {
  Activity,
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
 * Four sections, and the reason they are four rather than one is legibility. A
 * single flat list of nineteen destinations is past the point where a reader can
 * hold it in their head — every item looks equally important, so none of them
 * is. The sections each answer one question, in the order a reader asks them:
 *
 *   INTELLIGENCE  what happened, where, and how it propagates
 *   EXPOSURE      who and what is carrying the impact
 *   ANALYSIS      what could happen next, and the brief written about it
 *   SYSTEM        what this data is, and where it came from
 *
 * Three rules the structure enforces:
 *
 * 1. **Every sidebar label is the name the destination calls itself.** "Risk
 *    explorer" opens a page headed "Risk explorer", "World map" a page headed
 *    "World map". The previous set carried framing words instead — "Exposure"
 *    for the risk matrix, "Intelligence" for the AI analyst — so a reader
 *    clicked one thing and landed on something named something else.
 *
 *    The top bar and the mobile bar use the *short form* of the same names
 *    ("Risk", "Impact", "Scenarios", "Map"), never a different name, because
 *    those two bars have a fixed width budget of seven and five slots. A short
 *    form of the destination's own name is an abbreviation; a framing word is a
 *    different claim.
 *
 *    Before renaming anything here, extract the target page's own `eyebrow`
 *    and `title` from `src/pages/*.tsx` and match one of them.
 * 2. A destination with no connected source is shown greyed with its reason
 *    rather than hidden. Hiding it would imply the capability does not exist;
 *    showing it greyed states the honest reason and still teaches the reader
 *    what the product is *for*.
 * 3. Every route that was reachable from the old rail is still reachable here.
 *    The navigation was restructured, not reduced.
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
    id: "intelligence",
    label: "Intelligence",
    items: [
      { to: "/app", label: "Overview", icon: LayoutGrid, end: true },
      { to: "/app/events", label: "Events", icon: Activity },
      { to: "/app/world", label: "World map", icon: Globe2 },
      { to: "/app/risk", label: "Risk explorer", icon: Radar },
      { to: "/app/chain", label: "Impact graph", icon: Route },
      { to: "/app/graph", label: "Knowledge graph", icon: Share2 },
    ],
  },
  {
    id: "exposure",
    label: "Exposure",
    items: [
      { to: "/app/countries", label: "Countries", icon: Globe2 },
      { to: "/app/industries", label: "Industries", icon: Boxes },
      { to: "/app/supply", label: "Supply chains", icon: Network },
      { to: "/app/trade", label: "Trade", icon: Boxes },
      { to: "/app/markets", label: "Markets", icon: TrendingUp },
      { to: "/app/watchlist", label: "Watchlist", icon: Bookmark },
      {
        to: "/app/companies",
        label: "Companies",
        icon: Factory,
        unavailable: "no company-level data connected",
      },
    ],
  },
  {
    id: "analysis",
    label: "Analysis",
    items: [
      { to: "/app/scenarios", label: "Scenario lab", icon: Radar },
      { to: "/app/analyst", label: "AI analyst", icon: Activity },
      {
        to: "/app/policy",
        label: "Policy",
        icon: ScrollText,
        unavailable: "no policy registry connected",
      },
      {
        to: "/app/analogues",
        label: "Analogues",
        icon: Boxes,
        unavailable: "no historical corpus connected",
      },
    ],
  },
  {
    id: "system",
    label: "System",
    items: [
      { to: "/app/data", label: "Sources", icon: Database },
      { to: "/methodology", label: "Methodology", icon: GitBranch },
    ],
  },
];

/**
 * The top bar: the seven questions the product answers, in the order a reader
 * asks them — explore the world, see what happened, follow the impact, check who
 * is exposed, run a scenario, open your watchlist, read the analyst's brief.
 *
 * Rendered as labels only (icons live in the Explore panel and the mobile bar)
 * so all seven fit without wrapping: the first five show from `lg`, all seven
 * from `xl`. A wrapped centre section would push the wordmark and the account
 * cluster out of alignment, so the later items yield on narrow desktops rather
 * than overlap them.
 *
 * Labels are kept to the page's own short name and deliberately not lengthened
 * for framing: the bar's whole budget is seven items on a 1024px row, and each
 * extra character is width the account cluster does not have.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: "/app", label: "Explore", icon: Compass, end: true },
  { to: "/app/events", label: "Events", icon: Activity },
  { to: "/app/chain", label: "Impact", icon: Route },
  { to: "/app/risk", label: "Risk", icon: Radar },
  { to: "/app/scenarios", label: "Scenarios", icon: Radar },
  { to: "/app/watchlist", label: "Watchlist", icon: Bookmark },
  { to: "/app/analyst", label: "AI analyst", icon: TrendingUp },
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
