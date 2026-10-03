import { Link, useParams } from "react-router";
import { DataType, PageFrame, PageLoading } from "@/components/viz/exec/design";
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
      <PageLoading
        eyebrow="Country"
        title="Country intelligence"
        lede="Exposure, dependency and the events that land hardest on this place."
      />
    );
  }

  const { node, country, exposure, industries, peers, dependents, watched } =
    data;
  const topContribution = exposure.contributions[0];

  return (
    <PageFrame
      eyebrow={country ? "Country" : "Infrastructure"}
      title={node.label}
      lede={
        country
          ? country.note
          : "An infrastructure node: this entry carries traffic rather than demand, so its exposure is measured by how many pathways route through it."
      }
      actions={
        <>
          <Link
            to="/app/countries"
            className="exec-label inline-flex items-center gap-1.5 border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3" /> Countries
          </Link>
          <button
            type="button"
            onClick={() => toggleWatch(`NODE:${nodeId}`)}
            className="exec-label inline-flex items-center gap-1.5 border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            {watched ? (
              <BookmarkCheck className="size-3" />
            ) : (
              <Bookmark className="size-3" />
            )}
            {watched ? "Tracking" : "Track"}
          </button>
        </>
      }
    >


      {/* LEVEL 1 — the headline load, then its channel breakdown. This was the
          bespoke masthead's right-hand card; the frame moved it into the body so
          the header stays one sentence everywhere. */}
      <div className="glass mb-3 px-3 py-3">
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="exec-label">Live load from current corpus</span>
          <span className="exec-num ml-auto text-[1.55rem] leading-none font-bold text-[var(--exec-ink)]">
            {pct(exposure.load)}
          </span>
          <DataType type="model" />
        </div>
        <Meter
          value={exposure.load}
          tone={exposure.load > 0.6 ? "signal" : "ink"}
          className="mt-3"
        />
        <div className="mt-4">
          <Label className="mb-2 block">By channel</Label>
          <ChannelBars
            pressure={Object.fromEntries(
              exposure.byChannel.map((c) => [c.channel, c.load]),
            ) as Record<Channel, number>}
          />
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
        <div className="grid gm-width gap-8 px-5 py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
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
          <dl className="grid gm-width grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-4 lg:px-8">
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
          <div className="gm-width px-5 py-8 lg:px-8 lg:py-10">
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
        <div className="grid gm-width gap-8 px-5 py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
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
          <div className="gm-width px-5 py-8 lg:px-8 lg:py-10">
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
        <div className="gm-width px-5 py-8 lg:px-8 lg:py-10">
          <Panel
            caption="Causal path trace · how this load was built"
            aside={`${exposure.contributions.length} pathway exposures across ${exposure.eventCount} events`}
          >
            <PathTrace contributions={exposure.contributions} limit={8} />
          </Panel>
        </div>
      </div>
    </PageFrame>
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