import { STALE_AFTER_MS, type DataStatus } from "@/lib/sources";

/**
 * How current a reading actually is.
 *
 * The interface is not allowed to call something live when it is not. This maps
 * an age onto one of five labels using each source's own refresh window, so
 * "LIVE" means "inside the window its publisher expects", not "the page just
 * re-rendered". Anything that has never been fetched is UNAVAILABLE, never zero.
 */
export type Freshness = "live" | "recent" | "delayed" | "historical" | "unavailable";

export const FRESHNESS_LABEL: Record<Freshness, string> = {
  live: "LIVE",
  recent: "RECENT",
  delayed: "DELAYED",
  historical: "HISTORICAL",
  unavailable: "UNAVAILABLE",
};

export const FRESHNESS_HELP: Record<Freshness, string> = {
  live: "Fetched inside this source's own refresh window.",
  recent: "Fetched recently, but outside the live window for this source.",
  delayed: "Fetched a while ago. Treat the figure as indicative.",
  historical: "Covers a closed historical period, so it will never be live.",
  unavailable: "No verified reading has ever been fetched for this.",
};

export const FRESHNESS_COLOUR: Record<Freshness, string> = {
  live: "var(--exec-emerald)",
  recent: "var(--exec-cyan)",
  delayed: "var(--exec-amber)",
  historical: "var(--exec-ink-dim)",
  unavailable: "var(--exec-crimson)",
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Age → label.
 *
 * World Bank and Comtrade publish on annual or monthly cycles, so a reading
 * fetched minutes ago still describes a closed historical period. Saying LIVE
 * there would be the exact kind of claim this platform refuses to make.
 */
export function freshnessOf(
  retrievedAt: number | undefined,
  sourceId: string,
): Freshness {
  if (!retrievedAt) return "unavailable";
  const window = STALE_AFTER_MS[sourceId];
  if (!window) return "delayed";
  const age = Date.now() - retrievedAt;

  // Annual and quarterly publishers are never "live", however recent the fetch.
  if (window >= 7 * DAY) {
    return age <= window ? "historical" : "delayed";
  }
  if (age <= window / 4) return "live";
  if (age <= window) return "recent";
  return "delayed";
}

/** UTC clock, because every timestamp in this product is UTC. */
export function utcStamp(ms: number | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds(),
  )} UTC`;
}

export function utcDateTime(ms: number | undefined): string {
  if (!ms) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(
    d.getUTCDate(),
  )} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

/** The freshness implied by a provenance status the server already assigned. */
export function freshnessFromStatus(status: DataStatus): Freshness {
  switch (status) {
    case "observed":
      return "recent";
    case "model":
      return "recent";
    case "scenario":
      return "historical";
    case "stale":
      return "delayed";
    default:
      return "unavailable";
  }
}