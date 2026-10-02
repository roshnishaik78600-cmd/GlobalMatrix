import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { allAssessments, networkSummary } from "../lib/intel/engine";
import {
  corridorIndex,
  countryIndex,
  countryProfilePayload,
  industryIndex,
  industryProfilePayload,
} from "../lib/intel/exposure";
import { SCENARIOS } from "../lib/intel/scenarios";
import { CHANNELS, type Channel, type Stage } from "../lib/intel/types";
import { query } from "./_generated/server";

/**
 * Detection feed.
 *
 * Ranked by 30-day composite risk, with the dominant transmission channel and
 * the evidence ledger summary attached so the list view can explain itself.
 */
export const detectionFeed = query({
  args: {
    channel: v.optional(v.union(v.literal("trade"), v.literal("energy"), v.literal("finance"), v.literal("diplomatic"))),
    stage: v.optional(
      v.union(
        v.literal("emerging"),
        v.literal("escalating"),
        v.literal("active"),
        v.literal("de-escalating"),
      ),
    ),
    watchlistOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const watched = new Set<string>();
    if (userId) {
      const rows = await ctx.db
        .query("watchlist")
        .withIndex("by_user", (q) => q.eq("userId", userId))
        .collect();
      for (const row of rows) watched.add(row.eventId);
    }

    const all = allAssessments(SCENARIOS);

    const rows = all
      .filter((a) => !args.channel || a.channelPressure[args.channel as Channel] > 0.3)
      .filter((a) => !args.stage || a.scenario.stage === (args.stage as Stage))
      .filter((a) => !args.watchlistOnly || watched.has(a.scenario.id))
      .map((a) => ({
        id: a.scenario.id,
        reference: a.scenario.reference,
        title: a.scenario.title,
        summary: a.scenario.summary,
        stage: a.scenario.stage,
        detectedAt: a.scenario.detectedAt,
        firstSignalAt: a.scenario.firstSignalAt,
        confidence: a.scenario.confidence,
        novelty: a.scenario.novelty,
        velocity: a.scenario.velocity,
        actors: a.scenario.actors,
        regions: a.scenario.regions,
        tags: a.scenario.tags,
        signalCount: a.scenario.signals.length,
        dominantChannel: a.dominantChannel,
        channelPressure: a.channelPressure,
        score30: a.risk[30].score,
        low30: a.risk[30].low,
        high30: a.risk[30].high,
        band: a.band,
        evidenceStrength: a.evidenceStrength,
        velocitySeries: a.velocitySeries,
        watched: watched.has(a.scenario.id),
      }));

    return {
      rows,
      total: all.length,
      corpusSize: all.length,
      watchlistSize: watched.size,
    };
  },
});

/** Full assessment for one event, including the propagation graph. */
export const eventDetail = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const assessment = allAssessments(SCENARIOS).find(
      (a) => a.scenario.id === args.eventId,
    );
    if (!assessment) return null;

    let watched = false;
    let annotations: { id: Id<"annotations">; body: string; createdAt: number }[] = [];
    let brief: {
      thesis: string;
      channels: string[];
      caveats: string[];
      model: string;
      createdAt: number;
    } | null = null;

    if (userId) {
      const w = await ctx.db
        .query("watchlist")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("eventId", args.eventId),
        )
        .first();
      watched = !!w;

      annotations = (
        await ctx.db
          .query("annotations")
          .withIndex("by_user_event", (q) =>
            q.eq("userId", userId).eq("eventId", args.eventId),
          )
          .collect()
      ).map((a) => ({ id: a._id, body: a.body, createdAt: a.createdAt }));

      brief = await ctx.db
        .query("briefs")
        .withIndex("by_user_event", (q) =>
          q.eq("userId", userId).eq("eventId", args.eventId),
        )
        .first();
    }

    return {
      assessment,
      risk: [7, 30, 90].map((h) => assessment.risk[h]),
      watched,
      annotations,
      brief: brief
        ? {
            thesis: brief.thesis,
            channels: brief.channels,
            caveats: brief.caveats,
            model: brief.model,
            createdAt: brief.createdAt,
          }
        : null,
    };
  },
});

/**
 * Risk board: every event as a row, every channel as a column, plus the
 * network aggregates the board header reports.
 */
export const riskBoard = query({
  args: {},
  handler: async () => {
    const all = allAssessments(SCENARIOS);
    return {
      channels: [...CHANNELS],
      rows: all.map((a) => ({
        id: a.scenario.id,
        title: a.scenario.title,
        stage: a.scenario.stage,
        dominantChannel: a.dominantChannel,
        channelPressure: a.channelPressure,
        score7: a.risk[7].score,
        score30: a.risk[30].score,
        low30: a.risk[30].low,
        high30: a.risk[30].high,
        band: a.band,
        tailScenario: a.scenario.tailScenario,
        analystNote: a.scenario.analystNote,
        uncertainty: a.uncertainty,
      })),
      summary: networkSummary(all),
    };
  },
});

/**
 * Country and corridor index. Exposure is derived live from the event corpus
 * by walking the propagation graph to each node — no figure here is stored.
 */
export const countryDirectory = query({
  args: {},
  handler: async () => {
    const all = allAssessments(SCENARIOS);
    return {
      countries: countryIndex(all),
      corridors: corridorIndex(all),
    };
  },
});

/** Full profile for one country, bloc, chokepoint or institution. */
export const countryProfile = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return countryProfilePayload(allAssessments(SCENARIOS), args.nodeId);
  },
});

/** Industry index, ranked by live exposure. */
export const industryDirectory = query({
  args: {},
  handler: async () => {
    return { industries: industryIndex(allAssessments(SCENARIOS)) };
  },
});

/** Full profile for one industry. */
export const industryProfile = query({
  args: { industryId: v.string() },
  handler: async (ctx, args) => {
    return industryProfilePayload(allAssessments(SCENARIOS), args.industryId);
  },
});

/** Corpus-level metadata surfaced in the app header. */
export const corpusStats = query({
  args: {},
  handler: async () => {
    const all = allAssessments(SCENARIOS);
    const bands = all.reduce<Record<string, number>>((acc, a) => {
      acc[a.band] = (acc[a.band] ?? 0) + 1;
      return acc;
    }, {});
    return {
      events: all.length,
      signals: all.reduce((sum, a) => sum + a.scenario.signals.length, 0),
      actors: new Set(all.flatMap((a) => a.scenario.actors)).size,
      meanScore: all.reduce((s, a) => s + a.overall, 0) / all.length,
      bands,
      nodes: new Set(
        all.flatMap((a) =>
          a.scenario.pathways.flatMap((p) => p.exposures.map((e) => e.nodeId)),
        ),
      ).size,
    };
  },
});