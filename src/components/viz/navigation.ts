import {
  Activity,
  Boxes,
  Database,
  Factory,
  Globe2,
  LayoutGrid,
  Network,
  Radar,
  ScrollText,
  type LucideIcon,
} from "lucide-react";

/**
 * The information architecture of the console.
 *
 * Navigation used to be one flat list of sixteen entries, which is past the
 * point where a reader can hold it in their head — every item looks equally
 * important, so none of them is. Grouping them by *kind of question* rather
 * than by feature lets a reader find a section by asking what they want
 * ("where does this land?" → World; "what does it touch?" → Networks) instead
 * of by remembering a name.
 *
 * Two rules the grouping enforces:
 *
 * 1. Five groups, eight visible destinations at most per group. Anything that
 *    cannot justify a slot stays reachable from the palette and the page it
 *    belongs to.
 * 2. A destination with no connected source is shown greyed with its reason
 *    rather than hidden. Hiding it would imply the capability does not exist;
 *    showing it greyed states the honest reason and still teaches the reader
 *    what the product is *for*.
 *
 * This module holds no JSX so both the desktop rail and the mobile sheet can
 * render from one definition and can never drift apart.
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
      { to: "/app/markets", label: "Markets", icon: Activity },
      { to: "/app/chain", label: "Energy", icon: Network },
    ],
  },
  {
    id: "networks",
    label: "Networks",
    items: [
      { to: "/app/supply", label: "Supply chains", icon: Network },
      { to: "/app/industries", label: "Industries", icon: Boxes },
      { to: "/app/companies", label: "Companies", icon: Factory, unavailable: "no company-level data connected" },
      { to: "/app/graph", label: "Knowledge graph", icon: Network },
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
    ],
  },
];

/** Flat view, used by the command palette and anywhere that just needs routes. */
export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** How many destinations are actually reachable — stated, not implied. */
export const NAV_AVAILABLE_COUNT = NAV_ITEMS.filter((i) => !i.unavailable).length;