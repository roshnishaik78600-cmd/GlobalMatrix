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