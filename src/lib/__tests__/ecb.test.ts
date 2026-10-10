import { afterEach, describe, expect, test } from "bun:test";
import {
  ECB_FX,
  ECB_TENORS,
  pullEcbFx,
  pullEcbYield,
  readSdmx,
  splitCsvLine,
  type ConnectorOutcome,
} from "@/lib/ecb";

/**
 * The ECB connector's parsing and its failure contract.
 *
 * The failure half matters more than the happy path. Everything in this product
 * is allowed to be unavailable, and nothing is allowed to be invented, so the
 * assertions that carry weight are the ones checking that a bad or blocked
 * response produces *no reading* rather than a plausible one — and that the
 * failure is described in a sentence a reader can act on.
 */

const HEADER =
  "KEY,FREQ,CURRENCY,CURRENCY_DENOM,EXR_TYPE,EXR_SUFFIX,TIME_PERIOD,OBS_VALUE,OBS_STATUS";
const YIELD_HEADER =
  "KEY,FREQ,REF_AREA,CURRENCY,PROVIDER_FM,INSTRUMENT_FM,SERIES_VARIATION,PROVIDER_FM_ID,TIME_PERIOD,OBS_VALUE,OBS_STATUS";

/** One FX row for a tracked pair. */
const fxRow = (code: string, date: string, value: string) =>
  `EXR.D.${code}.EUR.SP00.A,D,${code},EUR,SP00,A,${date},${value},A`;

const csv = (rows: string[]) => [HEADER, ...rows].join("\n");

/** Replace the global fetch for one test, returning nothing to restore. */
function stubFetch(impl: (url: string) => Response | Promise<Response>) {
  globalThis.fetch = ((input: unknown) =>
    Promise.resolve(impl(String(input)))) as unknown as typeof fetch;
}

const jsonResponse = (body: string, status = 200, ok = true) =>
  ({ ok, status, text: async () => body }) as unknown as Response;

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

/* ------------------------------------------------------------------ */

describe("splitCsvLine", () => {
  test("splits plain records", () => {
    expect(splitCsvLine("a,b,c")).toEqual(["a", "b", "c"]);
  });

  test("keeps commas that sit inside a quoted field", () => {
    // The whole reason this is hand-written: a naive split shifts every column
    // after the first quoted title, which puts a title where a number belongs.
    expect(splitCsvLine('KEY,TITLE,2026-10-05,1.5,"Rates, fixed daily"')).toEqual([
      "KEY",
      "TITLE",
      "2026-10-05",
      "1.5",
      "Rates, fixed daily",
    ]);
  });

  test("unescapes a doubled quote", () => {
    expect(splitCsvLine('a,"say ""hi""",c')).toEqual(["a", 'say "hi"', "c"]);
  });

  test("keeps empty trailing fields so column indexes stay aligned", () => {
    expect(splitCsvLine("a,b,")).toEqual(["a", "b", ""]);
  });
});

describe("readSdmx", () => {
  test("locates its columns by name, not by position", () => {
    // The ECB reorders metadata columns between requests, so the value column
    // is not always in the same slot.
    const reordered = [
      "OBS_VALUE,KEY,TIME_PERIOD",
      "1.16,EXR.D.USD.EUR.SP00.A,2026-10-05",
    ].join("\n");
    expect(readSdmx(reordered)).toEqual([
      { series: "1.16", date: "2026-10-05", value: 1.16 },
    ]);
  });

  test("returns nothing when the required columns are absent", () => {
    expect(readSdmx("A,B,C\n1,2,3")).toEqual([]);
  });

  test("returns nothing for a header-only or empty body", () => {
    expect(readSdmx(HEADER)).toEqual([]);
    expect(readSdmx("")).toEqual([]);
  });

  test("drops rows whose period is not a full date", () => {
    const body = csv([
      fxRow("USD", "2026-10", "1.16"),
      fxRow("USD", "not-a-date", "1.16"),
      fxRow("USD", "2026-10-05", "1.1642"),
    ]);
    const rows = readSdmx(body);
    expect(rows).toHaveLength(1);
    expect(rows[0].date).toBe("2026-10-05");
  });

  test("drops rows whose value is not a positive number", () => {
    const body = csv([
      fxRow("USD", "2026-10-05", "0"),
      fxRow("USD", "2026-10-05", "-1.2"),
      fxRow("USD", "2026-10-05", ""),
      fxRow("USD", "2026-10-05", "n/a"),
    ]);
    expect(readSdmx(body)).toEqual([]);
  });
});

/* ------------------------------------------------------------------ */

describe("pullEcbFx — success", () => {
  test("stores one observed reading per tracked pair", async () => {
    stubFetch(() =>
      jsonResponse(
        csv([
          fxRow("USD", "2026-10-05", "1.1642"),
          fxRow("JPY", "2026-10-05", "170.5"),
        ]),
      ),
    );

    const out = await pullEcbFx();
    expect(out.ok).toBe(true);
    expect(out.status).toBe("observed");
    expect(out.sourceId).toBe("ecb");
    expect(out.key).toBe("fx");
    // The observation period is a date, not our fetch time.
    expect(out.asOf).toBe("2026-10-05");

    const points = JSON.parse(out.payload) as {
      series: string;
      value: number;
      label: string;
      provenance: { sourceId: string; status: string; asOf: string; note?: string };
    }[];
    expect(points).toHaveLength(2);
    expect(points.map((p) => p.series).sort()).toEqual(["JPY", "USD"]);
    for (const point of points) {
      expect(point.value).toBeGreaterThan(0);
      expect(point.provenance.sourceId).toBe("ecb");
      expect(point.provenance.status).toBe("observed");
      // Every point says what it is not, not only what it is.
      expect(point.provenance.note).toContain("Not an executable quote");
    }
  });

  test("takes the newest period as asOf when rows disagree", async () => {
    stubFetch(() =>
      jsonResponse(
        csv([
          fxRow("USD", "2026-10-02", "1.16"),
          fxRow("USD", "2026-10-05", "1.1642"),
        ]),
      ),
    );
    const out = await pullEcbFx();
    expect(out.asOf).toBe("2026-10-05");
  });

  test("ignores a pair that is not tracked", async () => {
    stubFetch(() =>
      jsonResponse(
        csv([fxRow("USD", "2026-10-05", "1.1642"), fxRow("SEK", "2026-10-05", "11.2")]),
      ),
    );
    const out = await pullEcbFx();
    const points = JSON.parse(out.payload) as { series: string }[];
    expect(points.map((p) => p.series)).toEqual(["USD"]);
  });
});

describe("pullEcbFx — failure never yields a reading", () => {
  /** Every failure path must land on this shape. */
  function expectHonestFailure(out: ConnectorOutcome) {
    expect(out.ok).toBe(false);
    expect(out.status).toBe("unavailable");
    // No payload at all: a failure must not leave half-parsed readings behind.
    expect(out.payload).toBe("[]");
    expect(out.problem).toBeTruthy();
    // The problem is a sentence, never a status line or a stack.
    expect(out.problem).not.toContain("http");
    expect(out.problem!.length).toBeGreaterThan(10);
  }

  test("an HTTP error is reported, not salvaged", async () => {
    stubFetch(() => jsonResponse("", 500, false));
    const out = await pullEcbFx();
    expectHonestFailure(out);
    expect(out.problem).toBe("The source returned an error.");
  });

  test("a rate limit is named as a rate limit", async () => {
    stubFetch(() => jsonResponse("", 429, false));
    const out = await pullEcbFx();
    expectHonestFailure(out);
    expect(out.problem).toContain("rate-limiting");
  });

  test("an unreachable source is distinguished from an error response", async () => {
    stubFetch(() => {
      throw new TypeError("fetch failed");
    });
    const out = await pullEcbFx();
    expectHonestFailure(out);
    expect(out.problem).toBe("The source could not be reached.");
  });

  test("a table that parses to nothing is a parse failure, not an empty answer", async () => {
    stubFetch(() => jsonResponse("KEY,TIME_PERIOD,OBS_VALUE"));
    const out = await pullEcbFx();
    expectHonestFailure(out);
    expect(out.problem).toBe("The source returned a table we could not read.");
  });

  test("rows that parse but match no tracked pair are a shape failure", async () => {
    // Distinct from an empty response: the source answered, we just could not
    // attribute what it said. Saying which of the two happened is the point.
    stubFetch(() => jsonResponse(csv([fxRow("SEK", "2026-10-05", "11.2")])));
    const out = await pullEcbFx();
    expectHonestFailure(out);
    expect(out.problem).toBe("The source returned a table we could not read.");
  });

  test("an HTML error page is not parsed into readings", async () => {
    stubFetch(() => jsonResponse("<html><body>Service Unavailable</body></html>"));
    const out = await pullEcbFx();
    expectHonestFailure(out);
  });
});

/* ------------------------------------------------------------------ */

describe("pullEcbYield", () => {
  test("returns one outcome per tenor", async () => {
    stubFetch(
      () =>
        jsonResponse(
          [YIELD_HEADER, `YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_2Y,D,U2,EUR,4F,G_N_A,SV_C_YM,SR_2Y,2026-10-05,2.14,A`].join(
            "\n",
          ),
        ),
    );
    const out = await pullEcbYield();
    expect(out).toHaveLength(ECB_TENORS.length);
    expect(out.every((o) => o.ok)).toBe(true);
    expect(out.map((o) => o.key)).toEqual(ECB_TENORS.map((t) => `yield:${t.code}`));
  });

  test("one unavailable tenor does not blank the curve", async () => {
    let call = 0;
    stubFetch(() => {
      call += 1;
      if (call === 1) {
        return jsonResponse(
          [YIELD_HEADER, `YC.…SR_2Y,D,U2,EUR,4F,G_N_A,SV_C_YM,SR_2Y,2026-10-05,2.14,A`].join("\n"),
        );
      }
      return jsonResponse("", 503, false);
    });

    const out = await pullEcbYield();
    expect(out).toHaveLength(ECB_TENORS.length);
    expect(out.filter((o) => o.ok)).toHaveLength(1);
    const failed = out.filter((o) => !o.ok);
    expect(failed).toHaveLength(2);
    for (const item of failed) expect(item.payload).toBe("[]");
  });

  test("takes the last row, which is the newest", async () => {
    // `lastNObservations=1` still returns ascending order; taking [0] would
    // silently report the older fixing.
    stubFetch(() =>
      jsonResponse(
        [
          YIELD_HEADER,
          `YC.…SR_10Y,D,U2,EUR,4F,G_N_A,SV_C_YM,SR_10Y,2026-10-02,2.61,A`,
          `YC.…SR_10Y,D,U2,EUR,4F,G_N_A,SV_C_YM,SR_10Y,2026-10-05,2.64,A`,
        ].join("\n"),
      ),
    );
    const out = await pullEcbYield();
    const tenYear = out.find((o) => o.key === "yield:SR_10Y");
    const points = JSON.parse(tenYear!.payload) as { date: string; value: number }[];
    expect(points[0].date).toBe("2026-10-05");
    expect(points[0].value).toBe(2.64);
  });
});

/* ------------------------------------------------------------------ */

describe("the tracked pair list", () => {
  test("excludes the rouble, whose rate the ECB suspended", () => {
    // The API still serves the frozen February 2022 value on request. Printing
    // a four-year-old number in a row of today's rates would read as a quote,
    // so the pair is not tracked at all.
    expect(ECB_FX.map((c) => c.code)).not.toContain("RUB");
  });

  test("every pair carries a human label", () => {
    for (const pair of [...ECB_FX, ...ECB_TENORS]) {
      expect(pair.code).toMatch(/^[A-Z0-9_]+$/);
      expect(pair.label.length).toBeGreaterThan(3);
    }
  });
});
