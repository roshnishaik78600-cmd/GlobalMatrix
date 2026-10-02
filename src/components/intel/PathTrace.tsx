import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import type { ExposureContribution } from "@/lib/intel/exposure";
import { CHANNEL_LABEL, STAGE_LABEL, type Stage } from "@/lib/intel/types";
import { Label, Meter } from "./primitives";
import { pct } from "@/lib/format";

/**
 * Causal path trace.
 *
 * Renders the actual chain the model walked, in order:
 *
 *   EVENT → CHANNEL (mechanism, lag) → NODE (impact) → WEIGHT
 *
 * Every number shown is one the engine actually used, so the trace doubles as
 * the audit trail: a reader can verify the arithmetic without opening the
 * source.
 */
export function PathTrace({
  contributions,
  limit = 6,
  showMechanism = true,
}: {
  contributions: ExposureContribution[];
  limit?: number;
  showMechanism?: boolean;
}) {
  if (contributions.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-[13px] text-muted-foreground">
        No pathway in the current corpus reaches this entity. That is a finding,
        not missing data.
      </p>
    );
  }

  const shown = contributions.slice(0, limit);
  const ceiling = contributions[0].contribution || 1;

  return (
    <ol className="divide-y divide-rule">
      {shown.map((c, i) => (
        <motion.li
          key={`${c.eventId}-${c.channel}-${c.viaNodeId}-${i}`}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3) }}
          className="px-4 py-4"
        >
          {/* Step 1 — event */}
          <div className="flex items-start gap-3">
            <Step n="1" />
            <div className="min-w-0 flex-1">
              <Link
                to={`/app/event/${c.eventId}`}
                className="text-[13.5px] leading-snug font-semibold transition-colors hover:text-signal"
              >
                {c.title}
              </Link>
              <p className="num mt-0.5 text-[10px] text-muted-foreground">
                {c.reference} · {STAGE_LABEL[c.stage as Stage]}
              </p>
            </div>
          </div>

          {/* Step 2 — transmission channel */}
          <div className="mt-3 flex items-start gap-3">
            <Step n="2" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="label">{CHANNEL_LABEL[c.channel]}</span>
                <span className="num text-[10px] text-muted-foreground">
                  magnitude {pct(c.magnitude)} · confidence{" "}
                  {pct(c.confidence)}
                </span>
                <span className="num text-[10px] text-muted-foreground">
                  lag {c.lagDays[0]}–{c.lagDays[1]}d
                </span>
                {c.affinity > 1 ? (
                  <span className="label border border-signal px-1.5 py-0.5 text-[8px] text-signal">
                    structural affinity ×{c.affinity.toFixed(1)}
                  </span>
                ) : (
                  <span className="label border border-rule px-1.5 py-0.5 text-[8px] text-muted-foreground">
                    off-affinity
                  </span>
                )}
              </div>
              {showMechanism ? (
                <p className="mt-1.5 max-w-prose text-[11.5px] leading-relaxed text-muted-foreground">
                  {c.mechanism}
                </p>
              ) : null}
            </div>
          </div>

          {/* Step 3 — landing node */}
          <div className="mt-3 flex items-start gap-3">
            <Step n="3" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-medium">{c.viaNodeLabel}</span>
                <span className="num text-[10px] text-muted-foreground">
                  impact {pct(c.impact)}
                </span>
                {c.share !== 1 ? (
                  <span className="num text-[10px] text-muted-foreground">
                    structural share {pct(c.share)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          {/* Step 4 — the arithmetic */}
          <div className="mt-3 flex items-start gap-3">
            <Step n="4" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <Label>Weighted contribution</Label>
                <span className="num text-[13px] font-semibold">
                  {c.contribution.toFixed(3)}
                </span>
              </div>
              <Meter
                value={c.contribution / ceiling}
                tone={c.contribution / ceiling > 0.55 ? "signal" : "ink"}
                className="mt-1.5"
              />
              <p className="num mt-1 text-[10px] text-muted-foreground">
                {c.impact.toFixed(2)} impact × {c.share.toFixed(2)} share ×{" "}
                {c.magnitude.toFixed(2)} magnitude × {c.confidence.toFixed(2)}{" "}
                confidence
                {c.affinity > 1 ? ` × ${c.affinity.toFixed(1)} affinity` : ""} ={" "}
                {c.contribution.toFixed(3)}
              </p>
            </div>
          </div>
        </motion.li>
      ))}

      {contributions.length > limit ? (
        <li className="px-4 py-3 text-center">
          <p className="num text-[11px] text-muted-foreground">
            + {contributions.length - limit} further pathway exposures below
          </p>
        </li>
      ) : null}
    </ol>
  );
}

function Step({ n }: { n: string }) {
  return (
    <span className="num mt-0.5 flex size-5 shrink-0 items-center justify-center border border-rule text-[9px] text-muted-foreground">
      {n}
    </span>
  );
}

/** Compact one-line variant used inside dense tables. */
export function PathInline({
  contribution,
  ceiling,
  channel,
}: {
  contribution: number;
  ceiling: number;
  channel: string;
}) {
  return (
    <span className="flex items-center gap-2">
      <span className="label text-[8px] text-muted-foreground">
        {channel}
      </span>
      <ArrowRight className="size-3 text-muted-foreground" />
      <span className="num text-[12px] font-semibold">
        {contribution.toFixed(3)}
      </span>
      <Meter
        value={contribution / (ceiling || 1)}
        tone={contribution / (ceiling || 1) > 0.55 ? "signal" : "ink"}
        className="max-w-[70px]"
      />
    </span>
  );
}