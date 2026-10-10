import { describe, expect, test } from "bun:test";
import { SCENARIOS } from "@/lib/intel/scenarios";
import { COUNTRIES } from "@/lib/intel/countries";
import { INDUSTRIES } from "@/lib/intel/industries";
import { isKnownNode } from "@/lib/intel/nodes";
import { allAssessments } from "@/lib/intel/engine";
import {
  countryIndex,
  corridorIndex,
  industryExposure,
  nodeExposure,
} from "@/lib/intel/exposure";
import { CHANNELS, type Channel } from "@/lib/intel/types";

/**
 * The exposure model.
 *
 * Exposure is the number the whole product is built on — it is what a country
 * page, an industry page and the map all read — so the properties that make it
 * defensible are pinned here: it is a pure function of the corpus, it is
 * bounded, its parts reconcile with its total, and every contribution it
 * reports can be traced back to a real event.
 */

const assessments = allAssessments(SCENARIOS);
const channelSet = new Set<Channel>(CHANNELS);

describe("node exposure", () => {
  test("contributions reconcile with the headline load", () => {
    for (const country of COUNTRIES) {
      const profile = nodeExposure(assessments, country.nodeId);
      const byChannel = profile.byChannel.reduce((sum, c) => sum + c.load, 0);
      // The channel breakdown is the same mass as the total, so a reader can
      // always add the parts up.
      expect(Math.abs(byChannel - profile.load)).toBeLessThan(1e-9);
    }
  });

  test("is bounded and never negative", () => {
    for (const country of COUNTRIES) {
      const profile = nodeExposure(assessments, country.nodeId);
      expect(profile.load).toBeGreaterThanOrEqual(0);
      expect(profile.load).toBeLessThanOrEqual(1);
    }
  });

  test("always reports all four channels, including the quiet ones", () => {
    // A channel at zero is a reading. Omitting it would make "no transmission
    // on finance" indistinguishable from "we do not look at finance".
    for (const country of COUNTRIES) {
      const profile = nodeExposure(assessments, country.nodeId);
      expect(profile.byChannel).toHaveLength(CHANNELS.length);
      for (const entry of profile.byChannel) {
        expect(channelSet.has(entry.channel)).toBe(true);
      }
    }
  });

  test("every contribution names a pathway that exists in the corpus", () => {
    const corpusEvents = new Map(SCENARIOS.map((s) => [s.id, s]));
    for (const country of COUNTRIES) {
      for (const c of nodeExposure(assessments, country.nodeId).contributions) {
        const event = corpusEvents.get(c.eventId);
        expect(event).toBeDefined();
        expect(c.title).toBe(event!.title);
        expect(channelSet.has(c.channel)).toBe(true);
        expect(c.viaNodeId).toBe(country.nodeId);
        // Authored magnitudes stay in range.
        expect(c.magnitude).toBeGreaterThanOrEqual(0);
        expect(c.magnitude).toBeLessThanOrEqual(1);
        expect(c.confidence).toBeGreaterThanOrEqual(0);
        expect(c.confidence).toBeLessThanOrEqual(1);
        // A labelled multiplier, never a discount.
        expect(c.affinity).toBeGreaterThanOrEqual(1);
        expect(c.lagDays[0]).toBeLessThanOrEqual(c.lagDays[1]);
      }
    }
  });

  test("eventCount counts distinct events, not exposures", () => {
    for (const country of COUNTRIES) {
      const profile = nodeExposure(assessments, country.nodeId);
      const distinct = new Set(profile.contributions.map((c) => c.eventId));
      expect(profile.eventCount).toBe(distinct.size);
    }
  });

  test("offAffinityCount agrees with the contributions it describes", () => {
    for (const country of COUNTRIES) {
      const profile = nodeExposure(assessments, country.nodeId);
      const off = profile.contributions.filter((c) => c.affinity === 1).length;
      expect(profile.offAffinityCount).toBe(off);
    }
  });

  test("a node the corpus never reaches is zero, not missing", () => {
    const profile = nodeExposure([], "TW");
    expect(profile.load).toBe(0);
    expect(profile.contributions).toEqual([]);
    expect(profile.eventCount).toBe(0);
    expect(Number.isNaN(profile.load)).toBe(false);
  });

  test("is deterministic", () => {
    const once = nodeExposure(assessments, "TW");
    const twice = nodeExposure(assessments, "TW");
    expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
  });
});

describe("industry exposure", () => {
  test("only counts nodes with a declared structural role", () => {
    for (const industry of INDUSTRIES) {
      const profile = industryExposure(assessments, industry);
      for (const c of profile.contributions) {
        // A node with no production, consumption, input or route role is not
        // part of this industry, however exposed it is elsewhere.
        const declared =
          industry.producers.some((p) => p.nodeId === c.viaNodeId) ||
          industry.consumers.some((p) => p.nodeId === c.viaNodeId) ||
          industry.inputs.some((p) => p.nodeId === c.viaNodeId) ||
          industry.routes.some((p) => p.nodeId === c.viaNodeId);
        expect(declared).toBe(true);
        expect(c.share).toBeGreaterThan(0);
      }
    }
  });

  test("is bounded and reconciles", () => {
    for (const industry of INDUSTRIES) {
      const profile = industryExposure(assessments, industry);
      expect(profile.load).toBeGreaterThanOrEqual(0);
      expect(profile.load).toBeLessThanOrEqual(1);
      const byChannel = profile.byChannel.reduce((sum, c) => sum + c.load, 0);
      expect(Math.abs(byChannel - profile.load)).toBeLessThan(1e-9);
    }
  });
});

describe("country index", () => {
  const rows = countryIndex(assessments);

  test("has exactly one row per tracked country", () => {
    expect(rows).toHaveLength(COUNTRIES.length);
    expect(new Set(rows.map((r) => r.nodeId)).size).toBe(COUNTRIES.length);
  });

  test("every row is a node the model actually defines", () => {
    for (const row of rows) {
      expect(isKnownNode(row.nodeId)).toBe(true);
      expect(row.label).toBeTruthy();
      // No row may fall back to the placeholder's region.
      expect(row.region).not.toBe("Unclassified");
    }
  });

  test("is ranked by load, worst first", () => {
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].load).toBeGreaterThanOrEqual(rows[i].load);
    }
  });

  test("topChannel is the channel carrying the most load", () => {
    for (const row of rows) {
      const heaviest = [...row.byChannel].sort((a, b) => b.load - a.load)[0];
      expect(row.topChannel).toBe(heaviest.channel);
    }
  });
});

describe("corridor index", () => {
  const rows = corridorIndex(assessments);

  test("carries infrastructure only — no economies", () => {
    // This list is the infrastructure layer. A country leaking into it would
    // duplicate the country directory under a different heading.
    const countryIds = new Set(COUNTRIES.map((c) => c.nodeId));
    for (const row of rows) {
      expect(row.kind).not.toBe("economy");
      expect(row.kind).not.toBe("bloc");
      expect(countryIds.has(row.nodeId)).toBe(false);
    }
  });

  test("is ranked by load and drawn from defined nodes", () => {
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i - 1].load).toBeGreaterThanOrEqual(rows[i].load);
    }
    for (const row of rows) {
      expect(isKnownNode(row.nodeId)).toBe(true);
      expect(row.criticality).toBeGreaterThan(0);
    }
  });
});
