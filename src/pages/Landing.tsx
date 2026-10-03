import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import {
  ArrowRight,
  Factory,
  Globe2,
  Landmark,
  Network,
  Package,
  TrendingUp,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { TopologyResult } from "@/convex/macroTopology";
import { getNode } from "@/lib/intel/nodes";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import { riskColorForScore } from "@/lib/intel/visual";
import { WorldMap } from "@/components/viz/WorldMap";
import { Skeleton } from "@/components/viz/core";
import { CountryDrawer } from "@/components/viz/exec/CountryDrawer";
import { useFocus } from "@/lib/focus";
import {
  ExecGrid,
  ExecPage,
  FreshnessTag,
  SectionTitle,
} from "@/components/viz/exec/system";
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
import { EventTimeline, TrustStrip, type TimelineEvent } from "@/components/landing/feed";

/**
 * The public homepage.
 *
 * Show, then explain, then explore. The world map is the first thing a visitor
 * meets after the headline and the largest object on the page, because the
 * single question this product answers is "what is happening, and where" — and
 * that is a question a map answers better than a paragraph. Everything below it
 * is either a reading of the same data (the pulse), a pointer to the next click
 * (the timeline, the explore grid) or an honest statement of what is not
 * connected.
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
  const health = useQuery(api.observations.sourceHealth);

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
    () => (data?.mapNodes ?? []).filter((n) => getNode(n.nodeId).lat !== undefined),
    [data],
  );

  const timeline = useMemo<TimelineEvent[]>(() => {
    if (!feed) return [];
    return [...feed.rows]
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
      .slice(0, 8)
      .map((row) => ({
        id: row.id,
        place: row.topNodes[0]?.label ?? "no dominant location",
        at: row.detectedAt,
        title: row.title,
        source: row.latestSignal?.source ?? CORPUS_LABEL,
        sourceClass: row.latestSignal?.sourceClass ?? "intel",
        score: row.score30,
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
        blurb: "Track countries and their global connections.",
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
        blurb: "See global trade relationships and flows.",
        preview: trade ? (
          <SplitPreview
            left={{
              label: "Bottleneck idx",
              value: (trade.intensity * 100).toFixed(0),
              tone: loadColour(trade.intensity),
            }}
            right={{
              label: "Reporters",
              value: String((data?.mapNodes ?? []).filter((n) => n.kind === "economy").length),
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
        blurb: "Explore critical dependencies.",
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
        blurb: "Understand economic and market context.",
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
        blurb: "Track important policy and regulatory changes.",
        preview: <UnavailablePreview />,
        unavailable: "No policy registry is connected. Policy events are tagged in the corpus.",
      },
    ];
  }, [data, topology]);

  return (
    <ExecPage className="min-h-screen">
      <LandingNav />

      {/* Hero. Compact on purpose: the map is the headline, and a wall of type
          above it would push the one thing worth seeing below the fold. */}
      <header className="border-b border-[var(--exec-hairline)] px-4 pt-8 pb-6 lg:px-8 lg:pt-12 lg:pb-8">
        <div className="mx-auto max-w-[1600px]">
          <p className="exec-label text-[var(--exec-cyan)]">Global event intelligence</p>
          <h1 className="mt-3 text-[2rem] leading-[1.05] font-semibold tracking-[-0.03em] text-[var(--exec-ink)] sm:text-[2.9rem] lg:text-[3.6rem]">
            See how the world connects.
          </h1>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--exec-ink-dim)]">
            Track global events, trade, markets, supply chains and their
            connections — all in one place.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              to="/app"
              className="flex items-center gap-2 bg-[var(--exec-cyan)] px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.1em] text-black uppercase transition-opacity hover:opacity-85"
            >
              Explore global intelligence
              <ArrowRight className="size-3.5" />
            </Link>
            <a
              href="#world-map"
              className="flex items-center gap-2 border border-[var(--exec-hairline-strong)] px-4 py-2.5 text-[11.5px] font-semibold tracking-[0.1em] text-[var(--exec-ink)] uppercase transition-colors hover:border-[var(--exec-cyan)]"
            >
              View world map
            </a>
          </div>
        </div>
      </header>

      {/* THE MAP. Full-bleed and immediately below the hero — this is the visual
          star of the page and everything else is sized around it. */}
      <section
        id="world-map"
        className="border-b border-[var(--exec-hairline)] scroll-mt-14"
      >
        <div className="mx-auto max-w-[1600px]">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3">
            <h2 className="exec-label text-[var(--exec-ink)]">
              Global risk surface
            </h2>
            <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
              {data
                ? `${mappable.length} places · ${data.mapEvents.length} events · ${data.flows.length} couplings`
                : "resolving"}
              {" · "}
              <FreshnessTag freshness="historical" className="exec-label" />
            </span>
          </div>

          {data ? (
            <WorldMap
              nodes={data.mapNodes}
              flows={data.flows}
              events={data.mapEvents.filter((e) => e.nodeId !== "")}
              height={480}
              selected={sharedNodeId}
              onSelect={selectNode}
              onInspect={(id) => {
                navigate(`/app/country/${id}`);
              }}
            />
          ) : (
            <Skeleton className="mx-4 mb-4 h-[480px] w-[calc(100%-2rem)]" />
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--exec-hairline)] px-4 py-2">
            {[
              // Economies and corridors draw with the same circle marker, so the
              // legend names them together rather than implying a distinction
              // the map does not make.
              { label: "Economy / corridor", shape: "circle" },
              { label: "Chokepoint", shape: "diamond" },
            ].map((g) => (
              <span key={g.label} className="flex items-center gap-1.5">
                <span
                  className="inline-block size-2.5 border border-current"
                  style={{
                    borderRadius: g.shape === "circle" ? "9999px" : 0,
                    transform: g.shape === "diamond" ? "rotate(45deg) scale(0.8)" : undefined,
                  }}
                />
                <span className="exec-label">{g.label}</span>
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-full bg-[var(--exec-crimson)]" />
              <span className="exec-label">Event</span>
            </span>
            <span className="exec-label ml-auto text-[var(--exec-ink-dim)]">
              Hover for a place · click for its intelligence · {CORPUS_LABEL}
            </span>
          </div>
        </div>
      </section>

      <ExecGrid>
        {/* The pulse: the same six signals the executive board runs, compressed
            into one readable strip. */}
        <div className="col-span-4 lg:col-span-12">
          <GlobalPulse data={topology} />
        </div>

        {/* WHAT'S HAPPENING NOW. Four fields per event, then the click. */}
        <div className="col-span-4 lg:col-span-5">
          <EventTimeline events={timeline} />
        </div>

        {/* EXPLAIN. One object, one sentence. */}
        <div className="col-span-4 lg:col-span-7">
          <PropagationFlow />
        </div>

        {/* EXPLORE. Six panels, each previewed from the board it opens. */}
        <div className="col-span-4 lg:col-span-12">
          <SectionTitle
            meta="six ways in"
            className="px-3"
          >
            Explore global intelligence
          </SectionTitle>
          <div className="mt-3">
            <ExploreGrid panels={panels} />
          </div>
        </div>

        {/* AI ANALYST. A preview of the answer's *shape* — evidence, drivers,
            sources — not a chat window. */}
        <div className="col-span-4 lg:col-span-7">
          <AnalystPreview
            question="Why did trade risk change?"
            evidence={timeline[0]}
            drivers={(topology?.categories ?? []).filter((c) =>
              ["trade-bottlenecks", "energy", "supply-chain"].includes(c.id),
            )}
          />
        </div>

        {/* TRUST + DATA. */}
        <div className="col-span-4 lg:col-span-5">
          <TrustStrip health={health ?? []} />
        </div>
      </ExecGrid>

      <AccessBand />

      <footer className="border-t border-[var(--exec-hairline)] px-4 py-5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
          <span className="exec-label text-[var(--exec-ink-dim)]">
            GlobalMatrix · geopolitical, macro and supply-chain intelligence
          </span>
          <div className="flex items-center gap-4">
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

function LandingNav() {
  return (
    <nav className="sticky top-0 z-30 border-b border-[var(--exec-hairline)] bg-[var(--exec-base)]/90 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-4 lg:px-8">
        <Link to="/" className="flex shrink-0 items-center gap-2">
          <span className="size-2 bg-[var(--exec-cyan)]" aria-hidden />
          <span className="text-[12px] font-semibold tracking-[0.18em] text-[var(--exec-ink)] uppercase">
            GlobalMatrix
          </span>
        </Link>
        <div className="ml-auto flex items-center gap-1">
          {[
            { to: "/app", label: "Intelligence" },
            { to: "/app/events", label: "Events" },
            { to: "/app/world", label: "World" },
            { to: "/app/data", label: "Sources" },
            { to: "/methodology", label: "Methodology" },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="exec-label hidden px-2 py-1.5 text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)] sm:block"
            >
              {item.label}
            </Link>
          ))}
          <Link
            to="/auth"
            className="exec-label ml-1 border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            Sign in
          </Link>
        </div>
      </div>
    </nav>
  );
}

/**
 * A compact preview of what the analyst returns: a claim, the evidence under
 * it, the drivers, and the sources. Deliberately not a chat input — the point
 * is that the answer is auditable, and a message box would frame it as a
 * conversation rather than as a result.
 */
function AnalystPreview({
  question,
  evidence,
  drivers,
}: {
  question: string;
  evidence: TimelineEvent | undefined;
  drivers: TopologyResult["categories"];
}) {
  return (
    <div className="glass flex h-full flex-col">
      <SectionTitle meta="preview · answers are saved to your account">
        AI analyst
      </SectionTitle>
      <div className="flex flex-col gap-2.5 px-3 py-3">
        <p className="flex items-center gap-2 text-[13px] font-medium text-[var(--exec-ink)]">
          <span className="text-[var(--exec-cyan)]" aria-hidden>
            &ldquo;
          </span>
          {question}
        </p>

        {evidence ? (
          <div className="border-l-2 border-[var(--exec-hairline-strong)] pl-2.5">
            <p className="exec-label">Evidence</p>
            <p className="mt-1 text-[11.5px] leading-snug text-[var(--exec-ink)]">
              <span style={{ color: riskColorForScore(evidence.score) }}>
                {evidence.score.toFixed(0)}
              </span>{" "}
              — {evidence.title}
            </p>
            <p className="exec-num mt-0.5 text-[9.5px] text-[var(--exec-ink-dim)]">
              {evidence.source}
            </p>
          </div>
        ) : (
          <p className="exec-label">Evidence — no verified event resolved yet</p>
        )}

        <div className="grid grid-cols-3 gap-2">
          {drivers.map((d) => (
            <div key={d.id} className="min-w-0">
              <p className="exec-label min-w-0 truncate">{d.label}</p>
              <p
                className="exec-num mt-0.5 truncate text-[15px] font-bold"
                style={{ color: loadColour(d.intensity) }}
              >
                {(d.intensity * 100).toFixed(0)}
              </p>
            </div>
          ))}
        </div>

        <p className="exec-label">Sources</p>
        <p className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
          {evidence?.source ?? CORPUS_LABEL} · every claim links to the
          ledger it came from
        </p>
      </div>
      <div className="mt-auto border-t border-[var(--exec-hairline)] px-3 py-2">
        <Link
          to="/app/analyst"
          className="exec-label inline-flex items-center gap-1.5 border border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:bg-[var(--exec-surface-strong)]"
        >
          Ask GlobalMatrix <ArrowRight className="size-3" />
        </Link>
      </div>
    </div>
  );
}

function AccessBand() {
  return (
    <section className="border-t border-[var(--exec-hairline)] px-4 py-10 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <h2 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-[var(--exec-ink)] sm:text-[1.9rem]">
          Explore GlobalMatrix freely.
        </h2>
        <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
          The map, events, countries, companies, trade, markets and all public
          intelligence are open to anyone. No account, no email verification, no
          card. An account is only for the things you want to keep.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
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
            <div key={col.title} className="glass px-3.5 py-3">
              <p className="exec-label text-[var(--exec-ink)]">{col.title}</p>
              <ul className="mt-2.5 flex flex-wrap gap-1.5">
                {col.items.map((item) => (
                  <li
                    key={item}
                    className="exec-label border border-[var(--exec-hairline)] px-2 py-1 text-[var(--exec-ink-dim)]"
                  >
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
