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
  /**
   * Shortest gap between two runs when a caller explicitly asked for a refresh.
   *
   * A manual refresh is allowed to ignore the success cooldown, because a
   * reader asking for fresh numbers is a legitimate reason to ask the publisher
   * again. It is not allowed to ignore this floor. Without one, `force: true`
   * meant "always proceed", so an anonymous caller could drive an upstream
   * fetch on every request — the cooldown protected the source from the cron
   * schedule but not from the client, which is the direction the abuse comes
   * from. The floor is set well below a human's refresh cadence and well above
   * an attacker's, so it costs a reader nothing and caps the request rate the
   * endpoint can be made to generate.
   */
  forceFloorMs: number;
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
    // Annual data. A reader has no reason to ask more than once an hour, and
    // World Bank throttles bursts, so this is the tightest bound that costs a
    // human nothing.
    forceFloorMs: 60 * MINUTE,
    backoffBaseMs: 15 * MINUTE,
    maxBackoffMs: 12 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "weekly — annual series, revised without notice",
  },
  comtrade: {
    minIntervalMs: 12 * HOUR,
    forceFloorMs: 60 * MINUTE,
    backoffBaseMs: 30 * MINUTE,
    maxBackoffMs: 24 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "weekly — annual totals, roughly a year in arrears",
  },
  gdelt: {
    minIntervalMs: 20 * MINUTE,
    // The only genuinely moving feed, so the floor is low enough for a reader
    // to re-check it during a live situation — and caps a client at six
    // upstream requests an hour instead of one every two minutes.
    forceFloorMs: 10 * MINUTE,
    backoffBaseMs: 10 * MINUTE,
    maxBackoffMs: 3 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "every 30 minutes — continuously updated, rate-limited",
  },
  ecb: {
    minIntervalMs: 3 * HOUR,
    forceFloorMs: 30 * MINUTE,
    backoffBaseMs: 30 * MINUTE,
    maxBackoffMs: 12 * HOUR,
    maxRunMs: 2 * MINUTE,
    cadence: "every 6 hours — fixed once per business day",
  },
};

export const pollPolicyFor = (sourceId: string): SourcePoll | undefined =>
  POLL[sourceId];
