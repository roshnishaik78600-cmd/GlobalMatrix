import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { FxPoint, YieldPoint } from "@/lib/ecb";
import { STALE_AFTER_MS, formatAsOf, type Provenance } from "@/lib/sources";

/**
 * Reading and refreshing verified external data.
 *
 * The cache is the source of truth for the UI. Nothing here ever substitutes a
 * placeholder for a missing reading, and nothing here polls on a timer: the
 * server owns the schedule (`convex/crons.ts`) and the poll governor
 * (`convex/observations.ts`). The browser's only job is to read the reactive
 * cache and, when a source has never reported or has clearly expired, ask once
 * for a run — an ask the server is free to refuse.
 *
 * That division is what keeps this page cheap and honest at the same time. The
 * values shown change when a publisher actually gives us something new, not
 * because a client-side interval fired, and a source that is down costs one
 * refused request rather than one per open tab per second.
 *
 * Freshness is read from `sourceStatus`, which reports the last *attempt* and
 * the last *verified* fetch separately. The distinction is the whole point: a
 * source that failed at 10:00 while holding a reading from 09:00 is "source
 * unavailable, last verified 09:00", not "no data" and not "updated now".
 */

export type MacroReading = {
  key: string;
  node: string;
  indicatorKey: string;
  seriesId: string;
  label: string;
  value: number;
  unit?: string;
  period?: string;
  provenance: Provenance;
};

export type TradeFlow = {
  key: string;
  reporter: string;
  reporterIso: string;
  partner: string;
  partnerIso: string | null;
  period: string;
  exportsUsd: number;
  importsUsd: number;
  provenance: Provenance;
};

export type AttentionPoint = {
  key: string;
  at: string;
  attention: number;
  tone: number | null;
  provenance: Provenance;
};

export type Headline = {
  key: string;
  title: string;
  url: string;
  domain: string;
  seenAt: string;
  provenance: Provenance;
};

type Row = {
  key: string;
  ok: boolean;
  status: string;
  asOf: string;
  publishedAt?: number;
  retrievedAt: number;
  problem?: string;
  payload: string;
};

/** What the governor reported about the most recent run the client asked for. */
export type RunOutcome = {
  skipped?: "in_flight" | "cooling_down";
  retryInMs?: number;
  refreshed?: number;
  failed?: number;
};

/**
 * A single source, its freshness, and whatever it actually managed to return.
 *
 * `data` is null while the query is in flight and an empty array when the source
 * has genuinely never produced a reading — the caller's cue to render "No
 * verified data available" rather than a zero.
 */
export type Verified<T> = {
  /** Which connector produced this, so a shared status line can name it. */
  sourceId: string;
  data: T | null;
  status: string;
  asOf: string;
  retrievedAt: number;
  problem?: string;
  refreshing: boolean;
  /** When the newest verified reading was fetched. 0 if none ever was. */
  lastVerifiedAt: number;
  /** When the last attempt was made, successful or not. 0 if never. */
  lastAttemptAt: number;
  /** The publisher's own time for the newest item, where the source supplies one. */
  publishedAt?: number;
  /** Plain-language cadence the server actually keeps for this source. */
  cadence: string;
  /** Live updates are suspended for this source. */
  paused: boolean;
  setPaused: (paused: boolean) => void;
  /** Ask for a run now. The server may refuse; the refusal is reported here. */
  refresh: () => Promise<void>;
  /** Set when the last requested run was refused by the governor. */
  skipped?: "in_flight" | "cooling_down";
  retryInMs?: number;
};

const parse = <T,>(rows: Row[], prefix: string): T[] => {
  const out: T[] = [];
  for (const r of rows) {
    if (!r.ok || !r.key.startsWith(prefix)) continue;
    try {
      const parsed = JSON.parse(r.payload);
      if (Array.isArray(parsed)) out.push(...(parsed as T[]));
    } catch {
      // A payload we cannot parse is not a reading. Skip it rather than guess.
    }
  }
  return out;
};

const newest = (rows: Row[]): number =>
  rows.reduce((max, r) => Math.max(max, r.retrievedAt), 0);

/**
 * The `asOf` the panel should claim.
 *
 * `observations` returns one row per key with no ordering guarantee, so taking
 * `rows[0].asOf` would show a random key's date. The freshest successful run is
 * the only defensible answer, and it is formatted for humans because sources
 * disagree on the shape of that string.
 */
const latestAsOf = (rows: Row[]): string => {
  let best: Row | undefined;
  for (const r of rows) {
    if (!r.ok || !r.asOf) continue;
    if (!best || r.retrievedAt > best.retrievedAt) best = r;
  }
  return best ? formatAsOf(best.asOf) : "";
};

const expired = (rows: Row[], window: number): boolean => {
  if (rows.length === 0) return true;
  return Date.now() - newest(rows) > window;
};

/* ------------------------------------------------------------------ */
/* Shared client state                                                 */
/* ------------------------------------------------------------------ */

/**
 * One refresh flag per source, shared by every panel showing that source.
 *
 * Several panels on a screen can need the same feed. Without this they would
 * each render their own "refreshing" state for one run, and one would appear to
 * finish while another still claimed to be working.
 */
const inFlight = new Set<string>();
const refreshListeners = new Set<() => void>();

function announceRefresh(key: string, active: boolean) {
  if (active) inFlight.add(key);
  else inFlight.delete(key);
  for (const listener of refreshListeners) listener();
}

function useRefreshing(key: string): boolean {
  const [refreshing, setRefreshing] = useState(() => inFlight.has(key));
  useEffect(() => {
    const update = () => setRefreshing(inFlight.has(key));
    refreshListeners.add(update);
    update();
    return () => {
      refreshListeners.delete(update);
    };
  }, [key]);
  return refreshing;
}

/**
 * Pause state, per source and shared across panels.
 *
 * A module store rather than context because "stop updating the news feed" is a
 * property of the feed, not of the tree that happens to be rendering it: pausing
 * GDELT on the sources board has to be the same switch the panel above it
 * follows.
 */
const paused = new Set<string>();
const pauseListeners = new Set<() => void>();

function setSourcePaused(sourceId: string, next: boolean) {
  if (next) paused.add(sourceId);
  else paused.delete(sourceId);
  for (const listener of pauseListeners) listener();
}

function useSourcePaused(sourceId: string): [boolean, (p: boolean) => void] {
  const [value, setValue] = useState(() => paused.has(sourceId));
  useEffect(() => {
    const update = () => setValue(paused.has(sourceId));
    pauseListeners.add(update);
    update();
    return () => {
      pauseListeners.delete(update);
    };
  }, [sourceId]);
  const set = useCallback(
    (next: boolean) => setSourcePaused(sourceId, next),
    [sourceId],
  );
  return [value, set];
}

/** Sources this page session has already asked for, so a mount cannot loop. */
const attempted = new Set<string>();

/* ------------------------------------------------------------------ */
/* The shared reader                                                   */
/* ------------------------------------------------------------------ */

/**
 * Request a run and hold what the governor said about it.
 *
 * Shared by the panels and by the sources board so both report refusals the
 * same way. A refused run is not a failure and must not look like one: nothing
 * was fetched because nothing needed fetching yet.
 */
function useRun(
  sourceId: string,
  run: (force: boolean) => Promise<unknown>,
): { request: (force: boolean) => Promise<void>; refreshing: boolean; outcome: RunOutcome } {
  const [outcome, setOutcome] = useState<RunOutcome>({});

  const request = useCallback(
    async (force: boolean) => {
      announceRefresh(sourceId, true);
      try {
        const result = (await run(force)) as RunOutcome | undefined;
        setOutcome({
          skipped: result?.skipped,
          retryInMs: result?.retryInMs,
          refreshed: result?.refreshed,
          failed: result?.failed,
        });
      } catch {
        // A failed run is already recorded server-side and renders as an honest
        // unavailable state. Swallowing it here keeps a transport error out of
        // the console, where it would read as the product being broken.
        setOutcome({});
      } finally {
        announceRefresh(sourceId, false);
      }
    },
    [run, sourceId],
  );

  return { request, refreshing: useRefreshing(sourceId), outcome };
}

/** Maps a source id onto the connector action that refreshes it. */
export function useSourceAction(sourceId: string): (force: boolean) => Promise<unknown> {
  const convex = useConvex();
  return useCallback(
    (force: boolean) => {
      switch (sourceId) {
        case "worldbank":
          return convex.action(api.sources.refreshMacro, { force });
        case "comtrade":
          return convex.action(api.sources.refreshTrade, { force });
        case "gdelt":
          return convex.action(api.sources.refreshAttention, { force });
        case "ecb":
          return convex.action(api.sources.refreshEcb, { force });
        default:
          return Promise.resolve(undefined);
      }
    },
    [convex, sourceId],
  );
}

/**
 * Control one source from outside its own panel.
 *
 * The sources board needs the same pause switch and the same refresh button the
 * panels have, without reading the panel's data. Both go through the shared
 * stores above, so pausing GDELT on the board pauses it in the panel too —
 * "live updates" is a property of the feed, not of one card.
 */
export function useSourceControl(sourceId: string) {
  const run = useSourceAction(sourceId);
  const { request, refreshing, outcome } = useRun(sourceId, run);
  const [paused, setPaused] = useSourcePaused(sourceId);
  return {
    paused,
    setPaused,
    refreshing,
    skipped: outcome.skipped,
    retryInMs: outcome.retryInMs,
    refresh: useCallback(() => request(true), [request]),
  };
}

/**
 * `E` is one reading; the returned `Verified<E[]>` is the reading list, so the
 * public hooks keep the `Verified<MacroReading[]>` shape their callers expect.
 */
function useVerified<E>({
  sourceId,
  prefix,
  windowMs,
  run,
}: {
  sourceId: string;
  /** Key prefix identifying this panel's rows within the source. */
  prefix: string;
  /** Age at which this source's data stops counting as current. */
  windowMs: number;
  run: (force: boolean) => Promise<unknown>;
}): Verified<E[]> {
  const rows = useQuery(api.observations.observations, { sourceId });
  const health = useQuery(api.observations.sourceStatus, { sourceId });
  const [pausedHere, setPausedHere] = useSourcePaused(sourceId);
  const { request: runOnce, refreshing, outcome } = useRun(sourceId, run);
  const started = useRef(false);

  /**
   * Bootstrap only.
   *
   * The server polls on its own schedule; this fires at most once per page
   * session, and only when the cache is empty or expired, so a freshly deployed
   * environment is not blank until the first cron tick. It is deliberately not
   * a polling loop — the interval belongs to the publisher, and it lives in
   * `convex/crons.ts`.
   */
  useEffect(() => {
    if (started.current) return;
    if (rows === undefined || pausedHere) return;
    started.current = true;
    if (attempted.has(sourceId)) return;
    attempted.add(sourceId);
    if (!expired(rows, windowMs)) return;
    void runOnce(false);
  }, [rows, pausedHere, sourceId, windowMs, runOnce]);

  const refresh = useCallback(() => runOnce(true), [runOnce]);

  const readings = rows === undefined ? null : parse<E>(rows, prefix);

  return {
    sourceId,
    data: readings,
    status:
      readings === null
        ? ""
        : readings.length > 0
          ? "observed"
          : "unavailable",
    asOf: latestAsOf(rows ?? []),
    // The newest verified fetch. Not the newest attempt: a failed attempt is
    // not a reason to tell a reader their data is fresh.
    retrievedAt: health?.lastVerifiedAt ?? newest(rows ?? []),
    problem: health?.problem,
    refreshing,
    lastVerifiedAt: health?.lastVerifiedAt ?? 0,
    lastAttemptAt: health?.lastAttemptAt ?? 0,
    publishedAt: health?.publishedAt,
    cadence: health?.cadence ?? "",
    paused: pausedHere,
    setPaused: setPausedHere,
    refresh,
    skipped: outcome.skipped,
    retryInMs: outcome.retryInMs,
  };
}

/* ------------------------------------------------------------------ */

/** World Bank macro panel: growth, prices, trade openness, population. */
export function useMacroData(): Verified<MacroReading[]> {
  const convex = useConvex();
  const run = useCallback(
    (force: boolean) => convex.action(api.sources.refreshMacro, { force }),
    [convex],
  );
  return useVerified<MacroReading>({
    sourceId: "worldbank",
    prefix: "",
    windowMs: STALE_AFTER_MS.worldbank ?? Infinity,
    run,
  });
}

/** UN Comtrade total merchandise trade per reporter. */
export function useTradeData(): Verified<TradeFlow[]> {
  const convex = useConvex();
  const run = useCallback(
    (force: boolean) => convex.action(api.sources.refreshTrade, { force }),
    [convex],
  );
  return useVerified<TradeFlow>({
    sourceId: "comtrade",
    prefix: "comtrade",
    windowMs: STALE_AFTER_MS.comtrade ?? Infinity,
    run,
  });
}

/** GDELT media-attention timelines. Measures coverage, never events. */
export function useAttentionData(): Verified<AttentionPoint[]> {
  const convex = useConvex();
  const run = useCallback(
    (force: boolean) => convex.action(api.sources.refreshAttention, { force }),
    [convex],
  );
  return useVerified<AttentionPoint>({
    sourceId: "gdelt",
    prefix: "attention",
    windowMs: STALE_AFTER_MS.gdelt ?? Infinity,
    run,
  });
}

/** Recent coverage, with each publisher's own link so it can be checked. */
export function useHeadlinesData(): Verified<Headline[]> {
  const convex = useConvex();
  const run = useCallback(
    (force: boolean) => convex.action(api.sources.refreshAttention, { force }),
    [convex],
  );
  return useVerified<Headline>({
    sourceId: "gdelt",
    prefix: "headlines",
    windowMs: STALE_AFTER_MS.gdelt ?? Infinity,
    run,
  });
}

/**
 * ECB euro reference rates.
 *
 * The only genuinely daily feed in the build, and therefore the only one that
 * can honestly be called live. It refreshes on its own action for that reason:
 * re-pulling the whole annual macro panel to refresh a currency rate would be
 * the wrong shape of request, and the ECB publishes far more often than the
 * annual sources do.
 */
export function useRateData(): Verified<FxPoint[]> {
  const convex = useConvex();
  const run = useCallback(
    (force: boolean) => convex.action(api.sources.refreshEcb, { force }),
    [convex],
  );
  return useVerified<FxPoint>({
    sourceId: "ecb",
    prefix: "fx",
    windowMs: STALE_AFTER_MS.ecb ?? Infinity,
    run,
  });
}

/**
 * ECB euro area spot yields.
 *
 * Reads the same source and prefix family as the rates panel and shares its
 * pause switch, so the two can never disagree about whether the Bank is being
 * asked.
 */
export function useYieldData(): Verified<YieldPoint[]> {
  const convex = useConvex();
  const run = useCallback(
    (force: boolean) => convex.action(api.sources.refreshEcb, { force }),
    [convex],
  );
  return useVerified<YieldPoint>({
    sourceId: "ecb",
    prefix: "yield",
    windowMs: STALE_AFTER_MS.ecb ?? Infinity,
    run,
  });
}

/**
 * Latest value per (node, indicator), with the history kept for sparklines.
 * Latest is the most recent period that actually reported a value — never a
 * carried-forward guess for a year the source left empty.
 */
export function macroSeries(
  readings: MacroReading[],
): Map<string, { latest: MacroReading; history: MacroReading[] }> {
  const byNode = new Map<string, Map<string, MacroReading[]>>();
  for (const r of readings) {
    if (!r.period) continue;
    const perIndicator = byNode.get(r.node) ?? new Map<string, MacroReading[]>();
    const list = perIndicator.get(r.indicatorKey) ?? [];
    list.push(r);
    perIndicator.set(r.indicatorKey, list);
    byNode.set(r.node, perIndicator);
  }

  const out = new Map<string, { latest: MacroReading; history: MacroReading[] }>();
  for (const [node, perIndicator] of byNode) {
    for (const [indicator, list] of perIndicator) {
      const sorted = [...list].sort((a, b) =>
        (a.period ?? "").localeCompare(b.period ?? ""),
      );
      const last = sorted[sorted.length - 1];
      if (last) out.set(`${node}:${indicator}`, { latest: last, history: sorted });
    }
  }
  return out;
}
