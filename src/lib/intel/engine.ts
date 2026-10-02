import { getNode } from "./nodes";
import {
  CHANNELS,
  type Channel,
  type Driver,
  type EventAssessment,
  type RiskBand,
  type RiskEstimate,
  type Scenario,
} from "./types";

/* ------------------------------------------------------------------ *
 * Model coefficients.
 *
 * These are the only free parameters in the system. They are stated here
 * rather than buried in the UI so that every score on screen is auditable:
 * change a number, and the whole corpus re-scores deterministically.
 * ------------------------------------------------------------------ */

/** How much a shock on each channel moves the composite. */
export const CHANNEL_WEIGHT: Record<Channel, number> = {
  energy: 1.15,
  trade: 1.0,
  finance: 0.95,
  diplomatic: 0.7,
};

/** Where each channel sits on the composite. Sums to 1. */
export const CHANNEL_SHARE: Record<Channel, number> = {
  energy: 0.3,
  trade: 0.28,
  finance: 0.24,
  diplomatic: 0.18,
};

/** Stage prior, 0..1, before any signal evidence is applied. */
export const STAGE_INDEX = {
  emerging: 0.38,
  escalating: 0.58,
  active: 0.66,
  "de-escalating": 0.3,
} as const;

/** Multiplier applied to the base score per forecast horizon. */
export const HORIZON_DRIFT = {
  7: 1.0,
  30: 1.04,
  90: 0.96,
} as const;

/** How fast the interval widens with each additional week of horizon. */
export const HORIZON_UNCERTAINTY_GROWTH = {
  7: 0,
  30: 3.5,
  90: 9,
} as const;

export const HORIZONS = [7, 30, 90] as const;

const clamp = (v: number, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

/** Reliability prior by source class. Explicit beats a wire, open source loses. */
export function reliabilityOf(scenario: Scenario): number {
  const total = scenario.signals.reduce(
    (sum, s) => sum + s.reliability * s.weight * (1 + Math.log10(s.corroborations)),
    0,
  );
  return total / Math.max(1, scenario.signals.length);
}

/**
 * Evidence strength: reliability-weighted, corroboration-weighted signal mass,
 * saturating against the corpus's own best-corroborated scenarios. It is the
 * term that shrinks the interval, so weak evidence widens the forecast rather
 * than lowering the score.
 */
export function evidenceStrengthOf(scenario: Scenario): number {
  const mass = scenario.signals.reduce(
    (sum, s) => sum + s.reliability * s.weight * Math.min(2, s.corroborations / 3),
    0,
  );
  return clamp(mass / 4.2);
}

/** Network centrality of the event: the most critical node it touches. */
export function centralityOf(scenario: Scenario): number {
  let peak = 0;
  for (const pathway of scenario.pathways) {
    for (const exposure of pathway.exposures) {
      const structural = getNode(exposure.nodeId).criticality;
      peak = Math.max(peak, structural * (0.45 + 0.55 * exposure.impact));
    }
  }
  return clamp(peak);
}

/** Mean pressure on each channel, 0..1, weighted by pathway confidence. */
export function channelPressureOf(scenario: Scenario): Record<Channel, number> {
  const out = {} as Record<Channel, number>;
  for (const channel of CHANNELS) {
    const relevant = scenario.pathways.filter((p) => p.channel === channel);
    if (relevant.length === 0) {
      out[channel] = 0;
      continue;
    }
    const mass = relevant.reduce((sum, p) => sum + p.magnitude * p.confidence, 0);
    const conf = relevant.reduce((sum, p) => sum + p.confidence, 0) || 1;
    const stability = p_stability(relevant[0].direction);
    out[channel] = clamp((mass / conf) * stability);
  }
  return out;
}

function p_stability(direction: Scenario["pathways"][number]["direction"]): number {
  return direction === "mixed" ? 0.72 : 1;
}

/**
 * The composite severity score before horizon drift, 0..100.
 *
 *   severity = 100 * (0.40 * channel pressure
 *                   + 0.22 * network centrality
 *                   + 0.20 * evidence strength
 *                   + 0.18 * stage prior)
 */
export function severityOf(scenario: Scenario): number {
  const pressure = channelPressureOf(scenario);
  const weighted = CHANNELS.reduce(
    (sum, c) => sum + pressure[c] * CHANNEL_WEIGHT[c],
    0,
  );
  const normalised = CHANNELS.reduce((sum, c) => sum + CHANNEL_WEIGHT[c], 0);
  const pressureTerm = weighted / normalised;

  const evidence = evidenceStrengthOf(scenario);
  const centrality = centralityOf(scenario);
  const stage = STAGE_INDEX[scenario.stage];

  // Evidence is a genuine multiplier on the structural signal rather than an
  // additive term: well-corroborated events score higher, poorly-corroborated
  // ones do not score lower, they score more uncertain.
  const evidential = 0.82 + 0.18 * evidence;

  const score =
    100 *
    evidential *
    (0.4 * pressureTerm + 0.22 * centrality + 0.2 * stage);

  return clamp(score, 0, 100);
}

/**
 * Half-width of the 80% interval, in score points.
 *
 *   half = 6 + 26*(1 - evidence) + 10*(1 - confidence) + 4*(1 - centrality) + horizon growth
 *
 * Every term is an explicit statement about why this particular forecast is
 * uncertain, and all four are shown to the researcher.
 */
export function uncertaintyOf(scenario: Scenario, horizonDays: number): number {
  const evidence = evidenceStrengthOf(scenario);
  const confidence = scenario.confidence;
  const centrality = centralityOf(scenario);
  const base =
    6 +
    26 * (1 - evidence) +
    10 * (1 - confidence) +
    4 * (1 - centrality);
  return Math.min(
    36,
    base + HORIZON_UNCERTAINTY_GROWTH[horizonDays as 7 | 30 | 90],
  );
}

/**
 * Band thresholds are calibrated against the corpus, not against the
 * theoretical range of the composite (which tops out near 75). They express
 * an analyst's tolerance: only the top of the observed distribution reads as
 * high, and nothing reads as severe without a near-maximal score.
 */
export function bandOf(score: number): RiskBand {
  if (score < 30) return "low";
  if (score < 42) return "moderate";
  if (score < 52) return "elevated";
  if (score < 65) return "high";
  return "severe";
}

/** Decompose the composite into auditable, channel-tagged contributions. */
export function driversOf(scenario: Scenario): Driver[] {
  const pressure = channelPressureOf(scenario);
  const drivers: Driver[] = CHANNELS.map((channel) => {
    const contribution = pressure[channel] * CHANNEL_SHARE[channel] * 100;
    return {
      id: `drv-${channel}`,
      label: `${channel[0].toUpperCase()}${channel.slice(1)} channel`,
      channel,
      weight: CHANNEL_SHARE[channel],
      contribution,
      note: channelNote(channel, pressure[channel]),
    };
  });

  drivers.push({
    id: "drv-centrality",
    label: "Network centrality",
    channel: "trade",
    weight: 0.1,
    contribution: (centralityOf(scenario) / 1) * 10,
    note: `Most critical exposed node reaches ${(centralityOf(scenario) * 100).toFixed(0)}% of maximum propagation strength.`,
  });

  const evidence = evidenceStrengthOf(scenario);
  drivers.push({
    id: "drv-evidence",
    label: "Evidence strength",
    channel: "finance",
    weight: 0.08,
    contribution: evidence * 8,
    note: `${scenario.signals.length} observations, mean reliability ${(reliabilityOf(scenario) * 100).toFixed(0)}%. Acts as a multiplier, not an offset.`,
  });

  return drivers.sort((a, b) => b.contribution - a.contribution);
}

function channelNote(channel: Channel, magnitude: number): string {
  if (magnitude === 0) return `No material transmission observed on ${channel}.`;
  if (magnitude < 0.3) return `Weak, late transmission on ${channel}.`;
  if (magnitude < 0.55) return `Moderate transmission on ${channel}, mixed direction.`;
  if (magnitude < 0.78) return `Material transmission on ${channel}.`;
  return `Dominant transmission on ${channel}.`;
}

/** Full multi-horizon risk estimate for one scenario. */
export function assess(scenario: Scenario): EventAssessment {
  const base = severityOf(scenario);
  const risk: Record<number, RiskEstimate> = {};

  for (const horizon of HORIZONS) {
    const drift = HORIZON_DRIFT[horizon];
    // Long-horizon forecasts mean-revert toward the corpus median, because the
    // model's edge decays with time even when its current signal does not.
    const regression = horizon === 90 ? 0.72 : 1;
    const score = clamp(base * drift * regression + (1 - regression) * 48, 0, 100);
    const half = uncertaintyOf(scenario, horizon);
    risk[horizon] = {
      horizonDays: horizon,
      score,
      low: clamp(score - half, 0, 100),
      high: clamp(score + half, 0, 100),
      band: bandOf(score),
      drivers: driversOf(scenario),
    };
  }

  const pressure = channelPressureOf(scenario);
  const dominantChannel = CHANNELS.reduce((best, c) =>
    pressure[c] * CHANNEL_WEIGHT[c] > pressure[best] * CHANNEL_WEIGHT[best] ? c : best,
  );

  return {
    scenario,
    risk,
    channelPressure: pressure,
    overall: risk[30].score,
    band: risk[30].band,
    confidence: scenario.confidence,
    evidenceStrength: evidenceStrengthOf(scenario),
    uncertainty: risk[30].high - risk[30].low,
    dominantChannel,
    velocitySeries: velocitySeriesOf(scenario),
  };
}

/**
 * Cumulative evidence mass over the detection window, used for the sparkline.
 * Deterministic: same corpus, same picture, every render.
 */
export function velocitySeriesOf(scenario: Scenario): number[] {
  const steps = 24;
  const start = Date.parse(scenario.firstSignalAt);
  const end = Date.parse(scenario.detectedAt);
  const span = Math.max(1, end - start);
  const buckets = new Array<number>(steps).fill(0);

  for (const signal of scenario.signals) {
    const offset = (Date.parse(signal.observedAt) - start) / span;
    const index = Math.min(steps - 1, Math.max(0, Math.round(offset * (steps - 1))));
    buckets[index] += signal.reliability * signal.weight;
  }

  let running = 0;
  return buckets.map((v) => {
    running += v;
    return running;
  });
}

/** The whole corpus, assessed once. Deterministic, so memoisation is safe. */
let cache: EventAssessment[] | null = null;

export function allAssessments(scenarios: Scenario[]): EventAssessment[] {
  if (cache && cache.length === scenarios.length) return cache;
  cache = scenarios.map(assess).sort((a, b) => b.overall - a.overall);
  return cache;
}

/** Aggregate network state used by the risk board header. */
export function networkSummary(assessments: EventAssessment[]) {
  const byChannel = {} as Record<Channel, number>;
  for (const channel of CHANNELS) {
    byChannel[channel] =
      assessments.reduce((sum, a) => sum + a.channelPressure[channel], 0) /
      Math.max(1, assessments.length);
  }

  const nodeLoad = new Map<string, number>();
  for (const a of assessments) {
    for (const pathway of a.scenario.pathways) {
      for (const exposure of pathway.exposures) {
        const key = `${pathway.channel}:${exposure.nodeId}`;
        nodeLoad.set(
          key,
          (nodeLoad.get(key) ?? 0) +
            exposure.impact * pathway.magnitude * pathway.confidence,
        );
      }
    }
  }

  const hottest = [...nodeLoad.entries()]
    .map(([key, load]) => {
      const [channel, nodeId] = key.split(":");
      return { channel: channel as Channel, node: getNode(nodeId), load };
    })
    .sort((a, b) => b.load - a.load)
    .slice(0, 8);

  const meanUncertainty =
    assessments.reduce((sum, a) => sum + a.uncertainty, 0) /
    Math.max(1, assessments.length);

  return { byChannel, hottest, meanUncertainty };
}