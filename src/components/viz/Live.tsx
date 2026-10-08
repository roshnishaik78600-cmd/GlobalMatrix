import { useEffect, useState } from "react";
import { Pause, Play, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { sourceById } from "@/lib/sources";
import {
  FRESHNESS_HELP,
  FRESHNESS_LABEL,
  freshnessOf,
  relativeAge,
  utcDateTime,
} from "@/lib/freshness";

/**
 * The live status line for one externally sourced panel.
 *
 * Three claims, kept separate because they answer three different questions and
 * collapsing them is how a dashboard starts lying:
 *
 *   FRESHNESS  is this inside the window its publisher expects? (LIVE / RECENT /
 *              DELAYED / HISTORICAL)
 *   AGE        when did a fetch actually succeed? Rendered from
 *              `lastVerifiedAt`, never from a render, a route change, or a
 *              timer.
 *   HEALTH     did the most recent attempt work? A source that failed ten
 *              seconds ago while holding a reading from this morning is
 *              "SOURCE UNAVAILABLE · LAST VERIFIED 09:14", not "live".
 *
 * The age is the only thing here that re-renders on a clock, and it re-renders
 * alone: the interval lives in this component, so a one-second tick costs one
 * small subtree rather than the page. A timestamp that never moves is not
 * evidence of freshness anyway — `lastVerifiedAt` is, and it only changes when
 * the server stores a new reading.
 *
 * Nothing here can make data appear newer than it is. If no reading has ever
 * been stored the line says NO VERIFIED DATA YET and the age is absent, because
 * there is no timestamp to print.
 */
export function LiveSignal({
  sourceId,
  lastVerifiedAt,
  lastAttemptAt,
  publishedAt,
  problem,
  cadence,
  refreshing,
  paused,
  onRefresh,
  onTogglePause,
  skipped,
  retryInMs,
  nextAttemptAt,
  className,
}: {
  sourceId: string;
  lastVerifiedAt: number;
  lastAttemptAt: number;
  publishedAt?: number;
  /** When the poll governor will next allow this source to be asked. */
  nextAttemptAt?: number;
  /** Why the most recent attempt failed, while it is still the newest attempt. */
  problem?: string;
  /** The cadence the server actually keeps, so the page cannot overclaim. */
  cadence: string;
  refreshing: boolean;
  paused: boolean;
  onRefresh: () => void;
  onTogglePause: () => void;
  /** Set when the governor refused the last requested run. */
  skipped?: "in_flight" | "cooling_down";
  retryInMs?: number;
  className?: string;
}) {
  // The only clock in the live layer. Everything that depends on "now" is
  // rendered from this component's own tick, so no page or panel re-renders once
  // a second just to keep a countdown honest.
  const [now, tick] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => tick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const source = sourceById(sourceId);
  const freshness = freshnessOf(lastVerifiedAt, sourceId);
  const never = lastVerifiedAt === 0;
  // A failure only counts as current health if it is newer than the reading we
  // are showing. An old error next to a fresh reading is history, not status.
  const failing = Boolean(problem) && lastAttemptAt > lastVerifiedAt;

  const cooling = failing && retryInMs !== undefined && retryInMs > 0;
  const coolMinutes = cooling ? Math.max(1, Math.ceil(retryInMs / 60000)) : 0;

  const word = never
    ? "NO VERIFIED DATA YET"
    : failing
      ? "SOURCE UNAVAILABLE"
      : FRESHNESS_LABEL[freshness];

  const tone = never
    ? "var(--exec-crimson)"
    : failing
      ? "var(--exec-amber)"
      : freshness === "live"
        ? "var(--exec-emerald)"
        : freshness === "recent"
          ? "var(--exec-cyan)"
          : "var(--exec-ink-dim)";

  return (
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5",
        className,
      )}
    >
      {/* The status word. Colour plus the dot, never colour alone. */}
      <span
        className="inline-flex shrink-0 items-center gap-1.5"
        style={{ color: tone }}
        title={
          failing
            ? (problem ?? FRESHNESS_HELP[freshness])
            : never
              ? FRESHNESS_HELP.unavailable
              : FRESHNESS_HELP[freshness]
        }
      >
        <span
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            freshness === "live" && !failing && !paused && "live-dot",
          )}
          style={{ background: tone }}
          aria-hidden
        />
        <span className="exec-label">{word}</span>
      </span>

      {/* The source itself, so a reader never has to scroll up to learn whose
          numbers these are. */}
      {source ? (
        <span className="exec-label shrink-0 text-[var(--exec-ink-dim)]">
          {source.label}
        </span>
      ) : null}

      {/* The age. `aria-hidden` because it changes every second and would
          otherwise be announced continuously; the static title carries the
          precise time for anyone who needs it. */}
      <span
        className="exec-num min-w-0 text-[12px] text-[var(--exec-ink-dim)]"
        aria-hidden
      >
        {never
          ? "no successful fetch recorded"
          : `updated ${relativeAge(lastVerifiedAt)}`}
      </span>
      <span className="sr-only">
        {never
          ? `No verified reading has been fetched from ${source?.label ?? sourceId}.`
          : `Last verified ${utcDateTime(lastVerifiedAt)}.`}
        {failing ? ` The most recent attempt failed: ${problem}` : ""}
      </span>

      {/* Where the source supplies its own publication time, say so: it is
          routinely older than the fetch, and that gap is information. */}
      {publishedAt ? (
        <span
          className="exec-num min-w-0 text-[12px] text-[var(--exec-ink-dim)]"
          title="The publisher's own timestamp for the newest item"
        >
          newest item {relativeAge(publishedAt)}
        </span>
      ) : null}

      {paused ? (
        <span className="chip shrink-0 text-[var(--exec-ink-dim)]">
          LIVE UPDATES PAUSED
        </span>
      ) : null}

      {skipped === "in_flight" ? (
        <span className="chip shrink-0 text-[var(--exec-cyan)]">
          A FETCH IS ALREADY RUNNING
        </span>
      ) : null}
      {skipped === "cooling_down" && retryInMs ? (
        <span
          className="chip shrink-0 text-[var(--exec-amber)]"
          title="The poll governor is holding this source. It is asked again once the window elapses, or immediately if you ask for it and the source is healthy."
        >
          {failing
            ? `BACKED OFF · RETRY IN ~${coolMinutes} MIN`
            : `ASKED RECENTLY · ${Math.max(1, Math.ceil(retryInMs / 60000))} MIN WINDOW`}
        </span>
      ) : null}

      {nextAttemptAt !== undefined && nextAttemptAt > now ? (
        <span
          className="exec-num shrink-0 text-[12px] text-[var(--exec-ink-muted)]"
          title="When the poll governor will next allow this source to be asked"
        >
          next poll in ~{Math.max(1, Math.round((nextAttemptAt - now) / 60000))}m
        </span>
      ) : null}

      <span className="exec-label hidden shrink-0 text-[var(--exec-ink-muted)] xl:inline">
        {cadence}
      </span>

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          aria-label={`Re-fetch now from ${source?.label ?? sourceId}`}
          title="Ask this source for new data now. The server refuses if it is already running or backing off."
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline)] px-2.5 py-1 text-[12px] text-[var(--exec-ink-dim)] transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)] disabled:opacity-50"
        >
          <RefreshCw
            className={cn("size-3", refreshing && "animate-spin")}
            aria-hidden
          />
          {refreshing ? "Fetching" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={onTogglePause}
          aria-pressed={paused}
          aria-label={
            paused
              ? `Resume live updates from ${source?.label ?? sourceId}`
              : `Pause live updates from ${source?.label ?? sourceId}`
          }
          title={
            paused
              ? "Live updates are paused. Values still come from the server cache, and the server still polls on its own schedule."
              : "Pause this panel's live updates. The server keeps polling either way; this only stops the panel asking."
          }
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline)] px-2.5 py-1 text-[12px] text-[var(--exec-ink-dim)] transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)]"
        >
          {paused ? (
            <Play className="size-3" aria-hidden />
          ) : (
            <Pause className="size-3" aria-hidden />
          )}
          {paused ? "Resume" : "Pause"}
        </button>
      </div>
    </div>
  );
}
