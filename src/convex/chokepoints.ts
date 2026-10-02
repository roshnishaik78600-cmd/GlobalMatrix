import { allAssessments } from "../lib/intel/engine";
import {
  corridorIndex,
  countryIndex,
  industryExposure,
  nodeExposure,
} from "../lib/intel/exposure";
import { INDUSTRIES } from "../lib/intel/industries";
import { SCENARIOS } from "../lib/intel/scenarios";
import { CHANNEL_LABEL, type Channel, type EventAssessment } from "../lib/intel/types";
import { query } from "./_generated/server";

/** Fixed ceiling for shared-event coupling, so adding a pair cannot rescale. */
const COUPLING_CEILING = 1.8;

/**
 * Chokepoint board.
 *
 * The question a supply-chain page has to answer is not "which industries are
 * large" but "which single points of failure are load-bearing right now". This
 * answers it per infrastructure node: how hard the corpus is pressing on the
 * node, which sectors have declared a structural dependency on it, and which
 * economies carry the resulting exposure.
 *
 * Two distinct kinds of number, kept separate on purpose. The *dependency* edges
 * are declared reference structure and never change. The *load* on each side of
 * an edge is derived from the current corpus and does.
 */
export interface ChokepointRow {
  nodeId: string;
  label: string;
  short: string;
  region: string;
  kind: string;
  load: number;
  criticality: number;
  eventCount: number;
  byChannel: { channel: Channel; label: string; load: number }[];
  /** Sectors that declare a dependency on this node, strongest first. */
  industries: {
    id: string;
    label: string;
    share: number;
    note: string;
    role: "route" | "input";
    sectorLoad: number;
  }[];
  /** Top events reaching this node, with the term they contribute. */
  events: { eventId: string; title: string; weight: number; channel: Channel }[];
  /** Economies most exposed to the same events as this node. */
  exposed: { nodeId: string; label: string; load: number; coupling: number }[];
}

export const chokepointBoard = query({
  args: {},
  handler: async (): Promise<{ rows: ChokepointRow[] }> => {
    const all = allAssessments(SCENARIOS);
    const corridors = corridorIndex(all).filter(
      (c) => c.kind === "chokepoint" || c.kind === "corridor",
    );
    if (corridors.length === 0) return { rows: [] };

    // One exposure profile per infrastructure node, reused by the coupling step.
    const profiles = new Map<string, ReturnType<typeof nodeExposure>>();
    for (const c of corridors) {
      profiles.set(c.nodeId, nodeExposure(all, c.nodeId));
    }

    const rows = corridors
      .map((c) => {
        const profile = profiles.get(c.nodeId);

        // Declared structure: which sectors route through, or consume from, here.
        const industries = INDUSTRIES.flatMap((industry) => {
          const route = industry.routes.find((r) => r.nodeId === c.nodeId);
          const input = industry.inputs.find((i) => i.nodeId === c.nodeId);
          if (!route && !input) return [];
          const sectorExposure = industryExposure(all, industry).load;
          return [
            {
              id: industry.id,
              label: industry.label,
              share: input?.share ?? 0,
              note: (input?.note ?? route?.note ?? industry.note).slice(0, 140),
              role: (input ? "input" : "route") as "route" | "input",
              sectorLoad: sectorExposure,
            },
          ];
        }).sort((a, b) => b.share - a.share || b.sectorLoad - a.sectorLoad);

        // Events, ranked by the exact term this node contributes.
        const events = (profile?.contributions ?? [])
          .slice(0, 6)
          .map((e) => ({
            eventId: e.eventId,
            title: e.title,
            weight: e.contribution,
            channel: e.channel,
          }));

        // Economies sharing this node's exposure, i.e. what a shock here reaches.
        const exposed = profile ? exposedEconomies(all, profile) : [];

        return {
          nodeId: c.nodeId,
          label: c.label,
          short: c.short,
          region: c.region,
          kind: c.kind,
          load: c.load,
          criticality: c.criticality,
          eventCount: c.eventCount,
          byChannel: (c.byChannel ?? []).map((ch) => ({
            channel: ch.channel,
            label: CHANNEL_LABEL[ch.channel],
            load: ch.load,
          })),
          industries,
          events,
          exposed,
        };
      })
      .sort((a, b) => b.load - a.load);

    return { rows };
  },
});

/** Economies most exposed to the same events as this infrastructure node. */
function exposedEconomies(
  assessments: EventAssessment[],
  profile: NonNullable<ReturnType<typeof nodeExposure>>,
): { nodeId: string; label: string; load: number; coupling: number }[] {
  const byEvent = new Map<string, number>();
  for (const c of profile.contributions) {
    byEvent.set(c.eventId, (byEvent.get(c.eventId) ?? 0) + c.contribution);
  }
  return countryIndex(assessments)
    .map((country) => {
      const other = nodeExposure(assessments, country.nodeId);
      let shared = 0;
      for (const c of other.contributions) {
        shared += Math.min(c.contribution, byEvent.get(c.eventId) ?? 0);
      }
      return {
        nodeId: country.nodeId,
        label: country.label,
        load: country.load,
        coupling: Math.min(1, shared / COUPLING_CEILING),
      };
    })
    .filter((r) => r.coupling > 0.01)
    .sort((a, b) => b.coupling - a.coupling)
    .slice(0, 6);
}
