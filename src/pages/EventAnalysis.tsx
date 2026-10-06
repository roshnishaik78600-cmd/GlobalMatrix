import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useConvex } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Trash2,
  ExternalLink,
} from "lucide-react";
import {
  DataType,
  ErrorState,
  PageFrame,
  PageLoading,
} from "@/components/viz/exec/design";
import { SectionTitle } from "@/components/viz/exec/system";
import { api } from "@/convex/_generated/api";
import { useToggleWatch, useAuthAction } from "@/hooks/use-auth-action";
import { NoData } from "@/components/viz/core";
import { WorldMap } from "@/components/viz/WorldMap";
import { GraphExplorer } from "@/components/viz/Flow";
import { BandChip, IntervalBar } from "@/components/intel/primitives";
import { pct, shortDate, signed, timestamp } from "@/lib/format";
import { getNode } from "@/lib/intel/nodes";
import { riskColorForScore } from "@/lib/intel/visual";
import {
  BAND_LABEL,
  CHANNEL_LABEL,
  CHANNELS,
  SOURCE_CLASS_LABEL,
  STAGE_LABEL,
  type EventAssessment,
} from "@/lib/intel/types";

/**
 * One event, read in the order a reader asks the questions.
 *
 * MAP → IMPACT SNAPSHOT → WHAT HAPPENS NEXT → PROPAGATION GRAPH → TIMELINE →
 * INDUSTRY / MARKET → EVIDENCE. The footprint comes before the arithmetic, the
 * propagation graph takes the full row because it is the signature panel, and
 * every projection states whether it is observed, modelled or scenario before
 * the reader sees a number.
 */
export default function EventAnalysis() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const data = useQuery(
    api.intel.eventDetail,
    eventId ? { eventId } : "skip",
  );
  const graph = useQuery(
    api.intel.eventGraph,
    eventId ? { eventId } : "skip",
  );
  const chain = useQuery(
    api.intel.eventChain,
    eventId ? { eventId } : "skip",
  );
  const toggleWatch = useToggleWatch();
  const addAnnotation = useMutation(api.research.addAnnotation);
  const deleteAnnotation = useMutation(api.research.deleteAnnotation);
  const convex = useConvex();
  const { requireAuth, isAuthenticated } = useAuthAction();

  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [briefError, setBriefError] = useState<string | null>(null);

  // `undefined` means the query is still in flight; `null` means the corpus has
  // no assessment under this id. Collapsing the two left an unknown event id
  // showing "Resolving…" forever.
  if (!eventId || data === undefined) {
    return (
      <PageLoading
        eyebrow="Event"
        title="Event analysis"
        lede="Resolving the assessment, its evidence and its propagation."
      />
    );
  }

  if (data === null) {
    return (
      <PageFrame
        eyebrow="Event"
        title="Event not found"
        lede={`No event in the current corpus carries the id "${eventId}". It may have been renamed, or the link may be stale.`}
        actions={
          <Link
            to="/app/events"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3.5" /> Events
          </Link>
        }
      >
        <div className="lg:col-span-12">
          <NoData reason="This identifier is not in the current corpus." />
        </div>
      </PageFrame>
    );
  }

  const { assessment, risk, watched, annotations, brief } = data;
  const s = assessment.scenario;
  const primary = risk.find((r) => r.horizonDays === 30) ?? risk[0];
  const where = topExposures(assessment, 8);
  // The place the event lands on hardest, from the same exposure walk the map
  // draws. Never invented: with no resolved exposure the chip says so.
  const primaryPlace = where[0] ? getNode(where[0].nodeId).label : null;

  // Derived, never invented — every figure below is read straight off the
  // assessment the page already has, for the "what happens next" panel.
  const sourceCount = new Set(s.signals.map((x) => x.source)).size;
  const latestObservation = s.signals.reduce<(typeof s.signals)[number] | null>(
    (best, x) => (!best || x.observedAt > best.observedAt ? x : best),
    null,
  );
  const risk7 = risk.find((r) => r.horizonDays === 7) ?? risk[0];
  const risk90 = risk.find((r) => r.horizonDays === 90) ?? risk[risk.length - 1];
  const dominantPathway = s.pathways.find(
    (p) => p.channel === assessment.dominantChannel,
  );
  const lagWindow = dominantPathway
    ? `${dominantPathway.lagDays[0]}–${dominantPathway.lagDays[1]} days`
    : null;

  const onGenerateBrief = async () => {
    if (!requireAuth("Generate and save analyst briefs")) return;
    setPending(true);
    setBriefError(null);
    try {
      const result = await convex.action(api.brief.generateBrief, { eventId });
      if (!result.ok) setBriefError(result.message);
    } catch (error) {
      // The action already returns structured refusals for every expected
      // outcome, so reaching this branch means something unexpected went wrong
      // at the transport layer. Log the detail; show the reader a plain line.
      console.error("[brief] action failed:", error);
      setBriefError(
        "The analyst service could not be reached. Your evidence is unaffected — try again shortly.",
      );
    } finally {
      setPending(false);
    }
  };

  const onSaveAnnotation = async () => {
    const body = draft.trim();
    if (!body) return;
    if (!requireAuth("Save research notes")) return;
    await addAnnotation({ eventId, body });
    setDraft("");
  };

  return (
    <PageFrame
      eyebrow={s.reference}
      title={s.title}
      lede={s.summary}
      actions={
        <>
          <button
            type="button"
            onClick={() => toggleWatch(`EVENT:${s.id}`)}
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
            to="/app/events"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3.5" /> Back to events
          </Link>
        </>
      }
    >
      {/* The one metadata line: category, country, time. Everything the reader
          needs to place the event before they read anything else. */}
      <div className="lg:col-span-12">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="chip text-[var(--exec-cyan)]">
            {CHANNEL_LABEL[assessment.dominantChannel]}
          </span>
          <span className="chip">{primaryPlace ?? "No dominant location"}</span>
          <span className="exec-label">First signal {shortDate(s.firstSignalAt)}</span>
          <span className="exec-label">Detected {shortDate(s.detectedAt)}</span>
          <span className="exec-label">{STAGE_LABEL[s.stage]}</span>
          <DataType type="scenario" />
          <div className="flex flex-wrap items-center gap-1.5">
            {s.tags.slice(0, 4).map((tag) => (
              <span key={tag} className="chip text-[var(--exec-ink-dim)]">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- EVENT MAP ------
          First after the metadata line: where this lands, before any score.
          The reader should see the footprint before the arithmetic. */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle meta={`${where.length} exposed places · hover to preview`}>
            Where it spreads
          </SectionTitle>
          {where.length > 0 ? (
            <>
              <WorldMap
                nodes={where.map((w) => ({
                  nodeId: w.nodeId,
                  label: getNode(w.nodeId).label,
                  load: w.load,
                  eventCount: 0,
                  criticality: getNode(w.nodeId).criticality,
                }))}
                events={[]}
                className="map-frame"
                onInspect={(id) => navigate(`/app/country/${id}`)}
              />
              <ul className="grid grid-cols-2 divide-x divide-y divide-[var(--exec-hairline)] border-t border-[var(--exec-hairline)] sm:grid-cols-3 lg:grid-cols-4">
                {where.map((w) => (
                  <li key={w.nodeId}>
                    <Link
                      to={`/app/country/${w.nodeId}`}
                      className="flex items-baseline justify-between gap-2 px-4 py-3 transition-colors hover:bg-[var(--exec-surface)]"
                    >
                      <span className="min-w-0 truncate text-[14px] text-[var(--exec-ink)]">
                        {getNode(w.nodeId).label}
                      </span>
                      <span className="exec-num shrink-0 text-[13px] font-semibold text-[var(--exec-ink)]">
                        {(w.load * 100).toFixed(0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <NoData reason="This event resolves no node-level exposure." />
          )}
        </div>
      </div>

      {/* ------------------------------------------------------ IMPACT SNAPSHOT -- */}
      <div className="lg:col-span-12">
        <SectionTitle
          meta="30-day composite · 80% interval"
          right={<DataType type="scenario" />}
        >
          Impact snapshot
        </SectionTitle>

        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* The score itself, at a size it can be read from across a desk. */}
          <div className="flex flex-col gap-3 sm:col-span-2 lg:col-span-2">
            <div className="flex items-end gap-4">
              <span
                className="exec-num text-[4.5rem] leading-none font-bold tracking-[-0.04em]"
                style={{ color: riskColorForScore(primary.score) }}
              >
                {primary.score.toFixed(1)}
              </span>
              <span className="mb-2 flex flex-col gap-1.5">
                <span className="exec-label">out of 100</span>
                <BandChip band={primary.band} />
              </span>
            </div>
            {/* The interval, drawn at full width. A score without its interval is
                a number pretending to be a fact. */}
            <IntervalBar
              score={primary.score}
              low={primary.low}
              high={primary.high}
              band={primary.band}
              className="h-7"
            />
            <p className="exec-num text-[13px] text-[var(--exec-ink-dim)]">
              80% interval {primary.low.toFixed(0)}–{primary.high.toFixed(0)} ·
              wider means less certain, not worse
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Readout
              caption="Model confidence"
              value={pct(s.confidence)}
              note="Corroboration across independent source classes"
            />
            <Readout
              caption="Evidence strength"
              value={pct(assessment.evidenceStrength)}
              note="Reliability × weight × corroborations"
            />
          </div>
          <div className="flex flex-col gap-4">
            <Readout
              caption="Novelty"
              value={pct(s.novelty)}
              note="Distance from the corpus's own precedent set"
            />
            <Readout
              caption="Signal velocity"
              value={pct(s.velocity)}
              note="Rate of new observation, 30-day window"
            />
          </div>
        </div>
      </div>

      {/* --------------------------------------------- WHAT HAPPENS NEXT --
          Five honest states in one strip: what is recorded, where it stands,
          what the model projects, what would confirm or break it, and how
          certain the model is. Every figure is read off this event's own
          assessment — nothing is forecast beyond the horizons already shown. */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta="observed · current · next · watch · confidence"
            right={<DataType type="scenario" />}
          >
            What happens next
          </SectionTitle>
          <div className="grid grid-cols-1 divide-y divide-[var(--exec-hairline)] md:grid-cols-2 xl:grid-cols-5 xl:divide-x xl:divide-y-0">
            <div className="flex min-w-0 flex-col gap-2 p-4">
              <span className="exec-label text-[var(--exec-emerald)]">
                OBSERVED
              </span>
              <p className="text-[14px] leading-snug text-[var(--exec-ink)]">
                {s.signals.length} observations across {sourceCount} source
                {sourceCount === 1 ? "" : "s"} · first{" "}
                {shortDate(s.firstSignalAt)} · latest{" "}
                {latestObservation
                  ? shortDate(latestObservation.observedAt)
                  : "not dated"}
                .
              </p>
              <p className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                What the corpus has actually recorded. Nothing here is inferred.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-2 p-4">
              <span className="exec-label text-[var(--exec-amber)]">
                CURRENT IMPACT
              </span>
              <p className="text-[14px] leading-snug text-[var(--exec-ink)]">
                Stage {STAGE_LABEL[s.stage]} · 30-day composite{" "}
                {primary.score.toFixed(1)} ({BAND_LABEL[primary.band]}), landing
                hardest on {primaryPlace ?? "no resolved place"}.
              </p>
              <p className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                Where the modelled exposure already sits.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-2 p-4">
              <span className="exec-label text-[var(--exec-cyan)]">
                POTENTIAL NEXT EFFECTS
              </span>
              <p className="text-[14px] leading-snug text-[var(--exec-ink)]">
                Composite at {risk7.score.toFixed(1)} (7d),{" "}
                {primary.score.toFixed(1)} (30d), {risk90.score.toFixed(1)} (90d)
                {lagWindow
                  ? `; ${CHANNEL_LABEL[assessment.dominantChannel].toLowerCase()} transmits with a ${lagWindow} lag`
                  : ""}
                .
              </p>
              <p className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                MODEL OUTPUT — possibilities under current pathways, not
                predictions.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-2 p-4">
              <span className="exec-label text-[var(--exec-cyan)]">WATCH</span>
              <p className="text-[14px] leading-snug text-[var(--exec-ink)]">
                {CHANNEL_LABEL[assessment.dominantChannel]} pressure on{" "}
                {primaryPlace ?? "the top exposed place"} over the next{" "}
                {lagWindow ?? "coming days"}.
              </p>
              <p className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                A move there confirms the modelled path; a flat reading weakens
                it.
              </p>
            </div>

            <div className="flex min-w-0 flex-col gap-2 p-4">
              <span className="exec-label text-[var(--exec-ink-dim)]">
                CONFIDENCE
              </span>
              <p className="text-[14px] leading-snug text-[var(--exec-ink)]">
                {pct(s.confidence)} model confidence on{" "}
                {pct(assessment.evidenceStrength)} evidence strength · band{" "}
                {BAND_LABEL[primary.band]}.
              </p>
              <p className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                80% interval {primary.low.toFixed(0)}–{primary.high.toFixed(0)}
                {' '}— width is uncertainty, not severity.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- HOW IT MOVES --
          Full width: this is the signature panel of the page, so it gets the
          whole row rather than sharing it. */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle meta="event → channel → place" className="border-violet">
            How it moves
          </SectionTitle>
          {graph === undefined ? (
            <NoData reason="Resolving the propagation graph." />
          ) : graph === null ? (
            <NoData reason="No propagation path resolved for this event." />
          ) : (
            <>
              <GraphExplorer nodes={graph.nodes} edges={graph.edges} height={440} />
              <div className="border-t border-[var(--exec-hairline)] px-4 py-3">
                <p className="exec-label">Channel pressure</p>
                <ul className="mt-2 flex flex-col gap-2">
                  {CHANNELS.map((channel) => {
                    const value = assessment.channelPressure[channel];
                    const pathway = s.pathways.find((p) => p.channel === channel);
                    return (
                      <li key={channel} className="flex items-center gap-3">
                        <span className="w-28 shrink-0 text-[13px] text-[var(--exec-ink-dim)]">
                          {CHANNEL_LABEL[channel]}
                        </span>
                        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--exec-surface)]">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.max(1, value * 100)}%`,
                              background: riskColorForScore(value * 100),
                            }}
                          />
                        </span>
                        <span className="exec-num w-10 shrink-0 text-right text-[13px] text-[var(--exec-ink)]">
                          {(value * 100).toFixed(0)}%
                        </span>
                        <span className="exec-num w-16 shrink-0 text-right text-[12px] text-[var(--exec-ink-dim)]">
                          {pathway
                            ? `${pathway.lagDays[0]}–${pathway.lagDays[1]}d`
                            : "no lag"}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- TIMELINE -- */}
      <div className="lg:col-span-5">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle
            meta="central estimate with 80% interval"
            right={<DataType type="model" />}
          >
            Timeline
          </SectionTitle>
          <ol className="flex min-w-0 flex-col p-4">
            {risk.map((r, i) => (
              <motion.li
                key={r.horizonDays}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.07 }}
                className="relative flex flex-col gap-2 pb-5 pl-6 last:pb-0"
              >
                {/* The rail is the `li`'s own left border, so it cannot drift
                    out of alignment with the node that heads it. */}
                <span
                  aria-hidden
                  className="absolute top-2 bottom-0 left-[7px] w-px bg-[var(--exec-hairline)] last:hidden"
                />
                <span
                  aria-hidden
                  className="absolute top-1 left-0 size-4 rounded-full border-2 bg-[var(--card)]"
                  style={{ borderColor: riskColorForScore(r.score) }}
                />
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] font-medium text-[var(--exec-ink)]">
                    {r.horizonDays} days out
                  </span>
                  <span
                    className="exec-num text-[1.25rem] leading-none font-bold"
                    style={{ color: riskColorForScore(r.score) }}
                  >
                    {r.score.toFixed(1)}
                  </span>
                </div>
                <IntervalBar
                  score={r.score}
                  low={r.low}
                  high={r.high}
                  band={r.band}
                />
                <div className="flex items-center gap-3">
                  <BandChip band={r.band} />
                  <span className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
                    ±{(r.high - r.score).toFixed(1)} points
                  </span>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>

      {/* ------------------------------------------- INDUSTRY EXPOSURE ----
          What this event reaches at sector level, from the same nine-stage
          chain the Impact page renders — one shared model, two surfaces. */}
      <div className="lg:col-span-7">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta="structural share · model output"
            right={<DataType type="model" />}
          >
            Industry exposure
          </SectionTitle>
          {chain === undefined ? (
            <NoData reason="Resolving industry reach for this event." />
          ) : chain === null || chain.industries.length === 0 ? (
            <NoData reason="No tracked industry shares enough structural exposure with the nodes this event reaches to rank." />
          ) : (
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {chain.industries.map((row) => (
                <li
                  key={row.id}
                  className="flex min-w-0 items-baseline justify-between gap-3 px-4 py-3"
                >
                  <Link
                    to={`/app/industry/${row.id}`}
                    className="min-w-0 truncate text-[14px] text-[var(--exec-ink)] hover:text-[var(--exec-cyan)]"
                  >
                    {row.label}
                  </Link>
                  <span className="flex shrink-0 items-baseline gap-3">
                    {row.channel ? (
                      <span className="exec-label">
                        {CHANNEL_LABEL[row.channel]}
                      </span>
                    ) : null}
                    <span className="exec-num text-[13px] font-semibold text-[var(--exec-ink)]">
                      {pct(Math.min(1, row.share), 1)}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ------------------------------------------------ MARKET CONNECTIONS -- */}
      <div className="lg:col-span-7">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta="finance channel · model output"
            right={<DataType type="model" />}
          >
            Market connections
          </SectionTitle>
          {chain === undefined ? (
            <NoData reason="Resolving finance-channel pathways." />
          ) : chain === null || chain.market.length === 0 ? (
            <NoData reason="This event carries no finance-channel pathway, so it has no modelled market transmission. No price feed is connected either, so nothing here could be a quote." />
          ) : (
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {chain.market.map((row) => (
                <li key={`${row.nodeId}-${row.channel}`} className="min-w-0 px-4 py-3">
                  <p className="truncate text-[14px] text-[var(--exec-ink)]">
                    {row.label}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                    {row.mechanism}
                  </p>
                  <p className="exec-label mt-1">
                    lag {row.lagDays[0]}–{row.lagDays[1]}d · confidence{" "}
                    {pct(row.confidence)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------------- COMPANIES --
          An honest absence, not a blank: no issuer-level data is connected, so
          the panel states why no company is named rather than naming one. */}
      <div className="lg:col-span-5">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle meta="not measured by this build">Companies</SectionTitle>
          <p className="p-4 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
            {chain?.companyReason ??
              "Company-level exposure is not measured by this build."}
          </p>
        </div>
      </div>

      {/* ---------------------------------------------------------- EVIDENCE -- */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta={`${s.signals.length} observations · newest first`}
            right={<DataType type="scenario" />}
          >
            Evidence
          </SectionTitle>

          {/* Source cards, not a table. A ledger needs to be *scanned* — source,
              reliability, corroboration and anomaly side by side per signal — and
              a table makes the reader widen a column to get one of those. */}
          <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {[...s.signals]
              .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
              .map((signal, i) => (
                <motion.article
                  key={`${signal.source}-${signal.observedAt}-${i}`}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.28, delay: Math.min(i * 0.03, 0.2) }}
                  className="card flex min-w-0 flex-col gap-2 p-4"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-[13px] font-semibold text-[var(--exec-ink)]">
                      {signal.source}
                    </span>
                    <span className="exec-num shrink-0 text-[12px] text-[var(--exec-ink-dim)]">
                      {shortDate(signal.observedAt)}
                    </span>
                  </div>
                  <p className="line-clamp-3 text-[14px] leading-snug text-[var(--exec-ink)]">
                    {signal.headline}
                  </p>
                  <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--exec-hairline)] pt-3">
                    <span className="exec-label">
                      {SOURCE_CLASS_LABEL[signal.sourceClass]}
                    </span>
                    <span className="exec-label">
                      {CHANNEL_LABEL[signal.channel]}
                    </span>
                    <span
                      className="exec-num ml-auto text-[12px] text-[var(--exec-ink-dim)]"
                      title="Reliability × corroborations, and the anomaly z-score against this source's own history"
                    >
                      rel {pct(signal.reliability)} · ×{signal.corroborations} ·{" "}
                      {signal.anomalyZ.toFixed(1)}σ
                    </span>
                  </div>
                </motion.article>
              ))}
          </div>
        </div>
      </div>

      {/* Risk decomposition: the arithmetic behind the score, term by term. */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle meta="share of the 0–100 composite">
            Risk decomposition
          </SectionTitle>
          <ul className="grid grid-cols-1 divide-y divide-[var(--exec-hairline)] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {assessment.risk[30].drivers.map((driver) => (
              <li key={driver.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)]">
                    {driver.label}
                  </span>
                  <span className="exec-num shrink-0 text-[14px] font-semibold text-[var(--exec-ink)]">
                    {signed(driver.contribution)}
                  </span>
                </div>
                <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.min(100, Math.abs((driver.contribution / 30) * 100))}%`,
                      background:
                        driver.channel === "energy"
                          ? "var(--exec-crimson)"
                          : "var(--exec-ink-dim)",
                    }}
                  />
                </span>
                <p className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                  {driver.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Brief and annotations: the two account-gated surfaces on this page. */}
      <div className="lg:col-span-7">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle
            meta={brief ? `Generated ${timestamp(brief.createdAt)}` : "Not generated"}
          >
            Analyst brief
          </SectionTitle>
          <div className="flex min-w-0 flex-1 flex-col gap-4 p-4">
            {brief ? (
              <>
                <p className="text-[15px] leading-relaxed text-[var(--exec-ink)]">
                  {brief.thesis}
                </p>
                {brief.channels.length > 0 ? (
                  <div>
                    <p className="exec-label">Transmission reading</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {brief.channels.map((c, i) => (
                        <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                          <span className="exec-num shrink-0 text-[12px] text-[var(--exec-cyan)]">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {brief.caveats.length > 0 ? (
                  <div>
                    <p className="exec-label">Caveats &amp; falsifiers</p>
                    <ul className="mt-2 flex flex-col gap-2">
                      {brief.caveats.map((c, i) => (
                        <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                          <span aria-hidden>—</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </>
            ) : (
              <ErrorState
                title="No brief saved for this event"
                reason="Generate a written reading of the evidence set above. A brief may only re-weigh observations already in the ledger — it cannot introduce new facts — and it must return its caveat list alongside the thesis."
              />
            )}

            <div className="mt-auto flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={pending}
                onClick={onGenerateBrief}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--exec-ink)] px-4 py-2.5 text-[13px] font-semibold text-[var(--exec-base)] transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                <Sparkles className="size-3.5" />
                {pending ? "Generating…" : brief ? "Regenerate brief" : "Generate brief"}
              </button>
              {brief ? (
                <span className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
                  {brief.model}
                </span>
              ) : null}
            </div>
            {briefError ? (
              <p className="text-[13px] text-[var(--exec-crimson)]">{briefError}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="lg:col-span-5">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta={`${annotations.length} notes`}>
            Research annotations
          </SectionTitle>
          <div className="flex min-w-0 flex-1 flex-col p-4">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              maxLength={2000}
              aria-label="Write a research note"
              placeholder={
                isAuthenticated
                  ? "Record a reading, a caveat, or a falsification test…"
                  : "Sign in to write private research notes…"
              }
              disabled={!isAuthenticated}
              className="w-full resize-none rounded-lg border border-[var(--exec-hairline)] bg-[var(--exec-base)] px-3 py-2.5 text-[14px] leading-relaxed outline-none placeholder:text-[var(--exec-ink-dim)] focus:border-[var(--exec-cyan)] disabled:opacity-60"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
                {draft.length}/2000
              </span>
              <button
                type="button"
                onClick={onSaveAnnotation}
                disabled={!draft.trim()}
                className="rounded-full border border-[var(--exec-hairline-strong)] px-4 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)] disabled:opacity-40"
              >
                Save note
              </button>
            </div>

            {annotations.length > 0 ? (
              <ul className="mt-4 flex flex-col divide-y divide-[var(--exec-hairline)] border-t border-[var(--exec-hairline)]">
                {annotations
                  .slice()
                  .sort((a, b) => b.createdAt - a.createdAt)
                  .map((note) => (
                    <li key={note.id} className="group flex gap-3 py-3">
                      <p className="flex-1 text-[14px] leading-relaxed text-[var(--exec-ink)]">
                        {note.body}
                      </p>
                      <button
                        type="button"
                        aria-label="Delete annotation"
                        onClick={() => deleteAnnotation({ annotationId: note.id })}
                        className="shrink-0 text-[var(--exec-ink-dim)] opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 hover:text-[var(--exec-crimson)]"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-4 border-t border-[var(--exec-hairline)] pt-4 text-[13px] text-[var(--exec-ink-dim)]">
                No annotations yet. Notes are private to your account.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="lg:col-span-12">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--exec-ink-dim)]">
          <ExternalLink className="size-3.5 shrink-0" aria-hidden />
          Every figure on this page is model output over a scenario corpus. Check
          the evidence cards above for the signals it was computed from.
        </p>
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ parts -- */

/**
 * The exposed places, ranked.
 *
 * Derived from the same pathways the channels are, so the map and the ranked
 * list beneath it are two views of one number rather than two numbers.
 */
function topExposures(assessment: EventAssessment, limit: number) {
  const byNode = new Map<string, number>();
  for (const pathway of assessment.scenario.pathways) {
    for (const exposure of pathway.exposures) {
      const term = exposure.impact * pathway.magnitude * pathway.confidence;
      byNode.set(exposure.nodeId, (byNode.get(exposure.nodeId) ?? 0) + term);
    }
  }
  const max = Math.max(...byNode.values(), 0.0001);
  return [...byNode.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([nodeId, load]) => ({ nodeId, load: load / max }));
}



function Readout({
  caption,
  value,
  note,
}: {
  caption: string;
  value: string;
  note: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="exec-label">{caption}</span>
      <span className="exec-num text-[1.5rem] leading-none font-bold text-[var(--exec-ink)]">
        {value}
      </span>
      <span className="text-[12px] leading-snug text-[var(--exec-ink-dim)]">{note}</span>
    </div>
  );
}