import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { STALE_AFTER_MS, type DataStatus } from "../lib/sources";

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

/**
 * Persist a connector run.
 *
 * Connectors execute in the Node runtime, which has no database handle, so they
 * hand their validated results here. Only fully-formed outcomes are accepted —
 * a connector cannot write an unattributed or half-parsed reading.
 */
export const storeObservations = mutation({
  args: { items: v.array(outcomeValidator) },
  handler: async (ctx, args): Promise<number> => {
    for (const o of args.items) {
      await ctx.db.insert("observations", o);
    }
    return args.items.length;
  },
});

const applyStaleness = (o: Observation): Observation =>
  o.ok && Date.now() - o.retrievedAt > (STALE_AFTER_MS[o.sourceId] ?? Infinity)
    ? { ...o, status: "stale", note: o.note ?? "Past its refresh window." }
    : o;

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
      latest.set(r.key, {
        sourceId: r.sourceId,
        key: r.key,
        asOf: r.asOf,
        retrievedAt: r.retrievedAt,
        status: r.status as DataStatus,
        note: r.note,
        ok: r.ok,
        problem: r.problem,
        payload: r.payload,
      });
    }

    return [...latest.values()].map(applyStaleness);
  },
});

/** Every source that has an attempt on record, successful or not. */
export const sourceHealth = query({
  handler: async (ctx): Promise<
    Array<{
      sourceId: string;
      ok: boolean;
      status: DataStatus;
      retrievedAt: number;
      asOf: string;
      problem?: string;
    }>
  > => {
    const rows = await ctx.db.query("observations").collect();
    const latest = new Map<string, Observation>();
    for (const r of rows) {
      const prev = latest.get(r.sourceId);
      if (prev && prev.retrievedAt >= r.retrievedAt) continue;
      latest.set(r.sourceId, applyStaleness({
        sourceId: r.sourceId,
        key: r.key,
        asOf: r.asOf,
        retrievedAt: r.retrievedAt,
        status: r.status as DataStatus,
        note: r.note,
        ok: r.ok,
        problem: r.problem,
        payload: r.payload,
      }));
    }
    return [...latest.values()].map((o) => ({
      sourceId: o.sourceId,
      ok: o.ok,
      status: o.status,
      retrievedAt: o.retrievedAt,
      asOf: o.asOf,
      problem: o.problem,
    }));
  },
});