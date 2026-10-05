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
import { getNode, isKnownNode } from "../lib/intel/nodes";
import { COUNTRIES } from "../lib/intel/countries";
import { getIndustry, INDUSTRIES } from "../lib/intel/industries";
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
 * Fixed ceiling for shared-event coupling, so adding a strongly coupled pair
 * cannot silently rescale every other arc on the map.
 */
const COUPLING_CEILING = 1.8;

/**
 * How strongly two nodes are pulled by the same events.
 *
 * For each event both nodes are exposed to, this takes the weaker of the two
 * contribution terms and sums them. That is a statement about the corpus, not
 * about physical routing — which is why the map labels these as couplings.
 */
function sharedEventCoupling(
  a: ReturnType<typeof nodeExposure>,
  b: ReturnType<typeof nodeExposure>,
): number {
  const byEvent = new Map<string, number>();
  for (const c of a.contributions) {
    byEvent.set(c.eventId, (byEvent.get(c.eventId) ?? 0) + c.contribution);
  }
  let shared = 0;
  for (const c of b.contributions) {
    shared += Math.min(c.contribution, byEvent.get(c.eventId) ?? 0);
  }
  return Math.min(1, shared / COUPLING_CEILING);
}

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
          // The single most recent signal's publisher, so a compact feed row can
          // name its source without shipping the whole ledger to every caller.
          latestSignal: a.scenario.signals.reduce<(typeof a.scenario.signals)[number] | null>(
            (best, s) => (!best || s.observedAt > best.observedAt ? s : best),
            null,
          ),
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

/**
 * The six-signal comparison across every tracked economy.
 *
 * Five columns are model output and one is not computed here at all: the
 * economic column is a reported World Bank figure, so it is filled in on the
 * client from the verified feed and simply left empty where the Bank publishes
 * no reading. The two are never mixed into one score.
 */
export const signalMatrix = query({
  args: {},
  handler: async () => {
    const all = allAssessments(SCENARIOS);
    const countries = countryIndex(all);
    const corridors = corridorIndex(all).filter((c) => c.kind !== "institution");

    const profiles = new Map<string, ReturnType<typeof nodeExposure>>();
    for (const row of [...countries, ...corridors]) {
      profiles.set(row.nodeId, nodeExposure(all, row.nodeId));
    }

    /** Fixed ceiling for the supply-chain column, for the same reason. */
    const SUPPLY_CEILING = 0.5;

    const rows = countries.map((country) => {
      const profile = profiles.get(country.nodeId);
      const load = new Map(
        (profile?.byChannel ?? []).map((c) => [c.channel as Channel, c.load]),
      );

      // Supply chain: how much of this economy's exposure arrives through
      // infrastructure that is itself loaded, weighted by that load.
      let supply = 0;
      for (const corridor of corridors) {
        const other = profiles.get(corridor.nodeId);
        if (!other || !profile) continue;
        supply += sharedEventCoupling(other, profile) * corridor.load;
      }

      return {
        nodeId: country.nodeId,
        label: country.label,
        short: country.short,
        region: country.region,
        geopolitical: load.get("diplomatic") ?? 0,
        trade: load.get("trade") ?? 0,
        energy: load.get("energy") ?? 0,
        market: load.get("finance") ?? 0,
        supply: Math.min(1, supply / SUPPLY_CEILING),
        eventCount: country.eventCount,
        overall: country.load,
      };
    });

    return { rows: rows.sort((a, b) => b.overall - a.overall) };
  },
});

/**
 * The transmission chain for one event, stage by stage.
 *
 * Nine stages, and every one of them is either measured or explicitly reported
 * as unmeasured:
 *
 *   event → country → trade → energy → infrastructure
 *         → supply chain → industry → company → market
 *
 * Seven are read straight off the propagation graph for this event. Company is
 * returned as an explicit absence with its reason, because a chain that quietly
 * omitted it would read as though no company-level effect exists — it is simply
 * not measured by this build.
 *
 * INFRASTRUCTURE and SUPPLY CHAIN are two different claims and are kept apart.
 * Infrastructure is *where* the shock travels: the chokepoints, straits and
 * corridors it actually passes through. Supply chain is *how far it carries* —
 * the economies reached by coupling to that infrastructure, weighted by how
 * hard this particular event presses on it. Merging them would report one idea
 * twice and call it two.
 */
export const eventChain = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    const all = allAssessments(SCENARIOS);
    const assessment = all.find((a) => a.scenario.id === args.eventId);
    if (!assessment) return null;

    const byChannel = (channel: Channel) =>
      assessment.scenario.pathways
        .filter((p) => p.channel === channel)
        .flatMap((p) =>
          p.exposures.map((e) => ({
            nodeId: e.nodeId,
            label: getNode(e.nodeId).label,
            short: getNode(e.nodeId).short,
            channel: p.channel,
            mechanism: p.mechanism,
            lagDays: p.lagDays as [number, number],
            confidence: p.confidence,
            impact: e.impact,
            note: e.note,
          })),
        )
        .sort((a, b) => b.impact * b.confidence - a.impact * a.confidence);

    const everyNode = byChannel("trade")
      .concat(byChannel("energy"), byChannel("finance"), byChannel("diplomatic"));

    const countries = everyNode
      .reduce<Array<{ nodeId: string; label: string; short: string; load: number }>>(
        (acc, row) => {
          // Infrastructure and institutions get their own stages further down;
          // mixing them into "countries" would misdescribe what they are.
          const kind = getNode(row.nodeId).kind;
          if (kind === "chokepoint" || kind === "corridor" || kind === "institution") {
            return acc;
          }
          const found = acc.find((a) => a.nodeId === row.nodeId);
          if (found) {
            found.load += row.impact * row.confidence;
          } else {
            acc.push({
              nodeId: row.nodeId,
              label: row.label,
              short: row.short,
              load: row.impact * row.confidence,
            });
          }
          return acc;
        },
        [],
      )
      .sort((a, b) => b.load - a.load);

    // Infrastructure this event actually travels through, carrying its mechanism
    // and lag so the stage can explain itself rather than just rank a list.
    const seenInfrastructure = new Set<string>();
    const infrastructure = everyNode
      .filter((c) => {
        const kind = getNode(c.nodeId).kind;
        if (kind !== "chokepoint" && kind !== "corridor") return false;
        if (seenInfrastructure.has(c.nodeId)) return false;
        seenInfrastructure.add(c.nodeId);
        return true;
      })
      .sort((a, b) => b.impact * b.confidence - a.impact * a.confidence)
      .slice(0, 8)
      .map((c) => ({
        ...c,
        kind: getNode(c.nodeId).kind,
        region: getNode(c.nodeId).region,
        criticality: getNode(c.nodeId).criticality,
      }));

    // Supply chain: how far this event carries *through* that infrastructure.
    //
    // For each economy, the shared-event coupling to each loaded infrastructure
    // node, scaled by how hard this event presses on that node. The coupling term
    // is corpus-derived, the scaling term is event-specific, and neither is a
    // shipping route — the wording on the panel says so.
    const infrastructureProfiles = new Map<string, ReturnType<typeof nodeExposure>>();
    for (const node of infrastructure) {
      infrastructureProfiles.set(node.nodeId, nodeExposure(all, node.nodeId));
    }
    const pressByNode = new Map<string, number>();
    for (const pathway of assessment.scenario.pathways) {
      for (const exposure of pathway.exposures) {
        const node = getNode(exposure.nodeId);
        if (node.kind !== "chokepoint" && node.kind !== "corridor") continue;
        pressByNode.set(
          exposure.nodeId,
          (pressByNode.get(exposure.nodeId) ?? 0) +
            exposure.impact * pathway.magnitude * pathway.confidence,
        );
      }
    }

    const supply = countries
      .map((country) => {
        const profile = nodeExposure(all, country.nodeId);
        let via: string | null = null;
        let load = 0;
        for (const [nodeId, press] of pressByNode) {
          const infra = infrastructureProfiles.get(nodeId);
          if (!infra || press <= 0) continue;
          const coupling = sharedEventCoupling(infra, profile);
          const carried = coupling * press;
          if (carried > load) {
            load = carried;
            via = getNode(nodeId).label;
          }
        }
        return { ...country, load, via };
      })
      .filter((row) => row.load > 0)
      .sort((a, b) => b.load - a.load)
      .slice(0, 8);

    // Industries the event reaches, by structural share through that node.
    const industryReach = INDUSTRIES.map((industry) => {
      const exposure = industryExposure(all, industry);
      const share = exposure.contributions
        .filter((c) => c.eventId === assessment.scenario.id)
        .reduce((s, c) => s + c.weight, 0);
      return {
        id: industry.id,
        label: industry.label,
        share,
        channel: exposure.contributions.find(
          (c) => c.eventId === assessment.scenario.id,
        )?.channel,
      };
    })
      .filter((row) => row.share > 0)
      .sort((a, b) => b.share - a.share);

    return {
      event: {
        id: assessment.scenario.id,
        reference: assessment.scenario.reference,
        title: assessment.scenario.title,
        summary: assessment.scenario.summary,
        detectedAt: assessment.scenario.detectedAt,
        stage: assessment.scenario.stage,
        score: assessment.risk[30].score,
        low: assessment.risk[30].low,
        high: assessment.risk[30].high,
        band: assessment.band,
        uncertainty: assessment.uncertainty,
        confidence: assessment.confidence,
        regions: assessment.scenario.regions,
        actors: assessment.scenario.actors,
      },
      countries: countries.slice(0, 10),
      trade: byChannel("trade").slice(0, 8),
      energy: byChannel("energy").slice(0, 8),
      infrastructure,
      supply,
      industries: industryReach.slice(0, 8),
      market: byChannel("finance").slice(0, 8),
      // No `company` payload at all: an absent key is the honest answer, and the
      // reason travels with it so the UI can say why rather than show a blank.
      companyReason:
        "No company filings, ownership records or issuer-level exposure data are connected, so GlobalMatrix does not name a company as affected. The link between an industry and a firm is asserted by that firm's own disclosure, and this build reads none.",
    };
  },
});

/**
 * Per-node daily pressure over the last 14 days of the corpus timeline.
 *
 * The corpus is a fixed scenario set with its own dated observations, so the
 * window is anchored to the corpus's latest observation rather than to today —
 * a scenario from 2026 does not acquire a trend by ageing. Each day's value is
 * the sum of exposure impact × pathway magnitude × confidence for every
 * observation recorded that day, which is the same term the exposure model
 * already sums, broken out by date.
 */
export const countryTrends = query({
  args: {},
  handler: async (): Promise<{
    days: string[];
    latest: string;
    nodes: { nodeId: string; values: number[] }[];
  }> => {
    const all = allAssessments(SCENARIOS);

    // The corpus's own "today" is its latest observation date.
    let latest = "";
    for (const a of all) {
      for (const s of a.scenario.signals) {
        if (s.observedAt > latest) latest = s.observedAt;
      }
    }
    if (latest === "") return { days: [], latest: "", nodes: [] };

    const dayMs = 24 * 60 * 60 * 1000;
    const end = Date.parse(latest);
    const days: string[] = [];
    for (let i = 13; i >= 0; i--) {
      days.push(new Date(end - i * dayMs).toISOString().slice(0, 10));
    }
    const index = new Map(days.map((d, i) => [d, i]));

    const byNode = new Map<string, number[]>();
    for (const a of all) {
      // Weight per node, once per scenario.
      const weights = new Map<string, number>();
      for (const pathway of a.scenario.pathways) {
        for (const exposure of pathway.exposures) {
          const term =
            exposure.impact * pathway.magnitude * pathway.confidence;
          weights.set(exposure.nodeId, (weights.get(exposure.nodeId) ?? 0) + term);
        }
      }
      for (const signal of a.scenario.signals) {
        const day = signal.observedAt.slice(0, 10);
        const slot = index.get(day);
        if (slot === undefined) continue;
        for (const [nodeId, weight] of weights) {
          const series = byNode.get(nodeId) ?? days.map(() => 0);
          series[slot] += weight;
          byNode.set(nodeId, series);
        }
      }
    }

    return {
      days,
      latest,
      nodes: [...byNode.entries()].map(([nodeId, values]) => ({
        nodeId,
        values,
      })),
    };
  },
});

/**
 * Full profile for one country, bloc, chokepoint or institution.
 *
 * Returns null for an id the model does not track. `getNode` invents a
 * placeholder for unknown ids, and without this guard a mistyped or stale link
 * rendered a complete-looking profile for a node that does not exist — every
 * metric zero, region "Unclassified", the id printed as the country name.
 */
export const countryProfile = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    if (!isKnownNode(args.nodeId)) return null;
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

    // Map links: chokepoint → economy, weighted by how strongly the two are
    // exposed to the *same* events. This is a coupling, not a shipping lane and
    // not a trade flow — the wording on the map says so.
    const profiles = new Map<string, ReturnType<typeof nodeExposure>>();
    for (const row of [...countries, ...corridors]) {
      profiles.set(row.nodeId, nodeExposure(all, row.nodeId));
    }
    const flows: { from: string; to: string; weight: number }[] = [];
    for (const corridor of corridors) {
      if (corridor.kind === "institution") continue;
      const from = profiles.get(corridor.nodeId);
      if (!from) continue;
      for (const country of countries) {
        const to = profiles.get(country.nodeId);
        if (!to) continue;
        const weight = sharedEventCoupling(from, to);
        if (weight > 0.01) {
          flows.push({ from: corridor.nodeId, to: country.nodeId, weight });
        }
      }
    }
    flows.sort((a, b) => b.weight - a.weight);

    return {
      mapNodes: [
        ...countries.map((r) => ({
          ...r,
          kind: "economy" as const,
          criticality: getNode(r.nodeId).criticality,
        })),
        ...corridors,
      ].map((r) => ({
        nodeId: r.nodeId,
        label: r.label,
        kind: r.kind,
        load: r.load,
        eventCount: r.eventCount,
        criticality: r.criticality,
        // Per-channel load, so the map's domain layers can re-shade a country
        // by one channel instead of only by its blended total.
        byChannel: r.byChannel.map((c) => ({
          channel: c.channel,
          load: c.load,
        })),
      })),
      flows: flows.slice(0, 80),
      // Where each event lands, for the map markers.
      mapEvents: all.map((a) => {
        const primary = topNodesOf(a, 1)[0];
        return {
          id: a.scenario.id,
          label: a.scenario.title,
          nodeId: primary?.nodeId ?? "",
          score: a.risk[30].score,
          channel: a.dominantChannel,
          detectedAt: a.scenario.detectedAt,
        };
      }),
      domains,
      observations,
      topEvents: all.slice(0, 5).map((a) => ({
        id: a.scenario.id,
        reference: a.scenario.reference,
        title: a.scenario.title,
        stage: a.scenario.stage,
        // Carried so the threat ticker can state when each event was detected
        // rather than leaving the date off the one surface where it matters.
        detectedAt: a.scenario.detectedAt,
        firstSignalAt: a.scenario.firstSignalAt,
        confidence: a.scenario.confidence,
        signals: a.scenario.signals,
        score: a.risk[30].score,
        low: a.risk[30].low,
        high: a.risk[30].high,
        band: a.band,
        dominantChannel: a.dominantChannel,
        channelPressure: a.channelPressure,
        topNodes: topNodesOf(a, 3),
      })),
      hottestCountries: countries.slice(0, 6),
      // Supply-chain pressure: the infrastructure nodes currently carrying the
      // most weighted exposure. Real, derived, and distinct from country load.
      supplyPressure: corridors
        .filter((c) => c.kind === "chokepoint" || c.kind === "corridor")
        .slice(0, 6),
      // Policy-linked events, filtered from real corpus tags rather than a
      // separate policy registry, which this build does not have.
      policyEvents: all
        .filter((a) =>
          a.scenario.tags.some((t) =>
            /export control|tariff|sanction|carbon|regulation|industrial policy/i.test(
              t,
            ),
          ),
        )
        .slice(0, 6)
        .map((a) => ({
          id: a.scenario.id,
          title: a.scenario.title,
          tags: a.scenario.tags,
          score: a.risk[30].score,
        })),
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
      // Places that carry a real coordinate, i.e. everything the map can plot.
      countries: COUNTRIES.filter((c) => {
        const node = getNode(c.nodeId);
        return node.lat !== undefined && node.lon !== undefined;
      }).length,
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