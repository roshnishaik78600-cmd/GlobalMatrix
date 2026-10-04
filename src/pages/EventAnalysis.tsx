import { useState } from "react";
import {
  DataTable,
  DataType,
  PageFrame,
  PageLoading,
} from "@/components/viz/exec/design";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { useConvex } from "convex/react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useToggleWatch, useAuthAction } from "@/hooks/use-auth-action";
import { Panel } from "@/components/intel/AppShell";
import { NoData } from "@/components/viz/core";
import {
  BandChip,
  IntervalBar,
  Label,
  Meter,
} from "@/components/intel/primitives";
import { pct, shortDate, signed, timestamp } from "@/lib/format";
import { num } from "@/lib/numbers";
import { getNode } from "@/lib/intel/nodes";
import {
  CHANNELS,
  CHANNEL_CODE,
  CHANNEL_LABEL,
  SOURCE_CLASS_LABEL,
  STAGE_LABEL,
} from "@/lib/intel/types";

export default function EventAnalysis() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const data = useQuery(
    api.intel.eventDetail,
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
            className="exec-label inline-flex items-center gap-1.5 border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3" /> Events
          </Link>
        }
      >
        <NoData
          reason="This identifier is not in the current corpus."
        />
      </PageFrame>
    );
  }

  const { assessment, risk, watched, annotations, brief } = data;
  const s = assessment.scenario;

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
      eyebrow={`Event · ${STAGE_LABEL[s.stage]}`}
      title={s.title}
      lede={s.summary}
      actions={
        <>
          <button
            type="button"
            onClick={() => navigate("/app/events")}
            className="exec-label border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            ← Back to events
          </button>
        </>
      }
    >

      {/* The reference, tags and watch control that the bespoke masthead
          used to carry inline. The frame owns the title and the lede; these
          are the event-specific facts that have nowhere else to live. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-3">
        <span className="exec-num text-[10px] font-semibold tracking-[0.16em] text-[var(--exec-cyan)]">
          {s.reference}
        </span>
        <span className="label">First signal {shortDate(s.firstSignalAt)}</span>
        <span className="label">Detected {shortDate(s.detectedAt)}</span>
        <DataType type="scenario" />
        <button
          type="button"
          onClick={() => toggleWatch(`EVENT:${s.id}`)}
          className="exec-label ml-auto inline-flex items-center gap-1.5 border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
        >
          {watched ? <BookmarkCheck className="size-3" /> : <Bookmark className="size-3" />}
          {watched ? "Tracking" : "Track"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 pb-4">
        {s.tags.map((tag) => (
          <span
            key={tag}
            className="exec-num border border-[var(--exec-hairline)] px-2 py-1 text-[9px] text-[var(--exec-ink-dim)]"
          >
            {tag}
          </span>
        ))}
      </div>


      {/* Readouts */}
      <div className="border-b border-rule bg-card">
        <dl className="grid gm-width grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-5 lg:px-8">
          <Readout caption="Model confidence" value={pct(s.confidence)} note="Corroboration across independent source classes" />
          <Readout caption="Novelty" value={pct(s.novelty)} note="Distance from the corpus's own precedent set" />
          <Readout caption="Signal velocity" value={pct(s.velocity)} note="Rate of new observation, 30-day window" />
          <Readout caption="Evidence strength" value={pct(assessment.evidenceStrength)} note="Reliability × weight × corroborations" />
          <Readout caption="Dominant channel" value={CHANNEL_LABEL[assessment.dominantChannel]} note={`Propagation weighted ${CHANNEL_CODE[assessment.dominantChannel]}`} />
        </dl>
      </div>

      {/* Risk by horizon */}
      <div className="border-b border-rule">
        <div className="gm-width px-5 py-8 lg:px-8 lg:py-10">
          <Panel caption="Risk by horizon" aside="Central estimate with 80% interval">
            <div className="divide-y divide-rule">
              {risk.map((r) => (
                <div key={r.horizonDays} className="grid grid-cols-12 items-center gap-x-4 gap-y-2 px-4 py-4 lg:px-6">
                  <div className="col-span-3 lg:col-span-2">
                    <span className="num label text-muted-foreground">
                      {r.horizonDays} days
                    </span>
                  </div>
                  <div className="col-span-9 lg:col-span-2">
                    <span className="num display text-2xl leading-none">
                      {r.score.toFixed(1)}
                    </span>
                  </div>
                  <div className="col-span-12 lg:col-span-6">
                    <IntervalBar
                      score={r.score}
                      low={r.low}
                      high={r.high}
                      band={r.band}
                    />
                    <p className="num mt-1 text-[10px] text-muted-foreground">
                      ±{((r.high - r.score)).toFixed(1)} points ·{" "}
                      {r.band}
                    </p>
                  </div>
                  <div className="col-span-12 lg:col-span-2">
                    <BandChip band={r.band} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      {/* Propagation map */}
      <div className="border-b border-rule">
        <div className="gm-width px-5 py-8 lg:px-8 lg:py-10">
          <Panel
            caption="Propagation map · trade / energy / finance / diplomatic"
            aside="Pressure, transmission lag and exposed nodes per channel"
          >
            <div className="grid grid-cols-1 divide-y divide-rule lg:grid-cols-4 lg:divide-x lg:divide-y-0">
              {CHANNELS.map((channel, ci) => {
                const pathway = s.pathways.find((p) => p.channel === channel);
                return (
                  <motion.div
                    key={channel}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: ci * 0.06 }}
                    className="flex flex-col"
                  >
                    <div className="border-b border-rule px-4 py-4">
                      <div className="flex items-baseline justify-between">
                        <span className="label">{CHANNEL_LABEL[channel]}</span>
                        <span className="num text-[10px] text-muted-foreground">
                          {CHANNEL_CODE[channel]}
                        </span>
                      </div>
                      <p className="num display mt-2 text-3xl leading-none">
                        {pathway
                          ? `${Math.round(pathway.magnitude * 100)}%`
                          : "—"}
                      </p>
                      {pathway ? (
                        <>
                          <Meter
                            value={pathway.magnitude}
                            tone={
                              pathway.direction === "escalatory"
                                ? "signal"
                                : pathway.direction === "stabilising"
                                  ? "blue"
                                  : "ink"
                            }
                            className="mt-3"
                          />
                          <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                            {pathway.mechanism}
                          </p>
                          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-rule pt-3">
                            <div>
                              <dt className="label text-[9px] text-muted-foreground">
                                Lag
                              </dt>
                              <dd className="num text-[12px]">
                                {pathway.lagDays[0]}–{pathway.lagDays[1]}d
                              </dd>
                            </div>
                            <div>
                              <dt className="label text-[9px] text-muted-foreground">
                                Confidence
                              </dt>
                              <dd className="num text-[12px]">
                                {pct(pathway.confidence)}
                              </dd>
                            </div>
                          </dl>
                        </>
                      ) : (
                        <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                          No material transmission observed on this channel.
                        </p>
                      )}
                    </div>

                    {pathway && pathway.exposures.length > 0 ? (
                      <div className="flex-1 px-4 py-4">
                        <Label className="mb-3 block">Exposed nodes</Label>
                        <ul className="space-y-3">{pathway.exposures
                              .slice()
                              .sort((a, b) => b.impact - a.impact)
                              .map((exposure) => {
                                const node = getNode(exposure.nodeId);
                                return (
                                  <li key={exposure.nodeId}>
                                    <div className="flex items-baseline justify-between gap-2">
                                      <Link
                                        to={`/app/country/${exposure.nodeId}`}
                                        className="group flex items-baseline gap-1.5"
                                      >
                                        <span className="text-[12px] font-medium transition-colors group-hover:text-signal">
                                          {node.label}
                                        </span>
                                        <ArrowUpRight className="size-2.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                                      </Link>
                                      <span className="num text-[10px] text-muted-foreground">
                                        {node.short}
                                      </span>
                                    </div>
                                  <Meter
                                    value={exposure.impact}
                                    tone={
                                      exposure.impact > 0.55 ? "signal" : "ink"
                                    }
                                    className="mt-1.5"
                                  />
                                  <p className="num mt-1 text-[10px] text-muted-foreground">
                                    impact {pct(exposure.impact)} · exposure{" "}
                                    {pct(exposure.exposure)} · lag {exposure.lagDays}d
                                  </p>
                                  <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                                    {exposure.note}
                                  </p>
                                </li>
                              );
                            })}
                        </ul>
                      </div>
                    ) : (
                      <div className="flex-1 px-4 py-4">
                        <p className="text-[11px] text-muted-foreground">
                          No node-level exposure resolved.
                        </p>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </Panel>
        </div>
      </div>

      {/* Drivers + scenario */}
      <div className="border-b border-rule">
        <div className="grid gm-width gap-8 px-5 py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
          <div className="lg:col-span-7">
            <Panel
              caption="Risk decomposition"
              aside="Share of the 0–100 composite"
              className="h-full"
            >
              <ul className="divide-y divide-rule">
                {assessment.risk[30].drivers.map((driver) => (
                  <li key={driver.id} className="px-4 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">
                        {driver.label}
                      </span>
                      <span className="num text-[13px] font-semibold">
                        {signed(driver.contribution)}
                      </span>
                    </div>
                    <Meter
                      value={Math.min(1, driver.contribution / 30)}
                      tone={
                        driver.channel === "energy" ? "signal" : "ink"
                      }
                      className="mt-2"
                    />
                      <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                        {driver.note}
                      </p>
                    </li>
                ))}
              </ul>
          </Panel>
        </div>
        </div>
      </div>

      {/* LEVEL 5 — the evidence ledger. Every signal that moved this score,
          in one table, because this is where precise comparison matters: the
          reader is meant to check reliability, corroboration and anomaly
          against each other column by column. */}
      <div className="border-b border-rule">
        <Panel
          caption="Evidence ledger"
          aside={`${s.signals.length} observations · newest first`}
        >
          <DataTable
            columns={[
              { key: "date", label: "Date" },
              { key: "source", label: "Source" },
              { key: "class", label: "Class" },
              { key: "channel", label: "Channel" },
              { key: "observation", label: "Observation" },
              { key: "reliability", label: "Rel.", numeric: true },
              { key: "corr", label: "Corr.", numeric: true },
              { key: "z", label: "Anomaly", numeric: true },
            ]}
            rows={[...s.signals]
              .sort((a, b) => b.observedAt.localeCompare(a.observedAt))
              .map((signal) => ({
                date: shortDate(signal.observedAt),
                source: signal.source,
                class: (
                  <span className="exec-label">
                    {SOURCE_CLASS_LABEL[signal.sourceClass]}
                  </span>
                ),
                channel: (
                  <span className="exec-label">{CHANNEL_LABEL[signal.channel]}</span>
                ),
                observation: (
                  <span className="block min-w-[16rem] whitespace-normal">
                    <span className="block text-[12px] font-medium text-[var(--exec-ink)]">
                      {signal.headline}
                    </span>
                    <span className="mt-1 block text-[11px] leading-snug text-[var(--exec-ink-dim)]">
                      {signal.detail}
                    </span>
                  </span>
                ),
                reliability: pct(signal.reliability),
                corr: `×${signal.corroborations}`,
                z: `${num(signal.anomalyZ, 1)}σ`,
              }))}
          />
        </Panel>
      </div>

      {/* Brief + annotations */}
      <div className="grid gm-width gap-8 px-5 py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
        <div className="lg:col-span-7">
          <Panel
            caption="Analyst brief"
            aside={brief ? `Generated ${timestamp(brief.createdAt)}` : "Not generated"}
            className="h-full"
          >
            <div className="px-4 py-4">
              {brief ? (
                <>
                  <p className="text-[13px] leading-relaxed">{brief.thesis}</p>
                  {brief.channels.length > 0 ? (
                    <>
                      <Label className="mt-5 block">Transmission reading</Label>
                      <ul className="mt-2 space-y-2">
                        {brief.channels.map((c, i) => (
                          <li key={i} className="flex gap-3 text-[12px] leading-relaxed">
                            <span className="num text-[10px] text-signal">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span>{c}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                  {brief.caveats.length > 0 ? (
                    <>
                      <Label className="mt-5 block">Caveats & falsifiers</Label>
                      <ul className="mt-2 space-y-2">
                        {brief.caveats.map((c, i) => (
                          <li key={i} className="flex gap-3 text-[12px] leading-relaxed">
                            <span className="num text-[10px] text-muted-foreground">
                              —
                            </span>
                            <span className="text-muted-foreground">{c}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  ) : null}
                </>
              ) : (
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Generate a written reading of this evidence set. The brief may
                  only re-weigh observations already in the ledger above — it
                  cannot introduce new facts — and it must return the caveat list
                  alongside the thesis.
                </p>
              )}

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  disabled={pending}
                  onClick={onGenerateBrief}
                  className="label flex items-center gap-2 border border-foreground bg-foreground px-4 py-2.5 text-background transition-opacity hover:opacity-85 disabled:opacity-50"
                >
                  <Sparkles className="size-3.5" />
                  {pending ? "Generating…" : brief ? "Regenerate brief" : "Generate brief"}
                </button>
                {brief ? (
                  <span className="num text-[10px] text-muted-foreground">
                    {brief.model}
                  </span>
                ) : null}
              </div>
              {briefError ? (
                <p className="mt-3 text-[12px] text-signal">{briefError}</p>
              ) : null}
            </div>
          </Panel>
        </div>

        <div className="lg:col-span-5">
          <Panel caption="Research annotations" aside={`${annotations.length} notes`} className="h-full">
            <div className="px-4 py-4">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={
                  isAuthenticated
                    ? "Record a reading, a caveat, or a falsification test…"
                    : "Sign in to write private research notes…"
                }
                disabled={!isAuthenticated}
                className="w-full resize-none border border-rule bg-background px-3 py-2 text-[13px] leading-relaxed outline-none placeholder:text-muted-foreground focus:border-foreground disabled:opacity-60"
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="num text-[10px] text-muted-foreground">
                  {draft.length}/2000
                </span>
                <button
                  type="button"
                  onClick={onSaveAnnotation}
                  disabled={!draft.trim()}
                  className="label border border-foreground px-3 py-2 transition-colors hover:bg-foreground hover:text-background disabled:opacity-40"
                >
                  Save note
                </button>
              </div>

              {annotations.length > 0 ? (
                <ul className="mt-5 divide-y divide-rule border-t border-rule">
                  {annotations
                    .slice()
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .map((note) => (
                      <li key={note.id} className="group flex gap-3 py-3">
                        <p className="flex-1 text-[12px] leading-relaxed">
                          {note.body}
                        </p>
                        <button
                          type="button"
                          aria-label="Delete annotation"
                          onClick={() => deleteAnnotation({ annotationId: note.id })}
                          className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:text-signal"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-5 border-t border-rule pt-4 text-[12px] text-muted-foreground">
                  No annotations yet. Notes are private to your account.
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </PageFrame>
  );
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
    <div className="border-b border-rule py-5 last:border-b-0 lg:border-b-0 lg:px-6 lg:first:pl-0">
      <dt className="label text-muted-foreground">{caption}</dt>
      <dd className="num display mt-2 text-2xl leading-none">{value}</dd>
      <dd className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
        {note}
      </dd>
    </div>
  );
}