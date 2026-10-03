import { Link } from "react-router";
import { ArrowUpRight, Radar } from "lucide-react";
import { SOURCE_CLASS_LABEL } from "@/lib/intel/types";
import { freshnessOf, type Freshness } from "@/lib/freshness";
import { SOURCE_LIST } from "@/lib/sources";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import {
  BasisTag,
  ExecCard,
  FreshnessTag,
  NoDataAvailable,
  SectionTitle,
} from "@/components/viz/exec/system";

/**
 * "What's happening now" — a timeline, not a feed of essays.
 *
 * Four fields per event and nothing else: where, when, what, and who reported
 * it. The homepage's job is to get a reader to the detailed analysis, and every
 * extra word on the card is a word between them and that click.
 */

export interface TimelineEvent {
  id: string;
  /** Place the event lands on hardest. */
  place: string;
  /** ISO date of detection. */
  at: string;
  title: string;
  /** Publisher of the most recent signal supporting this event. */
  source: string;
  sourceClass: keyof typeof SOURCE_CLASS_LABEL;
  score: number;
}

/** `2026-10-02` → `02 OCT`. Derived from the corpus date, never from the clock. */
export function eventStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const month = d
    .toLocaleString("en-GB", { month: "short", timeZone: "UTC" })
    .toUpperCase();
  return `${String(d.getUTCDate()).padStart(2, "0")} ${month}`;
}

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ExecCard>
      <SectionTitle
        meta={
          events.length > 0
            ? `${events.length} events · newest first · ${CORPUS_NOTE}`
            : CORPUS_NOTE
        }
        right={<BasisTag basis="scenario" />}
      >
        What's happening now
      </SectionTitle>
      {events.length === 0 ? (
        <NoDataAvailable
          title="No events to place on the timeline"
          reason="The event corpus has not resolved any events for this view. GlobalMatrix does not substitute an illustrative news feed for a real one."
        />
      ) : (
        <>
          {/* Vertical rail. Each entry is a link, so the whole row is the hit
              target rather than a small arrow in the corner. */}
          <ol className="relative">
            {events.map((event) => (
              <li key={event.id} className="relative">
                <Link
                  to={`/app/event/${event.id}`}
                  className="group grid grid-cols-[auto_auto_minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-1 border-b border-[var(--exec-hairline)] px-3 py-2.5 transition-colors last:border-b-0 hover:bg-[var(--exec-surface-strong)]"
                >
                  {/* Rail marker. The dot is the timeline; the line is drawn by
                      the li's own border so it cannot drift out of alignment. */}
                  <span className="flex h-full w-2 shrink-0 flex-col items-center self-stretch">
                    <span
                      className="mt-1.5 size-1.5 shrink-0 rounded-full"
                      style={{ background: "var(--exec-crimson)" }}
                      aria-hidden
                    />
                  </span>

                  <span className="exec-num shrink-0 text-[10px] text-[var(--exec-ink-dim)]">
                    {eventStamp(event.at)}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] font-medium text-[var(--exec-ink)]">
                      {event.title}
                    </span>
                    <span className="exec-num mt-0.5 block truncate text-[9.5px] text-[var(--exec-ink-dim)]">
                      {event.place} · {event.source} ·{" "}
                      {SOURCE_CLASS_LABEL[event.sourceClass]}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <span className="exec-num text-[11px] font-semibold text-[var(--exec-ink)]">
                      {event.score.toFixed(0)}
                    </span>
                    <ArrowUpRight
                      className="size-3 text-[var(--exec-ink-dim)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </>
      )}
    </ExecCard>
  );
}

/* ------------------------------------------------------------ Trust + data -- */

export interface SourceHealthRow {
  sourceId: string;
  ok: boolean;
  retrievedAt: number;
  asOf: string;
  problem?: string;
}

/**
 * Trust as a readout, not a paragraph.
 *
 * Every connector this build has, its last successful fetch and how current that
 * makes it. When a source has never answered, the row stays in place and says
 * so — a gap in the register is more reassuring than a gap in the data, because
 * it is the one thing a reader can check.
 */
export function TrustStrip({ health }: { health: SourceHealthRow[] }) {
  const connected = new Set(
    health.filter((h) => h.ok).map((h) => h.sourceId),
  );
  // Newest *successful* fetch, so "last updated" is a real observation rather
  // than the moment this component happened to render — and rather than the
  // timestamp of an attempt that returned an error. A failed connector that
  // retries last must never be able to date the whole board.
  const latest = health.reduce<number | undefined>((best, h) => {
    if (!h.ok || !h.retrievedAt) return best;
    return best === undefined || h.retrievedAt > best ? h.retrievedAt : best;
  }, undefined);

  // Data status is the *worst* freshness among the sources that did answer,
  // not the best. Quoting the freshest source would misrepresent a board whose
  // other half is a week old.
  const status: Freshness = !connected.size
    ? "unavailable"
    : connected.size === SOURCE_LIST.length
      ? worstFreshness(health)
      : "delayed";
  const reporting = health.filter((h) => h.ok).length;

  return (
    <ExecCard>
      <SectionTitle meta="every connector this build has">
        Data &amp; sources
      </SectionTitle>

      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--exec-hairline)] px-3 py-2.5">
        {SOURCE_LIST.map((source) => (
          <a
            key={source.id}
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            title={`${source.publisher} — ${source.covers}`}
            className="glass flex items-center gap-1.5 px-2 py-1 transition-colors hover:border-[var(--exec-hairline-strong)]"
          >
            <span
              className="size-1.5 shrink-0 rounded-full"
              style={{
                background: connected.has(source.id)
                  ? "var(--exec-emerald)"
                  : "var(--exec-ink-dim)",
              }}
              aria-hidden
            />
            <span className="exec-label whitespace-nowrap text-[var(--exec-ink)]">
              {BADGE[source.id] ?? source.label}
            </span>
          </a>
        ))}
      </div>

      {/* The three fields a reader is owed: where it came from, when we pulled
          it, and how current that makes it. */}
      <dl className="grid grid-cols-1 sm:grid-cols-3">
        <div className="min-w-0 border-b border-[var(--exec-hairline)] px-3 py-2 sm:border-r sm:border-b-0">
          <dt className="exec-label">Source</dt>
          <dd className="exec-num mt-1 truncate text-[11px] text-[var(--exec-ink)]">
            {reporting} of {SOURCE_LIST.length} reporting
          </dd>
        </div>
        <div className="min-w-0 border-b border-[var(--exec-hairline)] px-3 py-2 sm:border-r sm:border-b-0">
          <dt className="exec-label">Last updated</dt>
          <dd className="exec-num mt-1 truncate text-[11px] text-[var(--exec-ink)]">
            {latest
              ? `${new Date(latest).toISOString().slice(0, 16).replace("T", " ")} UTC`
              : "No verified data available."}
          </dd>
        </div>
        <div className="min-w-0 px-3 py-2">
          <dt className="exec-label">Data status</dt>
          <dd className="mt-1 flex h-[15px] items-center">
            <FreshnessTag freshness={status} />
          </dd>
        </div>
      </dl>

      {health.length > 0 ? (
        <ul className="border-t border-[var(--exec-hairline)]">
          {health.map((h) => (
            <li
              key={h.sourceId}
              className="flex items-center justify-between gap-3 border-b border-[var(--exec-hairline)] px-3 py-1.5 last:border-b-0"
            >
              <span className="exec-label min-w-0 truncate text-[var(--exec-ink)]">
                {h.sourceId}
              </span>
              <span className="exec-num min-w-0 truncate text-[9.5px] text-[var(--exec-ink-dim)]">
                {h.asOf ? `as of ${h.asOf}` : h.problem ?? "no reading"}
              </span>
              <FreshnessTag
                freshness={h.ok ? freshnessOf(h.retrievedAt, h.sourceId) : "unavailable"}
                className="shrink-0"
              />
            </li>
          ))}
        </ul>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--exec-hairline)] px-3 py-2">
        <Link
          to="/app/data"
          className="exec-label inline-flex items-center gap-1 border border-[var(--exec-hairline)] px-2 py-1 transition-colors hover:border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)] hover:text-[var(--exec-ink)]"
        >
          Source register <ArrowUpRight className="size-3" />
        </Link>
        <span className="exec-label ml-auto flex items-center gap-1">
          <Radar className="size-3" aria-hidden />
          Figures labelled observed, modelled or scenario
        </span>
      </div>
    </ExecCard>
  );
}

const BADGE: Record<string, string> = {
  worldbank: "World Bank",
  comtrade: "UN Comtrade",
  gdelt: "GDELT",
};

// Referenced, not retyped: a corpus version bump has to move every surface
// that names it, so the string lives in exactly one place.
const CORPUS_NOTE = CORPUS_LABEL;

/**
 * The weakest freshness among the sources that reported.
 *
 * Ordered so a single lagging source is enough to move the summary, which is
 * the point: a board that quotes one fresh feed and hides three stale ones is
 * the failure mode this label exists to prevent.
 */
const SEVERITY: Freshness[] = ["unavailable", "delayed", "historical", "recent", "live"];

function worstFreshness(health: SourceHealthRow[]): Freshness {
  let worst: Freshness = "live";
  for (const h of health) {
    if (!h.ok) continue;
    const f = freshnessOf(h.retrievedAt, h.sourceId);
    if (SEVERITY.indexOf(f) < SEVERITY.indexOf(worst)) worst = f;
  }
  return worst;
}
