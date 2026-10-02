import { useState } from "react";
import { Link } from "react-router";
import { useConvex, useQuery } from "convex/react";
import { Sparkles } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHead } from "@/components/viz/Shell";
import { Bar, NoData, Panel, Skeleton } from "@/components/viz/core";
import { CHANNEL_LABEL, SOURCE_CLASS_LABEL, type Channel } from "@/lib/intel/types";
import { dayMonth, timestamp } from "@/lib/format";
import { riskColorForScore } from "@/lib/intel/visual";

/**
 * Analyst workspace.
 *
 * The model is an interface over the evidence, not a source of truth. The
 * prompt contains only the ledger already published on the event page, and the
 * response must return caveats alongside its thesis.
 */
export default function Analyst() {
  const feed = useQuery(api.intel.detectionFeed, {});
  const convex = useConvex();
  const [eventId, setEventId] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = eventId ?? feed?.rows[0]?.id ?? null;
  const detail = useQuery(
    api.intel.eventDetail,
    active ? { eventId: active } : "skip",
  );

  const run = async () => {
    if (!active) return;
    setPending(true);
    setError(null);
    try {
      const res = await convex.action(api.brief.generateBrief, {
        eventId: active,
      });
      if (!res.ok) setError(res.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setPending(false);
    }
  };

  if (!feed) {
    return (
      <main>
        <PageHead title="AI analyst" lede="Evidence-grounded briefs." />
        <div className="p-3">
          <Skeleton className="h-[520px] w-full" />
        </div>
      </main>
    );
  }

  const brief = detail?.brief;
  const assessment = detail?.assessment;

  return (
    <main className="min-w-0">
      <PageHead
        title="AI analyst"
        lede="The model may only re-weigh evidence already in the ledger. It cannot introduce facts, and every brief must return its caveats."
        actions={
          <>
            <select
              value={active ?? ""}
              onChange={(e) => setEventId(e.target.value)}
              className="h-8 border border-rule bg-card px-2 text-[12px] outline-none focus:border-foreground"
              aria-label="Select event"
            >
              {feed.rows.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.reference} — {r.title.slice(0, 44)}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="label flex h-8 items-center gap-2 bg-foreground px-3 text-background transition-opacity hover:opacity-85 disabled:opacity-50"
            >
              <Sparkles className="size-3.5" />
              {pending ? "Generating" : brief ? "Regenerate" : "Generate"}
            </button>
          </>
        }
      />

      {error ? (
        <div className="border-b border-rule bg-signal/10 px-4 py-2">
          <p className="text-[12px] text-signal">{error}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        {/* Answer */}
        <section className="xl:col-span-6">
          <Panel
            title="Answer"
            meta={brief ? `generated ${timestamp(brief.createdAt)}` : "no brief yet"}
          >
            {pending ? (
              <div className="space-y-2 p-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-3 w-full" />
                ))}
              </div>
            ) : brief ? (
              <div className="space-y-4 p-3">
                <p className="text-[13.5px] leading-relaxed">{brief.thesis}</p>
                {brief.channels.length > 0 ? (
                  <div>
                    <p className="label text-muted-foreground">
                      Transmission reading
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {brief.channels.map((c, i) => (
                        <li
                          key={i}
                          className="flex gap-2.5 text-[12px] leading-relaxed"
                        >
                          <span className="num shrink-0 text-[10px] text-signal">
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
                    <p className="label text-muted-foreground">
                      Caveats &amp; falsifiers
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {brief.caveats.map((c, i) => (
                        <li
                          key={i}
                          className="flex gap-2.5 text-[12px] leading-relaxed text-muted-foreground"
                        >
                          <span className="shrink-0">—</span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <NoData reason="No brief generated for this event yet. Press Generate to run the model over its evidence ledger." />
            )}
          </Panel>
        </section>

        {/* Drivers + model output */}
        <section className="space-y-3 xl:col-span-3">
          <Panel title="Model output" meta="deterministic">
            {assessment ? (
              <div className="space-y-2.5 p-3">
                {assessment.risk[30].drivers.map((d) => (
                  <div key={d.id}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[11.5px]">{d.label}</span>
                      <span className="num text-[11.5px]">
                        {d.contribution >= 0 ? "+" : "−"}
                        {Math.abs(d.contribution).toFixed(1)}
                      </span>
                    </div>
                    <Bar
                      value={Math.min(1, Math.abs(d.contribution) / 30)}
                      tone="var(--foreground)"
                      height={3}
                      className="mt-1"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <Skeleton className="h-48 w-full" />
            )}
          </Panel>

          <Panel title="Classification">
            <dl className="divide-y divide-rule">
              {[
                ["Composite", assessment ? `${assessment.overall.toFixed(1)} / 100` : "—"],
                ["Band", assessment?.band ?? "—"],
                ["Confidence", assessment ? `${(assessment.confidence * 100).toFixed(0)}%` : "—"],
                [
                  "Uncertainty",
                  assessment ? `±${(assessment.uncertainty / 2).toFixed(1)} pts` : "—",
                ],
                ["Evidence mass", assessment ? `${(assessment.evidenceStrength * 100).toFixed(0)}%` : "—"],
                ["Dominant channel", assessment ? CHANNEL_LABEL[assessment.dominantChannel as Channel] : "—"],
                ["Model", brief?.model ?? "—"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between px-3 py-2">
                  <dt className="label text-muted-foreground">{k}</dt>
                  <dd className="num text-[12px]">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </section>

        {/* Evidence */}
        <section className="xl:col-span-3">
          <Panel
            title="Evidence"
            meta={`${assessment?.scenario.signals.length ?? 0} observations`}
            className="h-full"
          >
            <ul className="max-h-[620px] divide-y divide-rule overflow-y-auto">
              {(assessment?.scenario.signals ?? []).map((s) => (
                <li key={s.id} className="px-3 py-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="label text-[9px] text-muted-foreground">
                      {SOURCE_CLASS_LABEL[s.sourceClass]}
                    </span>
                    <span className="num shrink-0 text-[9px] text-muted-foreground">
                      {dayMonth(s.observedAt)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug">{s.headline}</p>
                  <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
                    {s.source}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <Bar
                      value={s.reliability}
                      tone={riskColorForScore(s.reliability * 100)}
                      height={2}
                      className="flex-1"
                    />
                    <span className="num text-[9px] text-muted-foreground">
                      {(s.reliability * 100).toFixed(0)}% · ×{s.corroborations} ·{" "}
                      {s.anomalyZ.toFixed(1)}σ
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      </div>

      {assessment ? (
        <div className="px-3 pb-4">
          <Link
            to={`/app/event/${assessment.scenario.id}`}
            className="label text-muted-foreground transition-colors hover:text-foreground"
          >
            Open full event analysis →
          </Link>
        </div>
      ) : null}
    </main>
  );
}