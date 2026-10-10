import { industryExposure, nodeExposure, type ChannelLoad, type ExposureProfile } from "./exposure";
import { getIndustry } from "./industries";
import { getNode, isKnownNode } from "./nodes";
import type { Channel, EventAssessment } from "./types";

/**
 * User-declared exposure.
 *
 * The brief's whole point is "how could this affect *my* business", and the one
 * thing the product cannot measure is which countries, chokepoints and sectors a
 * particular reader actually depends on. No company feed is connected, and this
 * module does not pretend otherwise: a reader states their own dependencies and
 * the model reports which events in the corpus reach them.
 *
 * Two rules make that honest rather than decorative:
 *
 * 1. A declaration is only a *pointer* to an entity the model already tracks.
 *    The label, the exposure and the events all come from the existing corpus
 *    walk — the reader chooses *what* to point at, never what the numbers say.
 * 2. Nothing is inferred about the reader's supply chain. An undeclared
 *    relationship is simply not shown, rather than guessed at from adjacency.
 */

export type DependencyKind = "node" | "industry";

/** Ceiling on a single reader's declarations, so the table stays bounded. */
export const MAX_DEPENDENCIES = 60;

/** Longest identifier accepted, matching the watchlist key bound. */
export const MAX_DEPENDENCY_ID = 120;

/** One thing a reader has said they depend on. */
export interface DeclaredDependency {
  kind: DependencyKind;
  refId: string;
}

export interface DependencyEvent {
  eventId: string;
  title: string;
  reference: string;
  channel: Channel;
  /** Weighted term the corpus contributes to this dependency, 0..1. */
  contribution: number;
  /** Authored impact of the exposure, 0..1. */
  impact: number;
  lagDays: [number, number];
  /** The node the shock travels through to reach the dependency. */
  viaNodeLabel: string;
}

export interface DependencyMatch {
  kind: DependencyKind;
  refId: string;
  label: string;
  /** Derived exposure of the dependency, 0..1 — the same scale as a profile. */
  load: number;
  eventCount: number;
  byChannel: ChannelLoad[];
  /** Events reaching this dependency, strongest first. */
  topEvents: DependencyEvent[];
}

/**
 * Resolve a declaration to the model entity it names, or `null`.
 *
 * This is the validation boundary: an id the graph does not define is refused
 * here rather than resolved to `getNode`'s placeholder, so a reader can never
 * store a dependency that renders as a bare code with every metric at zero.
 */
export function resolveDependency(
  kind: DependencyKind,
  refId: string,
): { label: string } | null {
  if (kind === "node") {
    return isKnownNode(refId) ? { label: getNode(refId).label } : null;
  }
  const industry = getIndustry(refId);
  return industry ? { label: industry.label } : null;
}

/** The model's exposure profile for a declaration, or `null` if unresolvable. */
function profileFor(
  dep: DeclaredDependency,
  assessments: EventAssessment[],
): ExposureProfile | null {
  if (dep.kind === "node") {
    return isKnownNode(dep.refId) ? nodeExposure(assessments, dep.refId) : null;
  }
  const industry = getIndustry(dep.refId);
  return industry ? industryExposure(assessments, industry) : null;
}

/**
 * Match declarations against the corpus.
 *
 * Deterministic and bounded: one corpus walk per declaration, the six strongest
 * events kept, results ordered by derived exposure. An unresolvable or
 * exposure-free declaration is dropped rather than shown at zero, because "you
 * depend on this but nothing in the corpus reaches it" is already a finding the
 * caller can state — it does not need a fake row.
 */
export function matchDependencies(
  deps: DeclaredDependency[],
  assessments: EventAssessment[],
  topEvents = 6,
): DependencyMatch[] {
  const seen = new Set<string>();
  const matches: DependencyMatch[] = [];

  for (const dep of deps) {
    const identity = `${dep.kind}:${dep.refId}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    const resolved = resolveDependency(dep.kind, dep.refId);
    const profile = profileFor(dep, assessments);
    if (!resolved || !profile) continue;

    matches.push({
      kind: dep.kind,
      refId: dep.refId,
      label: resolved.label,
      load: profile.load,
      eventCount: profile.eventCount,
      byChannel: profile.byChannel,
      topEvents: profile.contributions.slice(0, topEvents).map((c) => ({
        eventId: c.eventId,
        title: c.title,
        reference: c.reference,
        channel: c.channel,
        contribution: c.contribution,
        impact: c.impact,
        lagDays: c.lagDays,
        viaNodeLabel: c.viaNodeLabel,
      })),
    });
  }

  return matches.sort((a, b) => b.load - a.load);
}

/** The highest-lag event across a set of matches, for a "when" statement. */
export function earliestHorizon(matches: DependencyMatch[]): number | null {
  let lag: number | null = null;
  for (const match of matches) {
    for (const event of match.topEvents) {
      const days = event.lagDays[0];
      if (lag === null || days < lag) lag = days;
    }
  }
  return lag;
}
