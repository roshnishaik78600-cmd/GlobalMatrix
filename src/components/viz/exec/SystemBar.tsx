import type { ReactNode } from "react";
import { Link } from "react-router";
import { Menu, Search } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MAP_LAYERS, WINDOW_MS, useFocus, type MapLayer } from "@/lib/focus";
import { freshnessOf, utcStamp, type Freshness } from "@/lib/freshness";
import { sourceById } from "@/lib/sources";
import { SegmentedControl } from "./system";

/**
 * The command bar.
 *
 * A single fixed-height `h-14` row above the content viewport, carrying search,
 * source state, the two global filters and the account action. It was previously
 * two stacked rows that wrapped at small widths; two bars meant two left edges
 * that could disagree, and a wrapping bar meant the page's own header slid
 * vertically as the bar gained a line. One row, `shrink-0`, and every group
 * inside it is either truncating or hidden below a breakpoint, so the bar's
 * height is constant and nothing on it can push the layout sideways.
 *
 * Everything on it is a reading rather than a decoration. The one rule it exists
 * to enforce: a source is never called LIVE unless its own refresh window says
 * it can be, so each source carries an honest freshness tag and the bar's own
 * summary takes the worst state on screen rather than the best.
 */
export function SystemBar({
  onOpenSearch,
  onOpenNav,
  account,
}: {
  onOpenSearch: () => void;
  onOpenNav: () => void;
  account?: ReactNode;
}) {
  const health = useQuery(api.observations.sourceHealth);
  const stats = useQuery(api.intel.corpusStats);
  const { layer, setLayer, window, setWindow } = useFocus();

  const rows = health ?? [];
  const ok = rows.filter((h) => h.ok);

  // Worst-first, so a single failing connector is visible in the summary rather
  // than hidden behind a majority of healthy ones.
  const states: Freshness[] = rows.map((h) =>
    h.ok ? freshnessOf(h.retrievedAt, h.sourceId) : "unavailable",
  );
  const summary: Freshness = states.length === 0
    ? "unavailable"
    : states.some((s) => s === "unavailable")
      ? "unavailable"
      : states.some((s) => s === "delayed")
        ? "delayed"
        : states.some((s) => s === "historical")
          ? "historical"
          : states.some((s) => s === "recent")
            ? "recent"
            : "live";

  const lastUpdate = rows.reduce((max, h) => Math.max(max, h.retrievedAt), 0);
  const refreshing = rows.some((h) => h.status === "unavailable");

  return (
    <div className="flex h-14 shrink-0 items-center gap-2 border-b border-rule bg-[var(--exec-base)] px-2 sm:px-3">
      <button
        type="button"
        onClick={onOpenNav}
        aria-label="Open navigation"
        className="flex size-9 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-[var(--exec-surface)] hover:text-foreground lg:hidden"
      >
        <Menu className="size-4" />
      </button>

      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-9 min-w-0 max-w-[15rem] flex-1 items-center gap-2 rounded-lg border border-rule bg-[var(--exec-panel)] px-2.5 text-left transition-colors hover:border-[var(--exec-hairline-strong)] sm:max-w-xs 2xl:max-w-sm"
      >
        <Search className="size-3.5 shrink-0 text-[var(--exec-ink-dim)]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--exec-ink-dim)]">
          Search countries, events, routes, ports…
        </span>
        <kbd className="exec-num hidden shrink-0 rounded border border-rule px-1 text-[9px] text-[var(--exec-ink-dim)] sm:block">
          ⌘K
        </kbd>
      </button>

      {/* LIVE DATA — never a claim, always a per-source state. */}
      <Link
        to="/app/data"
        className="hidden min-w-0 shrink items-center gap-1.5 whitespace-nowrap rounded px-1 py-1 transition-colors hover:bg-[var(--exec-surface)] md:flex"
        title="Source-by-source status. Each source is only LIVE inside its own refresh window."
      >
        <PingDot
          colour={
            summary === "live"
              ? "var(--exec-emerald)"
              : summary === "unavailable"
                ? "var(--exec-crimson)"
                : summary === "delayed"
                  ? "var(--exec-amber)"
                  : "var(--exec-ink-dim)"
          }
          pulsing={summary === "live" || summary === "recent"}
        />
        <span className="exec-label">Live</span>
        <span className="exec-num text-[10.5px] text-[var(--exec-ink)]">
          {rows.length === 0
            ? "connecting"
            : `${ok.length}/${SOURCE_COUNT}`}
        </span>
      </Link>

      <span className="hidden min-w-0 shrink items-center gap-1.5 whitespace-nowrap xl:flex">
        <span className="exec-label">Updated</span>
        <span className="exec-num text-[10.5px] text-[var(--exec-ink)]">
          {lastUpdate ? utcStamp(lastUpdate) : "not yet"}
        </span>
      </span>

      <span
        className="hidden min-w-0 shrink items-center gap-1.5 whitespace-nowrap 2xl:flex"
        title="Connectors refresh themselves in the background when their cached copy ages out. Nothing on screen is reloaded to do it."
      >
        <span className="exec-label">Sync</span>
        <span className="exec-label text-[var(--exec-ink)]">
          {refreshing ? "syncing" : "on"}
        </span>
      </span>

      {/* One honest word per source, so the bar never overstates the platform.
          Clipped rather than wrapped: a chip row that grows a second line would
          change the height of a bar that everything above it positions against. */}
      {rows.length > 0 ? (
        <div className="hidden min-w-0 shrink items-center gap-1.5 overflow-hidden 2xl:flex">
          {rows.map((h) => {
            const source = sourceById(h.sourceId);
            const freshness: Freshness = h.ok
              ? freshnessOf(h.retrievedAt, h.sourceId)
              : "unavailable";
            return (
              <Link
                key={h.sourceId}
                to="/app/data"
                title={`${source?.label ?? h.sourceId} · ${
                  h.problem ?? "no problem reported"
                }`}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-rule py-0.5 pr-2 pl-1.5 transition-colors hover:border-[var(--exec-hairline-strong)]"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: FRESHNESS_DOT[freshness] }}
                  aria-hidden
                />
                <span className="exec-label max-w-[16ch] truncate">
                  {source?.label ?? h.sourceId}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}

      <span className="hidden min-w-0 shrink items-center gap-1.5 whitespace-nowrap xl:flex">
        <span className="exec-label">Signals</span>
        <span className="exec-num text-[10.5px] text-[var(--exec-ink)]">
          {activeSignals(stats)}
        </span>
      </span>

      <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2">
        {/* Global map layer and time window, shared by every map on the platform. */}
        <div className="hidden min-w-0 shrink items-center gap-1.5 lg:flex">
          <span className="exec-label">Window</span>
          <SegmentedControl
            options={WINDOW_OPTIONS}
            value={window}
            onChange={setWindow}
          />
        </div>
        <div className="hidden min-w-0 shrink items-center gap-1.5 xl:flex">
          <span className="exec-label">Layer</span>
          <SegmentedControl
            options={MAP_LAYERS}
            value={layer}
            onChange={(id) => setLayer(id as MapLayer)}
          />
        </div>
        <div className="flex min-w-0 shrink items-center gap-1.5">{account}</div>
      </div>
    </div>
  );
}

/**
 * A status dot with a ping ring.
 *
 * The ring only animates while the reading can actually change, so motion on
 * screen always means "this is live" rather than decoration.
 */
function PingDot({
  colour,
  pulsing,
}: {
  colour: string;
  pulsing: boolean;
}) {
  return (
    <span className="relative flex size-2 shrink-0" aria-hidden>
      {pulsing ? (
        <span
          className="absolute inset-0 animate-ping rounded-full opacity-60"
          style={{ background: colour }}
        />
      ) : null}
      <span
        className="relative size-2 rounded-full"
        style={{ background: colour }}
      />
    </span>
  );
}

/** Registered connectors. Deliberately the whole list, not whatever answered. */
const SOURCE_COUNT = 3;

const FRESHNESS_DOT: Record<Freshness, string> = {
  live: "var(--exec-emerald)",
  recent: "var(--exec-cyan)",
  historical: "var(--exec-ink-dim)",
  delayed: "var(--exec-amber)",
  unavailable: "var(--exec-crimson)",
};

const WINDOW_OPTIONS = (Object.keys(WINDOW_MS) as (keyof typeof WINDOW_MS)[]).map(
  (w) => ({ id: w, label: w.toUpperCase(), hint: `Last ${w}` }),
);

/** Elevated and above: the events a duty analyst would actually open. */
function activeSignals(
  stats:
    | { bands?: Record<string, number> }
    | undefined,
): number {
  const bands = stats?.bands;
  if (!bands) return 0;
  return (bands.high ?? 0) + (bands.severe ?? 0);
}