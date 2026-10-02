import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useToggleWatch } from "@/hooks/use-auth-action";
import { Panel } from "@/components/intel/AppShell";
import { PathTrace } from "@/components/intel/PathTrace";
import { ChannelBars, Label, Meter } from "@/components/intel/primitives";
import { QuestionStrip } from "@/components/viz/Unavailable";
import { NodeEvidence } from "@/components/viz/NodeEvidence";
import { MacroTrend } from "@/components/viz/MacroTrend";
import { pct } from "@/lib/format";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";

export default function CountryProfile() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const data = useQuery(
    api.intel.countryProfile,
    nodeId ? { nodeId } : "skip",
  );
  const toggleWatch = useToggleWatch();

  if (!nodeId || !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-5 py-20 lg:px-8">
        <p className="label text-muted-foreground">Loading node profile…</p>
      </main>
    );
  }

  const { node, country, exposure, industries, peers, dependents, watched } =
    data;
  const topContribution = exposure.contributions[0];

  return (
    <main>
      {/* Masthead */}
      <div className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 pt-6 pb-8 lg:px-8 lg:pt-8 lg:pb-10">
          <Link
            to="/app/countries"
            className="label inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-3" /> Countries
          </Link>

          <div className="mt-8 grid grid-cols-12 gap-x-4 gap-y-8">
            <div className="col-span-12 lg:col-span-8">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="num label text-signal">{node.short}</span>
                <span className="h-3 w-px bg-rule" />
                <span className="label text-muted-foreground">{node.kind}</span>
                <span className="label text-muted-foreground">{node.region}</span>
                <span className="label border border-signal px-1.5 py-0.5 text-[9px] text-signal">
                  Modelled exposure
                </span>
                <button
                  type="button"
                  onClick={() => toggleWatch(`NODE:${nodeId}`)}
                  className="label ml-auto flex items-center gap-1.5 border border-foreground px-2.5 py-1 transition-colors hover:bg-foreground hover:text-background lg:ml-0"
                >
                  {watched ? (
                    <BookmarkCheck className="size-3" />
                  ) : (
                    <Bookmark className="size-3" />
                  )}
                  {watched ? "Tracking" : "Track"}
                </button>
              </div>
              <h1 className="display mt-4 text-[2.4rem] sm:text-[3.2rem] lg:text-[4rem]">
                {node.label}
              </h1>
              {country ? (
                <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                  {country.note}
                </p>
              ) : (
                <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                  An infrastructure node: this entry carries traffic rather than
                  demand, so its exposure is measured by how many pathways route
                  through it rather than by how much it consumes.
                </p>
              )}
            </div>

            <div className="col-span-12 lg:col-span-4">
              <div className="border border-rule bg-card p-5">
                <Label>Live load from current corpus</Label>
                <p className="num display mt-3 text-[3.4rem] leading-none">
                  {pct(exposure.load)}
                </p>
                <Meter
                  value={exposure.load}
                  tone={exposure.load > 0.6 ? "signal" : "ink"}
                  className="mt-4"
                />
                <div className="mt-4">
                  <Label className="mb-2 block">By channel</Label>
                  <ChannelBars
                    pressure={Object.fromEntries(
                      exposure.byChannel.map((c) => [c.channel, c.load]),
                    ) as Record<Channel, number>}
                  />
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-3 border-t border-rule pt-4">
                  <div>
                    <dt className="label text-[9px] text-muted-foreground">
                      Events reaching node
                    </dt>
                    <dd className="num text-lg">{exposure.eventCount}</dd>
                  </div>
                  <div>
                    <dt className="label text-[9px] text-muted-foreground">
                      Off-channel arrivals
                    </dt>
                    <dd className="num text-lg">{exposure.offAffinityCount}</dd>
                  </div>
                  <div>
                    <dt className="label text-[9px] text-muted-foreground">
                      Criticality
                    </dt>
                    <dd className="num text-lg">{pct(node.criticality)}</dd>
                  </div>
                  {country ? (
                    <div>
                      <dt className="label text-[9px] text-muted-foreground">
                        Structural fragility
                      </dt>
                      <dd className="num text-lg">
                        {pct(country.structuralFragility)}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* The same five questions the rest of the site answers. */}
      <QuestionStrip
        className="border-b border-rule"
        answers={[
          {
            q: "What's happening here?",
            a: topContribution
              ? `${topContribution.title} is the largest single term in this profile's load.`
              : "No event in the corpus currently reaches this node.",
            href: topContribution ? `/app/event/${topContribution.eventId}` : undefined,
          },
          {
            q: "What changed?",
            a: `Live load is ${pct(exposure.load)} across ${exposure.eventCount} events.`,
          },
          {
            q: "Who's affected?",
            a:
              dependents.length > 0
                ? `${dependents.length} ${dependents.length === 1 ? "place depends" : "places depend"} on this node structurally.`
                : peers.length > 0
                  ? `It depends on ${peers.length} other ${peers.length === 1 ? "node" : "nodes"} in turn.`
                  : "No structural dependency recorded.",
          },
          {
            q: "Why does it matter?",
            a: `Criticality ${pct(node.criticality)} — how strongly a shock here travels onward.`,
            href: "/app/chain",
          },
          {
            q: "Show evidence",
            a: "Reported growth and trade below, each with its source and fetch time.",
          },
        ]}
      />

      {/* Reported evidence, kept visibly separate from the modelled load. */}
      <div className="border-b border-rule">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-5 py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
          <div className="lg:col-span-7">
            <MacroTrend nodeId={nodeId} />
          </div>
          <div className="lg:col-span-5">
            <div className="panel h-full">
              <div className="panel-head">
                <span className="label">Reported evidence</span>
                <span className="label text-muted-foreground">
                  measured, not modelled
                </span>
              </div>
              <NodeEvidence nodeId={nodeId} />
            </div>
          </div>
        </div>
      </div>

      {/* Macro parameters */}
      {country ? (
        <div className="border-b border-rule bg-card">
          <dl className="mx-auto grid max-w-[1600px] grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-4 lg:px-8">
            <Macro caption="Share of global output" value={pct(country.macro.outputShare)} note="MODELLED structural parameter" />
            <Macro caption="Trade openness" value={pct(country.macro.tradeOpenness)} note="MODELLED structural parameter" />
            <Macro caption="Energy import dependence" value={pct(country.macro.energyImportDependence)} note="MODELLED structural parameter" />
            <Macro caption="External buffer" value={pct(country.macro.externalBuffer)} note="MODELLED structural parameter" />
          </dl>
        </div>
      ) : null}

      {/* Energy mix */}
      {country ? (
        <div className="border-b border-rule">
          <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
            <Panel caption="Energy structure" aside="MODELLED · illustrative shares">
              <ul className="divide-y divide-rule">
                {country.energy.map((source) => (
                  <li key={source.source} className="px-4 py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">{source.source}</span>
                      <span className="num text-[13px]">{pct(source.share)}</span>
                    </div>
                    <Meter
                      value={source.share}
                      tone={source.nodeId ? "signal" : "ink"}
                      className="mt-2"
                    />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {source.nodeId ? `Routed via ${source.nodeId} · ` : ""}
                      {source.note}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      ) : null}

      {/* Dependencies + industries */}
      <div className="border-b border-rule">
        <div className="mx-auto grid max-w-[1600px] gap-8 px-5 py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
          {country ? (
            <div className="lg:col-span-6">
              <Panel
                caption="Structural dependencies"
                aside="Declared strength × live load"
                className="h-full"
              >
                <ul className="divide-y divide-rule">
                  {peers.map((peer) => (
                    <li key={peer.nodeId} className="px-4 py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          to={`/app/country/${peer.nodeId}`}
                          className="text-[13px] font-medium transition-colors hover:text-signal"
                        >
                          {peer.label}
                        </Link>
                        <span className="num text-[12px]">
                          {pct(peer.strength)}
                        </span>
                      </div>
                      <Meter value={peer.strength} tone="ink" className="mt-2" />
                      <p className="mt-1.5 text-[11px] text-muted-foreground">
                        {peer.basis} · {peer.region} · live load{" "}
                        {pct(peer.load)}
                      </p>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          ) : null}

          <div className={country ? "lg:col-span-6" : "lg:col-span-12"}>
            <Panel
              caption="Industry structure"
              aside="Declared share × live contribution"
              className="h-full"
            >
              {industries.length === 0 ? (
                <p className="px-4 py-8 text-[13px] text-muted-foreground">
                  No declared industry role in the current sector taxonomy.
                </p>
              ) : (
                <ul className="divide-y divide-rule">
                  {industries.map((industry) => (
                    <li key={industry.id} className="px-4 py-3.5">
                      <div className="flex items-baseline justify-between gap-3">
                        <Link
                          to={`/app/industry/${industry.id}`}
                          className="group flex items-baseline gap-2"
                        >
                          <span className="text-[13px] font-medium transition-colors group-hover:text-signal">
                            {industry.label}
                          </span>
                          <ArrowUpRight className="size-3 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                        <span className="num text-[12px]">
                          {industry.share > 0 ? pct(industry.share) : "—"}
                        </span>
                      </div>
                      <Meter
                        value={industry.share}
                        tone="ink"
                        className="mt-2"
                      />
                      <div className="mt-1.5 flex items-center justify-between gap-3">
                        <span className="text-[11px] text-muted-foreground">
                          {industry.basis || "No declared role"} · fragility{" "}
                          {pct(industry.fragility)}
                        </span>
                        <span className="num text-[10px] text-muted-foreground">
                          {industry.live > 0 ? (
                            <>
                              live{" "}
                              {industry.liveChannel
                                ? CHANNEL_LABEL[industry.liveChannel]
                                : ""}{" "}
                              {industry.live.toFixed(3)}
                            </>
                          ) : (
                            "not currently reached"
                          )}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      </div>

      {/* Dependents */}
      {dependents.length > 0 ? (
        <div className="border-b border-rule">
          <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
            <Panel
              caption="Who depends on this node"
              aside="Declared structural dependency ≥ 0.40"
              className="h-full"
            >
              <ul className="grid grid-cols-1 divide-y divide-rule md:grid-cols-2 md:divide-y-0">
                {dependents.map((dep, i) => (
                  <li
                    key={dep.nodeId}
                    className={`px-4 py-3.5 ${i > 0 ? "md:border-t md:border-rule" : ""} ${i === 1 ? "md:border-t-0" : ""}`}
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        to={`/app/country/${dep.nodeId}`}
                        className="text-[13px] font-medium transition-colors hover:text-signal"
                      >
                        {dep.label}
                      </Link>
                      <span className="num text-[12px]">{pct(dep.strength)}</span>
                    </div>
                    <Meter value={dep.strength} tone="signal" className="mt-2" />
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {dep.basis}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </div>
      ) : null}

      {/* Causal path trace */}
      <div>
        <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
          <Panel
            caption="Causal path trace · how this load was built"
            aside={`${exposure.contributions.length} pathway exposures across ${exposure.eventCount} events`}
          >
            <PathTrace contributions={exposure.contributions} limit={8} />
          </Panel>
        </div>
      </div>
    </main>
  );
}

function Macro({
  caption,
  value,
  note,
}: {
  caption: string;
  value: string;
  note: string;
}) {
  return (
    <div className="border-b border-rule py-5 last:border-b-0 lg:border-b-0 lg:px-6 lg:first:pl-0">
      <dt className="label text-muted-foreground">{caption}</dt>
      <dd className="num display mt-2 text-2xl leading-none">{value}</dd>
      <dd className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {note}
      </dd>
    </div>
  );
}