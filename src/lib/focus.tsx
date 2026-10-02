import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Channel } from "@/lib/intel/types";

/**
 * One selection, shared by everything on screen.
 *
 * Clicking a country, an event or a sector should not merely highlight a row —
 * it should make every other panel on the page answer about that same thing.
 * This context is that shared selection, and it is deliberately tiny: an id and
 * a kind, plus the time window a reader has chosen. Anything more would be state
 * that panels have to reconcile, and reconciliation is where dashboards start
 * quietly disagreeing with themselves.
 */

export type Focus =
  | { kind: "node"; id: string }
  | { kind: "event"; id: string }
  | { kind: "industry"; id: string }
  | { kind: "channel"; id: Channel }
  | null;

export type TimeWindow = "1h" | "6h" | "24h" | "7d";

/**
 * Which encoding every world map on the platform is currently emphasising.
 *
 * This lives in the shared context rather than inside a single map so the
 * system bar's LOAD | EVENTS | COUPLINGS control is genuinely global: switch it
 * on Overview, walk to World, and the new map is already in that layer instead
 * of silently resetting to its own default.
 */
export type MapLayer = "load" | "events" | "couplings";

export const MAP_LAYERS: { id: MapLayer; label: string; hint: string }[] = [
  {
    id: "load",
    label: "Load",
    hint: "Land shading and node size follow derived live load.",
  },
  {
    id: "events",
    label: "Events",
    hint: "Where corpus events land hardest on the network.",
  },
  {
    id: "couplings",
    label: "Couplings",
    hint: "Chokepoint-to-economy shared-event coupling. A shared pull, not a shipping lane.",
  },
];

export const WINDOW_MS: Record<TimeWindow, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

interface FocusValue {
  focus: Focus;
  /** Select, or deselect when the same thing is chosen again. */
  toggle: (next: NonNullable<Focus>) => void;
  setFocus: (next: Focus) => void;
  clear: () => void;
  /** True when this entity is the current focus — panels use it to dim the rest. */
  isFocused: (kind: NonNullable<Focus>["kind"], id: string) => boolean;
  /** True when something is selected, so a panel can offer a "clear" affordance. */
  hasFocus: boolean;
  window: TimeWindow;
  setWindow: (w: TimeWindow) => void;
  layer: MapLayer;
  setLayer: (l: MapLayer) => void;
}

const FocusContext = createContext<FocusValue | null>(null);

export function FocusProvider({ children }: { children: ReactNode }) {
  const [focus, setFocus] = useState<Focus>(null);
  const [window, setWindow] = useState<TimeWindow>("24h");
  const [layer, setLayer] = useState<MapLayer>("load");

  const toggle = useCallback((next: NonNullable<Focus>) => {
    setFocus((current) =>
      current && current.kind === next.kind && current.id === next.id
        ? null
        : next,
    );
  }, []);

  const clear = useCallback(() => setFocus(null), []);

  const isFocused = useCallback(
    (kind: NonNullable<Focus>["kind"], id: string) =>
      focus?.kind === kind && focus.id === id,
    [focus],
  );

  // Escape always backs out of a selection, from anywhere in the console. It is
  // the keyboard equivalent of clicking the same thing twice.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      const target = event.target as HTMLElement | null;
      // Never steal Escape from a text field or an open dialog.
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      setFocus(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const value = useMemo<FocusValue>(
    () => ({
      focus,
      toggle,
      setFocus,
      clear,
      isFocused,
      hasFocus: focus !== null,
      window,
      setWindow,
      layer,
      setLayer,
    }),
    [focus, toggle, clear, isFocused, window, layer],
  );

  return <FocusContext.Provider value={value}>{children}</FocusContext.Provider>;
}

export function useFocus(): FocusValue {
  const value = useContext(FocusContext);
  if (!value) {
    throw new Error("useFocus must be used inside FocusProvider");
  }
  return value;
}

/**
 * The same context, but null outside the console shell.
 *
 * Shared components (the world map in particular) are also rendered by the
 * public landing page, which has no FocusProvider. They degrade to their own
 * local state instead of crashing the marketing surface.
 */
export function useOptionalFocus(): FocusValue | null {
  return useContext(FocusContext);
}