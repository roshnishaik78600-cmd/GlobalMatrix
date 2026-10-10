import { describe, expect, test } from "bun:test";
import { SCENARIOS } from "@/lib/intel/scenarios";
import { COUNTRIES } from "@/lib/intel/countries";
import { INDUSTRIES } from "@/lib/intel/industries";
import { getNode, isKnownNode } from "@/lib/intel/nodes";
import { allAssessments } from "@/lib/intel/engine";
import {
  MAX_DEPENDENCIES,
  MAX_DEPENDENCY_ID,
  earliestHorizon,
  matchDependencies,
  resolveDependency,
} from "@/lib/intel/profile";

/**
 * The declared-exposure layer.
 *
 * This is the one place a signed-in reader writes an entity id straight into the
 * product, so the properties that matter are the ones that keep it honest: an id
 * the model does not define is refused rather than rendered as a placeholder,
 * the label always comes from the model and never from the caller, and every
 * event reported for a declaration can be traced back to the real corpus.
 */

const assessments = allAssessments(SCENARIOS);
const scenarioIds = new Set(SCENARIOS.map((s) => s.id));

describe("resolveDependency", () => {
  test("resolves a known node to its model label", () => {
    for (const country of COUNTRIES) {
      const resolved = resolveDependency("node", country.nodeId);
      expect(resolved).not.toBeNull();
      expect(resolved?.label).toBe(getNode(country.nodeId).label);
      expect(isKnownNode(country.nodeId)).toBe(true);
    }
  });

  test("resolves a known industry to its model label", () => {
    for (const industry of INDUSTRIES) {
      expect(resolveDependency("industry", industry.id)?.label).toBe(
        industry.label,
      );
    }
  });

  test("refuses an id the model does not define", () => {
    // The whole point: a mistyped or hostile id must not resolve to
    // `getNode`'s placeholder and print a bare code as a place name.
    expect(resolveDependency("node", "NOT-A-NODE")).toBeNull();
    expect(resolveDependency("node", "ZZ")).toBeNull();
    expect(resolveDependency("industry", "not-an-industry")).toBeNull();
    // A node id is not an industry id and vice versa.
    expect(resolveDependency("industry", COUNTRIES[0].nodeId)).toBeNull();
  });
});

describe("matchDependencies", () => {
  test("reports a declared node with events traced to the real corpus", () => {
    const matches = matchDependencies([{ kind: "node", refId: "CN" }], assessments);
    expect(matches).toHaveLength(1);
    const match = matches[0];
    expect(match.label).toBe(getNode("CN").label);
    expect(match.eventCount).toBeGreaterThan(0);
    expect(match.load).toBeGreaterThan(0);
    expect(match.load).toBeLessThanOrEqual(1);

    for (const ev of match.topEvents) {
      expect(scenarioIds.has(ev.eventId)).toBe(true);
      expect(ev.contribution).toBeGreaterThan(0);
      expect(ev.lagDays[0]).toBeLessThanOrEqual(ev.lagDays[1]);
      expect(ev.viaNodeLabel.length).toBeGreaterThan(0);
    }
  });

  test("drops an unresolvable declaration rather than showing it at zero", () => {
    const matches = matchDependencies(
      [
        { kind: "node", refId: "CN" },
        { kind: "node", refId: "MADE-UP" },
      ],
      assessments,
    );
    expect(matches.map((m) => m.refId)).toEqual(["CN"]);
  });

  test("declaring the same entity twice is one match", () => {
    const matches = matchDependencies(
      [
        { kind: "node", refId: "DE" },
        { kind: "node", refId: "DE" },
      ],
      assessments,
    );
    expect(matches).toHaveLength(1);
  });

  test("keeps a node and an industry with the same id distinct", () => {
    // A declaration is identified by kind + id, never by id alone.
    const industry = INDUSTRIES[0];
    const matches = matchDependencies(
      [
        { kind: "industry", refId: industry.id },
        { kind: "node", refId: "CN" },
      ],
      assessments,
    );
    expect(matches).toHaveLength(2);
    expect(new Set(matches.map((m) => m.kind)).size).toBe(2);
  });

  test("orders by derived exposure, strongest first", () => {
    const matches = matchDependencies(
      COUNTRIES.slice(0, 6).map((c) => ({ kind: "node" as const, refId: c.nodeId })),
      assessments,
    );
    for (let i = 1; i < matches.length; i++) {
      expect(matches[i - 1].load).toBeGreaterThanOrEqual(matches[i].load);
    }
  });

  test("keeps at most the requested number of events per dependency", () => {
    const matches = matchDependencies([{ kind: "node", refId: "CN" }], assessments, 3);
    expect(matches[0].topEvents.length).toBeLessThanOrEqual(3);
  });

  test("an empty declaration set is an empty match set", () => {
    expect(matchDependencies([], assessments)).toEqual([]);
  });
});

describe("earliestHorizon", () => {
  test("is null with nothing declared and a number once something is", () => {
    expect(earliestHorizon([])).toBeNull();
    const matches = matchDependencies([{ kind: "node", refId: "CN" }], assessments);
    const horizon = earliestHorizon(matches);
    expect(horizon).not.toBeNull();
    expect(horizon as number).toBeGreaterThanOrEqual(0);
  });
});

describe("bounds", () => {
  test("the profile cap and id bound are sane and cover real ids", () => {
    expect(Number.isInteger(MAX_DEPENDENCIES)).toBe(true);
    expect(MAX_DEPENDENCIES).toBeGreaterThan(0);
    for (const country of COUNTRIES) {
      expect(country.nodeId.length).toBeLessThanOrEqual(MAX_DEPENDENCY_ID);
    }
    for (const industry of INDUSTRIES) {
      expect(industry.id.length).toBeLessThanOrEqual(MAX_DEPENDENCY_ID);
    }
  });
});
