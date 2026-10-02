"use node";

/**
 * Connectors to verified public data sources.
 *
 * Everything here follows the same contract: fetch, validate, cache, stamp.
 * If any step fails the observation is written with `ok: false` and a plain
 * sentence a non-technical reader can understand — never an exception, never a
 * raw upstream body, and above all never a substituted value.
 *
 * All sources in this file are keyless public endpoints. FRED, EIA and Google
 * Trends need a credential or have no supported public API, so they are not
 * wired up; the UI reports them as "No verified data available" rather than
 * guessing.
 */

import { action } from "./_generated/server";
import { api } from "./_generated/api";
import {
  type Datum,
  type DataStatus,
  type Provenance,
} from "../lib/sources";

const TIMEOUT_MS = 20_000;
const UA = "GlobalMatrix/1.0 (open-source intelligence dashboard)";

/* ------------------------------------------------------------------ */
/* ISO mapping — corpus node ids are ISO2, public APIs want ISO3.        */
/* ------------------------------------------------------------------ */

export const ISO3: Record<string, string> = {
  CN: "CHN",
  US: "USA",
  RU: "RUS",
  IR: "IRN",
  TW: "TWN",
  KR: "KOR",
  JP: "JPN",
  NL: "NLD",
  GB: "GBR",
  DE: "DEU",
  IN: "IND",
  TR: "TUR",
  AE: "ARE",
  SA: "SAU",
  SG: "SGP",
  BR: "BRA",
  ZA: "ZAF",
  MY: "MYS",
};

/** Economies we can actually attribute a reading to. Blocs are excluded. */
const ECONOMIES = Object.entries(ISO3).map(([node, iso3]) => ({ node, iso3 }));

/* ------------------------------------------------------------------ */
/* Indicators — each entry names a real series in the source's own      */
/* vocabulary. Display labels are ours; the IDs are theirs.             */
/* ------------------------------------------------------------------ */

const WB_SERIES = [
  { id: "NY.GDP.MKTP.KD.ZG", label: "Real GDP growth", unit: "%", key: "gdpGrowth" },
  { id: "NY.GDP.MKTP.CD", label: "GDP", unit: "US$", key: "gdp" },
  { id: "FP.CPI.TOTL.ZG", label: "Inflation", unit: "%", key: "inflation" },
  { id: "NE.TRD.GNFS.ZS", label: "Trade share of GDP", unit: "%", key: "tradeOpen" },
  { id: "SP.POP.TOTL", label: "Population", unit: "people", key: "population" },
] as const;

/* IMF DataMapper is deliberately NOT wired up: its edge rejects clients whose
 * User-Agent lacks a contact URL, and we will not send a domain we do not
 * control. World Bank covers the same macro panel from a stable public API.
 * If you deploy GlobalMatrix under a real domain, add `imf` back here. */

export type MacroReading = Datum & {
  node: string;
  indicatorKey: string;
  seriesId: string;
};

export type ConnectorOutcome = {
  sourceId: string;
  key: string;
  asOf: string;
  retrievedAt: number;
  status: DataStatus;
  note?: string;
  ok: boolean;
  problem?: string;
  payload: string;
};

const PROBLEMS = {
  timeout: "The source did not respond in time.",
  network: "The source could not be reached.",
  http: "The source returned an error.",
  throttled: "The source is rate-limiting requests. Try again shortly.",
  shape: "The source returned data in an unexpected shape.",
  empty: "The source returned no readings for this request.",
} as const;

/* ------------------------------------------------------------------ */
/* Transport                                                           */
/* ------------------------------------------------------------------ */

/**
 * Fetch JSON with a hard timeout and a typed, user-safe failure. Any non-JSON
 * or non-2xx response is a failure — we never try to salvage a partial body.
 */
async function getJson(
  url: string,
): Promise<{ ok: true; data: unknown } | { ok: false; problem: string; status: number }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { accept: "application/json", "user-agent": UA },
    });
    if (!res.ok) {
      return {
        ok: false,
        problem: res.status === 429 ? PROBLEMS.throttled : PROBLEMS.http,
        status: res.status,
      };
    }
    return { ok: true, data: await res.json() };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      problem: aborted ? PROBLEMS.timeout : PROBLEMS.network,
      status: 0,
    };
  } finally {
    clearTimeout(timer);
  }
}

/** A reading is only real if it is a finite number, and negative GDP is not. */
function usableNumber(v: unknown, opts: { positive?: boolean } = {}): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return null;
  if (opts.positive && n <= 0) return null;
  return n;
}

const fail = (
  sourceId: string,
  key: string,
  problem: string,
): ConnectorOutcome => ({
  sourceId,
  key,
  asOf: "",
  retrievedAt: Date.now(),
  status: "unavailable",
  ok: false,
  problem,
  payload: "[]",
});

/* ------------------------------------------------------------------ */
/* World Bank Open Data                                                */
/* ------------------------------------------------------------------ */

/**
 * Pulls a World Bank series for every corpus economy in one request.
 *
 * World Bank publishes the dataset revision date in the response header of the
 * payload, which is the honest `asOf` for the whole batch — more useful than
 * pretending the observation is as fresh as our fetch time.
 */
async function pullWorldBank(series: (typeof WB_SERIES)[number]): Promise<ConnectorOutcome> {
  const countries = ECONOMIES.map((e) => e.iso3).join(";");
  const url =
    `https://api.worldbank.org/v2/country/${countries}/indicator/${series.id}` +
    `?format=json&date=2018:2025&per_page=1000`;

  const res = await getJson(url);
  if (!res.ok) return fail("worldbank", series.key, res.problem);

  if (!Array.isArray(res.data) || !Array.isArray(res.data[1])) {
    return fail("worldbank", series.key, PROBLEMS.shape);
  }

  const meta = res.data[0] as { lastupdated?: string } | undefined;
  const rows = res.data[1] as unknown[];
  const isoToNode = new Map(ECONOMIES.map((e) => [e.iso3, e.node]));
  const retrievedAt = Date.now();

  const readings: MacroReading[] = [];
  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as {
      countryiso3code?: unknown;
      date?: unknown;
      value?: unknown;
      country?: { id?: unknown };
    };
    const iso3 = typeof r.countryiso3code === "string" ? r.countryiso3code : null;
    const year = typeof r.date === "string" ? r.date : null;
    if (!iso3 || !year) continue;
    const node = isoToNode.get(iso3) ?? (typeof r.country?.id === "string" ? r.country.id : null);
    if (!node) continue;

    const value = usableNumber(r.value, { positive: series.key === "gdp" || series.key === "population" });
    if (value === null) continue;

    readings.push({
      key: `${node}:${series.key}:${year}`,
      node,
      indicatorKey: series.key,
      seriesId: series.id,
      label: series.label,
      value,
      unit: series.unit,
      period: year,
      provenance: {
        sourceId: "worldbank",
        asOf: meta?.lastupdated ?? "",
        retrievedAt,
        status: "observed",
      },
    } as MacroReading);
  }

  if (readings.length === 0) return fail("worldbank", series.key, PROBLEMS.empty);

  // Duplicate guard: the API can repeat a (country, year) pair across pages.
  const deduped = new Map<string, MacroReading>();
  for (const r of readings) if (!deduped.has(r.key)) deduped.set(r.key, r);

  return {
    sourceId: "worldbank",
    key: series.key,
    asOf: meta?.lastupdated ?? "",
    retrievedAt,
    status: "observed",
    ok: true,
    payload: JSON.stringify([...deduped.values()]),
  };
}

export const worldBankRefresh = action({
  handler: async (): Promise<ConnectorOutcome[]> => {
    const out: ConnectorOutcome[] = [];
    // Sequential on purpose: World Bank throttles bursts.
    for (const series of WB_SERIES) out.push(await pullWorldBank(series));
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* UN Comtrade                                                         */
/* ------------------------------------------------------------------ */

export type TradeFlow = {
  key: string;
  reporter: string;
  reporterIso: string;
  partner: string;
  partnerIso: string | null;
  period: string;
  /** Exports from reporter to partner, US$. */
  exportsUsd: number;
  /** Imports from partner to reporter, US$. */
  importsUsd: number;
  provenance: Provenance;
};

const COMTRADE_REPORTERS: Record<string, number> = {
  CN: 156,
  US: 842,
  DE: 276,
  JP: 392,
  GB: 826,
  NL: 528,
  IN: 699,
  KR: 410,
  SG: 702,
  BR: 223,
};

/**
 * Total merchandise trade per reporter, from the public preview tier.
 *
 * The preview endpoint is sampled and returns abbreviated fields; every row is
 * validated before it is stored and the whole tier is labelled accordingly.
 */
async function pullComtrade(period: string): Promise<ConnectorOutcome> {
  const reporterCodes = Object.values(COMTRADE_REPORTERS);
  const url =
    `https://comtradeapi.un.org/public/v1/preview/C/A/HS` +
    `?reporterCode=${reporterCodes.join(",")}&period=${period}` +
    `&flowCode=M,X&partnerCode=0&cmdCode=TOTAL`;

  const res = await getJson(url);
  if (!res.ok) return fail("comtrade", `comtrade:${period}`, res.problem);

  if (typeof res.data !== "object" || res.data === null) {
    return fail("comtrade", `comtrade:${period}`, PROBLEMS.shape);
  }
  const rows = (res.data as { data?: unknown }).data;
  if (!Array.isArray(rows)) return fail("comtrade", `comtrade:${period}`, PROBLEMS.shape);

  const codeToNode = new Map(
    Object.entries(COMTRADE_REPORTERS).map(([node, code]) => [code, node]),
  );
  const retrievedAt = Date.now();
  const totals = new Map<string, { exports: number; imports: number }>();

  for (const row of rows) {
    if (typeof row !== "object" || row === null) continue;
    const r = row as {
      reporterCode?: unknown;
      flowCode?: unknown;
      primaryValue?: unknown;
    };
    const reporter = codeToNode.get(Number(r.reporterCode));
    if (!reporter) continue;
    const value = usableNumber(r.primaryValue, { positive: true });
    if (value === null) continue;

    const slot = totals.get(reporter) ?? { exports: 0, imports: 0 };
    if (r.flowCode === "X") slot.exports += value;
    else if (r.flowCode === "M") slot.imports += value;
    totals.set(reporter, slot);
  }

  if (totals.size === 0) return fail("comtrade", `comtrade:${period}`, PROBLEMS.empty);

  const flows: TradeFlow[] = [...totals.entries()].map(([reporter, t]) => ({
    key: `${reporter}:${period}`,
    reporter,
    reporterIso: ISO3[reporter] ?? "",
    partner: "World",
    partnerIso: null,
    period,
    exportsUsd: Math.round(t.exports),
    importsUsd: Math.round(t.imports),
    provenance: {
      sourceId: "comtrade",
      asOf: period,
      retrievedAt,
      status: "observed",
      note: "Public preview tier: sampled, abbreviated detail.",
    },
  }));

  return {
    sourceId: "comtrade",
    key: `comtrade:${period}`,
    asOf: period,
    retrievedAt,
    status: "observed",
    ok: true,
    payload: JSON.stringify(flows),
  };
}

/** Most recent complete year with broadly reported figures. */
async function latestComtradeYear(): Promise<string> {
  const thisYear = new Date().getUTCFullYear();
  // UN Comtrade lags by roughly a year for most reporters.
  return String(thisYear - 1);
}

export const comtradeRefresh = action({
  handler: async (): Promise<ConnectorOutcome[]> => {
    return [await pullComtrade(await latestComtradeYear())];
  },
});

/* ------------------------------------------------------------------ */
/* GDELT — media attention                                            */
/* ------------------------------------------------------------------ */

export type AttentionPoint = {
  key: string;
  /** ISO date bucket, e.g. 20260914T120000Z flattened to hour. */
  at: string;
  /** Share of coverage in this bucket, 0-100. */
  attention: number;
  /** Sentiment polarity where GDELT publishes one. */
  tone: number | null;
  provenance: Provenance;
};

export type Headline = {
  key: string;
  title: string;
  url: string;
  domain: string;
  seenAt: string;
  provenance: Provenance;
};

const GDELT_MIN_INTERVAL_MS = 8_000;
const GDELT_RETRIES = 2;
let gdeltLastCall = 0;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * GDELT enforces a per-IP request floor and answers 429 rather than failing.
 * Space requests out and back off on a throttle instead of hammering it and
 * being throttled out for good.
 */
async function gdeltGet(path: string): Promise<{ ok: true; data: unknown } | { ok: false; problem: string }> {
  for (let attempt = 0; attempt <= GDELT_RETRIES; attempt++) {
    const since = GDELT_MIN_INTERVAL_MS - (Date.now() - gdeltLastCall);
    if (since > 0) await wait(since);
    gdeltLastCall = Date.now();

    const res = await getJson(`https://api.gdeltproject.org/api/v2/${path}`);
    if (res.ok) return { ok: true, data: res.data };
    if (res.status === 429 && attempt < GDELT_RETRIES) {
      await wait(GDELT_MIN_INTERVAL_MS * (attempt + 1));
      continue;
    }
    return { ok: false, problem: res.problem };
  }
  return { ok: false, problem: PROBLEMS.throttled };
}

/**
 * Media-attention volume for a topic.
 *
 * This measures how much news coverage a topic is receiving. It is explicitly
 * NOT evidence that an event happened or that it is severe, and the UI labels
 * it as public/media attention for that reason.
 */
async function pullGdeltAttention(topic: string): Promise<ConnectorOutcome> {
  const query = encodeURIComponent(topic);
  const res = await gdeltGet(
    `doc/doc?query=${query}&mode=timelinevolinfo&format=json&timespan=7d`,
  );
  if (!res.ok) return fail("gdelt", `attention:${topic}`, res.problem);

  if (typeof res.data !== "object" || res.data === null) {
    return fail("gdelt", `attention:${topic}`, PROBLEMS.shape);
  }
  const timeline = (res.data as { timeline?: unknown }).timeline;
  if (!Array.isArray(timeline)) return fail("gdelt", `attention:${topic}`, PROBLEMS.shape);

  const retrievedAt = Date.now();
  const points: AttentionPoint[] = [];

  for (const entry of timeline) {
    if (typeof entry !== "object" || entry === null) continue;
    const series = (entry as { series?: string; data?: unknown }).series ?? "";
    const data = (entry as { data?: unknown }).data;
    if (!Array.isArray(data)) continue;

    for (const bucket of data) {
      if (typeof bucket !== "object" || bucket === null) continue;
      const b = bucket as { date?: unknown; value?: unknown };
      if (typeof b.date !== "string") continue;
      const value = usableNumber(b.value);
      if (value === null) continue;

      points.push({
        key: `${topic}:${b.date}:${series}`,
        at: b.date,
        attention: value,
        tone: null,
        provenance: {
          sourceId: "gdelt",
          asOf: b.date,
          retrievedAt,
          status: "observed",
          note: "Media attention volume. Not evidence that an event occurred.",
        },
      });
    }
  }

  if (points.length === 0) return fail("gdelt", `attention:${topic}`, PROBLEMS.empty);

  return {
    sourceId: "gdelt",
    key: `attention:${topic}`,
    asOf: points[points.length - 1].at,
    retrievedAt,
    status: "observed",
    ok: true,
    payload: JSON.stringify(points),
  };
}

/**
 * Recent coverage for a topic, with the publisher's own URL so a reader can
 * always go and read the primary report themselves.
 */
async function pullGdeltHeadlines(topic: string): Promise<ConnectorOutcome> {
  const query = encodeURIComponent(topic);
  const res = await gdeltGet(
    `doc/doc?query=${query}&mode=artlist&format=json&maxrecords=25&sort=datedesc&timespan=7d`,
  );
  if (!res.ok) return fail("gdelt", `headlines:${topic}`, res.problem);

  if (typeof res.data !== "object" || res.data === null) {
    return fail("gdelt", `headlines:${topic}`, PROBLEMS.shape);
  }
  const articles = (res.data as { articles?: unknown }).articles;
  if (!Array.isArray(articles)) return fail("gdelt", `headlines:${topic}`, PROBLEMS.shape);

  const retrievedAt = Date.now();
  const seen = new Set<string>();
  const items: Headline[] = [];

  for (const a of articles) {
    if (typeof a !== "object" || a === null) continue;
    const r = a as { url?: unknown; title?: unknown; domain?: unknown; seendate?: unknown };
    const url = typeof r.url === "string" ? r.url : null;
    const title = typeof r.title === "string" ? r.title : null;
    if (!url || !title) continue;
    // Dedupe on URL — GDELT repeats syndicated copies across domains.
    if (seen.has(url)) continue;
    seen.add(url);

    const at = typeof r.seendate === "string" ? r.seendate : "";
    items.push({
      key: url,
      title: title.slice(0, 300),
      url,
      domain: typeof r.domain === "string" ? r.domain : "",
      seenAt: at,
      provenance: {
        sourceId: "gdelt",
        asOf: at,
        retrievedAt,
        status: "observed",
      },
    });
  }

  if (items.length === 0) return fail("gdelt", `headlines:${topic}`, PROBLEMS.empty);

  return {
    sourceId: "gdelt",
    key: `headlines:${topic}`,
    asOf: items[0].seenAt,
    retrievedAt,
    status: "observed",
    ok: true,
    payload: JSON.stringify(items),
  };
}

/** Topics tracked for public attention. Deliberately short: GDELT throttles by
 * request count, so a long list would starve later topics and leave most of the
 * panel empty. Two topics is what the quota actually sustains. */
const ATTENTION_TOPICS = ["trade war", "sanctions"];

export const gdeltRefresh = action({
  handler: async (): Promise<ConnectorOutcome[]> => {
    // Headlines first: a citable, linkable article is worth more to a reader
    // than another sparkline, so it is what we fight for when throttled.
    const out: ConnectorOutcome[] = [];
    for (const topic of ATTENTION_TOPICS) out.push(await pullGdeltHeadlines(topic));
    for (const topic of ATTENTION_TOPICS) out.push(await pullGdeltAttention(topic));
    return out;
  },
});

/* ------------------------------------------------------------------ */
/* Persistence                                                         */
/* ------------------------------------------------------------------ */

const tally = (out: ConnectorOutcome[]) => ({
  refreshed: out.filter((r) => r.ok).length,
  failed: out.filter((r) => !r.ok).length,
});

/**
 * Refresh entry points, one per upstream.
 *
 * Split deliberately: GDELT throttles to one request every five seconds, so it
 * runs on its own action rather than stretching the macro refresh. Each action
 * also records its own failures, so one dead source never stops the others.
 */
export const refreshMacro = action({
  handler: async (ctx): Promise<{ refreshed: number; failed: number }> => {
    const out: ConnectorOutcome[] = [];
    for (const series of WB_SERIES) out.push(await pullWorldBank(series));
    // The Node runtime has no database handle, so results go through a
    // mutation on the Convex runtime that validates them again on the way in.
    await ctx.runMutation(api.observations.storeObservations, { items: out });
    return tally(out);
  },
});

export const refreshTrade = action({
  handler: async (ctx): Promise<{ refreshed: number; failed: number }> => {
    const out = [await pullComtrade(await latestComtradeYear())];
    await ctx.runMutation(api.observations.storeObservations, { items: out });
    return tally(out);
  },
});

export const refreshAttention = action({
  handler: async (ctx): Promise<{ refreshed: number; failed: number }> => {
    const out: ConnectorOutcome[] = [];
    for (const topic of ATTENTION_TOPICS) out.push(await pullGdeltHeadlines(topic));
    for (const topic of ATTENTION_TOPICS) out.push(await pullGdeltAttention(topic));
    await ctx.runMutation(api.observations.storeObservations, { items: out });
    return tally(out);
  },
});

export type { DataStatus };