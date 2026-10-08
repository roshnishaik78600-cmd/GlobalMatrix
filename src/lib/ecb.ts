/**
 * European Central Bank open-data connector.
 *
 * Split out of `convex/sources.ts` because it is pure transport and parsing:
 * no database handle, no Convex imports, nothing that needs the Node runtime.
 * That keeps it directly runnable and testable, and it lets `sources.ts` stay
 * a thin list of actions.
 *
 * Everything here is keyless and official. The ECB publishes its open data
 * through an SDMX endpoint that needs no credential, no registration and no
 * contact address, which is exactly the kind of source this product is allowed
 * to rely on. Nothing is scraped and nothing is inferred: a row is either a
 * number the Bank printed in this response, or it is dropped.
 */

import type { Provenance } from "./sources";

const BASE = "https://data-api.ecb.europa.eu/service/data";

/** Hard timeout, matching the other connectors. */
const TIMEOUT_MS = 20_000;
const UA = "GlobalMatrix/1.0 (open-source intelligence dashboard)";

const PROBLEMS = {
  timeout: "The source did not respond in time.",
  network: "The source could not be reached.",
  http: "The source returned an error.",
  throttled: "The source is rate-limiting requests. Try again shortly.",
  parse: "The source returned a table we could not read.",
  empty: "The source returned no readings for this request.",
} as const;

/** Shape a `sources.ts` connector run is expected to return. */
export type ConnectorOutcome = {
  sourceId: string;
  key: string;
  asOf: string;
  /**
   * The source's own publication time for the item, in epoch ms, on the feeds
   * that supply one.
   *
   * Deliberately separate from the other two timestamps, because all three
   * answer different questions and collapsing them is how a stale feed comes to
   * look current: `publishedAt` is when the publisher issued the item,
   * `asOf` is the period it describes, and `retrievedAt` is when we fetched it.
   *
   * Left undefined rather than inferred. The ECB, for instance, publishes a
   * reference *date* fixed at 14:15 CET, not a timestamp — deriving one would be
   * inventing precision the source never gave us.
   */
  publishedAt?: number;
  retrievedAt: number;
  status: string;
  ok: boolean;
  note?: string;
  problem?: string;
  payload: string;
};

/**
 * The pairs we track, named by the ECB's own currency codes.
 *
 * RUB is deliberately absent. The ECB suspended its rouble reference rate in
 * March 2022 once the rate stopped being computable under sanctions, and the
 * API still serves that frozen value on request. Printing a four-year-old
 * number in a row of today's rates would read as a live quote, so the pair is
 * not tracked at all and the reason is stated in the source's `limits`.
 */
export const ECB_FX: { code: string; label: string }[] = [
  { code: "USD", label: "US dollar" },
  { code: "JPY", label: "Japanese yen" },
  { code: "CNY", label: "Chinese yuan" },
  { code: "GBP", label: "Pound sterling" },
  { code: "CHF", label: "Swiss franc" },
  { code: "INR", label: "Indian rupee" },
  { code: "KRW", label: "South Korean won" },
  { code: "BRL", label: "Brazilian real" },
  { code: "TRY", label: "Turkish lira" },
];

/** Euro area curve tenors. Two fixed points are enough to state the slope. */
export const ECB_TENORS: { code: string; label: string }[] = [
  { code: "SR_2Y", label: "Euro area 2-year" },
  { code: "SR_10Y", label: "Euro area 10-year" },
  { code: "SR_30Y", label: "Euro area 30-year" },
];

/**
 * One observed exchange-rate reading.
 *
 * The unit is the ECB's own: how many units of `series` one euro buys. It is
 * not a return, not an executable quote and not a mid-market print, and every
 * surface that shows it says so.
 */
export type FxPoint = {
  key: string;
  /** ISO currency code of the quoted currency. */
  series: string;
  /** Human label, e.g. "US dollar per euro". */
  label: string;
  /** ISO date the rate was fixed on. */
  date: string;
  value: number;
  provenance: Provenance;
};

/** One observed point on the euro area government bond curve. */
export type YieldPoint = {
  key: string;
  /** Tenor label exactly as the ECB publishes it. */
  tenor: string;
  label: string;
  date: string;
  /** Per cent per annum, as published. */
  value: number;
  provenance: Provenance;
};

/** A reading is only real if it is a finite, strictly positive number. */
function usableNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Fetch plain text with a typed, user-safe failure.
 *
 * The refusal rules are identical to the JSON connectors: a non-2xx response
 * is a failure, and a failure is reported in plain words rather than salvaged
 * from whatever partial body came back.
 */
async function getText(
  url: string,
): Promise<{ ok: true; data: string } | { ok: false; problem: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "text/csv, text/plain", "user-agent": UA },
    });
    if (!res.ok) {
      return {
        ok: false,
        problem: res.status === 429 ? PROBLEMS.throttled : PROBLEMS.http,
      };
    }
    return { ok: true, data: await res.text() };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { ok: false, problem: aborted ? PROBLEMS.timeout : PROBLEMS.network };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Split one CSV record, honouring quoted fields.
 *
 * Hand-written rather than `split(",")` because SDMX exports put commas inside
 * quoted titles. A naive split shifts every column after the first quote, which
 * would put a title into the value field and store a string where a number is
 * expected — a silent corruption, which is the one failure mode this file is
 * not allowed to have.
 */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch !== '"') {
        field += ch;
      } else if (line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = false;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      out.push(field);
      field = "";
    } else {
      field += ch;
    }
  }
  out.push(field);
  return out;
}

/**
 * The two columns we need, located by name.
 *
 * Positional reads are not safe here: the ECB adds, drops and reorders metadata
 * columns depending on the `detail` flag, so slot 7 is a date on one request
 * and a title on another.
 */
function sdmxColumns(header: string[]): { time: number; value: number } | null {
  const time = header.indexOf("TIME_PERIOD");
  const value = header.indexOf("OBS_VALUE");
  return time >= 0 && value >= 0 ? { time, value } : null;
}

/** An SDXM CSV export, reduced to the three fields this module can attribute. */
export function readSdmx(csv: string): { series: string; date: string; value: number }[] {
  const lines = csv
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length < 2) return [];

  const cols = sdmxColumns(splitCsvLine(lines[0]));
  if (!cols) return [];

  const out: { series: string; date: string; value: number }[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    const date = (cells[cols.time] ?? "").trim();
    const value = usableNumber(cells[cols.value]);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || value === null) continue;
    out.push({ series: cells[0] ?? "", date, value });
  }
  return out;
}

const fail = (key: string, problem: string): ConnectorOutcome => ({
  sourceId: "ecb",
  key,
  asOf: "",
  retrievedAt: Date.now(),
  status: "unavailable",
  ok: false,
  problem,
  payload: "[]",
});

/**
 * Daily euro reference rates for every tracked pair, in one request.
 *
 * The Bank fixes these once per TARGET business day, so the observation period
 * is a single date and the retrieval time is whenever we happened to fetch.
 * Both are stored separately, which is what lets a caller state "fixed
 * 2026-10-05, fetched 14:20" rather than collapsing the two into one
 * ambiguous timestamp.
 */
export async function pullEcbFx(): Promise<ConnectorOutcome> {
  const codes = ECB_FX.map((c) => c.code);
  const url =
    `${BASE}/EXR/D.${codes.join("+")}.EUR.SP00.A` +
    `?format=csvdata&detail=dataonly&lastNObservations=1`;
  const res = await getText(url);
  if (!res.ok) return fail("fx", res.problem);

  const rows = readSdmx(res.data);
  if (rows.length === 0) return fail("fx", PROBLEMS.parse);

  const retrievedAt = Date.now();
  const labelOf = new Map(ECB_FX.map((c) => [c.code, c.label]));
  const points: FxPoint[] = [];
  let asOf = "";

  for (const row of rows) {
    // The currency is read out of the ECB's own dotted series key — `EXR.D.USD.EUR.SP00.A`
    // carries the frequency in slot 2, so the quoted currency is slot 3. Matching
    // the whole documented shape rather than indexing blindly means a future
    // change to the key layout drops the row instead of mislabelling it.
    const match = /^EXR\.D\.([A-Z]{3})\.EUR\.SP00\.A$/.exec(row.series);
    if (!match) continue;
    const series = match[1];
    if (!labelOf.has(series)) continue;
    if (row.date > asOf) asOf = row.date;
    points.push({
      key: `fx:${series}:${row.date}`,
      series,
      label: `${labelOf.get(series)} per euro`,
      date: row.date,
      value: row.value,
      provenance: {
        sourceId: "ecb",
        asOf: row.date,
        retrievedAt,
        status: "observed",
        note: "ECB reference rate, fixed 14:15 CET. Not an executable quote.",
      },
    });
  }

  // Rows parsed but none were attributable to a pair we track: that is a shape
  // problem upstream rather than an empty answer, and saying so keeps the
  // sources dashboard honest about which of the two went wrong.
  if (points.length === 0) return fail("fx", PROBLEMS.parse);

  return {
    sourceId: "ecb",
    key: "fx",
    asOf,
    retrievedAt,
    status: "observed",
    ok: true,
    payload: JSON.stringify(points),
  };
}

/**
 * The euro area spot yield curve.
 *
 * Each tenor is fetched under its own key so one unavailable tenor cannot blank
 * the curve, and so the cache keeps a per-tenor history rather than a single
 * merged snapshot.
 */
export async function pullEcbYield(): Promise<ConnectorOutcome[]> {
  const out: ConnectorOutcome[] = [];

  for (const tenor of ECB_TENORS) {
    const url =
      `${BASE}/YC/B.U2.EUR.4F.G_N_A.SV_C_YM.${tenor.code}` +
      `?format=csvdata&detail=dataonly&lastNObservations=1`;
    const res = await getText(url);
    if (!res.ok) {
      out.push(fail(`yield:${tenor.code}`, res.problem));
      continue;
    }

    const rows = readSdmx(res.data);
    if (rows.length === 0) {
      out.push(fail(`yield:${tenor.code}`, PROBLEMS.parse));
      continue;
    }

    const retrievedAt = Date.now();
    // `lastNObservations=1` still returns the row in ascending date order, so
    // the newest is last. Taking [0] would silently report yesterday's fix.
    const latest = rows[rows.length - 1];
    const point: YieldPoint = {
      key: `yield:${tenor.code}:${latest.date}`,
      tenor: tenor.code,
      label: tenor.label,
      date: latest.date,
      value: latest.value,
      provenance: {
        sourceId: "ecb",
        asOf: latest.date,
        retrievedAt,
        status: "observed",
        note: "Euro area spot yield curve, per cent per annum.",
      },
    };
    out.push({
      sourceId: "ecb",
      key: `yield:${tenor.code}`,
      asOf: latest.date,
      retrievedAt,
      status: "observed",
      ok: true,
      payload: JSON.stringify([point]),
    });
  }

  return out;
}