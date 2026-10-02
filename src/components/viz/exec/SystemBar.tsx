import { Link } from "react-router";
import { Search } from "lucide-react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { MAP_LAYERS, WINDOW_MS, useFocus, type MapLayer } from "@/lib/focus";
import { freshnessOf, utcStamp, type Freshness } from "@/lib/freshness";
import { sourceById } from "@/lib/sources";
import { SegmentedControl } from "./system";

/**
 * The persistent system bar.
 *
 * Everything on it is a reading rather than a decoration. The one rule it exists
 * to enforce: a source is never called LIVE unless its own refresh window says
 * it can be, so each source carries an honest freshness tag and the bar's own
 * summary takes the worst state on screen rather than the best.
 */
export function SystemBar({ onOpenSearch }: { onOpenSearch: () => void }) {
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
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-[var(--exec-hairline)] bg-[var(--exec-base)] px-3 py-1.5">
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex h-7 min-w-0 flex-1 items-center gap-2 border border-[var(--exec-hairline)] bg-[var(--exec-surface)] px-2 text-left transition-colors hover:border-[var(--exec-hairline-strong)] sm:max-w-[22rem]"
      >
        <Search className="size-3.5 shrink-0 text-[var(--exec-ink-dim)]" aria-hidden />
        <span className="truncate text-[11.5px] text-[var(--exec-ink-dim)]">
          Search countries, companies, commodities, events, routes, ports…
        </span>
        <kbd className="exec-num ml-auto hidden shrink-0 border border-[var(--exec-hairline)] px-1 text-[9px] text-[var(--exec-ink-dim)] sm:block">
          ⌘K
        </kbd>
      </button>

      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        {/* LIVE DATA — never a claim, always a per-source state */}
        <Link
          to="/app/data"
          className="flex items-baseline gap-1.5 whitespace-nowrap transition-opacity hover:opacity-80"
          title="Source-by-source status. Each source is only LIVE inside its own refresh window."
        >
          <span className="exec-label">Live data</span>
          <span
            className="exec-label"
            style={{
              color:
                summary === "live"
                  ? "var(--exec-emerald)"
                  : summary === "unavailable"
                    ? "var(--exec-crimson)"
                    : "var(--exec-ink)",
            }}
          >
            {rows.length === 0
              ? "connecting"
              : `${ok.length}/${rows.length} ${
                  summary === "live"
                    ? "live"
                    : summary === "recent"
                      ? "recent"
                      : summary === "historical"
                        ? "historical"
                        : summary === "delayed"
                          ? "delayed"
                          : "unavailable"
                }`}
          </span>
        </Link>

        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="exec-label">Last updated</span>
          <span className="exec-num text-[10.5px] text-[var(--exec-ink)]">
            {lastUpdate ? utcStamp(lastUpdate) : "not yet"}
          </span>
        </span>

        <span
          className="hidden items-baseline gap-1.5 whitespace-nowrap lg:flex"
          title="Connectors refresh themselves in the background when their cached copy ages out. Nothing on screen is reloaded to do it."
        >
          <span className="exec-label">Auto sync</span>
          <span className="exec-label text-[var(--exec-ink)]">
            {refreshing ? "syncing" : "on"}
          </span>
        </span>

        <span className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span className="exec-label">Sources</span>
          <span className="exec-num text-[10.5px] text-[var(--exec-ink)]">
            {ok.length}/{SOURCE_COUNT}
          </span>
        </span>

        <span
          className="flex items-baseline gap-1.5 whitespace-nowrap"
          title="Corpus events currently carrying an elevated-or-worse composite score. Model output, not observed fact."
        >
          <span className="exec-label">Active signals</span>
          <span className="exec-num text-[10.5px] text-[var(--exec-ink)]">
            {activeSignals(stats)}
          </span>
        </span>
      </div>

      {/* Global map layer, shared by every world map on the platform */}
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-1.5 sm:flex">
          <span className="exec-label">Window</span>
          <SegmentedControl
            options={WINDOW_OPTIONS}
            value={window}
            onChange={setWindow}
          />
        </div>
        <SegmentedControl
          options={MAP_LAYERS}
          value={layer}
          onChange={(id) => setLayer(id as MapLayer)}
        />
      </div>

      {/* One honest word per source, so the header never overstates the platform. */}
      {rows.length > 0 ? (
        <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--exec-hairline)] pt-1.5">
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
                className="flex items-center gap-1.5 whitespace-nowrap transition-opacity hover:opacity-80"
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{
                    background:
                      freshness === "live"
                        ? "var(--exec-emerald)"
                        : freshness === "recent"
                          ? "var(--exec-cyan)"
                          : freshness === "historical"
                            ? "var(--exec-ink-dim)"
                            : freshness === "delayed"
                              ? "var(--exec-amber)"
                              : "var(--exec-crimson)",
                  }}
                  aria-hidden
                />
                <span className="exec-label max-w-[18ch] truncate">
                  {source?.label ?? h.sourceId}
                </span>
                <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
                  {h.retrievedAt ? utcStamp(h.retrievedAt) : "—"}
                </span>
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Registered connectors. Deliberately the whole list, not whatever answered. */
const SOURCE_COUNT = 3;

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
