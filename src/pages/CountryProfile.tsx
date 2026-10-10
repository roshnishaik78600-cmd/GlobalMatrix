import { Link, useParams } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowLeft, ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import { DataType, PageFrame, PageLoading } from "@/components/viz/exec/design";
import { SectionTitle } from "@/components/viz/exec/system";
import { api } from "@/convex/_generated/api";
import { useToggleWatch } from "@/hooks/use-auth-action";
import { NoData } from "@/components/viz/core";
import { ChannelBars } from "@/components/intel/primitives";
import { PathTrace } from "@/components/intel/PathTrace";
import { MacroTrend } from "@/components/viz/MacroTrend";
import { NodeEvidence } from "@/components/viz/NodeEvidence";
import { flagFor } from "@/lib/flags";
import { pct } from "@/lib/format";
import { riskColorForScore } from "@/lib/intel/visual";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";

/**
 * One place, read as a profile.
 *
 * A hero that answers the only three questions worth asking about a country —
 * which one is this, how exposed is it, and which way is it moving — and then
 * five sections that are graphs rather than paragraphs: exposure over time,
 * who it depends on, what it sells and buys, where its energy comes from, and
 * which routes carry it. The flag is present only for a sovereign economy.
 */
export default function CountryProfile() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const data = useQuery(
    api.intel.countryProfile,
    nodeId ? { nodeId } : "skip",
  );
  const trends = useQuery(api.intel.countryTrends);
  const toggleWatch = useToggleWatch();

  if (!nodeId || data === undefined) {
    return (
      <PageLoading
        eyebrow="Country"
        title="Country intelligence"
        lede="Exposure, dependency and the events that land hardest on this place."
      />
    );
  }

  // The query answers null for a node the model does not track. Rendering the
  // old falsy check here produced a complete-looking profile with every metric
  // at zero for a mistyped or stale link.
  if (data === null) {
    return (
      <PageFrame
        eyebrow="Country"
        title="Place not found"
        lede={`GlobalMatrix does not track a place called "${nodeId}".`}
        actions={
          <Link
            to="/app/countries"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3.5" /> Countries
          </Link>
        }
      >
        <div className="lg:col-span-12">
          <NoData reason="This identifier is not a tracked country, chokepoint or corridor." />
        </div>
      </PageFrame>
    );
  }

  const { node, country, exposure, industries, peers, dependents, watched } =
    data;
  const flag = flagFor(nodeId);

  // The trend is the corpus's own 14-day series for this node, not a percentage
  // someone typed in. With no series the page states that rather than inventing
  // an arrow.
  const series = trends?.nodes.find((n) => n.nodeId === nodeId)?.values ?? [];
  const delta = trendDelta(series);

  // The five snapshot dimensions, read from the same exposure walk the rest of
  // the page uses. A channel with no reading is `null`, never zero — those are
  // different claims and the snapshot says which one applies.
  const channelLoad = (c: Channel): number | null =>
    exposure.byChannel.find((x) => x.channel === c)?.load ?? null;
  const strongestRole = industries.reduce<(typeof industries)[number] | null>(
    (best, i) => (!best || i.share > best.share ? i : best),
    null,
  );
  const declaredRoles = industries.filter((i) => i.share > 0).length;

  // What kind of page this is comes from the node, not from whether a macro
  // profile happens to exist. An economy the corpus models before its national
  // accounts have been authored is still a country page; deriving the label
  // from the profile instead labelled Egypt an "Infrastructure profile".
  const isPlace = node.kind === "economy" || node.kind === "bloc";

  return (
    <PageFrame
      eyebrow={isPlace ? "Country profile" : "Infrastructure profile"}
      title={node.label}
      lede={
        country
          ? country.note
          : isPlace
            ? "This economy is tracked in the exposure model, but no national-accounts profile has been authored for it yet, so no macro section is shown rather than one filled with estimates."
            : "An infrastructure node: this entry carries traffic rather than demand, so its exposure is measured by how many pathways route through it."
      }
      actions={
        <>
          <button
            type="button"
            onClick={() => toggleWatch(`NODE:${nodeId}`)}
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
            to="/app/countries"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3.5" /> Countries
          </Link>
        </>
      }
    >
      {/* ---------------------------------------------------------------- Hero --
          The flag, the name, the exposure, the direction. Four objects, and
          they are the entire answer to "how exposed is this place right now". */}
      <div className="lg:col-span-12">
        <div className="card flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:gap-10 lg:p-8">
          <div className="flex min-w-0 items-center gap-4">
            {flag ? (
              <span className="text-[56px] leading-none" aria-hidden>
                {flag}
              </span>
            ) : (
              <span
                className="flex size-16 shrink-0 items-center justify-center rounded-lg border border-[var(--exec-hairline)] text-[18px] font-semibold text-[var(--exec-ink-dim)]"
                aria-hidden
              >
                {node.short.slice(0, 3)}
              </span>
            )}
            <div className="min-w-0">
              <h2 className="t-section text-[var(--exec-ink)]">
                {flag ? flag : ""} {node.label.toUpperCase()}
              </h2>
              <p className="exec-label mt-1">
                {node.region} · {node.kind}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-x-10 gap-y-4 lg:ml-auto">
            <div className="flex flex-col">
              <span className="exec-label">Global exposure</span>
              {/* Four of the tracked nodes carry no exposure at all. A confident
                  hero "0" would read as a measurement of zero; what actually
                  happened is that no observation in the corpus reaches this
                  place, which is a different fact and gets different words. */}
              {exposure.eventCount === 0 ? (
                <>
                  <span className="mt-1 text-[2.25rem] leading-none font-bold tracking-[-0.03em] text-[var(--exec-ink-dim)]">
                    No reading
                  </span>
                  <span className="mt-2 max-w-[16rem] text-[12px] leading-snug text-[var(--exec-ink-dim)]">
                    No event in the current corpus reaches this node, so no
                    exposure has been computed for it.
                  </span>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>

            <div className="flex flex-col">
              <span
                className="exec-label"
                title="Cumulative evidence mass on this node, compared between the first and the last day of the corpus's 14-day window that carries a reading. Days without an observation are excluded rather than counted as zero."
              >
                14-day change
              </span>
              {delta === null ? (
                <span className="mt-1 text-[1.75rem] leading-none font-bold text-[var(--exec-ink-dim)]">
                  —
                </span>
              ) : (
                <span
                  className="exec-num mt-1 text-[1.75rem] leading-none font-bold tracking-[-0.025em]"
                  style={{
                    color:
                      delta > 0.005
                        ? "var(--exec-crimson)"
                        : delta < -0.005
                          ? "var(--exec-emerald)"
                          : "var(--exec-ink-dim)",
                  }}
                >
                  {delta > 0 ? "↑" : delta < 0 ? "↓" : "—"}{" "}
                  {Math.abs(delta * 100).toFixed(1)}%
                </span>
              )}
              <span className="exec-num mt-1 text-[12px] text-[var(--exec-ink-dim)]">
                {delta === null
                  ? "Fewer than two observation days"
                  : `${series.filter((v) => v > 0).length} of ${series.length} days observed`}
                {" · "}
                {exposure.eventCount} events
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------- EXPOSURE SNAPSHOT --
          The five dimensions §16 asks for, in one strip, directly under the
          hero: geopolitical, trade, energy, market sensitivity and supply
          chain. Every value comes from the exposure walk already computed for
          this page; nothing is added or rescaled. */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta="what this place is exposed to"
            right={<DataType type="model" />}
          >
            Exposure snapshot
          </SectionTitle>
          <div className="grid grid-cols-2 divide-y divide-[var(--exec-hairline)] md:grid-cols-3 xl:grid-cols-5 xl:divide-x xl:divide-y-0">
            {(
              [
                { label: "Geopolitical", channel: "diplomatic", note: "diplomatic-channel load" },
                { label: "Trade", channel: "trade", note: "trade-channel load" },
                { label: "Energy", channel: "energy", note: "energy-channel load" },
                { label: "Market sensitivity", channel: "finance", note: "finance-channel load" },
              ] as const
            ).map((cell) => {
              const value = channelLoad(cell.channel);
              return (
                <div
                  key={cell.channel}
                  className="flex min-w-0 flex-col gap-1.5 p-4"
                >
                  <span className="exec-label">{cell.label}</span>
                  {value === null ? (
                    <span className="text-[1.25rem] leading-none font-bold text-[var(--exec-ink-dim)]">
                      No reading
                    </span>
                  ) : (
                    <>
                      <span
                        className="exec-num text-[1.5rem] leading-none font-bold tracking-[-0.02em]"
                        style={{ color: riskColorForScore(value * 100) }}
                      >
                        {(value * 100).toFixed(0)}
                      </span>
                      <span className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.max(2, value * 100)}%`,
                            background: riskColorForScore(value * 100),
                          }}
                        />
                      </span>
                    </>
                  )}
                  <span className="exec-label">{cell.note}</span>
                </div>
              );
            })}
            <div className="flex min-w-0 flex-col gap-1.5 p-4">
              <span className="exec-label">Supply chain</span>
              {strongestRole ? (
                <>
                  <span className="exec-num text-[1.5rem] leading-none font-bold tracking-[-0.02em] text-[var(--exec-ink)]">
                    {pct(strongestRole.share)}
                  </span>
                  <span className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(2, strongestRole.share * 100)}%`,
                        background: "var(--exec-ink-dim)",
                      }}
                    />
                  </span>
                </>
              ) : (
                <span className="text-[1.25rem] leading-none font-bold text-[var(--exec-ink-dim)]">
                  No declared role
                </span>
              )}
              <span className="exec-label">
                {declaredRoles} declared industry role
                {declaredRoles === 1 ? "" : "s"}
                {strongestRole ? ` · strongest: ${strongestRole.label}` : ""}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- EXPOSURE CHART -- */}
      <div className="lg:col-span-7">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="reported, not modelled" right={<DataType type="observed" />}>
            Exposure and growth
          </SectionTitle>
          <MacroTrend nodeId={nodeId} className="flex-1 border-0" />
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="where the load comes from" right={<DataType type="model" />}>
            Load by channel
          </SectionTitle>
          <div className="p-4">
            <ChannelBars
              pressure={Object.fromEntries(
                exposure.byChannel.map((c) => [c.channel, c.load]),
              ) as Record<Channel, number>}
            />
          </div>
          <ul className="flex flex-col divide-y divide-[var(--exec-hairline)] border-t border-[var(--exec-hairline)]">
            {exposure.byChannel
              .slice()
              .sort((a, b) => b.load - a.load)
              .map((c) => (
                <li key={c.channel} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13px] text-[var(--exec-ink)]">
                    {CHANNEL_LABEL[c.channel]}
                  </span>
                  <span className="exec-num shrink-0 text-[13px] font-semibold text-[var(--exec-ink)]">
                    {(c.load * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      {/* ------------------------------------------------- MAJOR CONNECTIONS -- */}
      <div className="lg:col-span-6">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="declared strength × live load">
            Major connections
          </SectionTitle>
          {peers.length === 0 ? (
            <NoData reason="No structural dependency is declared for this node." />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
              {peers.map((peer) => (
                <li key={peer.nodeId}>
                  <Link
                    to={`/app/country/${peer.nodeId}`}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)]">
                        {peer.label}
                      </span>
                      <span className="exec-num shrink-0 text-[14px] text-[var(--exec-ink)]">
                        {pct(peer.strength)}
                      </span>
                    </div>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(2, peer.strength * 100)}%`,
                          background: "var(--exec-ink-dim)",
                        }}
                      />
                    </span>
                    <span className="exec-label">
                      {peer.basis} · {peer.region} · live load {pct(peer.load)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="lg:col-span-6">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle
            meta={dependents.length > 0 ? `${dependents.length} depend on this node` : "no dependents recorded"}
          >
            Who depends on this
          </SectionTitle>
          {dependents.length === 0 ? (
            <NoData reason="No node in the corpus declares a structural dependency on this one." />
          ) : (
            <ul className="grid grid-cols-1 divide-y divide-[var(--exec-hairline)] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              {dependents.map((dep) => (
                <li key={dep.nodeId}>
                  <Link
                    to={`/app/country/${dep.nodeId}`}
                    className="flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)]">
                        {dep.label}
                      </span>
                      <span className="exec-num shrink-0 text-[14px] text-[var(--exec-ink)]">
                        {pct(dep.strength)}
                      </span>
                    </div>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(2, dep.strength * 100)}%`,
                          background: "var(--exec-crimson)",
                        }}
                      />
                    </span>
                    <span className="exec-label">{dep.basis}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ TRADE / ENERGY -- */}
      {country ? (
        <>
          <div className="lg:col-span-6">
            <div className="card flex h-full min-w-0 flex-col">
              <SectionTitle meta="structural parameter" right={<DataType type="model" />}>
                Trade and output
              </SectionTitle>
              <dl className="grid grid-cols-2 divide-x divide-y divide-[var(--exec-hairline)]">
                <Macro caption="Share of global output" value={pct(country.macro.outputShare)} />
                <Macro caption="Trade openness" value={pct(country.macro.tradeOpenness)} />
                <Macro caption="Energy import dependence" value={pct(country.macro.energyImportDependence)} />
                <Macro caption="External buffer" value={pct(country.macro.externalBuffer)} />
              </dl>
            </div>
          </div>

          <div className="lg:col-span-6">
            <div className="card flex h-full min-w-0 flex-col">
              <SectionTitle meta="modelled · illustrative shares" right={<DataType type="model" />}>
                Energy
              </SectionTitle>
              <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
                {country.energy.map((source) => (
                  <li key={source.source} className="flex flex-col gap-2 p-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)]">
                        {source.source}
                      </span>
                      <span className="exec-num shrink-0 text-[14px] text-[var(--exec-ink)]">
                        {pct(source.share)}
                      </span>
                    </div>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(2, source.share * 100)}%`,
                          background: source.nodeId
                            ? "var(--exec-crimson)"
                            : "var(--exec-ink-dim)",
                        }}
                      />
                    </span>
                    <span className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                      {source.nodeId ? `Routed via ${source.nodeId} · ` : ""}
                      {source.note}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      ) : null}

      {/* -------------------------------------------------------- SUPPLY CHAIN -- */}
      <div className="lg:col-span-6">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="declared share × live contribution" right={<DataType type="model" />}>
            Supply chain
          </SectionTitle>
          {industries.length === 0 ? (
            <NoData reason="No declared industry role in the current sector taxonomy." />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
              {industries.map((industry) => (
                <li key={industry.id}>
                  <Link
                    to={`/app/industry/${industry.id}`}
                    className="group flex flex-col gap-2 p-4 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)]">
                          {industry.label}
                        </span>
                        <ArrowUpRight className="size-3.5 shrink-0 text-[var(--exec-ink-dim)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </span>
                      <span className="exec-num shrink-0 text-[14px] text-[var(--exec-ink)]">
                        {industry.share > 0 ? pct(industry.share) : "—"}
                      </span>
                    </div>
                    <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                      <span
                        className="block h-full rounded-full"
                        style={{
                          width: `${Math.max(2, industry.share * 100)}%`,
                          background: "var(--exec-ink-dim)",
                        }}
                      />
                    </span>
                    <span className="exec-label">
                      {industry.basis || "No declared role"} · fragility{" "}
                      {pct(industry.fragility)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ RECENT EVENTS -- */}
      <div className="lg:col-span-6">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle
            meta={`${exposure.contributions.length} pathway exposures`}
            right={<DataType type="scenario" />}
          >
            Recent events
          </SectionTitle>
          {exposure.contributions.length === 0 ? (
            <NoData reason="No event in the current corpus reaches this node." />
          ) : (
            <motion.ul
              initial="hidden"
              animate="shown"
              variants={{ shown: { transition: { staggerChildren: 0.05 } } }}
              className="flex flex-col divide-y divide-[var(--exec-hairline)]"
            >
              {[...exposure.contributions]
                .sort((a, b) => b.contribution - a.contribution)
                .slice(0, 8)
                .map((c) => (
                  <motion.li
                    key={`${c.eventId}-${c.title}`}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      shown: { opacity: 1, y: 0 },
                    }}
                    transition={{ duration: 0.28 }}
                  >
                    <Link
                      to={`/app/event/${c.eventId}`}
                      className="flex items-baseline gap-3 p-4 transition-colors hover:bg-[var(--exec-surface)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 block text-[14px] leading-snug text-[var(--exec-ink)]">
                          {c.title}
                        </span>
                        <span className="exec-label mt-1 block">
                          {CHANNEL_LABEL[c.channel]} · via {c.viaNodeId}
                        </span>
                      </span>
                      <span className="exec-num shrink-0 text-[14px] font-semibold text-[var(--exec-ink)]">
                        {pct(c.contribution)}
                      </span>
                    </Link>
                  </motion.li>
                ))}
            </motion.ul>
          )}
        </div>
      </div>

      {/* --------------------------------------------------------- EVIDENCE -- */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle meta="measured, not modelled" right={<DataType type="observed" />}>
            Reported evidence
          </SectionTitle>
          <NodeEvidence nodeId={nodeId} />
        </div>
      </div>

      {/* The arithmetic, term by term. Last, because it is the audit view rather
          than the summary view. */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta={`${exposure.contributions.length} exposures across ${exposure.eventCount} events`}
          >
            How this load was built
          </SectionTitle>
          <PathTrace contributions={exposure.contributions} limit={8} />
        </div>
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ parts -- */

/**
 * The signed change across the corpus's own 14-day series.
 *
 * The series is *sparse by construction*: a day carries exposure only if that
 * day had an observation touching this node, so most slots are legitimately
 * zero. Comparing the first slot to the last therefore divides by zero for most
 * countries, which is how a 0.6 reading ends up rendered as a six-figure
 * percentage. The comparison is made between the first and the last day that
 * actually carries a reading, which is the only comparison the series supports.
 *
 * Returns `null` — rather than zero — when fewer than two days carry a reading,
 * because "no readings" and "no movement" are different facts and only one of
 * them is a flat line.
 */
function trendDelta(values: number[]): number | null {
  const reading = values.filter((v) => v > 0);
  if (reading.length < 2) return null;
  const first = reading[0];
  const last = reading[reading.length - 1];
  if (first <= 0) return null;
  return (last - first) / first;
}

function Macro({ caption, value }: { caption: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <dt className="exec-label">{caption}</dt>
      <dd className="exec-num text-[1.5rem] leading-none font-bold text-[var(--exec-ink)]">
        {value}
      </dd>
    </div>
  );
}