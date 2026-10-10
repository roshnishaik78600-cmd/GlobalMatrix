import { describe, expect, test } from "bun:test";
import {
  FRESHNESS_HELP,
  FRESHNESS_LABEL,
  freshnessOf,
  relativeAge,
  utcDateTime,
  utcStamp,
  type Freshness,
} from "@/lib/freshness";
import { SOURCES, STALE_AFTER_MS } from "@/lib/sources";

/**
 * The freshness contract.
 *
 * These assertions exist because freshness is the one label in the product that
 * is easy to get wrong in the direction that matters. Calling an annual World
 * Bank series LIVE because it was fetched a minute ago is the exact mistake
 * this module was written to prevent, so the boundary cases are pinned here
 * rather than left to whoever next edits the thresholds.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** All five labels the UI is allowed to render. */
const STATES: Freshness[] = [
  "live",
  "recent",
  "delayed",
  "historical",
  "unavailable",
];

describe("freshness labels", () => {
  test("every state has a label and an explanation", () => {
    for (const state of STATES) {
      expect(FRESHNESS_LABEL[state]).toBeTruthy();
      expect(FRESHNESS_HELP[state]).toBeTruthy();
    }
  });

  test("labels are the documented wording, not ad-hoc strings", () => {
    expect(FRESHNESS_LABEL).toEqual({
      live: "LIVE",
      recent: "RECENT",
      delayed: "DELAYED",
      historical: "HISTORICAL",
      unavailable: "UNAVAILABLE",
    });
  });

  test("every connected source declares a staleness window", () => {
    // A source with no window falls through to "delayed" for every reading,
    // which would mislabel a healthy feed. The registry and the window table
    // have to stay in step.
    for (const id of Object.keys(SOURCES)) {
      expect(STALE_AFTER_MS[id]).toBeGreaterThan(0);
    }
  });
});

describe("freshnessOf", () => {
  test("never returns a value for a timestamp that does not exist", () => {
    for (const id of Object.keys(SOURCES)) {
      expect(freshnessOf(undefined, id)).toBe("unavailable");
      expect(freshnessOf(0, id)).toBe("unavailable");
    }
  });

  test("an annual publisher is never LIVE, however recent the fetch", () => {
    // The whole point: retrieved a millisecond ago describes a closed period.
    expect(freshnessOf(Date.now(), "worldbank")).toBe("historical");
    expect(freshnessOf(Date.now(), "comtrade")).toBe("historical");
    expect(freshnessOf(Date.now(), "worldbank")).not.toBe("live");
  });

  test("an annual publisher goes DELAYED past its window, not LIVE", () => {
    expect(freshnessOf(Date.now() - 10 * DAY, "worldbank")).toBe("delayed");
    expect(freshnessOf(Date.now() - 30 * DAY, "comtrade")).toBe("delayed");
  });

  test("a continuously updated feed moves through all three live states", () => {
    const now = Date.now();
    // GDELT's window is 6h, so the live quarter is 90 minutes.
    expect(freshnessOf(now, "gdelt")).toBe("live");
    expect(freshnessOf(now - 3 * HOUR, "gdelt")).toBe("recent");
    expect(freshnessOf(now - 8 * HOUR, "gdelt")).toBe("delayed");
  });

  test("the ECB's business-day window is not treated as live for long", () => {
    const now = Date.now();
    // 4-day window, so the live quarter is a single day.
    expect(freshnessOf(now, "ecb")).toBe("live");
    expect(freshnessOf(now - 2 * DAY, "ecb")).toBe("recent");
    expect(freshnessOf(now - 6 * DAY, "ecb")).toBe("delayed");
  });

  test("an unknown source degrades to DELAYED rather than claiming freshness", () => {
    expect(freshnessOf(Date.now(), "not-a-connected-source")).toBe("delayed");
  });
});

describe("clock formatting", () => {
  test("an absent timestamp renders as a dash, never as a time", () => {
    expect(utcStamp(undefined)).toBe("—");
    expect(utcDateTime(undefined)).toBe("—");
  });

  test("timestamps are UTC", () => {
    const ms = Date.UTC(2026, 9, 5, 14, 20, 3);
    expect(utcStamp(ms)).toBe("14:20:03 UTC");
    expect(utcDateTime(ms)).toBe("2026-10-05 14:20 UTC");
  });
});

describe("relativeAge", () => {
  test("invents no recency when there is no timestamp", () => {
    expect(relativeAge(undefined)).toBe("");
    expect(relativeAge(0)).toBe("");
  });

  test("rounds down to the unit a reader cares about", () => {
    const now = Date.now();
    expect(relativeAge(now - 5 * 1000)).toBe("5s ago");
    expect(relativeAge(now - 3 * MINUTE)).toBe("3 min ago");
    expect(relativeAge(now - 5 * HOUR)).toBe("5h ago");
    expect(relativeAge(now - 3 * DAY)).toBe("3d ago");
  });

  test("a clock skew does not produce a negative age", () => {
    expect(relativeAge(Date.now() + 60 * 1000)).toBe("0s ago");
  });
});
