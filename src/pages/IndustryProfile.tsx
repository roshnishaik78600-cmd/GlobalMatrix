import { Link, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { ArrowLeft, ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel } from "@/components/intel/AppShell";
import { PathTrace } from "@/components/intel/PathTrace";
import { ChannelBars, Label, Meter } from "@/components/intel/primitives";
import { pct } from "@/lib/format";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";

const ROLE_TONE: Record<string, "signal" | "ink" | "blue"> = {
  Producer: "signal",
  Consumer: "ink",
  Input: "blue",
  Route: "blue",
};

export default function IndustryProfile() {
  const { industryId } = useParams<{ industryId: string }>();
  const data = useQuery(
    api.intel.industryProfile,
    industryId ? { industryId } : "skip",
  );
  const toggleWatch = useMutation(api.research.toggleWatch);

  if (!industryId || !data) {
    return (
      <main className="mx-auto max-w-[1600px] px-5 py-20 lg:px-8">
        <p className="label text-muted-foreground">Loading sector profile…</p>
      </main>
    );
  }

  const { industry, exposure, structure, liveNodes, watched } = data;
  const producers = structure.filter((s) => s.role === "Producer");
  const consumers = structure.filter((s) => s.role === "Consumer");
  const inputs = structure.filter((s) => s.role === "Input");
  const routes = structure.filter((s) => s.role === "Route");

  return (
    <main>
      {/* Masthead */}
      <div className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 pt-6 pb-8 lg:px-8 lg:pt-8 lg:pb-10">
          <Link
            to="/app/industries"
            className="label inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-3" /> Industries
          </Link>

          <div className="mt-8 grid grid-cols-12 gap-x-4 gap-y-8">
            <div className="col-span-12 lg:col-span-8">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="num label text-signal">{industry.code}</span>
                <span className="h-3 w-px bg-rule" />
                <span className="label border border-signal px-1.5 py-0.5 text-[9px] text-signal">
                  Modelled exposure
                </span>
                <button
                  type="button"
                  onClick={() => toggleWatch({ eventId: `SECTOR:${industry.id}` })}
                  className="label ml-auto flex items-center gap-1.5 border border-ink px-2.5 py-1 transition-colors hover:bg-ink hover:text-paper lg:ml-0"
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
                {industry.label}
              </h1>
              <p className="mt-5 max-w-3xl text-[15px] leading-relaxed text-muted-foreground">
                {industry.summary}
              </p>
              <p className="mt-4 max-w-3xl border-l-2 border-signal pl-4 text-[13px] leading-relaxed">
                {industry.note}
              </p>
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
                      Events reaching sector
                    </dt>
                    <dd className="num text-lg">{exposure.eventCount}</dd>
                  </div>
                  <div>
                    <dt className="label text-[9px] text-muted-foreground">
                      Off-affinity arrivals
                    </dt>
                    <dd className="num text-lg">{exposure.offAffinityCount}</dd>
                  </div>
                  <div>
                    <dt className="label text-[9px] text-muted-foreground">
                      Top producer share
                    </dt>
                    <dd className="num text-lg">
                      {pct(
                        producers.reduce(
                          (m, p) => Math.max(m, p.share),
                          0,
                        ),
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="label text-[9px] text-muted-foreground">
                      Substitution lead
                    </dt>
                    <dd className="num text-lg">
                      {industry.substitutionMonths}m
                    </dd>
                  </div>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Structure */}
      <div className="border-b border-rule bg-card">
        <dl className="mx-auto grid max-w-[1600px] grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-4 lg:px-8">
          <Fact caption="Structural fragility" value={pct(industry.fragility)} note="MODELLED single-point-of-failure exposure" />
          <Fact caption="Substitution lead time" value={`${industry.substitutionMonths} mo`} note="MODELLED requalification + inventory cycle" />
          <Fact
            caption="Route dependencies"
            value={String(routes.length)}
            note={routes.map((r) => r.nodeId).join(", ")}
          />
          <Fact
            caption="Channel affinity"
            value={industry.channelAffinity.length + " of 4"}
            note={industry.channelAffinity.map((c) => CHANNEL_LABEL[c]).join(", ")}
          />
        </dl>
      </div>

      {/* Structure map */}
      <div className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <Panel caption="Production & input structure" aside="MODELLED shares" className="h-full">
                <SectionGroup
                  title="Producers"
                  rows={producers}
                  empty="No production nodes declared."
                />
                <div className="border-t border-rule">
                  <SectionGroup
                    title="Upstream inputs"
                    rows={inputs}
                    empty="No upstream inputs declared."
                  />
                </div>
              </Panel>
            </div>

            <div className="lg:col-span-6">
              <Panel caption="Demand & routes" aside="MODELLED shares" className="h-full">
                <SectionGroup
                  title="Consumers"
                  rows={consumers}
                  empty="No demand centres declared."
                />
                <div className="border-t border-rule">
                  <SectionGroup
                    title="Routes"
                    rows={routes}
                    empty="No route dependencies declared."
                  />
                </div>
              </Panel>
            </div>
          </div>
        </div>
      </div>

      {/* Live node load */}
      <div className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
          <Panel
            caption="Nodes currently transmitting into this sector"
            aside="Σ weighted exposure across all events"
          >
            {liveNodes.length === 0 ? (
              <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
                No current event reaches this sector.
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {liveNodes.map((node) => (
                  <li key={node.nodeId} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <Link
                        to={`/app/country/${node.nodeId}`}
                        className="text-[13px] font-medium transition-colors hover:text-signal"
                      >
                        {node.label}
                      </Link>
                      <span className="num text-[12px]">
                        {node.weight.toFixed(2)}
                      </span>
                    </div>
                    <Meter
                      value={Math.min(1, node.weight / (liveNodes[0]?.weight || 1))}
                      tone="signal"
                      className="mt-2"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {node.region}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      {/* Causal path trace */}
      <div>
        <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
          <Panel
            caption="Causal path trace · how this load was built"
            aside={`${exposure.contributions.length} node exposures`}
          >
            <PathTrace contributions={exposure.contributions} limit={8} />
          </Panel>

          <div className="mt-6 flex items-center justify-between gap-4">
            <Link
              to="/app/industries"
              className="label inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-ink"
            >
              <ArrowLeft className="size-3" /> Industries
            </Link>
            <Link
              to="/app/countries"
              className="label inline-flex items-center gap-2 text-ink"
            >
              Countries <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionGroup({
  title,
  rows,
  empty,
}: {
  title: string;
  rows: {
    nodeId: string;
    label: string;
    region: string;
    share: number;
    role: string;
    criticality: number;
  }[];
  empty: string;
}) {
  return (
    <div>
      <h3 className="label border-b border-rule bg-secondary px-4 py-2 text-muted-foreground">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="px-4 py-4 text-[12px] text-muted-foreground">{empty}</p>
      ) : (
        <ul>
          {rows.map((row) => (
            <li key={`${title}-${row.nodeId}`} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <Link
                  to={`/app/country/${row.nodeId}`}
                  className="text-[13px] font-medium transition-colors hover:text-signal"
                >
                  {row.label}
                </Link>
                <span className="num text-[12px]">{pct(row.share)}</span>
              </div>
              <Meter
                value={row.share}
                tone={ROLE_TONE[row.role] ?? "ink"}
                className="mt-2"
              />
              <p className="mt-1 text-[10px] text-muted-foreground">
                {row.role} · {row.region} · criticality{" "}
                {pct(row.criticality)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({
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