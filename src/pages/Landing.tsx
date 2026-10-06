import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Factory, Globe2, Landmark, Network, Package, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { TopologyResult } from "@/convex/macroTopology";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import {
  BAND_LABEL,
  CHANNEL_LABEL,
  STAGE_LABEL,
  type Channel,
  type RiskBand,
  type Stage,
} from "@/lib/intel/types";
import { pct } from "@/lib/format";
import { SOURCES } from "@/lib/sources";
import { WorldMap, isPlottable } from "@/components/viz/WorldMap";
import { Skeleton } from "@/components/viz/core";
import { CountryDrawer } from "@/components/viz/exec/CountryDrawer";
import { useFocus } from "@/lib/focus";
import { ExecPage, FreshnessTag } from "@/components/viz/exec/system";
import { freshnessOf, relativeAge } from "@/lib/freshness";
import { loadColour } from "@/components/viz/exec/Topology";
import {
  BarPreview,
  ExploreGrid,
  FollowTheShock,
  GlobalPulse,
  SplitPreview,
  UnavailablePreview,
  type ExplorePanel,
} from "@/components/landing/sections";
import {
  WhatsChanging,
  TopIndustries,
  TrendingCountries,
  type TimelineEvent,
} from "@/components/landing/discovery";

/**
 * The public homepage.
 *
 * Show, then explain, then explore. The order is the argument: a headline, the
 * six numbers that summarise the world right now, the events behind them, the
 * map they land on, the mechanism that carries them, and finally the two
 * directories — countries and industries — that let a reader pick one and go
 * deep. Every section answers in under five seconds; the long form lives on the
 * pages each card links to.
 *
 * No login stands between a visitor and any of it. The console behind /app is
 * equally public; an account is only ever needed to save something.
 */
export default function Landing() {
  const data = useQuery(api.intel.overview);
  const feed = useQuery(api.intel.detectionFeed, {});
  const topology = useQuery(api.macroTopology.macroTopology) as
    | TopologyResult
    | undefined;

  // Client-side navigation, so inspecting a country on the map does not throw
  // away the SPA and the shared selection along with it.
  const navigate = useNavigate();

  // The map's selection is the shared console selection, so a country picked
  // here is still selected after crossing into /app. Landing is mounted inside
  // FocusProvider like every other route.
  const { focus, setFocus } = useFocus();
  const sharedNodeId = focus?.kind === "node" ? focus.id : null;

  // The reverse must not happen: the shared focus outlives the route, so a
  // country chosen inside the console would otherwise leave the marketing page
  // with a country drawer already covering it. The map is highlighted from the
  // shared selection, but the drawer is gated on what was picked on this page.
  const [pickedHere, setPickedHere] = useState<string | null>(null);
  const selectNode = (id: string) => {
    setPickedHere(id);
    setFocus({ kind: "node", id });
  };
  const nodeId = pickedHere;

  // The map can only draw a node that has coordinates, so the count beside it
  // has to be the count of drawable nodes. Institutions such as SWIFT and the
  // institutional-portfolio node carry no location and are dropped by the map
  // before they reach the screen; counting them would put a number on the page
  // that a reader cannot match against the picture.
  const mappable = useMemo(
    () => (data?.mapNodes ?? []).filter((n) => isPlottable(n.nodeId)),
    [data],
  );

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!feed) return [];
    return [...feed.rows]
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
      .slice(0, 10)
      .map((row) => ({
        id: row.id,
        place: row.topNodes[0]?.label ?? "no dominant location",
        at: row.detectedAt,
        title: row.title,
        summary: row.summary,
        regions: row.regions,
        source: row.latestSignal?.source ?? CORPUS_LABEL,
        sourceClass: row.latestSignal?.sourceClass ?? "intel",
        // The newest signal, not the detection date: a corpus can detect an
        // event on one day and see it corroborated weeks later, and a card that
        // showed only the first would go stale while the evidence grows.
        updatedAt: row.latestSignal?.observedAt ?? row.detectedAt,
        score: row.score30,
        category: CHANNEL_LABEL[row.dominantChannel],
        status: row.band,
      }));
  }, [feed]);

  const panels = useMemo<ExplorePanel[]>(() => {
    const hot = (data?.hottestCountries ?? []).map((r) => ({
      label: r.short,
      value: r.load,
    }));
    const supply = (data?.supplyPressure ?? []).map((r) => ({
      label: r.short,
      value: r.load,
    }));
    const industry = (data?.hottestIndustries ?? []).map((r) => ({
      label: r.label,
      value: r.load,
    }));

    const financial = topology?.categories.find((c) => c.id === "financial");
    const trade = topology?.categories.find((c) => c.id === "trade-bottlenecks");

    return [
      {
        to: "/app/countries",
        label: "Countries",
        icon: Globe2,
        blurb: "Exposure, dependencies and the events that land hardest on each economy.",
        preview: <BarPreview rows={hot} />,
      },
      {
        to: "/app/companies",
        label: "Companies",
        icon: Factory,
        blurb: "Explore business exposure and dependencies.",
        preview: <UnavailablePreview />,
        unavailable: "No company filings are connected, so this is empty by design.",
      },
      {
        to: "/app/trade",
        label: "Trade",
        icon: Package,
        blurb: "Reported merchandise values, UN Comtrade.",
        preview: trade ? (
          <SplitPreview
            left={{
              label: "Bottleneck idx",
              value: (trade.intensity * 100).toFixed(0),
              tone: loadColour(trade.intensity),
            }}
            right={{
              label: "Reporters",
              value: String(
                (data?.mapNodes ?? []).filter((n) => n.kind === "economy").length,
              ),
            }}
          />
        ) : (
          <UnavailablePreview />
        ),
      },
      {
        to: "/app/supply",
        label: "Supply chains",
        icon: Network,
        blurb: "Critical routes and the pressure moving through them.",
        // Routes first, sectors second: the corridor board is the primary
        // object on that page, with sector concentration as its context.
        preview:
          supply.length > 0 ? (
            <BarPreview rows={supply} />
          ) : (
            <BarPreview rows={industry} />
          ),
      },
      {
        to: "/app/markets",
        label: "Markets",
        icon: TrendingUp,
        blurb: "Reported macro context across every tracked economy.",
        preview: financial ? (
          <SplitPreview
            left={{
              label: "Finance idx",
              value: (financial.intensity * 100).toFixed(0),
              tone: loadColour(financial.intensity),
            }}
            right={{ label: "Trend", value: TREND_LABEL[financial.trend] }}
          />
        ) : (
          <UnavailablePreview />
        ),
        unavailable:
          "No price feed is connected. This shows modelled finance pressure, not quotes.",
      },
      {
        to: "/app/policy",
        label: "Policy",
        icon: Landmark,
        blurb: "Policy and regulatory change.",
        preview: <UnavailablePreview />,
        unavailable:
          "No policy registry is connected. Policy events are tagged in the corpus.",
      },
    ];
  }, [data, topology]);

  const mapEvents = (data?.mapEvents ?? []).filter((e) => e.nodeId !== "");

  return (
    <ExecPage className="min-h-full">
      <LandingNav />

      {/* Hero. Compact on purpose: the map is the headline, and a wall of type
          above it would push the one thing worth seeing below the fold. The
          world sits behind the type at low opacity on wide screens and below it
          on narrow ones, rather than beside it — beside it would halve the width
          of both. */}
      <header className="relative overflow-hidden border-b border-[var(--exec-hairline)]">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[420px] opacity-30 lg:h-full"
        >
          {data ? (
            <WorldMap
              nodes={data.mapNodes}
              flows={data.flows.slice(0, 40)}
              events={mapEvents}
              className="h-[300px] sm:h-[380px] lg:h-full"
              layers={false}
            />
          ) : null}
          {/* Fade the map into the page rather than ending it at a hard edge. */}
          <div className="absolute inset-0 bg-gradient-to-b from-[var(--exec-base)]/40 via-[var(--exec-base)]/80 to-[var(--exec-base)]" />
        </div>

        <div className="gm-width relative px-4 pt-16 pb-14 lg:px-8 lg:pt-24 lg:pb-20">
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="exec-label text-[var(--exec-cyan)]"
          >
            Global event intelligence
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.05 }}
            className="t-hero mt-4 text-[var(--exec-ink)]"
          >
            GLOBALMATRIX
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mt-5 max-w-2xl text-[1.25rem] leading-snug font-medium tracking-[-0.015em] text-[var(--exec-ink)] sm:text-[1.5rem]"
          >
            See what changed. Trace the impact.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--exec-ink-dim)]"
          >
            Global geopolitical and supply-chain exposure intelligence that
            connects events to the countries, flows, infrastructure, industries
            and companies they affect.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-7 flex flex-wrap gap-3"
          >
            <Link
              to="/app"
              className="inline-flex items-center gap-2 rounded-full bg-[var(--exec-cyan)] px-5 py-3 text-[14px] font-semibold text-[#070A0F] transition-opacity hover:opacity-90"
            >
              Explore Global Intelligence
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#world-map"
              className="inline-flex items-center gap-2 rounded-full border border-[var(--exec-hairline-strong)] px-5 py-3 text-[14px] font-semibold text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
            >
              View Impact Map
            </a>
          </motion.div>

          {/* The four numbers, and the freshness of the layer behind them.
              Kept flat and compact: this is a status readout, not a card
              grid, so it sits under the call to action rather than competing
              with the map for the first viewport. */}
          <HeroStats regions={mappable.length} links={data?.flows.length ?? 0} />
        </div>
      </header>

      <main className="min-w-0">
        <div className="gm-width flex flex-col gap-6 px-4 py-10 lg:gap-8 lg:px-8 lg:py-12">
          {/* GLOBAL PULSE — the six numbers that summarise the world. */}
          <GlobalPulse data={topology} />

          {/* HAPPENING NOW — the events behind those numbers. */}
          {feed ? <WhatsChanging events={timeline} /> : <PulseSkeleton />}

          {/* THE MAP. A major visual section, not a supporting one: it is the
              largest single object on the page and everything else is sized
              around it. */}
          <section id="world-map" className="card scroll-mt-24 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
              <h2 className="t-card text-[var(--exec-ink)]">World map</h2>
              <span className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
                {data
                  ? `${mappable.length} places · ${mapEvents.length} events · ${data.flows.length} couplings`
                  : "resolving"}
                {" · "}
                <FreshnessTag freshness="historical" />
              </span>
            </div>

            {data ? (
              <>
                <WorldMap
                  nodes={data.mapNodes}
                  flows={data.flows}
                  events={mapEvents}
                  className="map-frame"
                  selected={sharedNodeId}
                  onSelect={selectNode}
                  onInspect={(id) => {
                    navigate(`/app/country/${id}`);
                  }}
                />
                <MapLegend />
              </>
            ) : (
              <Skeleton className="map-frame w-full" />
            )}
          </section>

          {/* FOLLOW THE SHOCK — the mechanism, drawn rather than asserted. */}
          <FollowTheShock events={feed?.rows ?? []} />

          {/* TRENDING COUNTRIES — pick one and go deep. */}
          <TrendingCountries
            rows={(data?.hottestCountries ?? []).map((r) => ({
              nodeId: r.nodeId,
              label: r.label,
              short: r.short,
              load: r.load,
              topChannel: CHANNEL_LABEL[r.topChannel],
              eventCount: r.eventCount,
            }))}
          />

          {/* TOP INDUSTRIES — the same question asked of sectors. */}
          <TopIndustries
            rows={(data?.hottestIndustries ?? []).map((r) => ({
              id: r.id,
              label: r.label,
              load: r.load,
              topChannel: CHANNEL_LABEL[r.topChannel],
              eventCount: r.eventCount,
            }))}
          />

          {/* WHAT TO WATCH — the earliest-stage events, ranked by their own
              composite. Stage and channel are corpus facts; the section claims
              nothing about the future beyond the horizons the analysis shows. */}
          <WhatToWatch
            rows={(feed?.rows ?? [])
              .filter((r) => r.stage === "emerging" || r.stage === "escalating")
              .sort((a, b) => b.score30 - a.score30)
              .slice(0, 4)}
          />

          {/* DATA & EVIDENCE — what every picture above is built from, with
              each connector's own freshness, stated on the page that uses it. */}
          <DataAndEvidence />

          {/* EXPLORE — the six panels, each previewed from the board it opens. */}
          <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="t-section text-[var(--exec-ink)]">Explore</h2>
              <span className="exec-label">six ways in</span>
            </div>
            <ExploreGrid panels={panels} />
          </section>

          <AccessBand />
        </div>
      </main>

      <footer className="border-t border-[var(--exec-hairline)]">
        <div className="gm-width flex flex-wrap items-center justify-between gap-3 px-4 py-6 lg:px-8">
          <span className="exec-label text-[var(--exec-ink-dim)]">
            GlobalMatrix · geopolitical, macro and supply-chain intelligence
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/methodology"
              className="exec-label text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
            >
              Methodology
            </Link>
            <Link
              to="/app/data"
              className="exec-label text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
            >
              Sources
            </Link>
            <span className="exec-label text-[var(--exec-ink-dim)]">
              {CORPUS_LABEL}
            </span>
          </div>
        </div>
      </footer>

      {/* Countries carry their full ten-module board here too, so a click on the
          homepage map opens the same intelligence a reader would get inside. */}
      {nodeId ? <CountryDrawer nodeId={nodeId} /> : null}
    </ExecPage>
  );
}

/* ------------------------------------------------------------------ parts -- */

/**
 * `TopologyCategory.trend` is a direction, not a series, so it is labelled with
 * the same three words the pulse uses rather than printed raw.
 */
const TREND_LABEL: Record<TopologyResult["categories"][number]["trend"], string> = {
  rising: "rising",
  falling: "falling",
  flat: "steady",
};

/** The public header. Deliberately lighter than the console's own bar. */
function LandingNav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-[var(--exec-hairline)] bg-[var(--exec-base)]/90 backdrop-blur">
      <div className="gm-width flex h-16 items-center gap-4 px-4 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2.5">
          <span className="size-2 shrink-0 rounded-sm bg-[var(--exec-cyan)]" aria-hidden />
          <span className="truncate text-[14px] font-semibold tracking-[0.2em] text-[var(--exec-ink)] uppercase">
            Globalmatrix
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {[
            { to: "/app", label: "Explore" },
            { to: "/app/world", label: "World" },
            { to: "/app/events", label: "Events" },
            { to: "/app/markets", label: "Markets" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="hidden rounded-lg px-3 py-2 text-[14px] text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)] md:block"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/login"
            className="ml-1 rounded-full border border-[var(--exec-hairline-strong)] px-4 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            Sign in
          </Link>
          <Link
            to="/signup"
            className="ml-1.5 hidden rounded-full bg-[var(--exec-cyan)] px-4 py-2 text-[13px] font-semibold text-[#070A0F] transition-opacity hover:opacity-90 sm:block"
          >
            Create account
          </Link>
        </div>
      </div>
    </nav>
  );
}

/**
 * The four hero numbers.
 *
 * Every figure here is counted from something real, and the basis is stated on
 * the strip itself rather than left to the reader to work out:
 *
 * - LIVE SIGNALS counts only readings from sources that are inside their own
 *   refresh window right now. A rate-limited feed contributes zero, because a
 *   number we cannot currently refresh is not a live signal.
 * - ACTIVE REGIONS counts places the map can actually draw. Institutions carry
 *   no coordinate and are excluded, so the number matches the picture above it.
 * - NETWORK LINKS counts shared-exposure couplings between those places. They
 *   are couplings, not shipping lanes or trade flows, which the caption says.
 * - LAST UPDATE is the most recent successful fetch across every connector.
 */
function HeroStats({ regions, links }: { regions: number; links: number }) {
  const health = useQuery(api.observations.sourceHealth);

  const liveReadings = (health ?? []).reduce((sum, h) => {
    if (!h.readingCount) return sum;
    return freshnessOf(h.lastSuccessAt, h.sourceId) === "live"
      ? sum + h.readingCount
      : sum;
  }, 0);

  const lastUpdate = (health ?? []).reduce(
    (max, h) => Math.max(max, h.lastSuccessAt),
    0,
  );

  const cells = [
    { label: "Live signals", value: String(liveReadings) },
    { label: "Active regions", value: String(regions) },
    { label: "Network links", value: String(links) },
    {
      label: "Last update",
      value: relativeAge(lastUpdate) || "never",
      // A source that has never answered cannot leave this cell reading "never"
      // with no explanation, so it says why.
      note: lastUpdate ? undefined : "no connector has returned a reading yet",
    },
  ];

  return (
    <dl className="mt-9 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--exec-hairline)] bg-[var(--exec-hairline)] sm:grid-cols-4">
      {cells.map((cell) => (
        <div
          key={cell.label}
          className="flex min-w-0 flex-col gap-1 bg-[var(--card)] px-4 py-3"
        >
          <dt className="exec-label min-w-0 truncate text-[var(--exec-ink-dim)]">
            {cell.label}
          </dt>
          <dd
            className="exec-num truncate text-[1.35rem] leading-none font-semibold tracking-[-0.02em] text-[var(--exec-ink)]"
            title={cell.note}
          >
            {cell.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** The shape a "what to watch" card needs, satisfied by the feed's rows. */
interface WatchRow {
  id: string;
  title: string;
  summary: string;
  stage: Stage;
  dominantChannel: Channel;
  score30: number;
  band: RiskBand;
  confidence: number;
}

/**
 * WHAT TO WATCH — the earliest-stage events, ranked by their own 30-day
 * composite.
 *
 * Only events the corpus has actually scored as emerging or escalating appear
 * here. Stage, channel, band and confidence are read straight off those rows;
 * nothing about the future is claimed beyond the horizons the event analysis
 * itself shows. With nothing at an early stage, the section says so rather
 * than filling the space with speculation.
 */
function WhatToWatch({ rows }: { rows: WatchRow[] }) {
  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="t-section text-[var(--exec-ink)]">What to watch</h2>
        <span className="exec-label">{CORPUS_LABEL}</span>
      </div>
      {rows.length === 0 ? (
        <div className="card p-5">
          <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
            No event in the current corpus sits at an early stage. GlobalMatrix
            does not fill this space with speculation about what might happen.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
          {rows.map((row) => (
            <Link
              key={row.id}
              to={`/app/event/${row.id}`}
              className="card card-hover flex min-w-0 flex-col gap-2 p-4"
            >
              <span className="exec-label text-[var(--exec-cyan)]">
                {STAGE_LABEL[row.stage]} · {CHANNEL_LABEL[row.dominantChannel]}
              </span>
              <span className="line-clamp-2 text-[14px] leading-snug font-semibold text-[var(--exec-ink)]">
                {row.title}
              </span>
              <span className="line-clamp-3 text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                {row.summary}
              </span>
              <span className="exec-label mt-auto pt-1">
                30-day {BAND_LABEL[row.band]} · confidence {pct(row.confidence)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * DATA & EVIDENCE — the connectors behind every number above, each with its
 * own freshness, on the page that uses them.
 *
 * This is the provenance contract stated where the claims are made: source,
 * freshness and how many verified readings it is currently contributing. A
 * connector that has never answered says so instead of showing a date.
 */
function DataAndEvidence() {
  const health = useQuery(api.observations.sourceHealth);

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="t-section text-[var(--exec-ink)]">Data &amp; evidence</h2>
        <Link
          to="/app/data"
          className="exec-label text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
        >
          Source observatory →
        </Link>
      </div>
      <div className="card">
        {health === undefined ? (
          <p className="px-4 py-4 text-[13px] text-[var(--exec-ink-dim)]">
            Resolving connector state…
          </p>
        ) : health.length === 0 ? (
          <p className="px-4 py-4 text-[13px] text-[var(--exec-ink-dim)]">
            No connector has returned a reading yet. This page shows no
            estimates while that is true.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--exec-hairline)]">
            {health.map((h) => {
              const def = SOURCES[h.sourceId as keyof typeof SOURCES];
              const name =
                def?.label ??
                h.sourceId.charAt(0).toUpperCase() + h.sourceId.slice(1);
              return (
                <li
                  key={h.sourceId}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--exec-ink)]">
                    {name}
                  </span>
                  <FreshnessTag
                    freshness={freshnessOf(h.lastSuccessAt, h.sourceId)}
                  />
                  <span className="exec-label">
                    {h.lastSuccessAt
                      ? `updated ${relativeAge(h.lastSuccessAt)}`
                      : "never connected"}
                  </span>
                  <span className="exec-label">
                    {h.readingCount} verified reading
                    {h.readingCount === 1 ? "" : "s"}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/** The map's encoding, stated once, under the map that uses it. */
function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--exec-hairline)] px-4 py-3">
      {[
        { label: "Economy / corridor", shape: "circle" },
        { label: "Chokepoint", shape: "diamond" },
      ].map((g) => (
        <span key={g.label} className="flex items-center gap-2">
          <span
            className="inline-block size-3 border border-current"
            style={{
              borderRadius: g.shape === "circle" ? "9999px" : 0,
              transform: g.shape === "diamond" ? "rotate(45deg) scale(0.8)" : undefined,
            }}
            aria-hidden
          />
          <span className="exec-label">{g.label}</span>
        </span>
      ))}
      <span className="flex items-center gap-2">
        <span
          className="inline-block size-2 rounded-full bg-[var(--exec-crimson)]"
          aria-hidden
        />
        <span className="exec-label">Event</span>
      </span>
      <span className="exec-label ml-auto text-[var(--exec-ink-dim)]">
        Hover for a place · click for its intelligence · {CORPUS_LABEL}
      </span>
    </div>
  );
}

/** Skeleton for the discovery rail while the feed resolves. */
function PulseSkeleton() {
  return (
    <div className="card p-4">
      <Skeleton className="h-5 w-40" />
      <div className="mt-4 flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-[19rem] shrink-0 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

/** The access band. What is public, and what an account is actually for. */
function AccessBand() {
  return (
    <section className="card p-6 lg:p-8">
      <h2 className="t-section text-[var(--exec-ink)]">Explore GlobalMatrix freely.</h2>
      <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-[var(--exec-ink-dim)]">
        The map, events, countries, trade, markets and all public intelligence are
        open to anyone. No account, no email verification, no card. An account is
        only for the things you want to keep.
      </p>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[
          {
            title: "No sign-in needed",
            items: [
              "World map",
              "Events",
              "Countries",
              "Trade",
              "Markets",
              "Public intelligence",
            ],
          },
          {
            title: "Sign in only to save",
            items: [
              "Watchlists",
              "Comments and reviews",
              "Saved analysis",
            ],
          },
        ].map((col) => (
          <div key={col.title}>
            <p className="exec-label text-[var(--exec-ink)]">{col.title}</p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {col.items.map((item) => (
                <li
                  key={item}
                  className="chip text-[var(--exec-ink-dim)]"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}