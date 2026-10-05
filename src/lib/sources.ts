/**
 * Verified data-source registry and provenance types.
 *
 * Rule for this file and everything downstream of it: a number may only reach
 * the screen attached to the source it came from, the moment it was retrieved,
 * and an honest label for what kind of number it is. If a source cannot be
 * reached or cannot be parsed, the reading is dropped — it is never replaced by
 * a plausible-looking stand-in.
 */

/** What kind of thing a displayed figure actually is. */
export type DataStatus =
  /** Pulled verbatim from a named external source. */
  | "observed"
  /** Computed by us from observed inputs under a published formula. */
  | "model"
  /** A perturbation of the corpus the user asked us to explore. */
  | "scenario"
  /** Was observed once, but is past its refresh window. */
  | "stale"
  /** No verified reading available. Never render a stand-in for this. */
  | "unavailable";

export interface SourceDef {
  id: string;
  /** Short name for chips and tooltips. */
  label: string;
  /** Who actually publishes it. */
  publisher: string;
  /** Canonical human-readable page for the dataset. */
  url: string;
  /** What this source is legitimately evidence of. */
  covers: string;
  /** What it is NOT evidence of — the guard against over-reading. */
  limits: string;
  /** The grain and unit of the data, so a reader knows what one row means. */
  dataType: string;
  /** True when the source needs no credential, so absence means outage not setup. */
  keyless: boolean;
}

export const SOURCES = {
  worldbank: {
    id: "worldbank",
    label: "World Bank Open Data",
    publisher: "The World Bank Group",
    url: "https://data.worldbank.org",
    covers:
      "Annual national accounts and development indicators, as reported by member economies.",
    limits:
      "Annual and lagging — the most recent year is often a partial estimate, and revisions land without notice.",
    dataType: "Annual national indicators, 5 series × 18 economies",
    keyless: true,
  },
  comtrade: {
    id: "comtrade",
    label: "UN Comtrade",
    publisher: "United Nations Statistics Division",
    url: "https://comtradeplus.un.org",
    covers: "Reported bilateral merchandise trade values by reporter, partner and commodity.",
    limits:
      "The public preview tier is sampled and abbreviated. Mirrored flows do not sum to world totals.",
    dataType: "Annual merchandise trade totals, US$, 10 reporters",
    keyless: true,
  },
  gdelt: {
    id: "gdelt",
    label: "GDELT Project",
    publisher: "George Mason University",
    url: "https://www.gdeltproject.org",
    covers:
      "Volume and tone of global news coverage, derived from a continuously monitored global media index.",
    limits:
      "Measures media attention only. Coverage volume is NOT evidence that an event occurred, nor how severe it is.",
    dataType: "7-day coverage volume (share %) and article headlines",
    keyless: true,
  },
  ecb: {
    id: "ecb",
    label: "ECB reference rates",
    publisher: "European Central Bank",
    url: "https://data.ecb.europa.eu",
    covers:
      "Daily euro foreign-exchange reference rates and the euro area government bond yield curve, fixed by the ECB at 14:15 CET on every TARGET business day.",
    limits:
      "Euro-denominated and reference-only: these are not executable quotes, and the curve covers the euro area rather than US or Asian rates. The Bank suspended its Russian rouble reference rate in March 2022, so no rouble reading is tracked here.",
    dataType: "Daily FX reference rates (9 pairs) and euro area spot yields",
    keyless: true,
  },
} as const satisfies Record<string, SourceDef>;

export type SourceId = keyof typeof SOURCES;

export const SOURCE_LIST: SourceDef[] = Object.values(SOURCES);

/**
 * Everything the UI needs to answer "where did this come from and when?".
 */
export interface Provenance {
  sourceId: string;
  /** ISO-ish period the reading describes, e.g. "2023" or "2024-06". */
  asOf: string;
  /** Epoch ms at which we fetched it. */
  retrievedAt: number;
  status: DataStatus;
  /** Source-side caveat worth surfacing next to the number. */
  note?: string;
}

export const STATUS_LABEL: Record<DataStatus, string> = {
  observed: "Observed",
  model: "Model output",
  scenario: "Scenario",
  stale: "Stale",
  unavailable: "No verified data",
};

export const STATUS_HELP: Record<DataStatus, string> = {
  observed: "Reported by the named source.",
  model: "Computed here from observed inputs using a published formula.",
  scenario: "A hypothetical change. Nothing here has happened.",
  stale: "Retrieved earlier than the refresh window. Treat as indicative.",
  unavailable: "No verified reading available.",
};

/**
 * A single reading plus the provenance that makes it auditable.
 */
export interface Datum<T = number> {
  key: string;
  label: string;
  value: T;
  unit?: string;
  /** Reference period for the value itself, when it differs from `asOf`. */
  period?: string;
  provenance: Provenance;
}

/**
 * Shape every connector returns. On failure the readings array is empty and
 * `provenance.status` is "unavailable" — there is deliberately no partial
 * success that silently drops the provenance.
 */
export interface SourceResult<T> {
  provenance: Provenance;
  readings: T[];
  /** Safe to show a human. Never contains a stack trace or upstream body. */
  problem?: string;
}

export const unavailable = (problem: string): SourceResult<never> => ({
  provenance: { sourceId: "none", asOf: "", retrievedAt: Date.now(), status: "unavailable" },
  readings: [],
  problem,
});

/** Age at which a cached reading stops counting as current, per source. */
export const STALE_AFTER_MS: Record<string, number> = {
  worldbank: 1000 * 60 * 60 * 24 * 7,
  comtrade: 1000 * 60 * 60 * 24 * 14,
  gdelt: 1000 * 60 * 60 * 6,
  // Wide on purpose. The ECB publishes on TARGET business days only, so a
  // Friday afternoon fetch is still current on the following Monday. Four days
  // covers a long weekend plus a settlement slip without ever calling a stale
  // rate LIVE.
  ecb: 1000 * 60 * 60 * 24 * 4,
};

/**
 * Downgrade a provenance record once its cached copy ages out. A stale number
 * is still real data, so it stays on screen — but it stops claiming to be
 * current.
 */
export function withStaleness(p: Provenance): Provenance {
  const window = STALE_AFTER_MS[p.sourceId];
  if (!window) return p;
  if (p.status !== "observed") return p;
  return Date.now() - p.retrievedAt > window
    ? { ...p, status: "stale", note: "Past its refresh window." }
    : p;
}

export function sourceById(id: string): SourceDef | undefined {
  return (SOURCE_LIST as SourceDef[]).find((s) => s.id === id);
}

/**
 * Render a source's `asOf` as something a reader can place in time.
 *
 * Sources disagree on format: World Bank publishes a bare date, Comtrade a bare
 * year, GDELT a compact UTC stamp (`20261002T080000Z`). Showing those verbatim
 * puts a raw API token on screen, so they are normalised here. Anything we
 * cannot parse returns an empty string — the caller then shows the source's
 * status without inventing a date.
 */
export function formatAsOf(asOf: string): string {
  const raw = asOf.trim();
  if (!raw) return "";
  // GDELT compact stamp: YYYYMMDDTHHMMSSZ
  const compact = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(raw);
  if (compact) {
    const [, y, m, d, hh, mm] = compact;
    return `${y}-${m}-${d} ${hh}:${mm} UTC`;
  }
  // ISO date or full ISO timestamp.
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(raw);
  if (iso) {
    const [, y, m, d, hh, mm] = iso;
    return hh ? `${y}-${m}-${d} ${hh}:${mm} UTC` : `${y}-${m}-${d}`;
  }
  // A bare year, as Comtrade reports.
  if (/^\d{4}$/.test(raw)) return raw;
  return "";
}