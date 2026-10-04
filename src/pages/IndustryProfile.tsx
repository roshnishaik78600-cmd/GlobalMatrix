import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { ArrowLeft, ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useToggleWatch } from "@/hooks/use-auth-action";
import { DataType, PageFrame, PageLoading } from "@/components/viz/exec/design";
import { SectionTitle } from "@/components/viz/exec/system";
import { NoData } from "@/components/viz/core";
import { PathTrace } from "@/components/intel/PathTrace";
import { ChannelBars } from "@/components/intel/primitives";
import { pct } from "@/lib/format";
import { riskColorForScore } from "@/lib/intel/visual";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";

/**
 * One sector, read as a profile.
 *
 * Structured exactly like the country profile, because they answer the same
 * question about different objects: what is it, how exposed is it, who produces
 * it, who consumes it, what does it depend on, and what is reaching it now.
 * Two profiles in one shape is what lets a reader move between them without
 * relearning the page.
 */
export default function IndustryProfile() {
  const { industryId } = useParams<{ industryId: string }>();
  const data = useQuery(
    api.intel.industryProfile,
    industryId ? { industryId } : "skip",
  );
  const toggleWatch = useToggleWatch();

  if (!industryId || data === undefined) {
    return (
      <PageLoading
        eyebrow="Industry"
        title="Sector profile"
        lede="Structural position, dependency and the events currently reaching this sector."
      />
    );
  }

  // The query answers null for an unknown sector; the old falsy check left the
  // page reading "Loading sector profile…" for ever on a stale link.
  if (data === null) {
    return (
      <PageFrame
        eyebrow="Industry"
        title="Sector not found"
        lede={`GlobalMatrix does not track a sector called "${industryId}". The link may be stale, or the sector may have been removed from the model.`}
        actions={
          <Link
            to="/app/industries"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3.5" /> Industries
          </Link>
        }
      >
        <div className="lg:col-span-12">
          <NoData reason="This identifier is not a sector in the current taxonomy." />
        </div>
      </PageFrame>
    );
  }

  const { industry, exposure, structure, liveNodes, watched } = data;
  const producers = structure.filter((s) => s.role === "Producer");
  const consumers = structure.filter((s) => s.role === "Consumer");
  const inputs = structure.filter((s) => s.role === "Input");
  const routes = structure.filter((s) => s.role === "Route");
  const topProducerShare = producers.reduce((m, p) => Math.max(m, p.share), 0);

  return (
    <PageFrame
      eyebrow={`${industry.code} · sector profile`}
      title={industry.label}
      lede={industry.summary}
      actions={
        <>
          <button
            type="button"
            onClick={() => toggleWatch(`SECTOR:${industry.id}`)}
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            {watched ? (
              <BookmarkCheck className="size-3.5" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
            {watched ? "Tracking" : "Track"}
          </button>
          <Link
            to="/app/industries"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3.5" /> Industries
          </Link>
        </>
      }
    >
      {/* ---------------------------------------------------------------- Hero */}
      <div className="lg:col-span-12">
        <div className="card flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:gap-10 lg:p-8">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="exec-num text-[12px] font-semibold tracking-[0.16em] text-[var(--exec-cyan)]">
                {industry.code}
              </span>
              <DataType type="model" />
            </div>
            <p className="mt-3 max-w-2xl border-l-2 border-[var(--exec-crimson)] pl-4 text-[14px] leading-relaxed text-[var(--exec-ink)]">
              {industry.note}
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-x-10 gap-y-4 lg:ml-auto">
            <div className="flex flex-col">
              <span className="exec-label">Global exposure</span>
              <span className="exec-num mt-1 text-[3rem] leading-none font-bold tracking-[-0.035em] text-[var(--exec-ink)]">
                {(exposure.load * 100).toFixed(0)}
              </span>
              <span className="mt-2 h-2 w-32 overflow-hidden rounded-full bg-[var(--exec-surface)]">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${Math.max(2, exposure.load * 100)}%`,
                    background: riskColorForScore(exposure.load * 100),
                  }}
                />
              </span>
            </div>
            <div className="flex flex-col">
              <span className="exec-label">Events reaching it</span>
              <span className="exec-num mt-1 text-[1.75rem] leading-none font-bold text-[var(--exec-ink)]">
                {exposure.eventCount}
              </span>
              <span className="exec-label mt-2">
                {exposure.offAffinityCount} off-affinity
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------- STRUCTURAL PARAMETERS */}
      <div className="lg:col-span-8">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="modelled · single-point-of-failure exposure" right={<DataType type="model" />}>
            Structure
          </SectionTitle>
          <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--exec-hairline)] lg:grid-cols-4 lg:divide-y-0">
            <Fact caption="Structural fragility" value={pct(industry.fragility)} />
            <Fact
              caption="Substitution lead time"
              value={`${industry.substitutionMonths} mo`}
            />
            <Fact caption="Top producer share" value={pct(topProducerShare)} />
            <Fact
              caption="Channel affinity"
              value={`${industry.channelAffinity.length} of 4`}
            />
          </dl>
          <div className="border-t border-[var(--exec-hairline)] p-4">
            <p className="exec-label">Channel affinity</p>
            <div className="mt-3">
              <ChannelBars
                pressure={Object.fromEntries(
                  exposure.byChannel.map((c) => [c.channel, c.load]),
                ) as Record<Channel, number>}
              />
            </div>
            <p className="exec-label mt-3">
              {industry.channelAffinity
                .map((c) => CHANNEL_LABEL[c])
                .join(" · ")}
            </p>
          </div>
        </div>
      </div>

      <div className="lg:col-span-4">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="modelled shares" right={<DataType type="model" />}>
            Route dependencies
          </SectionTitle>
          {routes.length === 0 ? (
            <NoData reason="No route dependency is declared for this sector." />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
              {routes.map((route) => (
                <li key={route.nodeId}>
                  <Link
                    to={`/app/country/${route.nodeId}`}
                    className="flex items-baseline justify-between gap-3 p-4 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <span className="min-w-0 truncate text-[14px] text-[var(--exec-ink)]">
                      {route.label}
                    </span>
                    <span className="exec-num shrink-0 text-[14px] text-[var(--exec-ink)]">
                      {pct(route.share)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ------------------------------------------------- PRODUCTION / DEMAND -- */}
      <div className="lg:col-span-6">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="modelled shares" right={<DataType type="model" />}>
            Production and inputs
          </SectionTitle>
          <SectionGroup title="Producers" rows={producers} empty="No production nodes declared." />
          <div className="border-t border-[var(--exec-hairline)]">
            <SectionGroup title="Upstream inputs" rows={inputs} empty="No upstream inputs declared." />
          </div>
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="modelled shares" right={<DataType type="model" />}>
            Demand
          </SectionTitle>
          <SectionGroup title="Consumers" rows={consumers} empty="No demand centres declared." />
          <div className="border-t border-[var(--exec-hairline)]">
            <SectionGroup title="Routes" rows={routes} empty="No route dependencies declared." />
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------ LIVE NODE LOAD -- */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta="weighted exposure summed across all events"
            right={<DataType type="scenario" />}
          >
            Currently reaching this sector
          </SectionTitle>
          {liveNodes.length === 0 ? (
            <NoData reason="No current event reaches this sector." />
          ) : (
            <ul className="grid grid-cols-1 divide-y divide-[var(--exec-hairline)] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
              {liveNodes.map((node) => (
                <li key={node.nodeId}>
                  <Link
                    to={`/app/country/${node.nodeId}`}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)]">
                        {node.label}
                      </span>
                      <span className="exec-num shrink-0 text-[14px] text-[var(--exec-ink)]">
                        {node.weight.toFixed(2)}
                      </span>
                    </div>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                      <span
                        className="block h-full rounded-full bg-[var(--exec-crimson)]"
                        style={{
                          width: `${Math.max(
                            2,
                            (node.weight / Math.max(liveNodes[0]?.weight || 1, 0.0001)) * 100,
                          )}%`,
                        }}
                      />
                    </span>
                    <span className="exec-label">{node.region}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ AUDIT -- */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta={`${exposure.contributions.length} node exposures`}
            right={<DataType type="scenario" />}
          >
            How this load was built
          </SectionTitle>
          <PathTrace contributions={exposure.contributions} limit={8} />
        </div>
      </div>

      <div className="lg:col-span-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/app/industries"
            className="text-[13px] text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
          >
            ← All industries
          </Link>
          <Link
            to="/app/countries"
            className="inline-flex items-center gap-1.5 text-[13px] text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
          >
            Countries <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ parts -- */

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
      <h3 className="exec-label border-b border-[var(--exec-hairline)] px-4 py-2.5">
        {title}
      </h3>
      {rows.length === 0 ? (
        <p className="p-4 text-[13px] text-[var(--exec-ink-dim)]">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
          {rows.map((row) => (
            <li key={`${title}-${row.nodeId}`}>
              <Link
                to={`/app/country/${row.nodeId}`}
                className="flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--exec-surface)]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)]">
                    {row.label}
                  </span>
                  <span className="exec-num shrink-0 text-[14px] text-[var(--exec-ink)]">
                    {pct(row.share)}
                  </span>
                </div>
                <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(2, row.share * 100)}%`,
                      background: "var(--exec-ink-dim)",
                    }}
                  />
                </span>
                <span className="exec-label">
                  {row.role} · {row.region} · criticality{" "}
                  {pct(row.criticality)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Fact({ caption, value }: { caption: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <dt className="exec-label">{caption}</dt>
      <dd className="exec-num text-[1.5rem] leading-none font-bold text-[var(--exec-ink)]">
        {value}
      </dd>
    </div>
  );
}