import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { SOURCES, STALE_AFTER_MS, type DataStatus } from "../lib/sources";

/**
 * Read surface over the verified-data cache.
 *
 * Kept out of `sources.ts` because that module runs in the Node runtime, which
 * may only define actions. These queries run on Convex's own runtime and only
 * ever read what a connector actually stored.
 */

export type Observation = {
  sourceId: string;
  key: string;
  asOf: string;
  retrievedAt: number;
  status: DataStatus;
  note?: string;
  ok: boolean;
  problem?: string;
  payload: string;
};

const outcomeValidator = v.object({
  sourceId: v.string(),
  key: v.string(),
  asOf: v.string(),
  retrievedAt: v.number(),
  status: v.string(),
  note: v.optional(v.string()),
  ok: v.boolean(),
  problem: v.optional(v.string()),
  payload: v.string(),
});

/** Statuses a stored row is allowed to carry. */
const DATA_STATUSES: readonly string[] = ["observed", "stale", "unavailable"];

/**
 * Reject anything that is not a well-formed, attributable connector outcome.
 *
 * The cache is the only thing standing between the outside world and the word
 * "Observed" on screen, so it is worth being strict here. A row is only
 * accepted if it names a source we actually have a connector for, carries a
 * real fetch timestamp, and — for a successful run — parses to a non-empty
 * array of readings. A failed run is normalised to an empty payload so a
 * failure can never leave stale readings visible under a newer status.
 */
type IncomingOutcome = {
  sourceId: string;
  key: string;
  asOf: string;
  retrievedAt: number;
  status: string;
  note?: string;
  ok: boolean;
  problem?: string;
  payload: string;
};

function validateOutcome(o: IncomingOutcome): { ok: true } | { ok: false; why: string } {
  if (!(o.sourceId in SOURCES)) {
    return { ok: false, why: `unknown source "${o.sourceId}"` };
  }
  if (!o.key.trim()) return { ok: false, why: "empty key" };
  if (!Number.isFinite(o.retrievedAt) || o.retrievedAt <= 0) {
    return { ok: false, why: "invalid retrievedAt" };
  }
  if (!DATA_STATUSES.includes(o.status)) {
    return { ok: false, why: `invalid status "${o.status}"` };
  }
  if (o.problem && o.problem.length > 300) {
    return { ok: false, why: "problem text too long" };
  }
  if (o.note && o.note.length > 500) {
    return { ok: false, why: "note too long" };
  }

  if (!o.ok) {
    if (o.status !== "unavailable") {
      return { ok: false, why: "a failed run must be recorded as unavailable" };
    }
    if (o.payload !== "[]") {
      return { ok: false, why: "a failed run must not carry a payload" };
    }
    return { ok: true };
  }

  if (o.status !== "observed") {
    return { ok: false, why: "a successful run must be recorded as observed" };
  }
  let readings: unknown;
  try {
    readings = JSON.parse(o.payload);
  } catch {
    return { ok: false, why: "payload is not valid JSON" };
  }
  if (!Array.isArray(readings) || readings.length === 0) {
    return { ok: false, why: "a successful run must carry at least one reading" };
  }
  return { ok: true };
}

/**
 * Persist a connector run.
 *
 * Connectors execute in the Node runtime, which has no database handle, so they
 * hand their validated results here. This is an *internal* mutation on purpose:
 * as a public mutation it was callable by anyone holding the deployment URL,
 * which would have let a client write invented readings into the cache that the
 * UI renders as Observed World Bank / Comtrade / GDELT data.
 */
export const storeObservations = internalMutation({
  args: { items: v.array(outcomeValidator) },
  handler: async (ctx, args): Promise<number> => {
    let stored = 0;
    for (const item of args.items) {
      const check = validateOutcome(item);
      if (!check.ok) {
        console.warn(`[observations] rejected outcome: ${check.why}`);
        continue;
      }
      const outcome: Observation = {
        sourceId: item.sourceId,
        key: item.key,
        asOf: item.ok ? item.asOf : "",
        retrievedAt: item.retrievedAt,
        // Narrowed by validateOutcome: a successful run is observed, a failed
        // one is unavailable.
        status: item.ok ? "observed" : "unavailable",
        note: item.ok ? item.note : undefined,
        ok: item.ok,
        problem: item.ok ? undefined : item.problem ?? "No verified data.",
        payload: item.ok ? item.payload : "[]",
      };
      await ctx.db.insert("observations", outcome);
      stored += 1;
    }
    return stored;
  },
});

const applyStaleness = (o: Observation): Observation =>
  o.ok && Date.now() - o.retrievedAt > (STALE_AFTER_MS[o.sourceId] ?? Infinity)
    ? { ...o, status: "stale", note: o.note ?? "Past its refresh window." }
    : o;

const toObservation = (row: {
  sourceId: string;
  key: string;
  asOf: string;
  retrievedAt: number;
  status: string;
  note?: string;
  ok: boolean;
  problem?: string;
  payload: string;
}): Observation => ({
  sourceId: row.sourceId,
  key: row.key,
  asOf: row.asOf,
  retrievedAt: row.retrievedAt,
  // Rows predate validation, so the cast is still needed on read. An unknown
  // stored status degrades to "unavailable" rather than surfacing verbatim.
  status: (DATA_STATUSES.includes(row.status) ? row.status : "unavailable") as DataStatus,
  note: row.note,
  ok: row.ok,
  problem: row.problem,
  payload: row.payload,
});

/**
 * Latest observation per key for a source.
 *
 * If a connector has never run, or its most recent run failed, that is
 * surfaced as `ok: false` with a readable reason — the UI shows it as
 * "No verified data available" rather than rendering an empty chart.
 */
export const observations = query({
  args: { sourceId: v.string() },
  handler: async (ctx, args): Promise<Observation[]> => {
    const rows = await ctx.db
      .query("observations")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();

    const latest = new Map<string, Observation>();
    for (const r of rows) {
      const prev = latest.get(r.key);
      if (prev && prev.retrievedAt >= r.retrievedAt) continue;
      latest.set(r.key, applyStaleness(toObservation(r)));
    }

    return [...latest.values()];
  },
});

/**
 * Health of every source we have a connector for, whether or not it has run.
 *
 * Sources with no attempt on record are reported explicitly as unavailable, so
 * the sources page can render a complete table instead of silently omitting a
 * feed that has never been contacted. `asOf` prefers the most recent successful
 * run: a source that is currently throttled should still say when its data was
 * last real, while its status stays honest about the failed attempt.
 */
export const sourceHealth = query({
  handler: async (ctx): Promise<
    Array<{
      sourceId: string;
      ok: boolean;
      status: DataStatus;
      retrievedAt: number;
      /** Dataset revision of the last run that actually returned data. */
      asOf: string;
      /** When that successful run happened, 0 if the source has never succeeded. */
      lastSuccessAt: number;
      /** How many stored readings this source is currently contributing. */
      readingCount: number;
      problem?: string;
    }>
  > => {
    const rows = await ctx.db.query("observations").collect();

    const latestAttempt = new Map<string, Observation>();
    const lastSuccess = new Map<string, { retrievedAt: number; asOf: string }>();
    // Newest successful run per key, which is exactly the set of readings the
    // UI can actually render: older successful runs for the same key have been
    // superseded and must not be counted as live signal.
    const liveReadings = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const row = toObservation(r);
      const prev = latestAttempt.get(row.sourceId);
      if (!prev || row.retrievedAt > prev.retrievedAt) latestAttempt.set(row.sourceId, row);
      if (!row.ok) continue;

      const perKey = liveReadings.get(row.sourceId) ?? new Map<string, number>();
      const prevAt = perKey.get(row.key);
      if (prevAt === undefined || row.retrievedAt > prevAt) {
        perKey.set(row.key, row.retrievedAt);
      }
      liveReadings.set(row.sourceId, perKey);

      if (row.asOf) {
        const best = lastSuccess.get(row.sourceId);
        if (!best || row.retrievedAt > best.retrievedAt) {
          lastSuccess.set(row.sourceId, {
            retrievedAt: row.retrievedAt,
            asOf: row.asOf,
          });
        }
      }
    }

    return Object.keys(SOURCES).map((sourceId) => {
      const attempt = applyStaleness(
        latestAttempt.get(sourceId) ?? {
          sourceId,
          key: sourceId,
          asOf: "",
          retrievedAt: 0,
          status: "unavailable" as const,
          ok: false,
          problem: "This source has not been contacted yet.",
          payload: "[]",
        },
      );
      const success = lastSuccess.get(sourceId);
      return {
        sourceId,
        ok: attempt.ok,
        status: attempt.status,
        retrievedAt: attempt.retrievedAt,
        asOf: success?.asOf ?? "",
        lastSuccessAt: success?.retrievedAt ?? 0,
        readingCount: liveReadings.get(sourceId)?.size ?? 0,
        problem: attempt.problem,
      };
    });
  },
});