import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

/**
 * Server-side ingestion schedule.
 *
 * This is the piece that makes the platform continuously refreshed rather than
 * refreshed-when-someone-is-looking: before this existed, a connector only ever
 * ran because a browser asked it to, so a source nobody had open simply stopped
 * updating, and simultaneous visitors each fired their own request at the
 * publisher.
 *
 * Four jobs, four cadences, each chosen from what the publisher actually does.
 * There is no "every few seconds" job here on purpose — two of the four sources
 * publish annually, and polling an annual dataset continuously would be a lie
 * told with a timer:
 *
 *   ecb        6 hours. The Bank fixes reference rates once per TARGET business
 *              day; a 6-hour period guarantees the day's fixing is picked up
 *              without asking for something that cannot have changed.
 *   gdelt      30 minutes. Genuinely continuously updated, and the only source
 *              that can honestly move within a session. It is also the one that
 *              rate-limits hardest, which is why it is 30 minutes rather than
 *              the 8-second floor its API documents.
 *   worldbank  weekly. Annual national accounts, revised without notice.
 *   comtrade   weekly, offset from World Bank so the two never start together.
 *              Annual merchandise totals, published roughly a year in arrears.
 *
 * Two properties keep this from being an uncontrolled loop:
 *
 *  1. Every job calls the same guarded action the UI calls. The governor in
 *     `observations.ts` refuses a run that is already in flight or still inside
 *     its cooldown, so a cron tick that lands on top of a human refresh is a
 *     no-op rather than a second request.
 *  2. A failing source is backed off exponentially (10 minutes doubling to 3
 *     hours for GDELT, 15 minutes to 12 hours for the annual feeds). A source
 *     that is down is therefore polled a handful of times a day, not 48.
 *
 * The schedule periods are deliberately longer than the matching
 * `minIntervalMs` in `convex/poll.ts`, so a tick is never refused by its own
 * cooldown. If you change one, change the other.
 */
const crons = cronJobs();

crons.interval(
  "refresh ecb reference rates",
  { hours: 6 },
  api.sources.refreshEcb,
  {},
);

crons.interval(
  "refresh gdelt coverage",
  { minutes: 30 },
  api.sources.refreshAttention,
  {},
);

crons.interval(
  "refresh world bank indicators",
  { hours: 168 },
  api.sources.refreshMacro,
  {},
);

crons.interval(
  "refresh un comtrade totals",
  { hours: 172 },
  api.sources.refreshTrade,
  {},
);

export default crons;
