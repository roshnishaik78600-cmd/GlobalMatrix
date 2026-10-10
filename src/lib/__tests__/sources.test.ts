import { describe, expect, test } from "bun:test";
import {
  SOURCES,
  SOURCE_LIST,
  STATUS_HELP,
  STATUS_LABEL,
  formatAsOf,
  sourceById,
  type DataStatus,
} from "@/lib/sources";

/**
 * The provenance registry and its formatting rules.
 *
 * Two things are load-bearing here. Every source has to declare what it is and
 * is not evidence of, because that text is what stops a reader over-reading a
 * number. And `formatAsOf` is the only thing standing between a raw upstream
 * token and the screen: GDELT stamps readings as `20261002T080000Z`, and
 * printing that verbatim would put an API-shaped string in front of a reader.
 */

describe("source registry", () => {
  test("every source is fully described", () => {
    for (const source of SOURCE_LIST) {
      expect(source.id).toBeTruthy();
      expect(source.label).toBeTruthy();
      expect(source.publisher).toBeTruthy();
      expect(source.url.startsWith("https://")).toBe(true);
      expect(source.covers).toBeTruthy();
      expect(source.dataType).toBeTruthy();
    }
  });

  test("every source states what it is not evidence of", () => {
    // The `limits` field is the guard against over-reading. An empty one is how
    // a feed starts being cited for something it cannot support.
    for (const source of SOURCE_LIST) {
      expect(source.limits.trim().length).toBeGreaterThan(20);
    }
  });

  test("the registry is keyed by its own id", () => {
    for (const [key, source] of Object.entries(SOURCES)) {
      // An entry filed under an id it does not carry would make `sourceById`
      // miss it, and every provenance line for that source would go blank.
      const id: string = source.id;
      expect(id).toBe(key);
    }
  });

  test("lookup resolves a known id and refuses an unknown one", () => {
    expect(sourceById("ecb")?.publisher).toBe("European Central Bank");
    expect(sourceById("nope")).toBeUndefined();
  });

  test("the GDELT entry warns against reading volume as severity", () => {
    // This specific caveat is the difference between a coverage index and a
    // claim that an event happened. It is asserted so a future edit cannot
    // quietly soften it.
    expect(SOURCES.gdelt.limits).toContain("NOT evidence that an event occurred");
  });
});

describe("provenance states", () => {
  test("all four product states plus stale are labelled", () => {
    const states: DataStatus[] = [
      "observed",
      "model",
      "scenario",
      "stale",
      "unavailable",
    ];
    for (const state of states) {
      expect(STATUS_LABEL[state]).toBeTruthy();
      expect(STATUS_HELP[state]).toBeTruthy();
    }
  });

  test("observed, model and scenario are distinct words", () => {
    // The brief requires these three never be conflated in the UI.
    const labels = new Set([
      STATUS_LABEL.observed,
      STATUS_LABEL.model,
      STATUS_LABEL.scenario,
    ]);
    expect(labels.size).toBe(3);
    expect(STATUS_LABEL.unavailable).toBe("No verified data");
  });
});

describe("formatAsOf", () => {
  test("normalises the three shapes the connected sources publish", () => {
    // GDELT's compact stamp is the one that must never reach the screen raw.
    expect(formatAsOf("20261002T080000Z")).toBe("2026-10-02 08:00 UTC");
    // World Bank publishes an ISO date.
    expect(formatAsOf("2026-10-05")).toBe("2026-10-05");
    // Comtrade publishes a bare year.
    expect(formatAsOf("2024")).toBe("2024");
  });

  test("carries the time through when the source gives one", () => {
    expect(formatAsOf("2026-10-05T14:20:00Z")).toBe("2026-10-05 14:20 UTC");
    expect(formatAsOf("2026-10-05 14:20")).toBe("2026-10-05 14:20 UTC");
  });

  test("returns nothing rather than guessing at an unparseable value", () => {
    // A month without a day (`2024-06`) is a shape the Period field can hold,
    // and inventing a day for it would be fabricating a date.
    expect(formatAsOf("2024-06")).toBe("");
    expect(formatAsOf("")).toBe("");
    expect(formatAsOf("   ")).toBe("");
    expect(formatAsOf("last Tuesday")).toBe("");
    expect(formatAsOf("20261002")).toBe("");
  });

  test("never emits the raw upstream token", () => {
    expect(formatAsOf("20261002T080000Z")).not.toContain("T080000");
    expect(formatAsOf("20261002T080000Z")).not.toContain("Z");
  });
});
