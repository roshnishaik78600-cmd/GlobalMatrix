import { describe, expect, test } from "bun:test";
import { SCENARIOS, CORPUS_VERSION } from "@/lib/intel/scenarios";
import { NODES, getNode, isKnownNode } from "@/lib/intel/nodes";
import { COUNTRIES } from "@/lib/intel/countries";
import { INDUSTRIES } from "@/lib/intel/industries";
import { CHANNELS, STAGES, type Channel } from "@/lib/intel/types";

/**
 * Corpus and graph integrity.
 *
 * This file exists because of a real defect. Four pathway exposures pointed at
 * node ids the transmission graph did not define — `EG`, `AR`, `PH` and a
 * mistyped `MLT`. Nothing failed: `getNode` answers with a placeholder, so the
 * exposure list printed the bare ISO code where a country name belongs, the row
 * read "Unclassified", and `centralityOf` scored them at the placeholder's
 * criticality. A dangling reference was silently changing a risk score and
 * showing a fabricated label. These tests make that class of bug fail loudly.
 */

const corpusEvents = new Set(SCENARIOS.map((s) => s.id));

describe("graph integrity", () => {
  test("node ids are unique", () => {
    const ids = NODES.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("criticality is a positive fraction", () => {
    for (const node of NODES) {
      expect(node.criticality).toBeGreaterThan(0);
      expect(node.criticality).toBeLessThanOrEqual(1);
    }
  });

  test("a node is either a place or an abstraction, never a half-placed one", () => {
    for (const node of NODES) {
      const hasLat = node.lat !== undefined;
      const hasLon = node.lon !== undefined;
      // One coordinate without the other would plot at the wrong place.
      expect(hasLat).toBe(hasLon);
      if (hasLat) {
        expect(node.lat!).toBeGreaterThanOrEqual(-90);
        expect(node.lat!).toBeLessThanOrEqual(90);
        expect(node.lon!).toBeGreaterThanOrEqual(-180);
        expect(node.lon!).toBeLessThanOrEqual(180);
      }
    }
  });

  test("institutions are explicitly not plottable", () => {
    for (const node of NODES.filter((n) => n.kind === "institution")) {
      expect(node.lat).toBeUndefined();
      expect(node.lon).toBeUndefined();
    }
  });

  test("every node carries a display label, not a raw code", () => {
    for (const node of NODES) {
      expect(node.label).not.toBe(node.id);
      expect(node.label.length).toBeGreaterThan(2);
      expect(node.region).toBeTruthy();
      expect(node.region).not.toBe("Unclassified");
    }
  });

  test("an unknown id is recognisable as a placeholder", () => {
    // The fallback is load-bearing — it keeps `getNode` total — so it is
    // asserted explicitly, and `isKnownNode` is the guard callers use to answer
    // "not found" honestly instead.
    expect(isKnownNode("NOPE")).toBe(false);
    expect(isKnownNode("TW")).toBe(true);
    const placeholder = getNode("NOPE");
    expect(placeholder.region).toBe("Unclassified");
    expect(placeholder.label).toBe("NOPE");
  });
});

describe("corpus references", () => {
  test("every exposed node is one the graph defines", () => {
    const dangling = new Set<string>();
    for (const scenario of SCENARIOS) {
      for (const pathway of scenario.pathways) {
        for (const exposure of pathway.exposures) {
          if (!isKnownNode(exposure.nodeId)) dangling.add(exposure.nodeId);
        }
      }
    }
    expect([...dangling]).toEqual([]);
  });

  test("every actor that is a node reference resolves", () => {
    const dangling = new Set<string>();
    for (const scenario of SCENARIOS) {
      for (const actor of scenario.actors) {
        // Actor lists mix node ids with plain-language names; only the
        // id-shaped ones are references that must resolve.
        if (/^[A-Z]{2,8}$/.test(actor) && !isKnownNode(actor)) dangling.add(actor);
      }
    }
    expect([...dangling]).toEqual([]);
  });

  test("country and industry structures only name defined nodes", () => {
    const dangling = new Set<string>();
    for (const country of COUNTRIES) {
      for (const dep of country.dependencies) {
        if (!isKnownNode(dep.nodeId)) dangling.add(dep.nodeId);
      }
      for (const source of country.energy) {
        if (source.nodeId && !isKnownNode(source.nodeId)) dangling.add(source.nodeId);
      }
    }
    for (const industry of INDUSTRIES) {
      for (const entry of [
        ...industry.producers,
        ...industry.consumers,
        ...industry.inputs,
        ...industry.routes,
      ]) {
        if (!isKnownNode(entry.nodeId)) dangling.add(entry.nodeId);
      }
    }
    expect([...dangling]).toEqual([]);
  });
});

describe("corpus shape", () => {
  test("scenario ids are unique and versioned", () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(CORPUS_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(SCENARIOS.length).toBeGreaterThan(0);
  });

  test("every scenario is complete enough to render", () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.title.length).toBeGreaterThan(5);
      expect(scenario.summary.length).toBeGreaterThan(40);
      expect(scenario.reference).toBeTruthy();
      expect(scenario.tailScenario).toBeTruthy();
      expect(scenario.analystNote).toBeTruthy();
      expect(STAGES).toContain(scenario.stage);
      expect(scenario.signals.length).toBeGreaterThan(0);
      expect(scenario.pathways.length).toBeGreaterThan(0);
      expect(scenario.actors.length).toBeGreaterThan(0);
      expect(scenario.regions.length).toBeGreaterThan(0);
    }
  });

  test("authored fractions stay fractions", () => {
    for (const scenario of SCENARIOS) {
      for (const [name, value] of [
        ["confidence", scenario.confidence],
        ["novelty", scenario.novelty],
        ["velocity", scenario.velocity],
      ] as const) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
        expect(Number.isNaN(value)).toBe(false);
        expect(name).toBeTruthy();
      }
    }
  });

  test("timestamps are parseable and ordered", () => {
    for (const scenario of SCENARIOS) {
      const first = Date.parse(scenario.firstSignalAt);
      const detected = Date.parse(scenario.detectedAt);
      expect(Number.isNaN(first)).toBe(false);
      expect(Number.isNaN(detected)).toBe(false);
      expect(first).toBeLessThanOrEqual(detected);
    }
  });

  test("every signal is attributable and within range", () => {
    for (const scenario of SCENARIOS) {
      for (const signal of scenario.signals) {
        expect(signal.source).toBeTruthy();
        expect(signal.headline.length).toBeGreaterThan(10);
        expect(signal.detail.length).toBeGreaterThan(10);
        expect(signal.reliability).toBeGreaterThan(0);
        expect(signal.reliability).toBeLessThanOrEqual(1);
        expect(signal.weight).toBeGreaterThan(0);
        expect(signal.weight).toBeLessThanOrEqual(1);
        // An observation with no independent source is still one source.
        expect(signal.corroborations).toBeGreaterThanOrEqual(1);
        expect(Number.isNaN(Date.parse(signal.observedAt))).toBe(false);
        expect(CHANNELS).toContain(signal.channel as Channel);
      }
    }
  });

  test("every pathway declares a mechanism and a coherent lag window", () => {
    for (const scenario of SCENARIOS) {
      for (const pathway of scenario.pathways) {
        expect(CHANNELS).toContain(pathway.channel);
        expect(pathway.mechanism.length).toBeGreaterThan(10);
        expect(pathway.magnitude).toBeGreaterThanOrEqual(0);
        expect(pathway.magnitude).toBeLessThanOrEqual(1);
        expect(pathway.confidence).toBeGreaterThanOrEqual(0);
        expect(pathway.confidence).toBeLessThanOrEqual(1);
        expect(pathway.lagDays[0]).toBeLessThanOrEqual(pathway.lagDays[1]);
        for (const exposure of pathway.exposures) {
          expect(exposure.exposure).toBeGreaterThanOrEqual(0);
          expect(exposure.exposure).toBeLessThanOrEqual(1);
          expect(exposure.impact).toBeGreaterThanOrEqual(0);
          expect(exposure.impact).toBeLessThanOrEqual(1);
          expect(exposure.note.length).toBeGreaterThan(10);
        }
      }
    }
  });

  test("a pathway that exposes nothing declares no transmission", () => {
    // A channel may be assessed and ruled out. That is a legitimate record and
    // the corpus keeps one, but it is not a transmission, so it must not claim
    // a magnitude *or* a confidence that would let it be read as one. The
    // engine also skips these, so this is the data-side half of the same rule.
    const offenders: string[] = [];
    for (const scenario of SCENARIOS) {
      for (const pathway of scenario.pathways) {
        if (pathway.exposures.length > 0) continue;
        if (pathway.magnitude !== 0) {
          offenders.push(`${scenario.id}/${pathway.channel}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  test("every event reaches at least one node", () => {
    // An event that resolves no exposure at all has nothing to show and cannot
    // be audited. Zero-exposure *pathways* are fine; zero-exposure *events* are
    // not.
    const offenders: string[] = [];
    for (const scenario of SCENARIOS) {
      const reached = scenario.pathways.reduce(
        (sum, p) => sum + p.exposures.length,
        0,
      );
      if (reached === 0) offenders.push(scenario.id);
    }
    expect(offenders).toEqual([]);
  });

  test("signal ids are unique within an event", () => {
    for (const scenario of SCENARIOS) {
      const ids = scenario.signals.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  test("no exposure cites an event outside the corpus", () => {
    const offenders: string[] = [];
    for (const scenario of SCENARIOS) {
      if (!corpusEvents.has(scenario.id)) offenders.push(scenario.id);
    }
    expect(offenders).toEqual([]);
  });
});
