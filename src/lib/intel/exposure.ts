import { COUNTRIES, getCountry, type CountryProfile } from "./countries";
import { INDUSTRIES, getIndustry, type Industry } from "./industries";
import { getNode } from "./nodes";
import {
  CHANNELS,
  type Channel,
  type EventAssessment,
} from "./types";

/**
 * Country and industry exposure.
 *
 * Nothing here is stored or hand-authored as a risk figure. Every load and
 * contribution is derived by walking the event corpus's propagation graph to
 * the nodes that make up a country or an industry, which is what makes the
 * profiles auditable: change the corpus and the profiles move with it.
 *
 *   load(node) = Σ over events × pathways × exposures
 *                impact × magnitude × confidence      (that touch the node)
 *
 * For an industry, each node is additionally weighted by the share it holds in
 * the industry's production, consumption, input or route structure, and
 * channels the industry is structurally sensitive to get a small boost.
 */

/** Channels an entity is structurally sensitive to get a small amplification. */
const AFFINITY_BOOST = 1.3;

/**
 * Normalisation ceilings are fixed constants rather than the corpus maximum,
 * so one severe event cannot silently rescale every other profile.
 */
const COUNTRY_CEILING = 3.9;
const INDUSTRY_CEILING = 3.15;

export interface ChannelLoad {
  channel: Channel;
  load: number;
}

export interface ExposureContribution {
  eventId: string;
  title: string;
  reference: string;
  stage: string;
  channel: Channel;
  viaNodeId: string;
  viaNodeLabel: string;
  /** Raw impact of the exposure as authored in the corpus. */
  impact: number;
  /** Share of the industry's structure this node accounts for. */
  share: number;
  /** impact × share, before channel affinity. */
  weight: number;
  /** Amplifier applied because the channel matches the entity's affinity. */
  affinity: number;
}

export interface ExposureProfile {
  load: number;
  byChannel: ChannelLoad[];
  contributions: ExposureContribution[];
  /** Distinct events touching this entity. */
  eventCount: number;
  /** Contributions arriving on a channel the entity is not exposed to. */
  offAffinityCount: number;
}

interface Match {
  share: number;
  affinity: boolean;
}

function normalise(raw: number, ceiling: number): number {
  if (raw <= 0) return 0;
  return Math.min(1, raw / ceiling);
}

function accumulate(
  assessments: EventAssessment[],
  matches: (
    exposure: { nodeId: string; impact: number },
    channel: Channel,
  ) => Match | null,
  ceiling: number,
): ExposureProfile {
  const byChannelRaw: Record<Channel, number> = {
    trade: 0,
    energy: 0,
    finance: 0,
    diplomatic: 0,
  };
  const contributions: ExposureContribution[] = [];

  for (const assessment of assessments) {
    for (const pathway of assessment.scenario.pathways) {
      for (const exposure of pathway.exposures) {
        const match = matches(exposure, pathway.channel);
        if (!match || match.share <= 0) continue;

        const weight = exposure.impact * match.share;
        const affinity = match.affinity ? AFFINITY_BOOST : 1;
        byChannelRaw[pathway.channel] +=
          weight * pathway.magnitude * pathway.confidence * affinity;

        contributions.push({
          eventId: assessment.scenario.id,
          title: assessment.scenario.title,
          reference: assessment.scenario.reference,
          stage: assessment.scenario.stage,
          channel: pathway.channel,
          viaNodeId: exposure.nodeId,
          viaNodeLabel: getNode(exposure.nodeId).label,
          impact: exposure.impact,
          share: match.share,
          weight,
          affinity,
        });
      }
    }
  }

  const total = CHANNELS.reduce((sum, c) => sum + byChannelRaw[c], 0);
  const eventIds = new Set(contributions.map((c) => c.eventId));
  const offAffinity = new Set(
    contributions
      .filter((c) => c.affinity === 1 && c.weight > 0.12)
      .map((c) => `${c.eventId}:${c.channel}`),
  );

  contributions.sort((a, b) => b.weight - a.weight);

  return {
    load: normalise(total, ceiling),
    byChannel: CHANNELS.map((channel) => ({
      channel,
      load: normalise(byChannelRaw[channel], ceiling),
    })),
    contributions,
    eventCount: eventIds.size,
    offAffinityCount: offAffinity.size,
  };
}

/** Exposure of a single country, bloc or corridor node. */
export function nodeExposure(
  assessments: EventAssessment[],
  nodeId: string,
): ExposureProfile {
  const country = getCountry(nodeId);
  const affinity = new Set<Channel>(country?.primaryChannels ?? []);

  return accumulate(
    assessments,
    (exposure, channel) =>
      exposure.nodeId === nodeId
        ? { share: 1, affinity: affinity.has(channel) }
        : null,
    COUNTRY_CEILING,
  );
}

/** Structural share a node holds within an industry. */
export function industryRole(
  industry: Industry,
  nodeId: string,
): { share: number; basis: string } {
  const producer = industry.producers.find((p) => p.nodeId === nodeId);
  if (producer) return { share: producer.share, basis: "Production share" };
  const consumer = industry.consumers.find((c) => c.nodeId === nodeId);
  if (consumer) return { share: consumer.share, basis: "Consumption share" };
  const input = industry.inputs.find((i) => i.nodeId === nodeId);
  if (input) return { share: input.share, basis: "Upstream input" };
  const route = industry.routes.find((r) => r.nodeId === nodeId);
  if (route) return { share: 0.35, basis: "Route dependency" };
  return { share: 0, basis: "" };
}

/** Exposure of an industry, weighted by each node's structural share. */
export function industryExposure(
  assessments: EventAssessment[],
  industry: Industry,
): ExposureProfile {
  const affinity = new Set<Channel>(industry.channelAffinity);

  return accumulate(
    assessments,
    (exposure, channel) => {
      const role = industryRole(industry, exposure.nodeId);
      if (role.share <= 0) return null;
      return { share: role.share, affinity: affinity.has(channel) };
    },
    INDUSTRY_CEILING,
  );
}

/* ------------------------------------------------------------------ *
 * Indexes
 * ------------------------------------------------------------------ */

export interface CountryRow {
  nodeId: string;
  label: string;
  short: string;
  region: string;
  load: number;
  byChannel: ChannelLoad[];
  eventCount: number;
  offAffinityCount: number;
  topChannel: Channel;
  fragility: number;
}

export function countryIndex(assessments: EventAssessment[]): CountryRow[] {
  return COUNTRIES.map((profile) => {
    const exposure = nodeExposure(assessments, profile.nodeId);
    const node = getNode(profile.nodeId);
    return {
      nodeId: profile.nodeId,
      label: node.label,
      short: node.short,
      region: node.region,
      load: exposure.load,
      byChannel: exposure.byChannel,
      eventCount: exposure.eventCount,
      offAffinityCount: exposure.offAffinityCount,
      topChannel: [...exposure.byChannel].sort((a, b) => b.load - a.load)[0].channel,
      fragility: profile.structuralFragility,
    };
  }).sort((a, b) => b.load - a.load);
}

export interface CorridorRow {
  nodeId: string;
  label: string;
  short: string;
  region: string;
  kind: string;
  load: number;
  byChannel: ChannelLoad[];
  eventCount: number;
  criticality: number;
}

/** Chokepoints, corridors and infrastructure rails, ranked by live exposure. */
export function corridorIndex(assessments: EventAssessment[]): CorridorRow[] {
  const ids = new Set(
    assessments.flatMap((a) =>
      a.scenario.pathways.flatMap((p) =>
        p.exposures
          .filter((e) => {
            const node = getNode(e.nodeId);
            // Countries appear in the country directory; this list is only the
            // infrastructure layer — chokepoints, corridors and rails.
            if (getCountry(e.nodeId)) return false;
            return (
              node.kind === "chokepoint" ||
              node.kind === "institution" ||
              node.kind === "corridor"
            );
          })
          .map((e) => e.nodeId),
      ),
    ),
  );

  return [...ids]
    .map((nodeId) => {
      const node = getNode(nodeId);
      const exposure = nodeExposure(assessments, nodeId);
      return {
        nodeId,
        label: node.label,
        short: node.short,
        region: node.region,
        kind: node.kind,
        load: exposure.load,
        byChannel: exposure.byChannel,
        eventCount: exposure.eventCount,
        criticality: node.criticality,
      };
    })
    .sort((a, b) => b.load - a.load);
}

/* ------------------------------------------------------------------ *
 * Profile payloads
 * ------------------------------------------------------------------ */

export function countryProfilePayload(
  assessments: EventAssessment[],
  nodeId: string,
) {
  const country = getCountry(nodeId);
  const node = getNode(nodeId);
  const exposure = nodeExposure(assessments, nodeId);

  const industries = INDUSTRIES.map((industry) => {
    const role = industryRole(industry, nodeId);
    const via = exposure.contributions.find((c) => c.viaNodeId === nodeId);
    return {
      id: industry.id,
      label: industry.label,
      code: industry.code,
      basis: role.basis,
      share: role.share,
      live: via ? via.weight : 0,
      fragility: industry.fragility,
    };
  })
    .filter((row) => row.share > 0 || row.live > 0)
    .sort((a, b) => b.share - a.share || b.live - a.live);

  const peers = country
    ? country.dependencies
        .map((dep) => {
          const depNode = getNode(dep.nodeId);
          return {
            nodeId: dep.nodeId,
            label: depNode.label,
            region: depNode.region,
            strength: dep.strength,
            basis: dep.basis,
            load: nodeExposure(assessments, dep.nodeId).load,
          };
        })
        .sort((a, b) => b.strength - a.strength)
    : [];

  // Countries that declare a strong structural dependency on this node.
  const dependents = country
    ? COUNTRIES.filter((c) =>
        c.dependencies.some((d) => d.nodeId === nodeId && d.strength >= 0.4),
      ).map((c) => {
        const dep = c.dependencies.find((d) => d.nodeId === nodeId)!;
        return {
          nodeId: c.nodeId,
          label: getNode(c.nodeId).label,
          strength: dep.strength,
          basis: dep.basis,
          load: nodeExposure(assessments, c.nodeId).load,
        };
      })
    : [];

  return {
    node: {
      id: node.id,
      label: node.label,
      short: node.short,
      kind: node.kind,
      region: node.region,
      criticality: node.criticality,
    },
    country,
    exposure,
    industries,
    peers,
    dependents,
  };
}

export interface IndustryRow {
  id: string;
  label: string;
  code: string;
  summary: string;
  load: number;
  byChannel: ChannelLoad[];
  eventCount: number;
  offAffinityCount: number;
  fragility: number;
  substitutionMonths: number;
  topChannel: Channel;
  concentration: number;
  topEvent: { eventId: string; title: string; weight: number } | null;
}

export function industryIndex(assessments: EventAssessment[]): IndustryRow[] {
  return INDUSTRIES.map((industry) => {
    const exposure = industryExposure(assessments, industry);
    const top = exposure.contributions[0];
    return {
      id: industry.id,
      label: industry.label,
      code: industry.code,
      summary: industry.summary,
      load: exposure.load,
      byChannel: exposure.byChannel,
      eventCount: exposure.eventCount,
      offAffinityCount: exposure.offAffinityCount,
      fragility: industry.fragility,
      substitutionMonths: industry.substitutionMonths,
      topChannel: [...exposure.byChannel].sort((a, b) => b.load - a.load)[0].channel,
      concentration: industry.producers.reduce((m, p) => Math.max(m, p.share), 0),
      topEvent: top
        ? { eventId: top.eventId, title: top.title, weight: top.weight }
        : null,
    };
  }).sort((a, b) => b.load - a.load);
}

export function industryProfilePayload(
  assessments: EventAssessment[],
  industryId: string,
) {
  const industry = getIndustry(industryId);
  if (!industry) return null;

  const exposure = industryExposure(assessments, industry);

  const roles = new Map<string, { share: number; role: string }>();
  const record = (nodeId: string, share: number, role: string) => {
    const existing = roles.get(nodeId);
    if (!existing || share > existing.share) roles.set(nodeId, { share, role });
  };
  for (const p of industry.producers) record(p.nodeId, p.share, "Producer");
  for (const c of industry.consumers) record(c.nodeId, c.share, "Consumer");
  for (const i of industry.inputs) record(i.nodeId, i.share, "Input");
  for (const r of industry.routes) record(r.nodeId, 0.35, "Route");

  const structure = [...roles.entries()]
    .map(([id, value]) => {
      const node = getNode(id);
      return {
        nodeId: id,
        label: node.label,
        region: node.region,
        kind: node.kind,
        criticality: node.criticality,
        ...value,
      };
    })
    .sort((a, b) => b.share - a.share);

  const liveMap = new Map<string, number>();
  for (const c of exposure.contributions) {
    liveMap.set(c.viaNodeId, (liveMap.get(c.viaNodeId) ?? 0) + c.weight);
  }
  const liveNodes = [...liveMap.entries()]
    .map(([id, weight]) => ({
      nodeId: id,
      label: getNode(id).label,
      region: getNode(id).region,
      weight,
    }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 10);

  return { industry, exposure, structure, liveNodes };
}