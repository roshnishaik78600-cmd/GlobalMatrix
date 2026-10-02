import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { allAssessments, networkSummary } from "../lib/intel/engine";
import {
  corridorIndex,
  countryIndex,
  countryProfilePayload,
  industryExposure,
  industryIndex,
  industryProfilePayload,
  nodeExposure,
} from "../lib/intel/exposure";
import { SCENARIOS } from "../lib/intel/scenarios";
import { getNode } from "../lib/intel/nodes";
import { getIndustry } from "../lib/intel/industries";
import { runScenario, SHOCK_LABEL, SHOCK_DESCRIPTION } from "../lib/intel/scenario";
import {
  CHANNELS,
  CHANNEL_LABEL,
  SOURCE_CLASS_LABEL,
  type Channel,
  type Stage,
} from "../lib/intel/types";
import { query, type QueryCtx } from "./_generated/server";

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
      .map((a) => {
        // The nodes this event lands on hardest, so the feed answers
        // "where does this land?" without opening the event.
        const byNode = new Map<string, number>();
        for (const pathway of a.scenario.pathways) {
          for (const exposure of pathway.exposures) {
            const term = exposure.impact * pathway.magnitude * pathway.confidence;
            byNode.set(
              exposure.nodeId,
              (byNode.get(exposure.nodeId) ?? 0) + term,
            );
          }
        }
        const topNodes = [...byNode.entries()]
          .sort((x, y) => y[1] - x[1])
          .slice(0, 3)
          .map(([nodeId, weight]) => ({
            nodeId,
            label: getNode(nodeId).label,
            short: getNode(nodeId).short,
            weight,
          }));

        return {
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
          topNodes,
          watched: watched.has(a.scenario.id),
        };
      });

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
  handler: async (ctx) => {
    const all = allAssessments(SCENARIOS);
    const watched = await watchedKeys(ctx);
    const mark = (id: string) => watched.has(`NODE:${id}`);
    return {
      countries: countryIndex(all).map((r) => ({ ...r, watched: mark(r.nodeId) })),
      corridors: corridorIndex(all).map((r) => ({ ...r, watched: mark(r.nodeId) })),
      watchlistSize: [...watched].filter((k) => k.startsWith("NODE:")).length,
    };
  },
});

/** Keys of everything this researcher is tracking. */
async function watchedKeys(ctx: QueryCtx): Promise<Set<string>> {
  const userId = await getAuthUserId(ctx);
  if (!userId) return new Set();
  const rows = await ctx.db
    .query("watchlist")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();
  return new Set(rows.map((r) => r.eventId));
}

/** Full profile for one country, bloc, chokepoint or institution. */
export const countryProfile = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const watched = await watchedKeys(ctx);
    return {
      ...countryProfilePayload(allAssessments(SCENARIOS), args.nodeId),
      watched: watched.has(`NODE:${args.nodeId}`),
    };
  },
});

/** Industry index, ranked by live exposure. */
export const industryDirectory = query({
  args: {},
  handler: async (ctx) => {
    const watched = await watchedKeys(ctx);
    return {
      industries: industryIndex(allAssessments(SCENARIOS)).map((r) => ({
        ...r,
        watched: watched.has(`SECTOR:${r.id}`),
      })),
      watchlistSize: [...watched].filter((k) => k.startsWith("SECTOR:")).length,
    };
  },
});

/** Full profile for one industry. */
export const industryProfile = query({
  args: { industryId: v.string() },
  handler: async (ctx, args) => {
    const payload = industryProfilePayload(
      allAssessments(SCENARIOS),
      args.industryId,
    );
    if (!payload) return null;
    const watched = await watchedKeys(ctx);
    return { ...payload, watched: watched.has(`SECTOR:${args.industryId}`) };
  },
});

/**
 * Everything the Overview needs in one payload, so the dashboard is a single
 * round trip rather than eight independent subscriptions.
 */
export const overview = query({
  args: {},
  handler: async () => {
    const all = allAssessments(SCENARIOS);

    const countries = countryIndex(all);
    const corridors = corridorIndex(all);

    // Radar axes: real aggregates of channel pressure across the corpus.
    const domains = CHANNELS.map((channel) => ({
      label: CHANNEL_LABEL[channel],
      value: Math.min(
        1,
        all.reduce((s, a) => s + a.channelPressure[channel], 0) / all.length,
      ),
      count: all.filter((a) => a.scenario.pathways.some((p) => p.channel === channel))
        .length,
    })).sort((a, b) => b.value - a.value);

    // Timeline: real observation timestamps, newest first.
    const observations = all
      .flatMap((a) =>
        a.scenario.signals.map((sig) => ({
          eventId: a.scenario.id,
          title: sig.headline,
          detail: `${sig.source} · ${SOURCE_CLASS_LABEL[sig.sourceClass]}`,
          at: sig.observedAt,
          channel: sig.channel,
          stage: a.scenario.stage,
        })),
      )
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 14);

    // Map flows: chokepoint → the economies most dependent on it.
    const flows: { from: string; to: string; weight: number }[] = [];
    for (const corridor of corridors) {
      for (const row of countries) {
        const exposure = nodeExposure(all, row.nodeId);
        const via = exposure.contributions.find(
          (c) => c.viaNodeId === corridor.nodeId,
        );
        if (via) flows.push({ from: corridor.nodeId, to: row.nodeId, weight: via.contribution });
      }
    }
    flows.sort((a, b) => b.weight - a.weight);

    return {
      mapNodes: [...countries, ...corridors].map((r) => ({
        nodeId: r.nodeId,
        label: r.label,
        load: r.load,
        eventCount: r.eventCount,
        criticality: "criticality" in r ? r.criticality : 0,
      })),
      flows: flows.slice(0, 60),
      domains,
      observations,
      topEvents: all.slice(0, 5).map((a) => ({
        id: a.scenario.id,
        reference: a.scenario.reference,
        title: a.scenario.title,
        stage: a.scenario.stage,
        score: a.risk[30].score,
        low: a.risk[30].low,
        high: a.risk[30].high,
        band: a.band,
        dominantChannel: a.dominantChannel,
        channelPressure: a.channelPressure,
        topNodes: topNodesOf(a, 3),
      })),
      hottestCountries: countries.slice(0, 6),
      hottestIndustries: industryIndex(all).slice(0, 6),
      summary: networkSummary(all),
      stats: {
        events: all.length,
        signals: all.reduce((s, a) => s + a.scenario.signals.length, 0),
        actors: new Set(all.flatMap((a) => a.scenario.actors)).size,
        nodes: new Set(
          all.flatMap((a) =>
            a.scenario.pathways.flatMap((p) => p.exposures.map((e) => e.nodeId)),
          ),
        ).size,
      },
    };
  },
});

function topNodesOf(a: ReturnType<typeof allAssessments>[number], limit: number) {
  const byNode = new Map<string, number>();
  for (const pathway of a.scenario.pathways) {
    for (const exposure of pathway.exposures) {
      byNode.set(
        exposure.nodeId,
        (byNode.get(exposure.nodeId) ?? 0) +
          exposure.impact * pathway.magnitude * pathway.confidence,
      );
    }
  }
  return [...byNode.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, limit)
    .map(([nodeId, weight]) => ({
      nodeId,
      label: getNode(nodeId).label,
      short: getNode(nodeId).short,
      weight,
    }));
}

/** Relationship graph for one event: channels → countries. */
export const eventGraph = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const assessment = allAssessments(SCENARIOS).find(
      (a) => a.scenario.id === args.eventId,
    );
    if (!assessment) return null;

    const nodes = [
      {
        id: assessment.scenario.id,
        label: "Event",
        kind: "Event",
        weight: 1,
      },
    ];
    const edges: { from: string; to: string; weight: number; label: string }[] = [];

    for (const pathway of assessment.scenario.pathways) {
      const channelId = `ch:${pathway.channel}`;
      nodes.push({
        id: channelId,
        label: CHANNEL_LABEL[pathway.channel],
        kind: "Channel",
        weight: pathway.magnitude,
      });
      edges.push({
        from: assessment.scenario.id,
        to: channelId,
        weight: pathway.magnitude,
        label: "propagates via",
      });
      for (const exposure of pathway.exposures) {
        nodes.push({
          id: exposure.nodeId,
          label: getNode(exposure.nodeId).label,
          kind:
            getNode(exposure.nodeId).kind === "chokepoint"
              ? "Corridor"
              : "Country",
          weight: exposure.impact,
        });
        edges.push({
          from: channelId,
          to: exposure.nodeId,
          weight: exposure.impact * pathway.magnitude,
          label: "exposes",
        });
      }
    }

    // Deduplicate nodes while keeping the strongest weight.
    const merged = new Map<string, (typeof nodes)[number]>();
    for (const n of nodes) {
      const prev = merged.get(n.id);
      if (!prev || n.weight > prev.weight) merged.set(n.id, n);
    }

    return { nodes: [...merged.values()], edges };
  },
});

/** Supply-chain stages and edges for one industry, from real structure. */
export const supplyFlow = query({
  args: { industryId: v.string() },
  handler: async (ctx, args) => {
    const industry = getIndustry(args.industryId);
    if (!industry) return null;
    const all = allAssessments(SCENARIOS);
    const exposure = industryExposure(all, industry);

    const weightOf = (nodeId: string) =>
      exposure.contributions
        .filter((c) => c.viaNodeId === nodeId)
        .reduce((s, c) => s + c.contribution, 0);

    const stages = [
      { id: "input", label: "Input", nodeIds: industry.inputs.map((i) => i.nodeId) },
      { id: "route", label: "Route", nodeIds: industry.routes.map((r) => r.nodeId) },
      {
        id: "producer",
        label: "Producer",
        nodeIds: industry.producers.map((p) => p.nodeId),
      },
      {
        id: "consumer",
        label: "Consumer",
        nodeIds: industry.consumers.map((c) => c.nodeId),
      },
    ].filter((s) => s.nodeIds.length > 0);

    // Edges follow the declared structural chain: inputs and routes feed
    // producers, producers feed consumers. Weight is the live corpus term.
    const edges: { from: string; to: string; weight: number }[] = [];
    for (const producer of industry.producers) {
      for (const input of industry.inputs) {
        const w = weightOf(producer.nodeId) + weightOf(input.nodeId);
        if (w > 0) edges.push({ from: "input", to: "producer", weight: w });
      }
      for (const route of industry.routes) {
        const w = weightOf(producer.nodeId) + weightOf(route.nodeId);
        if (w > 0) edges.push({ from: "route", to: "producer", weight: w });
      }
      for (const consumer of industry.consumers) {
        const w = weightOf(producer.nodeId) + weightOf(consumer.nodeId);
        if (w > 0) edges.push({ from: "producer", to: "consumer", weight: w });
      }
    }

    return {
      industry: { id: industry.id, label: industry.label },
      stages,
      edges: edges.sort((a, b) => b.weight - a.weight).slice(0, 40),
    };
  },
});

/** Scenario metadata for the lab UI. */
export const scenarioMeta = query({
  args: {},
  handler: async () => {
    return {
      events: allAssessments(SCENARIOS)
        .slice(0, 12)
        .map((a) => ({
          id: a.scenario.id,
          reference: a.scenario.reference,
          title: a.scenario.title,
          stage: a.scenario.stage,
          score: a.risk[30].score,
        })),
      modes: (Object.keys(SHOCK_LABEL) as (keyof typeof SHOCK_LABEL)[]).map(
        (mode) => ({ mode, label: SHOCK_LABEL[mode], description: SHOCK_DESCRIPTION[mode] }),
      ),
    };
  },
});

/** Re-scores the corpus under a stated perturbation. Deterministic. */
export const runScenarioQuery = query({
  args: {
    eventId: v.string(),
    mode: v.union(v.literal("amplify"), v.literal("suppress"), v.literal("remove_node"), v.literal("decay")),
    magnitude: v.number(),
    nodeId: v.optional(v.string()),
    horizonDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return runScenario({
      eventId: args.eventId,
      mode: args.mode,
      magnitude: args.magnitude,
      nodeId: args.nodeId,
      horizonDays: args.horizonDays ?? 30,
    });
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