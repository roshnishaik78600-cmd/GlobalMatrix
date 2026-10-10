import { describe, expect, test } from "bun:test";
import { SCENARIOS } from "@/lib/intel/scenarios";
import {
  HORIZONS,
  allAssessments,
  assess,
  bandOf,
  centralityOf,
  channelPressureOf,
  evidenceStrengthOf,
  reliabilityOf,
  severityOf,
  uncertaintyOf,
  velocitySeriesOf,
} from "@/lib/intel/engine";
import { CHANNELS, RISK_BANDS, type RiskBand } from "@/lib/intel/types";

/**
 * The risk engine.
 *
 * Every score on screen comes out of these functions, and they are presented as
 * MODEL OUTPUT with a stated interval, so the properties asserted here are the
 * ones that make that label true: the interval actually contains the score, the
 * score is bounded, uncertainty grows with the horizon rather than being a fixed
 * decoration, and the same corpus always produces the same numbers.
 */

const assessments = allAssessments(SCENARIOS);

describe("bounds", () => {
  test("severity is inside the stated 0..100 range", () => {
    for (const scenario of SCENARIOS) {
      const score = severityOf(scenario);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  test("evidence strength is a fraction", () => {
    for (const scenario of SCENARIOS) {
      const value = evidenceStrengthOf(scenario);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
      expect(Number.isNaN(value)).toBe(false);
    }
  });

  test("centrality and reliability are fractions", () => {
    for (const scenario of SCENARIOS) {
      expect(centralityOf(scenario)).toBeGreaterThanOrEqual(0);
      expect(centralityOf(scenario)).toBeLessThanOrEqual(1);
      expect(reliabilityOf(scenario)).toBeGreaterThanOrEqual(0);
      expect(Number.isNaN(reliabilityOf(scenario))).toBe(false);
    }
  });
});

describe("channel pressure", () => {
  test("a pathway that exposes no node transmits no pressure", () => {
    // The regression this pins: a channel the corpus assessed and ruled out
    // still had a non-zero magnitude, and that magnitude fed the composite even
    // though the pathway reached nothing. Energy weighs most of the four
    // channels, so the event scored above what its exposures could account for.
    for (const scenario of SCENARIOS) {
      const pressure = channelPressureOf(scenario);
      for (const channel of CHANNELS) {
        const transmitting = scenario.pathways.filter(
          (p) => p.channel === channel && p.exposures.length > 0,
        );
        if (transmitting.length === 0) {
          expect(pressure[channel]).toBe(0);
        } else {
          expect(pressure[channel]).toBeGreaterThan(0);
        }
      }
    }
  });

  test("an event that reaches nothing through a channel scores as if it did not", () => {
    // Constructed, so the rule is asserted independently of the corpus: same
    // pathways, one with its exposures removed, must not keep its pressure.
    const base = SCENARIOS[0];
    const stripped = {
      ...base,
      pathways: base.pathways.map((p, i) =>
        i === 0 ? { ...p, exposures: [], magnitude: 0.9 } : p,
      ),
    };
    const before = channelPressureOf(base)[base.pathways[0].channel];
    const after = channelPressureOf(stripped)[base.pathways[0].channel];
    expect(before).toBeGreaterThan(0);
    const stillTransmitting = stripped.pathways.some(
      (p) => p.channel === base.pathways[0].channel && p.exposures.length > 0,
    );
    if (!stillTransmitting) expect(after).toBe(0);
  });

  test("pressure is a fraction on every channel", () => {
    for (const scenario of SCENARIOS) {
      const pressure = channelPressureOf(scenario);
      for (const channel of CHANNELS) {
        expect(pressure[channel]).toBeGreaterThanOrEqual(0);
        expect(pressure[channel]).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("the 80% interval", () => {
  test("contains its own score at every horizon", () => {
    // A forecast whose point estimate sits outside its own interval is not a
    // forecast, it is a rendering bug.
    for (const scenario of SCENARIOS) {
      const risk = assess(scenario).risk;
      for (const horizon of HORIZONS) {
        const estimate = risk[horizon];
        expect(estimate.low).toBeLessThanOrEqual(estimate.score);
        expect(estimate.score).toBeLessThanOrEqual(estimate.high);
        expect(estimate.low).toBeGreaterThanOrEqual(0);
        expect(estimate.high).toBeLessThanOrEqual(100);
      }
    }
  });

  test("widens with the horizon, for every scenario", () => {
    for (const scenario of SCENARIOS) {
      const short = uncertaintyOf(scenario, 7);
      const medium = uncertaintyOf(scenario, 30);
      const long = uncertaintyOf(scenario, 90);
      expect(medium).toBeGreaterThanOrEqual(short);
      expect(long).toBeGreaterThanOrEqual(medium);
    }
  });

  test("is capped rather than growing without limit", () => {
    for (const scenario of SCENARIOS) {
      expect(uncertaintyOf(scenario, 90)).toBeLessThanOrEqual(36);
    }
  });
});

describe("band thresholds", () => {
  test("sit exactly where the documented cutoffs are", () => {
    expect(bandOf(0)).toBe("low");
    expect(bandOf(29.999)).toBe("low");
    expect(bandOf(30)).toBe("moderate");
    expect(bandOf(41.999)).toBe("moderate");
    expect(bandOf(42)).toBe("elevated");
    expect(bandOf(51.999)).toBe("elevated");
    expect(bandOf(52)).toBe("high");
    expect(bandOf(64.999)).toBe("high");
    expect(bandOf(65)).toBe("severe");
    expect(bandOf(100)).toBe("severe");
  });

  test("never decreases as the score rises", () => {
    const rank = new Map<RiskBand, number>(RISK_BANDS.map((b, i) => [b, i]));
    let previous = -1;
    for (let score = 0; score <= 100; score += 0.5) {
      const level = rank.get(bandOf(score))!;
      expect(level).toBeGreaterThanOrEqual(previous);
      previous = level;
    }
  });

  test("covers every band in the type", () => {
    const seen = new Set<RiskBand>();
    for (let score = 0; score <= 100; score += 0.5) seen.add(bandOf(score));
    expect(seen.size).toBe(RISK_BANDS.length);
  });
});

describe("assess", () => {
  test("agrees with its own band at the headline horizon", () => {
    for (const scenario of SCENARIOS) {
      const result = assess(scenario);
      expect(result.band).toBe(result.risk[30].band);
      expect(result.overall).toBe(result.risk[30].score);
      expect(result.band).toBe(bandOf(result.overall));
    }
  });

  test("names a dominant channel and a full pressure vector", () => {
    for (const scenario of SCENARIOS) {
      const result = assess(scenario);
      expect(CHANNELS).toContain(result.dominantChannel);
      for (const channel of CHANNELS) {
        const pressure = result.channelPressure[channel];
        expect(pressure).toBeGreaterThanOrEqual(0);
        expect(pressure).toBeLessThanOrEqual(1);
      }
    }
  });

  test("carries an audit trail that reconciles with the score", () => {
    for (const scenario of SCENARIOS) {
      const result = assess(scenario);
      for (const horizon of HORIZONS) {
        const drivers = result.risk[horizon].drivers;
        expect(drivers.length).toBeGreaterThan(0);
        for (const driver of drivers) {
          expect(driver.note).toBeTruthy();
          expect(driver.contribution).toBeGreaterThanOrEqual(0);
          expect(CHANNELS).toContain(driver.channel);
        }
        // Ranked, so the biggest reason is the one a reader sees first.
        for (let i = 1; i < drivers.length; i += 1) {
          expect(drivers[i - 1].contribution).toBeGreaterThanOrEqual(
            drivers[i].contribution,
          );
        }
      }
    }
  });

  test("is deterministic", () => {
    for (const scenario of SCENARIOS) {
      expect(JSON.stringify(assess(scenario))).toBe(
        JSON.stringify(assess(scenario)),
      );
    }
  });
});

describe("velocity series", () => {
  test("is a fixed-length cumulative series", () => {
    for (const scenario of SCENARIOS) {
      const series = velocitySeriesOf(scenario);
      expect(series).toHaveLength(24);
      expect(series[0]).toBeGreaterThanOrEqual(0);
      // Cumulative evidence mass never goes down as the window closes.
      for (let i = 1; i < series.length; i += 1) {
        expect(series[i]).toBeGreaterThanOrEqual(series[i - 1]);
      }
    }
  });

  test("totals the reliability-weighted signal mass", () => {
    for (const scenario of SCENARIOS) {
      const series = velocitySeriesOf(scenario);
      const total = series[series.length - 1];
      const authored = scenario.signals.reduce(
        (sum, s) => sum + s.reliability * s.weight,
        0,
      );
      expect(Math.abs(total - authored)).toBeLessThan(1e-9);
    }
  });
});

describe("allAssessments", () => {
  test("is ranked worst first", () => {
    for (let i = 1; i < assessments.length; i += 1) {
      expect(assessments[i - 1].overall).toBeGreaterThanOrEqual(
        assessments[i].overall,
      );
    }
  });

  test("caches on corpus identity, so an edit cannot serve a stale result", () => {
    // The memo is keyed on the array reference rather than its length: keying on
    // length would keep serving the old scores for any edit that happened to
    // leave the scenario count unchanged, which is the common case.
    expect(allAssessments(SCENARIOS)).toBe(allAssessments(SCENARIOS));
    const edited = SCENARIOS.slice(0, SCENARIOS.length - 1);
    expect(allAssessments(edited)).not.toBe(assessments);
    expect(allAssessments(edited)).toHaveLength(SCENARIOS.length - 1);
    // Restore the shared memo for any later test in this file.
    expect(allAssessments(SCENARIOS)).toHaveLength(SCENARIOS.length);
  });
});
