import { useCallback, useEffect, useRef, useState } from "react";
import { useConvex, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { STALE_AFTER_MS, formatAsOf, type Provenance } from "@/lib/sources";

/**
 * Reading and refreshing verified external data.
 *
 * The cache is the source of truth for the UI. If it is empty or past its
 * refresh window we quietly kick off the relevant connector in the background;
 * if the connector then fails, the cached-or-unavailable state is what renders.
 * Nothing here ever substitutes a placeholder for a missing reading.
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
  retrievedAt: number;
  problem?: string;
  payload: string;
};

/**
 * A single source, its freshness, and whatever it actually managed to return.
 * `data` is null when the source has never succeeded — which is the caller's
 * cue to render "No verified data available".
 */
export type Verified<T> = {
  data: T | null;
  status: string;
  asOf: string;
  retrievedAt: number;
  problem?: string;
  refreshing: boolean;
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
 * `rows[0].asOf` would show a random key's date. The freshest *successful* run
 * is the only defensible answer, and it is formatted for humans because
 * sources disagree on the shape of that string.
 */
const latestAsOf = (rows: Row[]): string => {
  let best: Row | undefined;
  for (const r of rows) {
    if (!r.ok || !r.asOf) continue;
    if (!best || r.retrievedAt > best.retrievedAt) best = r;
  }
  return best ? formatAsOf(best.asOf) : "";
};

/** The freshest failure, so the reason shown is the one that actually happened. */
const latestProblem = (rows: Row[]): string | undefined => {
  let best: Row | undefined;
  for (const r of rows) {
    if (r.ok || !r.problem) continue;
    if (!best || r.retrievedAt > best.retrievedAt) best = r;
  }
  return best?.problem;
};

const expired = (rows: Row[], window: number): boolean => {
  if (rows.length === 0) return true;
  return Date.now() - newest(rows) > window;
};

/**
 * Refreshes are keyed per source for the lifetime of the page session.
 *
 * Several panels on a screen can need the same source, and the news index
 * rate-limits hard from shared addresses. Without this guard each panel would
 * fire its own refresh of the same connector.
 */
const attempted = new Set<string>();
const inFlight = new Set<string>();

/** Shared refresh state, so several panels can watch one connector's status. */
const refreshListeners = new Set<() => void>();

function announceRefresh(key: string, active: boolean) {
  if (active) inFlight.add(key);
  else inFlight.delete(key);
  for (const listener of refreshListeners) listener();
}

/** Subscribe to a source's refresh flag without setting state during render. */
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

/** Kicks a refresh at most once per source per session. */
function useBackgroundRefresh(
  key: string,
  shouldRefresh: boolean,
  run: () => Promise<unknown>,
): { refreshing: boolean } {
  const started = useRef(false);

  useEffect(() => {
    if (!shouldRefresh || started.current) return;
    started.current = true;
    if (attempted.has(key) || inFlight.has(key)) return;
    announceRefresh(key, true);
    run()
      .catch(() => {
        // Failure is already recorded server-side and renders as an honest
        // empty state. Swallow it here so it never becomes an unhandled
        // rejection or a red console error for a non-technical reader.
      })
      .finally(() => {
        attempted.add(key);
        announceRefresh(key, false);
      });
  }, [key, shouldRefresh, run]);

  return { refreshing: useRefreshing(key) };
}

/* ------------------------------------------------------------------ */

/** World Bank macro panel: growth, prices, trade openness, population. */
export function useMacroData(): Verified<MacroReading[]> {
  const convex = useConvex();
  const rows = useQuery(api.observations.observations, { sourceId: "worldbank" });

  const run = useCallback(
    () => convex.action(api.sources.refreshMacro, {}),
    [convex],
  );
  const { refreshing } = useBackgroundRefresh(
    "worldbank",
    !!rows && expired(rows, STALE_AFTER_MS.worldbank ?? Infinity),
    run,
  );

  const readings = rows ? parse<MacroReading>(rows, "") : [];
  return {
    data: rows === undefined ? null : readings,
    status: readings.length > 0 ? "observed" : rows === undefined ? "" : "unavailable",
    asOf: latestAsOf(rows ?? []),
    retrievedAt: newest(rows ?? []),
    problem: latestProblem(rows ?? []),
    refreshing,
  };
}

/** UN Comtrade total merchandise trade per reporter. */
export function useTradeData(): Verified<TradeFlow[]> {
  const convex = useConvex();
  const rows = useQuery(api.observations.observations, { sourceId: "comtrade" });

  const run = useCallback(
    () => convex.action(api.sources.refreshTrade, {}),
    [convex],
  );
  const { refreshing } = useBackgroundRefresh(
    "comtrade",
    !!rows && expired(rows, STALE_AFTER_MS.comtrade ?? Infinity),
    run,
  );

  const flows = rows ? parse<TradeFlow>(rows, "comtrade") : [];
  return {
    data: rows === undefined ? null : flows,
    status: flows.length > 0 ? "observed" : rows === undefined ? "" : "unavailable",
    asOf: latestAsOf(rows ?? []),
    retrievedAt: newest(rows ?? []),
    problem: latestProblem(rows ?? []),
    refreshing,
  };
}

/** GDELT media-attention timelines. Measures coverage, never events. */
export function useAttentionData(): Verified<AttentionPoint[]> {
  const convex = useConvex();
  const rows = useQuery(api.observations.observations, { sourceId: "gdelt" });

  const run = useCallback(
    () => convex.action(api.sources.refreshAttention, {}),
    [convex],
  );
  const { refreshing } = useBackgroundRefresh(
    "gdelt",
    !!rows && expired(rows, STALE_AFTER_MS.gdelt ?? Infinity),
    run,
  );

  const points = rows ? parse<AttentionPoint>(rows, "attention") : [];
  return {
    data: rows === undefined ? null : points,
    status: points.length > 0 ? "observed" : rows === undefined ? "" : "unavailable",
    asOf: latestAsOf(rows ?? []),
    retrievedAt: newest(rows ?? []),
    problem: latestProblem(rows ?? []),
    refreshing,
  };
}

/** Recent coverage, with each publisher's own link so it can be checked. */
export function useHeadlinesData(): Verified<Headline[]> {
  const rows = useQuery(api.observations.observations, { sourceId: "gdelt" });
  const items = rows ? parse<Headline>(rows, "headlines") : [];
  return {
    data: rows === undefined ? null : items,
    status: items.length > 0 ? "observed" : rows === undefined ? "" : "unavailable",
    asOf: latestAsOf(rows ?? []),
    retrievedAt: newest(rows ?? []),
    problem: latestProblem(rows ?? []),
    refreshing: false,
  };
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