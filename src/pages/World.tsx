import { Fragment, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRight, X } from "lucide-react";
import { api } from "@/convex/_generated/api";
import {
  Action,
  EmptyState,
  ErrorState,
  PageFrame,
  PageLoading,
  Segmented,
} from "@/components/viz/exec/design";
import { Bar, NoData, Skeleton } from "@/components/viz/core";
import { WorldMap, isPlottable, type MapNode } from "@/components/viz/WorldMap";
import { NodeEvidence } from "@/components/viz/NodeEvidence";
import { SourceLine } from "@/components/viz/Provenance";
import { useFocus, MAP_LAYERS } from "@/lib/focus";
import { getNode } from "@/lib/intel/nodes";
import { buildStages, type ChainStage } from "@/lib/intel/chain";
import { riskColorForScore } from "@/lib/intel/visual";
import {
  BAND_LABEL,
  CHANNEL_LABEL,
  STAGE_LABEL,
  type Channel,
  type RiskBand,
  type Stage,
} from "@/lib/intel/types";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import { macroSeries, useMacroData } from "@/hooks/use-verified-data";
import type { Provenance } from "@/lib/sources";
import { cn } from "@/lib/utils";

/**
 * Event → World.
 *
 * One event, followed outward: what happened, how it propagates, where the
 * impact lands, which channels carry it, and what evidence backs each claim.
 *
 * Three rules this page enforces structurally:
 *
 * 1. Exactly one propagation visual — the stage path. The map shows geography,
 *    the table compares economies; nothing repeats the chain a second time.
 * 2. Every figure states its basis. Observed, modelled and unmeasured never
 *    share a visual language, and a stage with no rows says "Not measured"
 *    rather than rendering a zero nobody measured.
 * 3. Selection is page-local: the map and the side panel share one selected
 *    place without opening the shell's inspect drawer on top of themselves.
 */

/* ------------------------------------------------------------ Data types -- */

/** The fields of `intel.detectionFeed` rows this page reads. */
interface EventRow {
  id: string;
  reference: string;
  title: string;
  summary: string;
  stage: Stage;
  detectedAt: string;
  dominantChannel: Channel;
  score30: number;
  band: RiskBand;
  regions: string[];
}

/** The fields of `intel.signalMatrix` rows this page reads. */
interface MatrixRow {
  nodeId: string;
  label: string;
  short: string;
  region: string;
  geopolitical: number;
  trade: number;
  energy: number;
  market: number;
  supply: number;
  overall: number;
  eventCount: number;
}

/* ------------------------------------------------------- Basis language -- */

type BadgeBasis = "observed" | "model" | "scenario" | "unavailable";

const BASIS_META: Record<
  BadgeBasis,
  { label: string; colour: string; help: string }
> = {
  observed: {
    label: "OBSERVED",
    colour: "var(--exec-emerald)",
    help: "Reported verbatim by a named external source.",
  },
  model: {
    label: "MODELLED",
    colour: "var(--exec-violet)",
    help: "Computed by GlobalMatrix from its own published formula.",
  },
  scenario: {
    label: "SCENARIO",
    colour: "var(--exec-amber)",
    help: "A hypothetical perturbation. Nothing here has happened.",
  },
  unavailable: {
    label: "UNAVAILABLE",
    colour: "var(--exec-ink-muted)",
    help: "No verified reading available. Never shown as zero.",
  },
};

/** The one data-type chip used across this page: dot + text, never colour alone. */
function BasisChip({
  basis,
  className,
}: {
  basis: BadgeBasis;
  className?: string;
}) {
  const meta = BASIS_META[basis];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap",
        className,
      )}
      title={meta.help}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: meta.colour }}
        aria-hidden
      />
      <span className="exec-label" style={{ color: meta.colour }}>
        {meta.label}
      </span>
    </span>
  );
}

/** A tiny status tag: dot + word, with the exact rule spelled out on hover. */
function StatusTag({
  label,
  colour,
  help,
  className,
}: {
  label: string;
  colour: string;
  help: string;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap",
        className,
      )}
      title={help}
    >
      <span
        className="size-1.5 shrink-0 rounded-full"
        style={{ background: colour }}
        aria-hidden
      />
      <span className="exec-label" style={{ color: colour }}>
        {label}
      </span>
    </span>
  );
}

/**
 * Event recency, stated against the corpus's own timeline rather than the
 * wall clock: the corpus is a fixed scenario set, so "LIVE" means "detected
 * within three days of the newest detection in the corpus", and the tooltip
 * says exactly that instead of implying a stream that does not exist.
 */
function eventStatus(detectedAt: string, corpusLatest: string) {
  if (!detectedAt || !corpusLatest) {
    return {
      label: "UNAVAILABLE",
      colour: "var(--exec-crimson)",
      help: "No detection date is recorded for this event.",
    };
  }
  const age = (Date.parse(corpusLatest) - Date.parse(detectedAt)) / 86_400_000;
  if (!Number.isFinite(age)) {
    return {
      label: "UNAVAILABLE",
      colour: "var(--exec-crimson)",
      help: "The detection date could not be parsed.",
    };
  }
  if (age <= 3) {
    return {
      label: "LIVE",
      colour: "var(--exec-emerald)",
      help: `Detected ${detectedAt}, within 3 days of the corpus's newest detection (${corpusLatest}).`,
    };
  }
  if (age <= 21) {
    return {
      label: "RECENT",
      colour: "var(--exec-cyan)",
      help: `Detected ${detectedAt}, ${Math.round(age)} days before the corpus's newest detection (${corpusLatest}).`,
    };
  }
  return {
    label: "HISTORICAL",
    colour: "var(--exec-ink-dim)",
    help: `Detected ${detectedAt}, ${Math.round(age)} days before the corpus's newest detection (${corpusLatest}).`,
  };
}

/**
 * Band word for a 0..100 score. The thresholds mirror `riskColorForScore`
 * exactly, so the word and the colour on the same cell can never disagree.
 */
function bandWord(score: number): string {
  if (score >= 65) return "Severe";
  if (score >= 52) return "High";
  if (score >= 42) return "Elevated";
  if (score >= 30) return "Moderate";
  return "Low";
}

/* -------------------------------------------------------------- Motion -- */

/** One subtle section entrance, disabled entirely under reduced motion. */
function Reveal({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.section>
  );
}

/** Section heading above a card: h2 + one supporting sentence. */
function SectionHead({
  id,
  title,
  lede,
  right,
}: {
  id: string;
  title: string;
  lede: string;
  right?: ReactNode;
}) {
  return (
    <div className="mb-4 flex min-w-0 flex-wrap items-end justify-between gap-x-6 gap-y-2">
      <div className="min-w-0 max-w-3xl">
        <h2 id={id} className="t-section text-[var(--exec-ink)]">
          {title}
        </h2>
        <p className="t-body mt-1.5 text-[var(--exec-ink-dim)]">{lede}</p>
      </div>
      {right ? <div className="min-w-0">{right}</div> : null}
    </div>
  );
}

/* --------------------------------------------------------------- Page -- */

export default function World() {
  const feed = useQuery(api.intel.detectionFeed, {});
  const overview = useQuery(api.intel.overview);
  const matrix = useQuery(api.intel.signalMatrix);
  const macro = useMacroData();
  const navigate = useNavigate();
  const reduce = useReducedMotion();
  const { layer, setLayer } = useFocus();
  const [searchParams, setSearchParams] = useSearchParams();

  // The selected place lives here rather than in the shared focus context:
  // the shell opens a full drawer on any node focus, which would cover this
  // page's own side panel. Escape still backs out, from anywhere on the page.
  const [selectedNode, setSelectedNode] = useState<string | null>(null);

  const rows = useMemo(() => (feed?.rows ?? []) as EventRow[], [feed]);
  const corpusLatest = useMemo(() => {
    let latest = "";
    for (const r of rows) if (r.detectedAt > latest) latest = r.detectedAt;
    return latest;
  }, [rows]);

  // The event choice lives in the URL, so a refresh or a shared link lands on
  // the same event. A stale id falls back to the feed's top event instead of
  // rendering a page about nothing.
  const requested = searchParams.get("event");
  const eventId =
    requested && rows.some((r) => r.id === requested)
      ? requested
      : (rows[0]?.id ?? null);

  const chain = useQuery(
    api.intel.eventChain,
    eventId ? { eventId } : "skip",
  );

  const selectEvent = (id: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("event", id);
    setSearchParams(next, { replace: true });
  };

  const selectedRow = rows.find((r) => r.id === eventId) ?? null;

  const stages = useMemo<ChainStage[]>(
    () => (chain ? buildStages(chain) : []),
    [chain],
  );

  const mapEvents = useMemo(
    () => (overview?.mapEvents ?? []).filter((e) => e.nodeId !== ""),
    [overview],
  );
  const plottedCount = useMemo(
    () =>
      (overview?.mapNodes ?? []).filter((n) => isPlottable(n.nodeId)).length,
    [overview],
  );
  const matrixRows = useMemo(
    () =>
      [...((matrix?.rows ?? []) as MatrixRow[])].sort(
        (a, b) => b.overall - a.overall,
      ),
    [matrix],
  );
  const growth = useMemo(
    () => (macro.data ? macroSeries(macro.data) : null),
    [macro.data],
  );

  useEffect(() => {
    if (!selectedNode) return;
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === "Escape") setSelectedNode(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [selectedNode]);

  const toggleNode = (id: string) =>
    setSelectedNode((current) => (current === id ? null : id));

  if (!feed || !overview || !matrix) {
    return (
      <PageLoading
        eyebrow="World map"
        title="Event → World"
        lede="Trace how a global event propagates across countries, trade, energy, infrastructure and supply chains."
        dominant="lg:col-span-12"
      />
    );
  }

  const mapNodes: MapNode[] = overview.mapNodes;
  const selectedMapNode = selectedNode
    ? mapNodes.find((n) => n.nodeId === selectedNode)
    : undefined;
  const selectedMatrixRow = selectedNode
    ? matrixRows.find((r) => r.nodeId === selectedNode)
    : undefined;

  // One provenance object for the reported-growth feed, shared by the table
  // footer and the evidence section so the same fetch is never described twice.
  const growthSource: Provenance | undefined =
    growth && growth.size > 0 && macro.retrievedAt
      ? {
          sourceId: "worldbank",
          asOf: [...growth.values()][0]?.latest.period ?? "",
          retrievedAt: macro.retrievedAt,
          status: "observed" as const,
        }
      : undefined;

  const eventStatusTag = selectedRow
    ? eventStatus(selectedRow.detectedAt, corpusLatest)
    : {
        label: "UNAVAILABLE",
        colour: "var(--exec-crimson)",
        help: "No event selected.",
      };

  return (
    <PageFrame
      eyebrow="World map"
      title="Event → World"
      lede="Trace how a global event propagates across countries, trade, energy, infrastructure and supply chains."
      actions={
        <div className="flex min-w-0 flex-col gap-1.5">
          <label htmlFor="world-event" className="exec-label">
            Selected event
          </label>
          <select
            id="world-event"
            value={eventId ?? ""}
            onChange={(e) => selectEvent(e.target.value)}
            className="h-9 w-full max-w-[min(22rem,80vw)] min-w-0 cursor-pointer truncate rounded-lg border border-[var(--exec-hairline-strong)] bg-[var(--exec-surface)] px-3 text-[13px] text-[var(--exec-ink)] outline-none transition-colors hover:border-[var(--exec-cyan)] focus-visible:border-[var(--exec-cyan)]"
          >
            {rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reference} — {r.title}
              </option>
            ))}
          </select>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
            <span className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
              {selectedRow?.reference ?? "—"}
            </span>
            <StatusTag {...eventStatusTag} />
          </div>
        </div>
      }
    >
      <div className="flex flex-col">
        {/* ------------------------------------------------ [Selected event] */}
        {selectedRow ? (
          <Reveal className="min-w-0">
            <article className="card min-w-0 p-5">
              <div className="flex min-w-0 flex-wrap items-start justify-between gap-x-8 gap-y-4">
                <div className="min-w-0 flex-1 basis-72">
                  <p className="exec-label text-[var(--exec-cyan)]">
                    Selected event
                  </p>
                  <h2 className="t-card mt-1.5 text-[var(--exec-ink)]">
                    {selectedRow.title}
                  </h2>
                  <dl className="mt-3.5 flex flex-wrap gap-x-6 gap-y-2.5">
                    <div>
                      <dt className="exec-label-muted">Event ID</dt>
                      <dd className="exec-num text-[13px] text-[var(--exec-ink)]">
                        {selectedRow.reference}
                      </dd>
                    </div>
                    <div>
                      <dt className="exec-label-muted">Detected</dt>
                      <dd className="exec-num text-[13px] text-[var(--exec-ink)]">
                        {selectedRow.detectedAt || "—"}
                      </dd>
                    </div>
                    <div>
                      <dt className="exec-label-muted">Stage</dt>
                      <dd className="text-[13px] text-[var(--exec-ink)]">
                        {STAGE_LABEL[selectedRow.stage]}
                      </dd>
                    </div>
                    <div>
                      <dt className="exec-label-muted">Dominant channel</dt>
                      <dd className="text-[13px] text-[var(--exec-ink)]">
                        {CHANNEL_LABEL[selectedRow.dominantChannel]}
                      </dd>
                    </div>
                    {selectedRow.regions.length > 0 ? (
                      <div className="min-w-0 max-w-full">
                        <dt className="exec-label-muted">Regions</dt>
                        <dd className="truncate text-[13px] text-[var(--exec-ink)]">
                          {selectedRow.regions.join(" · ")}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt className="exec-label-muted">30-day risk</dt>
                      <dd className="flex items-center gap-2">
                        <span
                          className="exec-num text-[13px] font-semibold"
                          style={{
                            color: riskColorForScore(selectedRow.score30),
                          }}
                        >
                          {selectedRow.score30.toFixed(0)} ·{" "}
                          {BAND_LABEL[selectedRow.band]}
                        </span>
                        <BasisChip basis="model" />
                      </dd>
                    </div>
                  </dl>
                  <p className="mt-3.5 max-w-3xl text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                    {selectedRow.summary}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2.5">
                  <Action to={`/app/event/${selectedRow.id}`}>
                    Open event intelligence →
                  </Action>
                  <span className="exec-label-muted">
                    Full signals, propagation graph and analyst notes
                  </span>
                </div>
              </div>
            </article>
          </Reveal>
        ) : (
          <Reveal className="min-w-0">
            <div className="card">
              <EmptyState
                title="No events in the corpus"
                reason="GlobalMatrix has no scored event to trace. The map and tables below render whatever the corpus contains."
              />
            </div>
          </Reveal>
        )}

        {/* -------------------------------------------- [Propagation path] */}
        <Reveal className="mt-6 min-w-0">
          <SectionHead
            id="propagation-path"
            title="Propagation path"
            lede="One event, in travel order. Stages with no measured rows for this event say so — an absence, never a zero."
          />
          <PropagationPath
            stages={stages}
            loading={chain === undefined && eventId !== null}
            notFound={chain === null && eventId !== null}
            eventId={eventId}
            eventReference={selectedRow?.reference}
            reduce={!!reduce}
          />
        </Reveal>

        {/* --------------------------------------------------- [KPI strip] */}
        <Reveal className="mt-8 min-w-0">
          <h2 className="sr-only">Global exposure snapshot</h2>
          <div className="card overflow-hidden">
            <div className="grid grid-cols-2 gap-px bg-[var(--exec-hairline)] lg:grid-cols-4">
              {[
                {
                  value: String(matrixRows.length),
                  label: "Economies tracked",
                  hint: "Ranked in the risk table below",
                },
                {
                  value: String(plottedCount),
                  label: "Places mapped",
                  hint: "Real coordinates only — institutions excluded",
                },
                {
                  value: String(feed.total),
                  label: "Events in corpus",
                  hint: "Scored and dated detections",
                },
                {
                  value: String(overview.flows.length),
                  label: "Measured couplings",
                  hint: "Chokepoint ↔ economy, shared-event",
                },
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  className="flex min-w-0 flex-col gap-1 bg-[var(--card)] px-4 py-4"
                >
                  <p className="exec-num text-[2rem] leading-none font-bold tracking-[-0.025em] text-[var(--exec-ink)] lg:text-[2.25rem]">
                    {kpi.value}
                  </p>
                  <p className="text-[13px] font-semibold text-[var(--exec-ink)]">
                    {kpi.label}
                  </p>
                  <span className="exec-label-muted">{kpi.hint}</span>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        {/* --------------------------------------------------- [World map] */}
        <Reveal className="mt-8 min-w-0">
          <SectionHead
            id="world-map"
            title="World map"
            lede="Every point sits on real country geometry; shading and radius encode derived load. Select a place to read its exposure beside the map."
            right={
              <div className="flex items-center gap-2">
                <span className="exec-label-muted">VIEW</span>
                <Segmented
                  label="Map view layer"
                  options={MAP_LAYERS}
                  value={layer}
                  onChange={setLayer}
                />
              </div>
            }
          />
          <div className="card min-w-0 overflow-hidden">
            <div className="flex min-w-0 flex-col xl:flex-row">
              <div className="min-w-0 flex-1">
                <WorldMap
                  nodes={mapNodes}
                  flows={overview.flows}
                  events={mapEvents}
                  className="h-[420px] sm:h-[500px] lg:h-[620px]"
                  selected={selectedNode}
                  onSelect={toggleNode}
                  onInspect={(id) => navigate(`/app/country/${id}`)}
                  layers={false}
                />
                <MapLegendRow />
              </div>
              <PlacePanel
                nodeId={selectedNode}
                mapNode={selectedMapNode}
                matrixRow={selectedMatrixRow}
                onClose={() => setSelectedNode(null)}
                reduce={!!reduce}
              />
            </div>
          </div>
        </Reveal>

        {/* ---------------------------------------------- [Country exposure] */}
        <Reveal className="mt-12 min-w-0">
          <SectionHead
            id="country-exposure"
            title="Where does the impact land hardest?"
            lede="Countries ranked by weighted exposure across measured propagation pathways."
          />
          <div className="card min-w-0">
            {chain === undefined && eventId !== null ? (
              <div className="space-y-px">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-11 w-full rounded-none" />
                ))}
              </div>
            ) : chain === null && eventId !== null ? (
              <ErrorState
                title="Event not found"
                reason="The selected event id is not in the corpus, so its country exposure cannot be resolved."
              />
            ) : (
              <ExposureList
                stages={stages}
                selected={selectedNode}
              />
            )}
          </div>
        </Reveal>

        {/* ------------------------------------------------ [Risk signals] */}
        <Reveal className="mt-12 min-w-0">
          <SectionHead
            id="risk-signals"
            title="Risk signals"
            lede="Six signals per economy: five are model output, one is reported. Every cell states which."
          />
          <RiskTable
            rows={matrixRows}
            growth={growth}
            macroFailed={macro.data == null && Boolean(macro.problem)}
            selected={selectedNode}
            source={growthSource}
          />
        </Reveal>

        {/* ------------------------------------------- [Evidence / method] */}
        <Reveal className="mt-12 min-w-0">
          <SectionHead
            id="evidence"
            title="Evidence & methodology"
            lede="What each figure on this page is, where it comes from, and what this build does not measure."
          />
          <EvidenceCard
            companyReason={
              chain?.companyReason ??
              "Company exposure is not measured by this build."
            }
            growthSource={growthSource}
          />
        </Reveal>
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------ Propagation path -- */

/**
 * The one propagation visual on the page.
 *
 * Vertical timeline on small screens, horizontal rail from `md` up that
 * scrolls inside its own card rather than wrapping — so a connector can never
 * dangle at the end of a wrapped row. Each stage is a compact node: ordinal,
 * stage, the strongest row and its weight, or an explicit "Not measured".
 * Stages never claim a stage they cannot show: the reason travels with the
 * node for assistive tech and with the evidence section for everyone else.
 */
function PropagationPath({
  stages,
  loading,
  notFound,
  eventId,
  eventReference,
  reduce,
}: {
  stages: ChainStage[];
  loading: boolean;
  notFound: boolean;
  eventId: string | null;
  eventReference?: string;
  reduce: boolean;
}) {
  if (notFound) {
    return (
      <div className="card min-w-0 overflow-hidden">
        <ErrorState
          title="Event not found"
          reason="The selected event id is not in the corpus, so no propagation path can be built for it. Pick another event above."
        />
      </div>
    );
  }
  if (loading) {
    return (
      <div className="card min-w-0 p-4">
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (stages.length === 0) {
    return (
      <div className="card min-w-0 overflow-hidden">
        <NoData reason="No event is selected, so there is no propagation path to draw." />
      </div>
    );
  }

  const measured = stages.filter((s) => s.rows.length > 0).length;

  return (
    <nav
      aria-label="Propagation path, event to market"
      className="card min-w-0 overflow-hidden"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--exec-hairline)] px-4 py-3">
        <span className="exec-label text-[var(--exec-ink)]">
          {measured} of {stages.length} stages measured for this event
        </span>
        <span className="exec-label-muted">
          event → country → trade → energy → infrastructure → supply chain →
          industry → company → market
        </span>
      </div>

      <motion.ol
        key={eventId ?? "none"}
        initial={reduce ? false : { opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.25 }}
        className="flex flex-col px-4 py-4 md:flex-row md:flex-nowrap md:overflow-x-auto"
      >
        {stages.map((stage, i) => {
          const top = stage.rows[0];
          const hasRows = stage.rows.length > 0;
          return (
            <Fragment key={stage.id}>
              <motion.li
                initial={reduce ? false : { opacity: 0, y: 6 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{
                  duration: 0.3,
                  delay: reduce ? 0 : i * 0.05,
                  ease: [0.16, 1, 0.3, 1],
                }}
                className="w-full shrink-0 md:w-[112px]"
              >
                <div
                  className={cn(
                    "flex h-full min-w-0 flex-col rounded-lg border border-[var(--exec-hairline)] border-t-2 p-3",
                    hasRows
                      ? "border-t-[var(--exec-cyan)]"
                      : "border-t-[var(--exec-ink-muted)]",
                  )}
                >
                  <span className="exec-label-muted exec-num">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className="exec-label mt-0.5 truncate uppercase text-[var(--exec-ink)]"
                    title={stage.title}
                  >
                    {stage.title}
                  </span>
                  {hasRows && top ? (
                    <>
                      <span
                        className="mt-2 truncate text-[13px] text-[var(--exec-ink-dim)]"
                        title={top.label}
                      >
                        {stage.id === "event" && eventReference
                          ? eventReference
                          : top.label}
                      </span>
                      <span
                        className="exec-num mt-0.5 text-[14px] font-semibold"
                        style={{
                          color: riskColorForScore((top.weight ?? 0) * 100),
                        }}
                      >
                        {top.weight !== undefined
                          ? Math.round(top.weight * 100)
                          : "—"}
                      </span>
                    </>
                  ) : (
                    <>
                      <span
                        className="mt-2 text-[12px] text-[var(--exec-ink-muted)]"
                        title={stage.unmeasured?.reason}
                      >
                        Not measured
                      </span>
                      <span className="sr-only">
                        {stage.unmeasured?.reason}
                      </span>
                    </>
                  )}
                </div>
              </motion.li>
              {i < stages.length - 1 ? (
                <li
                  aria-hidden
                  className="flex shrink-0 items-center justify-center py-1 md:w-5 md:py-0"
                >
                  <ArrowRight className="size-3.5 rotate-90 text-[var(--exec-ink-muted)] md:rotate-0" />
                </li>
              ) : null}
            </Fragment>
          );
        })}
      </motion.ol>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--exec-hairline)] px-4 py-3">
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: "var(--exec-cyan)" }}
            aria-hidden
          />
          <span className="exec-label-muted">Measured pathway</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block h-0.5 w-4 rounded-full"
            style={{ background: "var(--exec-ink-muted)" }}
            aria-hidden
          />
          <span className="exec-label-muted">Not measured</span>
        </span>
        <BasisChip basis="model" />
        <BasisChip basis="observed" />
        <span className="exec-label-muted w-full sm:w-auto sm:ml-auto">
          Stage weights are model output; the event&apos;s detection is observed.
        </span>
      </div>
    </nav>
  );
}

/* --------------------------------------------------------- Map legend -- */

const MAP_GLYPHS = [
  { label: "Economy", glyph: "circle" },
  { label: "Bloc", glyph: "square" },
  { label: "Chokepoint", glyph: "diamond" },
];

/** The load ramp uses the same five bands the risk colours are cut at. */
const RAMP = [
  { score: 20, label: "Low" },
  { score: 35, label: "Moderate" },
  { score: 47, label: "Elevated" },
  { score: 58, label: "High" },
  { score: 75, label: "Severe" },
];

/** Legend and interaction hint under the map — never instructions on it. */
function MapLegendRow() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-[var(--exec-hairline)] px-4 py-3">
      {MAP_GLYPHS.map((g) => (
        <span key={g.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 border border-current text-[var(--exec-ink-dim)]"
            style={{
              borderRadius: g.glyph === "circle" ? "9999px" : 0,
              transform:
                g.glyph === "diamond" ? "rotate(45deg) scale(0.8)" : undefined,
            }}
            aria-hidden
          />
          <span className="exec-label-muted">{g.label}</span>
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <span
          className="inline-block size-2 rounded-full"
          style={{ background: "var(--signal)" }}
          aria-hidden
        />
        <span className="exec-label-muted">Event</span>
      </span>
      <span className="flex items-center gap-2">
        <span className="exec-label-muted">Load</span>
        {RAMP.map((r) => (
          <span
            key={r.label}
            className="flex items-center gap-1"
            title={`${r.label} load band`}
          >
            <span
              className="inline-block size-2"
              style={{ background: riskColorForScore(r.score) }}
              aria-hidden
            />
            <span className="exec-label-muted">{r.label}</span>
          </span>
        ))}
      </span>
      <span className="exec-label-muted w-full sm:ml-auto sm:w-auto">
        Click a location to inspect exposure. Arcs are shared-event couplings,
        not shipping lanes.
      </span>
    </div>
  );
}

/* ------------------------------------------------------ Place panel -- */

const PLACE_CHANNELS: {
  key: "geopolitical" | "trade" | "energy" | "supply" | "market";
  label: string;
}[] = [
  { key: "geopolitical", label: "Geopolitical" },
  { key: "trade", label: "Trade" },
  { key: "energy", label: "Energy" },
  { key: "supply", label: "Supply chain" },
  { key: "market", label: "Market" },
];

/**
 * The selected-place panel, docked beside the map (below it on small
 * screens). One selection, one panel: modelled exposure with its band, the
 * channel breakdown, the reported evidence with sources, and the way into the
 * full profile. Every value carries its basis; nothing without a reading is
 * drawn as zero.
 */
function PlacePanel({
  nodeId,
  mapNode,
  matrixRow,
  onClose,
  reduce,
}: {
  nodeId: string | null;
  mapNode?: MapNode;
  matrixRow?: MatrixRow;
  onClose: () => void;
  reduce: boolean;
}) {
  return (
    <aside
      aria-label="Selected place"
      className="flex min-w-0 flex-col border-t border-[var(--exec-hairline)] xl:w-[340px] xl:shrink-0 xl:border-t-0 xl:border-l"
    >
      <AnimatePresence mode="wait" initial={false}>
        {nodeId && mapNode ? (
          <motion.div
            key={nodeId}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 1 } : { opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
            className="flex min-h-0 min-w-0 flex-1 flex-col"
          >
            <div className="flex items-start justify-between gap-2 border-b border-[var(--exec-hairline)] px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] leading-tight font-semibold tracking-[0.04em] text-[var(--exec-ink)] uppercase">
                  {mapNode.label}
                </p>
                <p className="exec-label-muted mt-1 truncate">
                  {getNode(mapNode.nodeId).region} · {mapNode.kind ?? "place"}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Clear selected place (Esc)"
                aria-label="Clear selected place"
                className="flex size-7 shrink-0 items-center justify-center rounded-md border border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] transition-colors hover:border-[var(--exec-hairline-strong)] hover:text-[var(--exec-ink)]"
              >
                <X className="size-3.5" />
              </button>
            </div>

            <div className="flex min-w-0 flex-col gap-4 px-4 py-4">
              <div className="flex items-baseline gap-2.5">
                <span
                  className="exec-num text-[2rem] leading-none font-bold tracking-[-0.025em]"
                  style={{
                    color: riskColorForScore(
                      (matrixRow?.overall ?? mapNode.load) * 100,
                    ),
                  }}
                >
                  {Math.round((matrixRow?.overall ?? mapNode.load) * 100)}
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] leading-tight font-semibold text-[var(--exec-ink)]">
                    {matrixRow ? "Weighted exposure" : "Live load"}
                  </p>
                  <BasisChip basis="model" className="mt-1" />
                </div>
              </div>

              {matrixRow ? (
                <div className="min-w-0">
                  <p className="exec-label-muted">CHANNELS · MODEL OUTPUT</p>
                  <dl className="mt-2 flex flex-col gap-1.5">
                    {PLACE_CHANNELS.map((c) => (
                      <div
                        key={c.key}
                        className="flex items-center justify-between gap-2"
                      >
                        <dt className="text-[13px] text-[var(--exec-ink-dim)]">
                          {c.label}
                        </dt>
                        <dd
                          className="text-[13px] font-semibold"
                          style={{
                            color: riskColorForScore(matrixRow[c.key] * 100),
                          }}
                          title={`${Math.round(matrixRow[c.key] * 100)} / 100 modelled channel load`}
                        >
                          {bandWord(matrixRow[c.key] * 100).toUpperCase()}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ) : (
                <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
                  <span className="text-[13px] text-[var(--exec-ink-dim)]">
                    {mapNode.eventCount} anchored events
                  </span>
                  <span className="text-[13px] text-[var(--exec-ink-dim)]">
                    criticality {Math.round(mapNode.criticality * 100)}%
                  </span>
                  <BasisChip basis="model" />
                </div>
              )}
            </div>

            <NodeEvidence
              nodeId={nodeId}
              className="border-t border-[var(--exec-hairline)]"
            />

            <div className="mt-auto border-t border-[var(--exec-hairline)] px-4 py-3">
              <Action to={`/app/country/${nodeId}`}>
                Open country profile →
              </Action>
            </div>
          </motion.div>
        ) : nodeId && !mapNode ? (
          <motion.div
            key="missing"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            className="flex flex-1 flex-col justify-center gap-2 px-4 py-6"
          >
            <span className="exec-label text-[var(--exec-crimson)]">
              UNAVAILABLE
            </span>
            <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
              This place is not in the tracked corpus, so there is nothing
              verified to show for it.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="empty"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 1 }}
            className="flex flex-1 flex-col justify-center gap-2 px-4 py-6"
          >
            <p className="exec-label text-[var(--exec-ink)]">SELECT A PLACE</p>
            <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
              Click any country or chokepoint on the map to read its exposure,
              channels and reported evidence right here.
            </p>
            <p className="text-[12px] leading-relaxed text-[var(--exec-ink-muted)]">
              Every economy also appears in the ranked list below, so nothing on
              the map is reachable by pointer only.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </aside>
  );
}

/* -------------------------------------------------- Country exposure -- */

/** The ranked list: one row per exposed economy, straight through to the profile. */
function ExposureList({
  stages,
  selected,
}: {
  stages: ChainStage[];
  selected: string | null;
}) {
  const rows = stages.find((s) => s.id === "country")?.rows ?? [];

  if (rows.length === 0) {
    return (
      <NoData reason="No economy is exposed to this event through a measured pathway — for this event the chain stops at infrastructure." />
    );
  }

  return (
    <>
      <ol className="divide-y divide-[var(--exec-hairline)]">
        {rows.map((r, i) => {
          const weight = r.weight ?? 0;
          const active = r.id === selected;
          return (
            <li key={r.id}>
              <Link
                to={r.href ?? `/app/country/${r.id}`}
                aria-current={active ? "true" : undefined}
                className={cn(
                  "group flex min-w-0 items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[var(--exec-surface)]",
                  active && "bg-[var(--exec-surface)]",
                )}
              >
                <span className="exec-num w-7 shrink-0 text-[12px] text-[var(--exec-ink-muted)]">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "min-w-0 flex-1 truncate text-[13px] transition-colors",
                    active
                      ? "text-[var(--exec-cyan)]"
                      : "text-[var(--exec-ink)] group-hover:text-[var(--exec-cyan)]",
                  )}
                >
                  {r.label}
                </span>
                <span className="hidden w-32 shrink-0 sm:block md:w-48">
                  <Bar
                    value={weight}
                    tone={riskColorForScore(weight * 100)}
                    height={4}
                  />
                </span>
                <span
                  className="exec-num w-9 shrink-0 text-right text-[13px] font-semibold"
                  style={{ color: riskColorForScore(weight * 100) }}
                >
                  {Math.round(weight * 100)}
                </span>
              </Link>
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--exec-hairline)] px-4 py-3">
        <BasisChip basis="model" />
        <span className="exec-label-muted">
          Weighted exposure = summed impact × pathway confidence across this
          event&apos;s measured channels, capped at 100. Rows link to the full
          country profile.
        </span>
      </div>
    </>
  );
}

/* ------------------------------------------------------ Risk signals -- */

const RISK_MODEL_COLS = [
  {
    key: "geopolitical",
    label: "Geo",
    help: "Geopolitical — diplomatic-channel load, model output.",
  },
  {
    key: "trade",
    label: "Trade",
    help: "Trade — trade-channel load, model output.",
  },
  {
    key: "energy",
    label: "Energy",
    help: "Energy — energy-channel load, model output.",
  },
  {
    key: "supply",
    label: "Supply",
    help: "Supply chain — exposure arriving via loaded corridors, model output.",
  },
  {
    key: "market",
    label: "Market",
    help: "Market — finance-channel load, model output.",
  },
] as const;

/**
 * Six signals per economy, short headers, one fixed column structure.
 *
 * Every model cell states its band and its basis; the reported column shows
 * the figure or an explicit dash with the reason. The table scrolls inside its
 * own box — the page never gains a horizontal axis from it.
 */
function RiskTable({
  rows,
  growth,
  macroFailed,
  selected,
  source,
}: {
  rows: MatrixRow[];
  growth: ReturnType<typeof macroSeries> | null;
  macroFailed: boolean;
  selected: string | null;
  source?: Provenance;
}) {
  if (rows.length === 0) {
    return (
      <div className="card min-w-0 overflow-hidden">
        <NoData reason="The signal matrix returned no economies, so there is nothing to compare." />
      </div>
    );
  }

  return (
    <div className="card min-w-0 overflow-hidden">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-[var(--exec-hairline)] px-4 py-3">
        <span className="exec-label text-[var(--exec-ink)]">
          {rows.length} economies · five modelled channels + one reported
          figure
        </span>
        <span className="exec-label-muted">
          Scroll the table sideways on narrow screens — the page itself never
          scrolls.
        </span>
      </div>

      <div className="max-h-[560px] min-w-0 overflow-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">
            Risk signals per economy. Geopolitical, Trade, Energy, Supply and
            Market are model output; Economic is reported real GDP growth.
          </caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky top-0 left-0 z-20 border-b border-[var(--exec-hairline-strong)] bg-[var(--card)] px-4 py-3 exec-label whitespace-nowrap"
              >
                Economy
              </th>
              {RISK_MODEL_COLS.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  title={c.help}
                  className="sticky top-0 z-10 border-b border-[var(--exec-hairline-strong)] bg-[var(--card)] px-3 py-3 exec-label whitespace-nowrap"
                >
                  {c.label}
                  <span className="sr-only"> — {c.help}</span>
                </th>
              ))}
              <th
                scope="col"
                title="Economic — reported real GDP growth, World Bank."
                className="sticky top-0 z-10 border-b border-[var(--exec-hairline-strong)] bg-[var(--card)] px-3 py-3 exec-label whitespace-nowrap"
              >
                Economic
                <span className="sr-only">
                  {" "}— reported real GDP growth from the World Bank.
                </span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const active = selected === row.nodeId;
              const obs = growth?.get(`${row.nodeId}:gdpGrowth`);
              return (
                <tr
                  key={row.nodeId}
                  className={cn(
                    "border-b border-[var(--exec-hairline)] transition-colors last:border-b-0",
                    active && "bg-[var(--exec-surface)]",
                  )}
                >
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 border-r border-[var(--exec-hairline)] px-4 py-2.5 text-left font-normal",
                      active
                        ? "bg-[var(--exec-surface)]"
                        : "bg-[var(--card)]",
                    )}
                  >
                    <Link
                      to={`/app/country/${row.nodeId}`}
                      className="group flex min-w-0 items-center gap-2"
                    >
                      <span className="exec-num w-7 shrink-0 text-[12px] text-[var(--exec-ink-muted)]">
                        {row.short}
                      </span>
                      <span className="min-w-0 truncate text-[13px] text-[var(--exec-ink)] transition-colors group-hover:text-[var(--exec-cyan)]">
                        {row.label}
                      </span>
                    </Link>
                  </th>
                  {RISK_MODEL_COLS.map((c) => {
                    const v = row[c.key];
                    return (
                      <td key={c.key} className="px-3 py-2.5 whitespace-nowrap">
                        <span
                          className="block text-[13px] font-semibold"
                          style={{ color: riskColorForScore(v * 100) }}
                          title={`${Math.round(v * 100)} / 100 modelled channel load`}
                        >
                          {bandWord(v * 100).toUpperCase()}
                        </span>
                        <BasisChip basis="model" className="mt-1" />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {!growth ? (
                      macroFailed ? (
                        <>
                          <span
                            className="block text-[13px] text-[var(--exec-ink-muted)]"
                            title="The reported-growth feed could not be fetched."
                          >
                            —
                          </span>
                          <BasisChip basis="unavailable" className="mt-1" />
                        </>
                      ) : (
                        <Skeleton className="h-4 w-10" />
                      )
                    ) : obs ? (
                      <>
                        <span
                          className="exec-num block text-[13px] font-semibold"
                          style={{
                            color:
                              obs.latest.value >= 0
                                ? "var(--exec-emerald)"
                                : "var(--exec-crimson)",
                          }}
                          title={`Reported real GDP growth, ${obs.latest.period}`}
                        >
                          {obs.latest.value.toFixed(1)}%
                        </span>
                        <BasisChip basis="observed" className="mt-1" />
                      </>
                    ) : (
                      <>
                        <span
                          className="block text-[13px] text-[var(--exec-ink-muted)]"
                          title="No World Bank reading for this economy — shown as absent, never as zero."
                        >
                          —
                        </span>
                        <BasisChip basis="unavailable" className="mt-1" />
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 border-t border-[var(--exec-hairline)] px-4 py-3">
        <p className="text-[12px] leading-relaxed text-[var(--exec-ink-muted)]">
          Geopolitical, Trade, Energy, Supply and Market are GlobalMatrix&apos;s
          own channel load for that economy. Economic is reported real GDP
          growth — a direction, not a risk score, and never mixed into the
          modelled columns.
        </p>
        {source ? (
          <SourceLine provenance={source} />
        ) : (
          <span className="exec-label-muted">
            No verified growth feed has been fetched for this session.
          </span>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------- Evidence section -- */

/** What every figure on the page is, including what this build cannot show. */
function EvidenceCard({
  companyReason,
  growthSource,
}: {
  companyReason: string;
  growthSource?: Provenance;
}) {
  const rows: {
    title: string;
    basis: BadgeBasis;
    body: string;
    source?: Provenance;
  }[] = [
    {
      title: "Event detections",
      basis: "observed",
      body: "Each event is anchored to dated signals from named sources with reliability weights. The status tag in the header reports the detection date against the corpus's newest detection.",
    },
    {
      title: "Propagation & exposure",
      basis: "model",
      body: "Stage weights are impact × pathway magnitude × confidence, summed per node from the corpus propagation graph. Nothing is stored — every figure is recomputed on request.",
    },
    {
      title: "Map couplings",
      basis: "model",
      body: "An arc means a chokepoint and an economy are pulled by the same events, weighted by the weaker of the two contribution terms: a coupling in the model, not a shipping lane and not a trade flow.",
    },
    {
      title: "Reported growth",
      basis: growthSource ? "observed" : "unavailable",
      body: growthSource
        ? "Real GDP growth as reported by the World Bank, shown only where the Bank publishes a reading for that economy — never estimated, never carried forward."
        : "No World Bank macro reading has been fetched, so the Economic column stays absent rather than borrowing a number.",
      source: growthSource,
    },
    {
      title: "Map geometry",
      basis: "observed",
      body: "Natural Earth-derived country geometry plotted on real coordinates. Institutions without a location are never given one, so they never appear as points.",
    },
    {
      title: "Company exposure",
      basis: "unavailable",
      body: companyReason,
    },
    {
      title: "Corpus",
      basis: "scenario",
      body: `${CORPUS_LABEL} — a deterministic, internally consistent scenario set. Every figure is reproducible and auditable end to end; scenario perturbations in the lab are hypothetical and labelled SCENARIO.`,
    },
  ];

  return (
    <div className="card min-w-0 overflow-hidden">
      <div className="divide-y divide-[var(--exec-hairline)]">
        {rows.map((r) => (
          <div
            key={r.title}
            className="flex min-w-0 flex-wrap items-start gap-x-5 gap-y-2 px-4 py-3.5"
          >
            <div className="w-44 shrink-0 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--exec-ink)]">
                {r.title}
              </p>
              <BasisChip basis={r.basis} className="mt-1" />
            </div>
            <p className="min-w-0 flex-1 basis-64 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
              {r.body}
            </p>
            {r.source ? (
              <SourceLine provenance={r.source} className="w-full" />
            ) : null}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--exec-hairline)] px-4 py-3">
        <Link
          to="/methodology"
          className="exec-label transition-colors hover:text-[var(--exec-ink)]"
        >
          Full methodology →
        </Link>
        <Link
          to="/app/data"
          className="exec-label transition-colors hover:text-[var(--exec-ink)]"
        >
          Data sources →
        </Link>
        <span className="exec-num ml-auto text-[12px] text-[var(--exec-ink-muted)]">
          {CORPUS_LABEL}
        </span>
      </div>
    </div>
  );
}
