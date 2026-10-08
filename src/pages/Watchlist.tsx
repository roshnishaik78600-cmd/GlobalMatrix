import { useMemo } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight, BookmarkCheck, LogIn } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  DataType,
  PageFrame,
  PageLoading,
} from "@/components/viz/exec/design";
import { BasisTag, ExecCard, SectionTitle } from "@/components/viz/exec/system";
import {
  CountryCard,
  type ExecCountry,
} from "@/components/viz/exec/CountryCard";
import { useAuthAction, useToggleWatch } from "@/hooks/use-auth-action";
import { BAND_LABEL, CHANNEL_LABEL, STAGE_LABEL, type Channel } from "@/lib/intel/types";
import { pct } from "@/lib/format";
import { SOURCE_LIST } from "@/lib/sources";
import { LiveSignal } from "@/components/viz/Live";
import { useSourceControl } from "@/hooks/use-verified-data";

/**
 * One external feed, as it stands right now.
 *
 * A component per row rather than a loop in the parent, because each row needs
 * its own subscription and its own controls, and hooks cannot be called from
 * inside a map.
 */
function WatchSourceRow({ sourceId }: { sourceId: string }) {
  const status = useQuery(api.observations.sourceStatus, { sourceId });
  const control = useSourceControl(sourceId);

  if (status === undefined) {
    return <div className="px-4 py-3"><span className="shimmer block h-4 w-2/3" /></div>;
  }
  if (status === null) return null;

  return (
    <div className="px-4 py-3">
      <LiveSignal
        sourceId={sourceId}
        lastVerifiedAt={status.lastVerifiedAt}
        lastAttemptAt={status.lastAttemptAt}
        publishedAt={status.publishedAt}
        problem={status.problem}
        nextAttemptAt={status.nextAttemptAt}
        cadence={status.cadence}
        refreshing={control.refreshing}
        paused={control.paused}
        onRefresh={() => void control.refresh()}
        onTogglePause={() => control.setPaused(!control.paused)}
        skipped={control.skipped}
        retryInMs={control.retryInMs}
      />
    </div>
  );
}

/**
 * The watchlist, aggregated.
 *
 * Everything a reader has bookmarked — events, countries, industries — in one
 * place, read back from the same queries the individual pages write to. No new
 * backend surface: the `watchlist` table already keys entries as bare/`EVENT:`
 * ids, `NODE:` ids and `SECTOR:` ids, and this page simply groups them.
 *
 * Three states matter here and each is explicit: loading (skeleton), signed
 * out (the honest reason nothing is saved), and empty (what to do next).
 */
export default function Watchlist() {
  const events = useQuery(api.intel.detectionFeed, { watchlistOnly: true });
  const directory = useQuery(api.intel.countryDirectory);
  const industries = useQuery(api.intel.industryDirectory);
  const { isAuthenticated, requireAuth } = useAuthAction();
  const toggleWatch = useToggleWatch();

  const watchedEvents = useMemo(() => events?.rows ?? [], [events]);

  const watchedCountries = useMemo<ExecCountry[]>(() => {
    if (!directory) return [];
    return directory.countries
      .filter((c) => c.watched)
      .map((c) => ({
        nodeId: c.nodeId,
        label: c.label,
        short: c.short,
        region: c.region,
        load: c.load,
        fragility: c.fragility,
        eventCount: c.eventCount,
        offAffinityCount: c.offAffinityCount,
        topChannel: c.topChannel as Channel,
        watched: c.watched,
        byChannel: c.byChannel as { channel: Channel; load: number }[],
      }));
  }, [directory]);

  const watchedIndustries = useMemo(
    () => (industries?.industries ?? []).filter((r) => r.watched),
    [industries],
  );

  if (!events || !directory || !industries) {
    return (
      <PageLoading
        eyebrow="Personal"
        title="Watchlist"
        lede="Everything you track — events, countries and industries — in one place."
      />
    );
  }

  const total =
    watchedEvents.length + watchedCountries.length + watchedIndustries.length;

  return (
    <PageFrame
      eyebrow="Personal"
      title="Watchlist"
      lede="What you are tracking. Bookmark an event, country or industry anywhere in GlobalMatrix and it appears here."
      actions={
        <>
          <DataType type="scenario" />
          <span className="glass exec-num px-3 py-2 text-[13px] font-semibold">
            {total} tracked
          </span>
        </>
      }
    >
      {/* Signed out: the reason nothing is saved, and the way to save it. */}
      {!isAuthenticated ? (
        <div className="lg:col-span-12">
          <ExecCard>
            <div className="flex flex-col items-start gap-3 p-5">
              <span className="exec-label text-[var(--exec-cyan)]">
                SIGN IN TO TRACK
              </span>
              <p className="t-card max-w-xl text-[var(--exec-ink)]">
                Your watchlist lives in your account, not in this browser.
              </p>
              <p className="max-w-xl text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                Browsing GlobalMatrix never needs an account — only saving does.
                Sign in and every event, country or industry you bookmark is
                collected here for your next visit.
              </p>
              <button
                type="button"
                onClick={() => requireAuth("Save items to your watchlist")}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--exec-ink)] px-4 py-2.5 text-[13px] font-semibold text-[var(--exec-base)] transition-opacity hover:opacity-90"
              >
                <LogIn className="size-3.5" /> Sign in
              </button>
            </div>
          </ExecCard>
        </div>
      ) : null}

      {/* Signed in and empty: what to do next, with real destinations. */}
      {isAuthenticated && total === 0 ? (
        <div className="lg:col-span-12">
          <ExecCard>
            <div className="flex flex-col items-start gap-3 p-5">
              <span className="exec-label text-[var(--exec-cyan)]">
                NOTHING TRACKED YET
              </span>
              <p className="t-card max-w-xl text-[var(--exec-ink)]">
                Bookmark items anywhere and they will gather here.
              </p>
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/app/events"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
                >
                  Browse events <ArrowUpRight className="size-3.5" />
                </Link>
                <Link
                  to="/app/countries"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
                >
                  Browse countries <ArrowUpRight className="size-3.5" />
                </Link>
                <Link
                  to="/app/industries"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
                >
                  Browse industries <ArrowUpRight className="size-3.5" />
                </Link>
              </div>
            </div>
          </ExecCard>
        </div>
      ) : null}

      {/* Tracked events. */}
      <div className="lg:col-span-7">
        <ExecCard bodyClassName="flex flex-col">
          <SectionTitle
            meta={`${watchedEvents.length} tracked`}
            right={<BasisTag basis="scenario" />}
          >
            Events
          </SectionTitle>
          {watchedEvents.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-[var(--exec-ink-dim)]">
              No events tracked. Use Track on any event page to follow it here.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {watchedEvents.map((row) => (
                <li
                  key={row.id}
                  className="flex min-w-0 items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--exec-surface)]"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/app/event/${row.id}`}
                      className="min-w-0 truncate text-[14px] font-semibold text-[var(--exec-ink)] hover:text-[var(--exec-cyan)]"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-1 truncate text-[13px] text-[var(--exec-ink-dim)]">
                      {row.summary}
                    </p>
                    <p className="exec-label mt-1.5 truncate">
                      {STAGE_LABEL[row.stage]} · {BAND_LABEL[row.band]} risk ·{" "}
                      {CHANNEL_LABEL[row.dominantChannel]}
                      {row.latestSignal
                        ? ` · source ${row.latestSignal.source} (${row.latestSignal.observedAt})`
                        : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Remove event from watchlist"
                      onClick={() => toggleWatch(`EVENT:${row.id}`)}
                      className="flex size-7 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
                    >
                      <BookmarkCheck className="size-4 text-[var(--exec-cyan)]" />
                    </button>
                    <Link
                      to={`/app/event/${row.id}`}
                      aria-label={`Open ${row.title}`}
                      className="flex size-7 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ExecCard>
      </div>

      {/* Tracked industries. */}
      <div className="lg:col-span-5">
        <ExecCard bodyClassName="flex flex-col">
          <SectionTitle
            meta={`${watchedIndustries.length} tracked`}
            right={<BasisTag basis="model" />}
          >
            Industries
          </SectionTitle>
          {watchedIndustries.length === 0 ? (
            <p className="px-4 py-5 text-[13px] text-[var(--exec-ink-dim)]">
              No industries tracked. Bookmark one from the industries board.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {watchedIndustries.map((row) => (
                <li
                  key={row.id}
                  className="flex min-w-0 items-start gap-3 px-4 py-3 transition-colors hover:bg-[var(--exec-surface)]"
                >
                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/app/industry/${row.id}`}
                      className="min-w-0 truncate text-[14px] font-semibold text-[var(--exec-ink)] hover:text-[var(--exec-cyan)]"
                    >
                      {row.label}
                    </Link>
                    <p className="exec-label mt-1.5 truncate">
                      {pct(row.load)} exposure · dominant{" "}
                      {CHANNEL_LABEL[row.topChannel]} · {row.eventCount} events
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      aria-label="Remove industry from watchlist"
                      onClick={() => toggleWatch(`SECTOR:${row.id}`)}
                      className="flex size-7 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
                    >
                      <BookmarkCheck className="size-4 text-[var(--exec-cyan)]" />
                    </button>
                    <Link
                      to={`/app/industry/${row.id}`}
                      aria-label={`Open ${row.label}`}
                      className="flex size-7 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
                    >
                      <ArrowUpRight className="size-4" />
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </ExecCard>
      </div>

      {/* Tracked countries: the full card, because a country is a dashboard. */}
      <div className="lg:col-span-12">
        <SectionTitle
          meta={`${watchedCountries.length} tracked`}
          className="rounded-t-[var(--radius)] border border-[var(--exec-hairline)] bg-[var(--exec-panel)]"
        >
          Countries
        </SectionTitle>
        {watchedCountries.length === 0 ? (
          <div className="rounded-b-[var(--radius)] border border-t-0 border-[var(--exec-hairline)] bg-[var(--exec-panel)]">
            <p className="px-4 py-5 text-[13px] text-[var(--exec-ink-dim)]">
              No countries tracked. Bookmark one from the countries board.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {watchedCountries.map((row, i) => (
              <CountryCard key={row.nodeId} row={row} index={i} />
            ))}
          </div>
        )}
      </div>

      {/* The external feeds behind the tracked world.

          A watchlist that only re-rendered from the scenario corpus would be
          inert: the corpus is versioned in code and never changes at runtime,
          so nothing could ever arrive to update it. These are the connectors
          that DO move, subscribed reactively, so a newly stored verified
          observation lands on this page without a reload — and each line says
          which source it is, when it last verified and whether it is currently
          backed off. */}
      {isAuthenticated ? (
        <div className="lg:col-span-12">
          <ExecCard bodyClassName="flex flex-col">
            <SectionTitle
              meta="live connectors"
              right={<BasisTag basis="observed" />}
            >
              Verified sources behind what you track
            </SectionTitle>
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {SOURCE_LIST.map((source) => (
                <li key={source.id}>
                  <WatchSourceRow sourceId={source.id} />
                </li>
              ))}
            </ul>
            <p className="border-t border-[var(--exec-hairline)] px-4 py-3 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
              Tracked events come from the versioned scenario corpus, not from
              these feeds — no external publisher announces a scenario. These
              rows are the measured data underneath the countries you track:
              they update here as the server stores new verified readings, not
              on a page timer.
            </p>
          </ExecCard>
        </div>
      ) : null}

      {/* The honest label for the whole page: events are scenario corpus. */}
      <p className="lg:col-span-12 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
        Tracking state is stored per account. Event entries follow the scenario
        corpus (SCENARIO basis); country and industry exposure values are MODEL
        OUTPUT derived live from that corpus — see Methodology for how each is
        computed.
      </p>
    </PageFrame>
  );
}
