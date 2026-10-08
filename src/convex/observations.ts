import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { POLL } from "./poll";
import { SOURCES, STALE_AFTER_MS, type DataStatus } from "../lib/sources";

/**
 * The verified-data cache, its poll governor, and the health model over both.
 *
 * Three tables, three jobs, kept apart on purpose:
 *
 *   `observations` — verified readings only, one row per (sourceId, key).
 *                    This is the only thing the UI renders as data.
 *   `sourceRuns`   — the last attempt per key, successful or not. Health is
 *                    read from here, so a failure is visible without being
 *                    allowed to destroy the last good reading.
 *   `sourceLocks`  — one row per source. The poll governor: in-flight claims,
 *                    cooldown after a success, exponential backoff after a
 *                    failure.
 *
 * The split exists because "what is the newest real value" and "did the last
 * fetch work" are different questions, and a single table cannot answer both
 * without either overwriting a verified reading with an empty one on failure,
 * or hiding the failure behind a still-successful row.
 *
 * Ingestion is server-side throughout. Any caller — a cron tick, another user's
 * tab, a manual refresh — must claim the source first, so a source is polled
 * once regardless of how many browsers are open, and a rate-limited source is
 * asked less often rather than hammered.
 */

export type Observation = {
  sourceId: string;
  key: string;
  asOf: string;
  publishedAt?: number;
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
  publishedAt: v.optional(v.number()),
  retrievedAt: v.number(),
  status: v.string(),
  note: v.optional(v.string()),
  ok: v.boolean(),
  problem: v.optional(v.string()),
  payload: v.string(),
});

/** Statuses a stored row is allowed to carry. */
const DATA_STATUSES: readonly string[] = ["observed", "stale", "unavailable"];

type IncomingOutcome = {
  sourceId: string;
  key: string;
  asOf: string;
  publishedAt?: number;
  retrievedAt: number;
  status: string;
  note?: string;
  ok: boolean;
  problem?: string;
  payload: string;
};

/**
 * Reject anything that is not a well-formed, attributable connector outcome.
 *
 * The cache is the only thing standing between the outside world and the word
 * "Observed" on screen, so it is worth being strict here. A row is only
 * accepted if it names a source we actually have a connector for, carries a
 * real fetch timestamp, and — for a successful run — parses to a non-empty
 * array of readings. A failed run must carry no payload at all, so a failure
 * can never leave half-parsed readings behind it.
 */
function validateOutcome(
  o: IncomingOutcome,
): { ok: true } | { ok: false; why: string } {
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
  if (
    o.publishedAt !== undefined &&
    (!Number.isFinite(o.publishedAt) || o.publishedAt <= 0)
  ) {
    return { ok: false, why: "invalid publishedAt" };
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

/** Readings in a validated payload, for the health board's row count. */
function countReadings(payload: string): number {
  try {
    const parsed = JSON.parse(payload);
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

/* ------------------------------------------------------------------ */
/* Poll governor                                                       */
/* ------------------------------------------------------------------ */

type ClaimResult =
  | { proceed: true }
  | { proceed: false; reason: "in_flight" | "cooling_down"; retryInMs: number };

/**
 * Claim a source for one run, or refuse because someone already has it.
 *
 * Refusals are ordinary outcomes, not errors: two tabs opening at once is the
 * normal case, and the second one should be told to wait rather than served an
 * exception or allowed to fire a duplicate request at the source.
 *
 * A claim that was never released — the action died, or the deployment
 * restarted mid-fetch — is treated as dead after `maxRunMs` and reclaimed. That
 * is why there is no unlock timer anywhere: a stale claim cannot wedge a source
 * permanently.
 *
 * `force` is for an explicit human refresh. It may shorten the cooldown after a
 * *successful* run, because a reader asking for fresh numbers is a legitimate
 * reason to ask the publisher again. It never bypasses a failure backoff, and
 * it never bypasses an in-flight run: neither is a matter of preference.
 */
export const claimRefresh = internalMutation({
  args: { sourceId: v.string(), force: v.optional(v.boolean()) },
  handler: async (ctx, args): Promise<ClaimResult> => {
    const policy = POLL[args.sourceId];
    if (!policy) return { proceed: false, reason: "cooling_down", retryInMs: 0 };

    const now = Date.now();
    const lock = await ctx.db
      .query("sourceLocks")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .first();

    if (lock) {
      const inFlight =
        lock.finishedAt === undefined && now - lock.startedAt < policy.maxRunMs;
      if (inFlight) {
        const retryInMs = Math.max(0, lock.startedAt + policy.maxRunMs - now);
        return { proceed: false, reason: "in_flight", retryInMs };
      }

      const cooling = lock.nextAllowedAt - now;
      // A healthy source may be re-asked on request. A failing one may not.
      const mayForce = args.force === true && lock.consecutiveFailures === 0;
      if (cooling > 0 && !mayForce) {
        return { proceed: false, reason: "cooling_down", retryInMs: cooling };
      }

      await ctx.db.patch(lock._id, {
        startedAt: now,
        finishedAt: undefined,
        attempts: lock.attempts + 1,
      });
      return { proceed: true };
    }

    await ctx.db.insert("sourceLocks", {
      sourceId: args.sourceId,
      startedAt: now,
      finishedAt: undefined,
      consecutiveFailures: 0,
      nextAllowedAt: now + policy.minIntervalMs,
      attempts: 1,
      failures: 0,
    });
    return { proceed: true };
  },
});

/* ------------------------------------------------------------------ */
/* Ingestion                                                           */
/* ------------------------------------------------------------------ */

/**
 * Persist one connector run and release its claim.
 *
 * Internal on purpose: connectors run in the Node runtime with no database
 * handle and hand their validated results here. As a public mutation this was
 * callable by anyone holding the deployment URL, which would have let a client
 * write invented readings into the cache the UI renders as Observed data.
 *
 * Two rules this enforces, both of which exist to keep the last verified value:
 *
 *  1. A successful run REPLACES the row for its key rather than appending. The
 *     table therefore holds exactly one reading per key — bounded growth, and
 *     no chance of the newest row for a key being an older duplicate.
 *  2. A failed run is recorded in `sourceRuns` and NOWHERE ELSE. It cannot
 *     overwrite the verified reading, and it cannot be mistaken for one.
 */
export const storeObservations = internalMutation({
  args: {
    sourceId: v.string(),
    items: v.array(outcomeValidator),
  },
  handler: async (ctx, args): Promise<number> => {
    const now = Date.now();
    const policy = POLL[args.sourceId];
    let stored = 0;
    let failures = 0;

    for (const item of args.items) {
      const check = validateOutcome(item);
      if (!check.ok) {
        console.warn(`[observations] rejected outcome: ${check.why}`);
        continue;
      }

      // --- the attempt record, success or failure -----------------------
      const prior = await ctx.db
        .query("sourceRuns")
        .withIndex("by_source_key", (q) =>
          q.eq("sourceId", item.sourceId).eq("key", item.key),
        )
        .first();
      // Never let an out-of-order (older) attempt overwrite a newer one.
      const newer = !prior || item.retrievedAt >= prior.retrievedAt;
      if (newer) {
        const run = {
          sourceId: item.sourceId,
          key: item.key,
          ok: item.ok,
          status: item.ok ? "observed" : "unavailable",
          asOf: item.ok ? item.asOf : "",
          publishedAt: item.ok ? item.publishedAt : undefined,
          retrievedAt: item.retrievedAt,
          readingCount: item.ok ? countReadings(item.payload) : 0,
          problem: item.ok ? undefined : (item.problem ?? "No verified data."),
        };
        if (prior) await ctx.db.patch(prior._id, run);
        else await ctx.db.insert("sourceRuns", run);
      }

      if (!item.ok) {
        failures += 1;
        continue;
      }

      // --- the verified reading ----------------------------------------
      const existing = await ctx.db
        .query("observations")
        .withIndex("by_source_key", (q) =>
          q.eq("sourceId", item.sourceId).eq("key", item.key),
        )
        .collect();
      for (const row of existing) {
        // Keep the newest reading for the key; replace anything older. This is
        // the whole of the deduplication: a key is an identity, not a log line.
        if (row.retrievedAt <= item.retrievedAt) await ctx.db.delete(row._id);
      }

      const observation: Observation = {
        sourceId: item.sourceId,
        key: item.key,
        asOf: item.asOf,
        publishedAt: item.publishedAt,
        retrievedAt: item.retrievedAt,
        status: "observed",
        note: item.note,
        ok: true,
        payload: item.payload,
      };
      await ctx.db.insert("observations", observation);
      stored += 1;
    }

    // --- release the claim, and set the next window ---------------------
    const lock = await ctx.db
      .query("sourceLocks")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .first();
    if (lock && policy) {
      const failed = failures > 0 || stored === 0;
      const consecutiveFailures = failed ? lock.consecutiveFailures + 1 : 0;
      // Exponential backoff, capped. A source that keeps failing is asked
      // progressively less often, but never stops being asked.
      const backoff = Math.min(
        policy.backoffBaseMs * 2 ** Math.max(0, consecutiveFailures - 1),
        policy.maxBackoffMs,
      );
      await ctx.db.patch(lock._id, {
        finishedAt: now,
        consecutiveFailures,
        nextAllowedAt: now + (failed ? backoff : policy.minIntervalMs),
        failures: lock.failures + (failed ? 1 : 0),
      });
    }

    return stored;
  },
});

/* ------------------------------------------------------------------ */
/* Read surface                                                        */
/* ------------------------------------------------------------------ */

const applyStaleness = (o: Observation): Observation =>
  o.ok && Date.now() - o.retrievedAt > (STALE_AFTER_MS[o.sourceId] ?? Infinity)
    ? { ...o, status: "stale", note: o.note ?? "Past its refresh window." }
    : o;

const toObservation = (row: {
  sourceId: string;
  key: string;
  asOf: string;
  publishedAt?: number;
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
  publishedAt: row.publishedAt,
  retrievedAt: row.retrievedAt,
  // Rows predate validation, so the cast is still needed on read. An unknown
  // stored status degrades to "unavailable" rather than surfacing verbatim.
  status: (DATA_STATUSES.includes(row.status)
    ? row.status
    : "unavailable") as DataStatus,
  note: row.note,
  ok: row.ok,
  problem: row.problem,
  payload: row.payload,
});

/**
 * Latest verified reading per key for a source.
 *
 * Only successful rows are returned. A failure is not a reading, and handing
 * one to the UI as data is precisely the mistake this table's shape prevents.
 * If a source has never succeeded the array is empty, which the UI renders as
 * "No verified data available" rather than as a zero.
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
      if (!r.ok) continue;
      const prev = latest.get(r.key);
      if (prev && prev.retrievedAt >= r.retrievedAt) continue;
      latest.set(r.key, applyStaleness(toObservation(r)));
    }

    return [...latest.values()];
  },
});

export type SourceStatus = {
  sourceId: string;
  /** Did the most recent attempt return a usable reading? */
  ok: boolean;
  /** Freshness-relevant status of the newest verified reading. */
  status: DataStatus;
  /** Period the newest verified reading describes. */
  asOf: string;
  /** Source-supplied publication time of the newest verified reading. */
  publishedAt?: number;
  /** When the newest verified reading was fetched; 0 if none ever was. */
  lastVerifiedAt: number;
  /** When the last attempt was made, successful or not; 0 if never. */
  lastAttemptAt: number;
  /** How many keys this source is currently contributing readings for. */
  readingCount: number;
  /** Earliest time the governor will allow another run. */
  nextAttemptAt: number;
  consecutiveFailures: number;
  /** Why the last attempt failed, when it did. */
  problem?: string;
  /** Configured cadence, so the UI can state it rather than imply "live". */
  cadence: string;
};

/** Health for one source, for the panels that render its data. */
export const sourceStatus = query({
  args: { sourceId: v.string() },
  handler: async (ctx, args): Promise<SourceStatus | null> => {
    if (!(args.sourceId in SOURCES)) return null;

    const readings = await ctx.db
      .query("observations")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();
    const attempts = await ctx.db
      .query("sourceRuns")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .collect();
    const lock = await ctx.db
      .query("sourceLocks")
      .withIndex("by_source", (q) => q.eq("sourceId", args.sourceId))
      .first();

    const keys = new Set<string>();
    let lastVerifiedAt = 0;
    let asOf = "";
    let publishedAt: number | undefined;
    let status: DataStatus = "unavailable";
    for (const r of readings) {
      if (!r.ok) continue;
      keys.add(r.key);
      if (r.retrievedAt > lastVerifiedAt) {
        lastVerifiedAt = r.retrievedAt;
        asOf = r.asOf;
        publishedAt = r.publishedAt;
        status = applyStaleness(toObservation(r)).status;
      }
    }

    let lastAttemptAt = 0;
    let newestFailureAt = 0;
    let problem: string | undefined;
    for (const a of attempts) {
      if (a.retrievedAt > lastAttemptAt) lastAttemptAt = a.retrievedAt;
      if (!a.ok && a.problem && a.retrievedAt > newestFailureAt) {
        newestFailureAt = a.retrievedAt;
        problem = a.problem;
      }
    }
    // A success at or after the newest failure means nothing is wrong *now*: a
    // source that failed at 10:00 and answered at 10:05 is not failing.
    if (lastVerifiedAt >= newestFailureAt) problem = undefined;

    return {
      sourceId: args.sourceId,
      ok: lastVerifiedAt > 0 && lastAttemptAt <= lastVerifiedAt,
      status: lastVerifiedAt === 0 ? "unavailable" : status,
      asOf,
      publishedAt,
      lastVerifiedAt,
      lastAttemptAt,
      readingCount: keys.size,
      nextAttemptAt: lock?.nextAllowedAt ?? 0,
      consecutiveFailures: lock?.consecutiveFailures ?? 0,
      problem,
      cadence: POLL[args.sourceId]?.cadence ?? "on demand",
    };
  },
});

/**
 * Health of every source we have a connector for, whether or not it has run.
 *
 * Sources with no attempt on record are reported explicitly, so the sources
 * page can render a complete table instead of silently omitting a feed that has
 * never been contacted. `asOf` prefers the most recent successful run: a source
 * that is currently throttled should still say when its data was last real,
 * while its status stays honest about the failed attempt.
 *
 * The failure count and `nextAttemptAt` are included so the board can show that
 * a struggling source is being backed off rather than simply ignored — the
 * difference between "we stopped asking" and "the source is quiet" matters to
 * anyone deciding whether to trust what is on screen.
 */
export const sourceHealth = query({
  handler: async (
    ctx,
  ): Promise<
    Array<{
      sourceId: string;
      ok: boolean;
      status: DataStatus;
      retrievedAt: number;
      asOf: string;
      lastSuccessAt: number;
      lastAttemptAt: number;
      publishedAt?: number;
      nextAttemptAt: number;
      consecutiveFailures: number;
      readingCount: number;
      cadence: string;
      problem?: string;
    }>
  > => {
    const readings = await ctx.db.query("observations").collect();
    const attempts = await ctx.db.query("sourceRuns").collect();
    const locks = await ctx.db.query("sourceLocks").collect();

    const bySourceReadings = new Map<string, typeof readings>();
    for (const r of readings) {
      const list = bySourceReadings.get(r.sourceId) ?? [];
      list.push(r);
      bySourceReadings.set(r.sourceId, list);
    }
    const bySourceAttempts = new Map<string, typeof attempts>();
    for (const a of attempts) {
      const list = bySourceAttempts.get(a.sourceId) ?? [];
      list.push(a);
      bySourceAttempts.set(a.sourceId, list);
    }
    const lockOf = new Map(locks.map((l) => [l.sourceId, l]));

    return Object.keys(SOURCES).map((sourceId) => {
      const rows = bySourceReadings.get(sourceId) ?? [];
      const runs = bySourceAttempts.get(sourceId) ?? [];
      const lock = lockOf.get(sourceId);

      // Newest verified reading, per key, exactly the set the UI can render.
      const perKey = new Map<string, (typeof rows)[number]>();
      for (const r of rows) {
        if (!r.ok) continue;
        const prev = perKey.get(r.key);
        if (!prev || r.retrievedAt > prev.retrievedAt) perKey.set(r.key, r);
      }

      let lastSuccessAt = 0;
      let asOf = "";
      let publishedAt: number | undefined;
      let status: DataStatus = "unavailable";
      for (const r of perKey.values()) {
        if (r.retrievedAt > lastSuccessAt) {
          lastSuccessAt = r.retrievedAt;
          asOf = r.asOf;
          publishedAt = r.publishedAt;
          status = applyStaleness(toObservation(r)).status;
        }
      }

      let lastAttemptAt = 0;
      let newestFailureAt = 0;
      let problem: string | undefined;
      for (const a of runs) {
        if (a.retrievedAt > lastAttemptAt) lastAttemptAt = a.retrievedAt;
        if (!a.ok && a.problem && a.retrievedAt > newestFailureAt) {
          newestFailureAt = a.retrievedAt;
          problem = a.problem;
        }
      }
      // A success at or after the newest failure means nothing is wrong now.
      if (lastSuccessAt >= newestFailureAt) problem = undefined;

      const neverContacted = lastAttemptAt === 0 && lastSuccessAt === 0;
      const failingNow = lastAttemptAt > lastSuccessAt;

      return {
        sourceId,
        ok: lastSuccessAt > 0 && !failingNow,
        status: lastSuccessAt === 0 ? "unavailable" : status,
        retrievedAt: lastAttemptAt,
        asOf,
        lastSuccessAt,
        lastAttemptAt,
        publishedAt,
        nextAttemptAt: lock?.nextAllowedAt ?? 0,
        consecutiveFailures: lock?.consecutiveFailures ?? 0,
        readingCount: perKey.size,
        cadence: POLL[sourceId]?.cadence ?? "on demand",
        problem: neverContacted ? undefined : problem,
      };
    });
  },
});
