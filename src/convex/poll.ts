/**
 * Poll policy: how often each source may be asked, and how a failing one is
 * backed off.
 *
 * This lives with the ingestion layer rather than with the display types,
 * because it is a statement about what the *publishers* do, and the client is
 * told about it over the wire (`sourceStatus.cadence`) rather than deciding for
 * itself. Three places have to agree on it — the poll governor in
 * `observations.ts`, the server-side schedule in `crons.ts`, and the cadence
 * label the sources board prints — so it is defined exactly once.
 *
 * Every interval is set by what the publisher actually does, not by what would
 * look impressive:
 *
 *   ecb        fixes its reference rates once per TARGET business day at 14:15
 *              CET. Polling that every few seconds would be theatre.
 *   gdelt      genuinely updates continuously and rate-limits hard from shared
 *              addresses. It is the only source here that can honestly move
 *              within a session, and it is still only asked every 30 minutes.
 *   worldbank  publishes annual national accounts, revised without notice.
 *   comtrade   publishes annual merchandise totals roughly a year in arrears.
 *
 * `minIntervalMs` is always shorter than the cron period, so the schedule is
 * never blocked by its own cooldown. `backoffBaseMs` doubling on each
 * consecutive failure is what a struggling source actually experiences: it is
 * asked less and less often, but never stops being asked.
 */
export interface SourcePoll {
  /** Shortest gap between two runs of this source, after a success. */
  minIntervalMs: number;
  /** First retry delay after a failure; doubles each consecutive failure. */
  backoffBaseMs: number;
  /** Ceiling on that backoff, so a broken source is still retried eventually. */
  maxBackoffMs: number;
  /** A claim older than this is treated as a dead run and may be reclaimed. */
  maxRunMs: number;
  /** Plain-language cadence, printed on the sources board. */
  cadence: string;
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

export const POLL: Record<string, SourcePoll> = {
  worldbank: {
    minIntervalMs: 6 * HOUR,
    backoffBaseMs: 15 * MINUTE,
    maxBackoffMs: 12 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "weekly — annual series, revised without notice",
  },
  comtrade: {
    minIntervalMs: 12 * HOUR,
    backoffBaseMs: 30 * MINUTE,
    maxBackoffMs: 24 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "weekly — annual totals, roughly a year in arrears",
  },
  gdelt: {
    minIntervalMs: 20 * MINUTE,
    backoffBaseMs: 10 * MINUTE,
    maxBackoffMs: 3 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "every 30 minutes — continuously updated, rate-limited",
  },
  ecb: {
    minIntervalMs: 3 * HOUR,
    backoffBaseMs: 30 * MINUTE,
    maxBackoffMs: 12 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "every 6 hours — fixed once per business day",
  },
};

export const pollPolicyFor = (sourceId: string): SourcePoll | undefined =>
  POLL[sourceId];
