import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowRight, Factory, Globe2, Landmark, Network, Package, TrendingUp } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { TopologyResult } from "@/convex/macroTopology";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import { CHANNEL_LABEL } from "@/lib/intel/types";
import { WorldMap, isPlottable } from "@/components/viz/WorldMap";
import { Skeleton } from "@/components/viz/core";
import { CountryDrawer } from "@/components/viz/exec/CountryDrawer";
import { useFocus } from "@/lib/focus";
import { ExecPage, FreshnessTag } from "@/components/viz/exec/system";
import { loadColour } from "@/components/viz/exec/Topology";
import {
  BarPreview,
  ExploreGrid,
  GlobalPulse,
  PropagationFlow,
  SplitPreview,
  UnavailablePreview,
  type ExplorePanel,
} from "@/components/landing/sections";
import {
  HappeningNow,
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
        source: row.latestSignal?.source ?? CORPUS_LABEL,
        sourceClass: row.latestSignal?.sourceClass ?? "intel",
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
            See what is changing in the world.
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="mt-3 max-w-xl text-[15px] leading-relaxed text-[var(--exec-ink-dim)]"
          >
            Understand global events, their connections and the industries they
            affect.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="mt-8 flex flex-wrap gap-3"
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
              Open World Map
            </a>
          </motion.div>
        </div>
      </header>

      <main className="min-w-0">
        <div className="gm-width flex flex-col gap-6 px-4 py-10 lg:gap-8 lg:px-8 lg:py-12">
          {/* GLOBAL PULSE — the six numbers that summarise the world. */}
          <GlobalPulse data={topology} />

          {/* HAPPENING NOW — the events behind those numbers. */}
          {feed ? <HappeningNow events={timeline} /> : <PulseSkeleton />}

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
          <PropagationFlow />

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
            to="/auth"
            className="ml-1 rounded-full border border-[var(--exec-hairline-strong)] px-4 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
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