import { allAssessments } from "../lib/intel/engine";
import { corridorIndex, countryIndex } from "../lib/intel/exposure";
import { SCENARIOS } from "../lib/intel/scenarios";
import { CHANNELS, type Channel } from "../lib/intel/types";
import { query } from "./_generated/server";

/**
 * Macro risk topology.
 *
 * Six categories, each a daily series over a fixed 30-day window anchored to the
 * corpus's own latest observation date — not to `Date.now()`, because the corpus
 * is a scenario and a scenario has its own clock. Every value is MODEL OUTPUT:
 * nothing here is observed, and each series is normalised against a ceiling that
 * is returned alongside it, so the UI can say what 100% means instead of showing
 * a bare index with no scale.
 *
 * Days on which no event was observed stay at zero rather than carrying the
 * previous day's level forward. Absence of coverage is information here, and
 * smoothing it away would overstate how continuously active the corpus is.
 */
const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 30;

/** Same tag test the Overview uses to surface policy-linked events. */
const POLICY_TAG =
  /export control|tariff|sanction|carbon|regulation|industrial policy/i;

export interface TopologyCategory {
  id: string;
  label: string;
  /** What the number is a measure of, so a tile can explain itself on hover. */
  measure: string;
  /** 30 daily values, each a share of `ceiling`. */
  values: number[];
  /** Raw peak the series is scaled against. */
  ceiling: number;
  /** Mean of the final third minus the preceding third, in index points. */
  change: number;
  trend: "rising" | "falling" | "flat";
  /** Latest reading, as a share of the ceiling. */
  intensity: number;
}

export interface TopologyResult {
  days: string[];
  /** The corpus's latest observation date — this series' "today". */
  latest: string;
  categories: TopologyCategory[];
  /** Seventh series, kept separate: a static structural table would say nothing. */
  fragility: {
    values: number[];
    ceiling: number;
    latest: number;
    change: number;
    measure: string;
  };
}

export const macroTopology = query({
  args: {},
  handler: async (): Promise<TopologyResult> => {
    const all = allAssessments(SCENARIOS);
    const empty: TopologyResult = {
      days: [],
      latest: "",
      categories: [],
      fragility: { values: [], ceiling: 0, latest: 0, change: 0, measure: "" },
    };
    if (all.length === 0) return empty;

    let latest = "";
    for (const a of all) {
      for (const s of a.scenario.signals) {
        if (s.observedAt > latest) latest = s.observedAt;
      }
    }
    if (latest === "") return empty;

    const end = Date.parse(latest);
    const days: string[] = [];
    for (let i = WINDOW_DAYS - 1; i >= 0; i--) {
      days.push(new Date(end - i * DAY_MS).toISOString().slice(0, 10));
    }
    const slot = new Map(days.map((d, i) => [d, i]));

    // Infrastructure places, so the supply-chain category measures chokepoints
    // and corridors specifically rather than all exposure everywhere.
    const infrastructure = new Set(
      corridorIndex(all)
        .filter((c) => c.kind === "chokepoint" || c.kind === "corridor")
        .map((c) => c.nodeId),
    );
    // Structural fragility per tracked economy, straight from the country
    // directory the Countries board uses.
    const fragilityOf = new Map(
      countryIndex(all).map((c) => [c.nodeId, c.fragility]),
    );

    const zero = () => days.map(() => 0);
    const byChannel = {} as Record<Channel, number[]>;
    for (const channel of CHANNELS) byChannel[channel] = zero();
    const supply = zero();
    const policy = zero();
    // Numerator and denominator of the fragility series, kept apart so it can be
    // a genuine exposure-weighted mean rather than a sum that drifts with volume.
    const fragilityWeighted = zero();
    const fragilityMass = zero();

    for (const a of all) {
      // Per-event mass, computed once, then stamped onto every day this event
      // was observed on.
      const channelMass = {} as Record<Channel, number>;
      for (const channel of CHANNELS) {
        channelMass[channel] = a.scenario.pathways
          .filter((p) => p.channel === channel)
          .reduce((sum, p) => sum + p.magnitude * p.confidence, 0);
      }

      const nodeWeight = new Map<string, number>();
      for (const pathway of a.scenario.pathways) {
        for (const exposure of pathway.exposures) {
          nodeWeight.set(
            exposure.nodeId,
            (nodeWeight.get(exposure.nodeId) ?? 0) +
              exposure.impact * pathway.magnitude * pathway.confidence,
          );
        }
      }
      let supplyMass = 0;
      let fragilityNum = 0;
      let fragilityDen = 0;
      for (const [nodeId, weight] of nodeWeight) {
        if (infrastructure.has(nodeId)) supplyMass += weight;
        const fragility = fragilityOf.get(nodeId);
        if (fragility !== undefined) {
          fragilityNum += weight * fragility;
          fragilityDen += weight;
        }
      }
      const policyMass = a.scenario.tags.some((t) => POLICY_TAG.test(t)) ? 1 : 0;

      for (const signal of a.scenario.signals) {
        const index = slot.get(signal.observedAt.slice(0, 10));
        if (index === undefined) continue;
        for (const channel of CHANNELS) byChannel[channel][index] += channelMass[channel];
        supply[index] += supplyMass;
        policy[index] += policyMass;
        fragilityWeighted[index] += fragilityNum;
        fragilityMass[index] += fragilityDen;
      }
    }

    const raw: { id: string; label: string; measure: string; values: number[] }[] = [
      {
        id: "trade-bottlenecks",
        label: "Trade bottlenecks",
        measure:
          "Corpus pathway mass on the trade channel, stamped on each day an event was observed.",
        values: byChannel.trade,
      },
      {
        id: "energy",
        label: "Energy",
        measure: "Corpus pathway mass on the energy channel.",
        values: byChannel.energy,
      },
      {
        id: "geopolitical",
        label: "Geopolitical stress",
        measure: "Corpus pathway mass on the diplomatic channel.",
        values: byChannel.diplomatic,
      },
      {
        id: "financial",
        label: "Financial stress",
        measure: "Corpus pathway mass on the finance channel.",
        values: byChannel.finance,
      },
      {
        id: "supply-chain",
        label: "Supply chain",
        measure:
          "Weighted exposure landing on tracked chokepoints and corridors rather than on economies.",
        values: supply,
      },
      {
        id: "policy",
        label: "Policy",
        measure:
          "Corpus events carrying a tariff, sanctions, export-control, carbon or industrial-policy tag.",
        values: policy,
      },
    ];

    const categories: TopologyCategory[] = raw.map((c) => {
      // Scaled to this category's own peak, so six categories of very different
      // natural magnitude stay comparable. The peak travels with the value.
      const ceiling = Math.max(...c.values, 0.0001);
      const values = c.values.map((v) => v / ceiling);
      const change = tailChange(values);
      return {
        id: c.id,
        label: c.label,
        measure: c.measure,
        values,
        ceiling,
        change,
        trend:
          change > 0.04 ? "rising"
          : change < -0.04 ? "falling"
          : "flat",
        intensity: values.length > 0 ? values[values.length - 1] : 0,
      };
    });

    // Fragility under pressure: each day's economy load weighted by the
    // structural fragility of the economies carrying it. A constant fragility
    // table would be true and useless — it would not move when the world does.
    const dailyMean = days.map((_, i) =>
      fragilityMass[i] > 0 ? fragilityWeighted[i] / fragilityMass[i] : 0,
    );
    const fragilityCeiling = Math.max(...dailyMean, 0.0001);

    return {
      days,
      latest,
      categories,
      fragility: {
        values: dailyMean.map((v) => v / fragilityCeiling),
        ceiling: fragilityCeiling,
        latest: dailyMean.length > 0 ? dailyMean[dailyMean.length - 1] / fragilityCeiling : 0,
        change: tailChange(dailyMean.map((v) => v / fragilityCeiling)),
        measure:
          "Structural fragility of tracked economies, weighted by the exposure they carry that day.",
      },
    };
  },
});

/** Mean of the final third of the window minus the third before it. */
function tailChange(values: number[]): number {
  const third = Math.max(1, Math.round(values.length / 3));
  const recent = values.slice(values.length - third);
  const prior = values.slice(values.length - third * 2, values.length - third);
  return mean(recent) - mean(prior);
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}
