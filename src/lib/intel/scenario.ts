import { allAssessments, assess } from "./engine";
import { countryIndex, industryExposure, industryIndex, nodeExposure } from "./exposure";
import { getIndustry } from "./industries";
import { SCENARIOS } from "./scenarios";
import type { Channel, Driver, Scenario } from "./types";

/**
 * Scenario engine.
 *
 * A scenario is not a separate model with invented outputs — it is a
 * perturbation of the actual corpus, re-scored by the actual engine. The
 * numbers below are therefore real consequences of the stated assumption, and
 * they are labelled as conditional everywhere they surface.
 */

export type ShockMode = "amplify" | "suppress" | "remove_node" | "decay";

export const SHOCK_LABEL: Record<ShockMode, string> = {
  amplify: "Amplify the event",
  suppress: "Suppress the event",
  remove_node: "Take a node offline",
  decay: "De-rate confidence",
};

export const SHOCK_DESCRIPTION: Record<ShockMode, string> = {
  amplify: "Scale every pathway magnitude on the selected event, then re-score the whole corpus.",
  suppress: "Scale pathway magnitude down, simulating de-escalation, then re-score.",
  remove_node: "Delete the selected node from the graph entirely and measure what stops propagating.",
  decay: "Lower pathway confidence to test how much of the estimate rests on soft evidence.",
};

export interface ScenarioParams {
  eventId: string;
  mode: ShockMode;
  /** 0..1 intensity of the perturbation. */
  magnitude: number;
  /** Required for remove_node. */
  nodeId?: string;
  /** Horizon the comparison is reported on. */
  horizonDays: number;
}

function cloneWithShock(params: ScenarioParams): Scenario[] {
  const intensity = Math.max(0, Math.min(1, params.magnitude));

  return SCENARIOS.map((scenario) => {
    if (scenario.id !== params.eventId) return scenario;

    const pathways = scenario.pathways
      .filter((pathway) =>
        params.mode === "remove_node"
          ? !pathway.exposures.some((e) => e.nodeId === params.nodeId)
          : true,
      )
      .map((pathway) => {
        const scaled =
          params.mode === "amplify"
            ? pathway.magnitude * (1 + intensity)
            : params.mode === "suppress"
              ? pathway.magnitude * (1 - intensity)
              : pathway.magnitude;
        const decayed =
          params.mode === "decay"
            ? pathway.confidence * (1 - intensity)
            : pathway.confidence;

        return {
          ...pathway,
          magnitude: Math.max(0, Math.min(1, scaled)),
          confidence: Math.max(0.05, Math.min(1, decayed)),
          exposures:
            params.mode === "remove_node"
              ? pathway.exposures.filter((e) => e.nodeId !== params.nodeId)
              : pathway.exposures,
        };
      });

    return { ...scenario, pathways };
  });
}

export interface EntityDelta {
  id: string;
  label: string;
  baseline: number;
  scenario: number;
  delta: number;
}

export interface ScenarioResult {
  ok: boolean;
  reason?: string;
  params: ScenarioParams;
  eventTitle: string;
  baselineEventScore: number;
  scenarioEventScore: number;
  horizonDays: number;
  baselineLow: number;
  baselineHigh: number;
  scenarioLow: number;
  scenarioHigh: number;
  countryDeltas: EntityDelta[];
  industryDeltas: EntityDelta[];
  affectedChannels: { channel: Channel; baseline: number; scenario: number }[];
  topDrivers: Driver[];
}

/** Re-scores the corpus under the perturbation and diffs the result. */
export function runScenario(params: ScenarioParams): ScenarioResult {
  const baseline = allAssessments(SCENARIOS);
  const shockedScenarios = cloneWithShock(params);
  const shocked = shockedScenarios.map(assess);

  const horizon = params.horizonDays;

  const baseEvent = baseline.find((a) => a.scenario.id === params.eventId);
  const shockedEvent = shocked.find((a) => a.scenario.id === params.eventId);
  if (!baseEvent || !shockedEvent) {
    return {
      ok: false,
      reason: "Event not found in the corpus.",
      params,
      eventTitle: params.eventId,
      baselineEventScore: 0,
      scenarioEventScore: 0,
      horizonDays: horizon,
      baselineLow: 0,
      baselineHigh: 0,
      scenarioLow: 0,
      scenarioHigh: 0,
      countryDeltas: [],
      industryDeltas: [],
      affectedChannels: [],
      topDrivers: shockedEvent?.risk[horizon].drivers ?? [],
    };
  }

  const countryDeltas: EntityDelta[] = countryIndex(baseline)
    .map((row) => {
      const after = nodeExposure(shocked, row.nodeId);
      return {
        id: row.nodeId,
        label: row.label,
        baseline: row.load,
        scenario: after.load,
        delta: after.load - row.load,
      };
    })
    .filter((d) => Math.abs(d.delta) > 0.0005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 12);

  const industryDeltas: EntityDelta[] = industryIndex(baseline)
    .map((row) => {
      const industry = getIndustry(row.id)!;
      const after = industryExposure(shocked, industry);
      return {
        id: row.id,
        label: row.label,
        baseline: row.load,
        scenario: after.load,
        delta: after.load - row.load,
      };
    })
    .filter((d) => Math.abs(d.delta) > 0.0005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 12);

  const affectedChannels = (
    ["trade", "energy", "finance", "diplomatic"] as Channel[]
  )
    .map((channel) => ({
      channel,
      baseline: baseEvent.channelPressure[channel],
      scenario: shockedEvent.channelPressure[channel],
    }))
    .filter((c) => Math.abs(c.scenario - c.baseline) > 0.001);

  return {
    ok: true,
    params,
    eventTitle: baseEvent.scenario.title,
    baselineEventScore: baseEvent.risk[horizon].score,
    scenarioEventScore: shockedEvent.risk[horizon].score,
    horizonDays: horizon,
    baselineLow: baseEvent.risk[horizon].low,
    baselineHigh: baseEvent.risk[horizon].high,
    scenarioLow: shockedEvent.risk[horizon].low,
    scenarioHigh: shockedEvent.risk[horizon].high,
    countryDeltas,
    industryDeltas,
    affectedChannels,
    topDrivers: shockedEvent.risk[horizon].drivers.slice(0, 5),
  };
}