import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { SOURCE_CLASS_LABEL } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import { flagFor } from "@/lib/flags";
import {
  BasisTag,
  ExecCard,
  FreshnessTag,
  NoDataAvailable,
  SectionTitle,
} from "@/components/viz/exec/system";

/**
 * Discovery surfaces.
 *
 * Three objects that answer the same question from different angles: what is
 * changing, where is it changing hardest, and what does it touch. Every card is
 * a link, every card carries its own provenance, and every card is short enough
 * to scan without reading it.
 */

/* --------------------------------------------------------- What is changing -- */

export interface TimelineEvent {
  id: string;
  /** Place the event lands on hardest. */
  place: string;
  /** ISO date of detection. */
  at: string;
  title: string;
  /** One-line description of the event itself. */
  summary: string;
  /** Regions the event touches, as the corpus records them. */
  regions: string[];
  /** Publisher of the most recent signal supporting this event. */
  source: string;
  sourceClass: keyof typeof SOURCE_CLASS_LABEL;
  /** ISO date of the most recent signal, which is not the detection date. */
  updatedAt: string;
  score: number;
  /** Transmission channel, used as the card's category line. */
  category: string;
  status: string;
}

/** `2026-10-02` to `02 Oct`. Derived from the corpus date, never from the clock. */
export function eventStamp(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Date unavailable";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });
}

/**
 * What is changing, as a horizontal rail of event cards.
 *
 * Seven fields per card and nothing else: channel, place, headline, one line of
 * description, where it reaches, impact and status, with the supporting
 * publisher named at the foot. The homepage's job is to get a reader to the
 * detailed analysis, and every extra word on the card is a word between them and
 * that click. The rail scrolls horizontally and snaps one card at a time,
 * because a discovery row you have to scroll a page to reach is just a list.
 *
 * The word verified is deliberately absent from these cards. Every event here
 * comes from a versioned scenario corpus rather than from a live feed, and a
 * verified badge over a synthetic publisher would be exactly the claim this
 * product refuses to make. The card names the publisher *within the corpus*
 * instead, and the section header carries the SCENARIO basis tag.
 */
export function WhatsChanging({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <ExecCard>
        <SectionTitle meta={CORPUS_LABEL} right={<BasisTag basis="scenario" />}>
          What changed
        </SectionTitle>
        <NoDataAvailable
          title="No events to show"
          reason="The event corpus has not resolved any events for this view. GlobalMatrix does not substitute an illustrative news feed for a real one."
        />
      </ExecCard>
    );
  }

  return (
    <ExecCard>
      <SectionTitle
        meta={`${events.length} events · newest first`}
        right={<BasisTag basis="scenario" />}
      >
        What changed
      </SectionTitle>

      {/* Horizontal rail. `snap-x` so a card always lands flush on mobile, where
          a partial card is the only honest affordance that more exist. */}
      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto p-4">
        {events.map((event, i) => (
          <motion.li
            key={event.id}
            initial={{ opacity: 0, x: 12 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.24) }}
            className="w-[21rem] shrink-0 snap-start"
          >
            <Link
              to={`/app/event/${event.id}`}
              className="card card-hover group flex h-full min-w-0 flex-col gap-3 p-4"
            >
              {/* Channel, place and date, on one line, all metadata. */}
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="exec-label min-w-0 truncate uppercase"
                  style={{ color: riskColorForScore(event.score) }}
                >
                  {event.category}
                </span>
                <span className="exec-label min-w-0 flex-1 truncate text-[var(--exec-ink-dim)]">
                  {event.place}
                </span>
                <span className="exec-num shrink-0 text-[12px] text-[var(--exec-ink-dim)]">
                  {eventStamp(event.at)}
                </span>
              </div>

              <p className="line-clamp-3 text-[14px] leading-snug font-medium text-[var(--exec-ink)]">
                {event.title}
              </p>

              {/* One line of what it is, then where it reaches. The regions line
                  is truncated rather than wrapped so every card in the rail
                  keeps the same height. */}
              <p className="line-clamp-2 text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                {event.summary}
              </p>
              <p className="exec-label min-w-0 truncate text-[var(--exec-ink-dim)]">
                {event.regions.length > 0
                  ? event.regions.join(" · ")
                  : "no region recorded"}
              </p>

              {/* Impact and status on the baseline, so the eye gets a number and
                  a band in the same glance, then the publisher underneath. */}
              <div className="mt-auto border-t border-[var(--exec-hairline)] pt-3">
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-baseline gap-1.5">
                    <span
                      className="exec-num text-[1.5rem] leading-none font-bold tracking-[-0.02em]"
                      style={{ color: riskColorForScore(event.score) }}
                    >
                      {event.score.toFixed(0)}
                    </span>
                    <span className="exec-label">impact</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="exec-label uppercase text-[var(--exec-ink-dim)]">
                      {event.status}
                    </span>
                    <ArrowUpRight
                      className="size-4 text-[var(--exec-ink-dim)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden
                    />
                  </span>
                </div>
                <p className="mt-2 flex min-w-0 items-center gap-2 text-[12px] text-[var(--exec-ink-dim)]">
                  <span className="shrink-0 uppercase">Source</span>
                  <span className="min-w-0 flex-1 truncate" title={event.source}>
                    {event.source}
                  </span>
                  <span className="exec-num shrink-0">
                    {eventStamp(event.updatedAt)}
                  </span>
                </p>
              </div>
            </Link>
          </motion.li>
        ))}
      </ul>
    </ExecCard>
  );
}

/* -------------------------------------------------------- Trending countries -- */

export interface TrendingCountry {
  nodeId: string;
  label: string;
  short: string;
  load: number;
  /** Dominant transmission channel, and the honest "why this is high" answer. */
  topChannel: string;
  eventCount: number;
}

/**
 * Trending countries.
 *
 * Flag, name, exposure and the single driver behind it. The flag is returned
 * only for a sovereign economy — a bloc or a chokepoint gets the node's own
 * glyph treatment instead, because putting a national flag beside the Strait of
 * Hormuz would misdescribe what the node is.
 */
export function TrendingCountries({ rows }: { rows: TrendingCountry[] }) {
  return (
    <ExecCard>
      <SectionTitle meta="ranked by global exposure" right={<BasisTag basis="model" />}>
        Most exposed countries
      </SectionTitle>

      {rows.length === 0 ? (
        <NoDataAvailable
          title="No country exposure resolved"
          reason="Exposure is derived by walking the event corpus to each tracked economy. With no corpus there is nothing to rank, and this panel does not fall back to a static list."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row, i) => {
            const flag = flagFor(row.nodeId);
            return (
              <motion.div
                key={row.nodeId}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.2) }}
                className="min-w-0"
              >
                <Link
                  to={`/app/country/${row.nodeId}`}
                  className="card card-hover flex h-full min-w-0 flex-col gap-3 p-4"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    {flag ? (
                      <span className="text-[24px] leading-none" aria-hidden>
                        {flag}
                      </span>
                    ) : (
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[var(--exec-hairline)] text-[12px] font-semibold text-[var(--exec-ink-dim)]"
                        aria-hidden
                      >
                        {row.short.slice(0, 3)}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--exec-ink)]">
                      {row.label}
                    </span>
                  </div>

                  <div className="flex items-end justify-between gap-3">
                    <span className="flex items-baseline gap-1.5">
                      <span
                        className="exec-num text-[1.75rem] leading-none font-bold tracking-[-0.025em]"
                        style={{ color: "var(--exec-ink)" }}
                      >
                        {(row.load * 100).toFixed(0)}
                      </span>
                      <span className="exec-label">exposure</span>
                    </span>
                    <ExposureBar value={row.load} />
                  </div>

                  <p className="border-t border-[var(--exec-hairline)] pt-3 text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                    Top driver —{" "}
                    <span className="text-[var(--exec-ink)]">
                      {row.topChannel} pressure
                    </span>
                    {row.eventCount > 0
                      ? `, across ${row.eventCount} ${row.eventCount === 1 ? "event" : "events"}.`
                      : ". No event currently exposes this economy."}
                  </p>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </ExecCard>
  );
}

/** A compact exposure meter. The band colour is the risk ramp, not an accent. */
function ExposureBar({ value }: { value: number }) {
  const clamped = Math.min(1, Math.max(0, value));
  return (
    <span className="block h-1.5 w-20 shrink-0 rounded-full bg-[var(--exec-surface)]">
      <span
        className="block h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${Math.max(2, clamped * 100)}%`,
          background: riskColorForScore(clamped * 100),
        }}
      />
    </span>
  );
}

/* ------------------------------------------------------------ Top industries -- */

export interface IndustryTile {
  id: string;
  label: string;
  load: number;
  topChannel: string;
  eventCount: number;
}

/**
 * Top industries.
 *
 * Six tiles, each one exposure and the channel driving it. A tile links to the
 * industry profile, so the tile is a door rather than a dead end.
 */
export function TopIndustries({ rows }: { rows: IndustryTile[] }) {
  const shown = rows.slice(0, 6);
  return (
    <ExecCard>
      <SectionTitle
        meta="structural share × live contribution"
        right={<BasisTag basis="model" />}
      >
        Most exposed industries
      </SectionTitle>

      {shown.length === 0 ? (
        <NoDataAvailable
          title="No industry exposure resolved"
          reason="Industry exposure is derived from the same corpus walk as country exposure. With no corpus there is nothing to rank."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((row, i) => (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.2) }}
              className="min-w-0"
            >
              <Link
                to={`/app/industry/${row.id}`}
                className="card card-hover flex h-full min-w-0 flex-col gap-3 p-4"
              >
                <span className="min-w-0 truncate text-[15px] font-semibold text-[var(--exec-ink)]">
                  {row.label}
                </span>
                <span className="flex items-end justify-between gap-3">
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className="exec-num text-[1.75rem] leading-none font-bold tracking-[-0.025em]"
                      style={{ color: "var(--exec-ink)" }}
                    >
                      {(row.load * 100).toFixed(0)}
                    </span>
                    <span className="exec-label">exposure</span>
                  </span>
                  <ExposureBar value={row.load} />
                </span>
                <p className="border-t border-[var(--exec-hairline)] pt-3 text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                  {row.topChannel} is the dominant channel, across{" "}
                  {row.eventCount} {row.eventCount === 1 ? "event" : "events"}.
                </p>
              </Link>
            </motion.div>
          ))}
        </div>
      )}
    </ExecCard>
  );
}

/** Re-exported so the landing page can show the same freshness chip. */
export { FreshnessTag };