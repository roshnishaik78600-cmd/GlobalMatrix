import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHead } from "@/components/viz/Shell";
import { Bar, Gauge, Panel, Radar, Skeleton, Timeline } from "@/components/viz/core";
import { NoVerifiedData, QuestionStrip } from "@/components/viz/Unavailable";
import { MapLegend, MapSelection, WorldMap } from "@/components/viz/WorldMap";
import { CHANNEL_COLOR, riskColorForScore } from "@/lib/intel/visual";
import { bandOf } from "@/lib/intel/engine";
import { CHANNELS, CHANNEL_LABEL, STAGE_LABEL, type Stage } from "@/lib/intel/types";
import { dayMonth } from "@/lib/format";

export default function Overview() {
  const data = useQuery(api.intel.overview);
  const [selected, setSelected] = useState<string | null>(null);
  const [domain, setDomain] = useState<string | null>(null);

  if (!data) return <OverviewSkeleton />;

  const {
    mapNodes,
    flows,
    domains,
    observations,
    topEvents,
    hottestCountries,
    hottestIndustries,
    supplyPressure,
    policyEvents,
    stats,
  } = data;

  const top = topEvents[0];
  const hottestNode = mapNodes.reduce(
    (best, n) => (n.load > best.load ? n : best),
    mapNodes[0] ?? { nodeId: "", label: "", load: 0, eventCount: 0, criticality: 0 },
  );

  return (
    <main className="min-w-0">
      <PageHead
        title="What is happening in the world"
        lede="Live risk signals, events and economic exposure across the global network. Every number links to its source."
        actions={
          <>
            <Link
              to="/app/scenarios"
              className="label flex items-center gap-2 border border-rule px-3 py-2 transition-colors hover:border-foreground"
            >
              Test a scenario <ArrowUpRight className="size-3" />
            </Link>
            <Link
              to="/app/events"
              className="label flex items-center gap-2 bg-foreground px-3 py-2 text-background transition-opacity hover:opacity-85"
            >
              All events <ArrowUpRight className="size-3" />
            </Link>
          </>
        }
      />

      {/* The five questions, answered first */}
      <QuestionStrip
        className="border-b border-rule"
        answers={[
          {
            q: "What happened",
            a: top ? top.title : "No events in the current corpus.",
            href: top ? `/app/event/${top.id}` : undefined,
          },
          {
            q: "Where",
            a: hottestNode?.nodeId
              ? `Most exposed node is ${hottestNode.label}, at ${(hottestNode.load * 100).toFixed(0)}% live load.`
              : "No exposure resolved.",
            href: "/app/world",
          },
          {
            q: "What changed",
            a: observations[0]
              ? `${observations[0].title} — ${dayMonth(observations[0].at)}.`
              : "No recent observations.",
          },
          {
            q: "Who is affected",
            a: hottestCountries[0]
              ? `${hottestCountries[0].label} leads on live exposure.`
              : "No country exposure resolved.",
            href: hottestCountries[0] ? `/app/country/${hottestCountries[0].nodeId}` : undefined,
          },
          {
            q: "Why it matters",
            a: top
              ? `${top.score.toFixed(1)} / 100 composite risk on ${CHANNEL_LABEL[top.dominantChannel].toLowerCase()} transmission.`
              : "—",
            href: "/app/risk",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-px bg-rule xl:grid-cols-12">
        {/* Hero map */}
        <section className="bg-background p-3 xl:col-span-8">
          <div className="panel h-full">
            <div className="panel-head">
              <span className="label">Global activity map</span>
              <span className="label text-muted-foreground">
                {mapNodes.length} nodes · {flows.length} transmission links
              </span>
            </div>
            <WorldMap
              nodes={mapNodes}
              flows={flows}
              height={440}
              selected={selected}
              onSelect={(id) => setSelected(id === selected ? null : id)}
            />
            <div className="border-t border-rule">
              <MapLegend />
            </div>
          </div>
        </section>

        {/* Side column */}
        <section className="space-y-3 bg-background p-3 xl:col-span-4">
          {selected ? (
            <MapSelection nodeId={selected} onClose={() => setSelected(null)} />
          ) : null}

          <Panel title="Domain activity" meta="mean channel pressure">
            <Radar
              axes={domains}
              onSelect={(l) => setDomain(domain === l ? null : l)}
              selected={domain}
            />
            <p className="px-3 pb-3 text-[11px] leading-relaxed text-muted-foreground">
              {domain
                ? `${domain} selected. Axis value is the corpus mean pressure; the trailing number is how many events carry that channel.`
                : "Select an axis to focus it. Each axis is the corpus mean pressure on that channel."}
            </p>
          </Panel>

          <Panel title="Risk by domain" meta="mean pressure on the risk scale">
            <div className="grid grid-cols-2 gap-4 p-3">
              {CHANNELS.map((channel) => {
                const axis = domains.find((d) => d.label === CHANNEL_LABEL[channel]);
                const value = (axis?.value ?? 0) * 100;
                return (
                  <Gauge
                    key={channel}
                    label={CHANNEL_LABEL[channel]}
                    score={value}
                    band={bandOf(value)}
                    detail={`${axis?.count ?? 0} events`}
                  />
                );
              })}
            </div>
            <p className="px-3 pb-3 text-[11px] leading-relaxed text-muted-foreground">
              Bands are the engine&apos;s own thresholds (low &lt;30 · moderate
              &lt;42 · elevated &lt;52 · high &lt;65), so a gauge always agrees
              with the band chip elsewhere in the app.
            </p>
          </Panel>
        </section>

        {/* What changed */}
        <section className="bg-background p-3 xl:col-span-4">
          <Panel
            title="What changed"
            meta={`${observations.length} most recent`}
            className="h-full"
          >
            <div className="max-h-[340px] overflow-y-auto p-3">
              <Timeline
                items={observations.map((o) => ({
                  time: dayMonth(o.at),
                  title: o.title,
                  detail: `${o.detail} · ${STAGE_LABEL[o.stage as Stage]}`,
                  tone: CHANNEL_COLOR[o.channel],
                }))}
              />
            </div>
          </Panel>
        </section>

        {/* Top developments */}
        <section className="bg-background p-3 xl:col-span-4">
          <Panel
            title="Top developments"
            meta="30-day composite"
            className="h-full"
          >
            <ul>
              {topEvents.map((event) => (
                <li key={event.id}>
                  <Link
                    to={`/app/event/${event.id}`}
                    className="group block border-b border-rule px-3 py-3 transition-colors last:border-b-0 hover:bg-white/4"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span
                        className="label"
                        style={{ color: CHANNEL_COLOR[event.dominantChannel] }}
                      >
                        {CHANNEL_LABEL[event.dominantChannel]}
                      </span>
                      <span className="num text-[13px] font-semibold">
                        {event.score.toFixed(1)}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-snug font-medium group-hover:text-signal">
                      {event.title}
                    </p>
                    <Bar
                      value={event.score}
                      tone={riskColorForScore(event.score)}
                      height={4}
                      className="mt-2"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-1">
                      {event.topNodes.map((n) => (
                        <span
                          key={n.nodeId}
                          className="num border border-rule px-1 text-[8px] text-muted-foreground"
                          title={`${n.label} · ${n.weight.toFixed(2)}`}
                        >
                          {n.short}
                        </span>
                      ))}
                      <span className="num ml-auto text-[9px] text-muted-foreground">
                        80% {event.low.toFixed(0)}–{event.high.toFixed(0)}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        {/* Corpus census */}
        <section className="bg-background p-3 xl:col-span-4">
          <Panel title="Corpus" meta="what is being analysed" className="h-full">
            <dl className="grid grid-cols-2 gap-px bg-rule">
              {[
                ["Events", stats.events],
                ["Signals", stats.signals],
                ["Actors", stats.actors],
                ["Nodes", stats.nodes],
              ].map(([k, v]) => (
                <div key={k as string} className="bg-card px-3 py-3">
                  <dt className="label text-muted-foreground">{k}</dt>
                  <dd className="h-metric mt-1.5">{v as number}</dd>
                </div>
              ))}
            </dl>
            <p className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
              This is a synthetic, internally-consistent scenario corpus — not a
              live intelligence feed. There is no ingestion pipeline behind this
              app, so no freshness or uptime is claimed anywhere in the
              interface.
            </p>
          </Panel>
        </section>

        {/* Entities */}
        <section className="bg-background p-3 xl:col-span-6">
          <Panel
            title="Most exposed countries"
            meta="derived live load"
            actions={
              <Link
                to="/app/countries"
                className="label text-muted-foreground hover:text-foreground"
              >
                All →
              </Link>
            }
          >
            <ul className="divide-y divide-rule">
              {hottestCountries.map((row) => (
                <li key={row.nodeId}>
                  <Link
                    to={`/app/country/${row.nodeId}`}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/4"
                  >
                    <span className="num w-8 shrink-0 text-[11px] text-muted-foreground">
                      {row.short}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">
                      {row.label}
                    </span>
                    <span className="w-20 shrink-0">
                      <Bar
                        value={row.load}
                        tone={riskColorForScore(row.load * 100)}
                        height={4}
                      />
                    </span>
                    <span className="num w-9 shrink-0 text-right text-[11px]">
                      {(row.load * 100).toFixed(0)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        <section className="bg-background p-3 xl:col-span-6">
          <Panel
            title="Most exposed industries"
            meta="derived live load"
            actions={
              <Link
                to="/app/industries"
                className="label text-muted-foreground hover:text-foreground"
              >
                All →
              </Link>
            }
          >
            <ul className="divide-y divide-rule">
              {hottestIndustries.map((row) => (
                <li key={row.id}>
                  <Link
                    to={`/app/industry/${row.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/4"
                  >
                    <span className="min-w-0 flex-1 truncate text-[12.5px]">
                      {row.label}
                    </span>
                    <span className="w-20 shrink-0">
                      <Bar
                        value={row.load}
                        tone={riskColorForScore(row.load * 100)}
                        height={4}
                      />
                    </span>
                    <span className="num w-9 shrink-0 text-right text-[11px]">
                      {(row.load * 100).toFixed(0)}%
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>
        </section>

        {/* Domain coverage — real where measured, explicit where not */}
        <section className="bg-background p-3 xl:col-span-12">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-4">
            <Panel
              title="Supply-chain pressure"
              meta="chokepoints &amp; corridors"
              className="h-full"
            >
              {supplyPressure.length === 0 ? (
                <NoVerifiedData
                  title="Supply chains"
                  domain="supply-chain telemetry"
                />
              ) : (
                <ul className="divide-y divide-rule">
                  {supplyPressure.map((row) => (
                    <li key={row.nodeId}>
                      <Link
                        to={`/app/country/${row.nodeId}`}
                        className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-white/4"
                      >
                        <span className="min-w-0 flex-1 truncate text-[12px]">
                          {row.label}
                        </span>
                        <span className="w-14 shrink-0">
                          <Bar
                            value={row.load}
                            tone={riskColorForScore(row.load * 100)}
                            height={4}
                          />
                        </span>
                        <span className="num w-8 shrink-0 text-right text-[10px]">
                          {(row.load * 100).toFixed(0)}%
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Policy changes" meta="linked events" className="h-full">
              {policyEvents.length === 0 ? (
                <NoVerifiedData
                  title="Policy"
                  domain="policy registry with lifecycle status"
                />
              ) : (
                <ul className="divide-y divide-rule">
                  {policyEvents.map((row) => (
                    <li key={row.id}>
                      <Link
                        to={`/app/event/${row.id}`}
                        className="block px-3 py-2 transition-colors hover:bg-white/4"
                      >
                        <p className="line-clamp-2 text-[12px] leading-snug">
                          {row.title}
                        </p>
                        <p className="num mt-0.5 text-[9px] text-muted-foreground">
                          {row.tags.join(" · ")} · {row.score.toFixed(1)}
                        </p>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Trade activity" meta="flows" className="h-full">
              <NoVerifiedData
                title="Trade"
                domain="bilateral trade-flow values"
                action={
                  <Link
                    to="/app/trade"
                    className="label text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Why this is empty →
                  </Link>
                }
              />
            </Panel>

            <Panel
              title="Economic &amp; market indicators"
              meta="prices, macro"
              className="h-full"
            >
              <NoVerifiedData
                title="Markets"
                domain="price, index, FX and macro series"
                action={
                  <Link
                    to="/app/markets"
                    className="label text-muted-foreground transition-colors hover:text-foreground"
                  >
                    Why this is empty →
                  </Link>
                }
              />
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}

function OverviewSkeleton() {
  return (
    <main className="min-w-0">
      <div className="border-b border-rule px-4 py-5">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="mt-3 h-4 w-full max-w-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <Skeleton className="h-[440px] w-full" />
        </div>
        <div className="space-y-3 xl:col-span-4">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="xl:col-span-4">
            <Skeleton className="h-64 w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}