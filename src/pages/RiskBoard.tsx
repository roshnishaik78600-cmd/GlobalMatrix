import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageFrame, PageLoading } from "@/components/viz/exec/design";
import { Panel } from "@/components/intel/AppShell";
import {
  BandChip,
  HeatCell,
  HeatLegend,
  IntervalBar,
  Label,
  Meter,
} from "@/components/intel/primitives";
import { CHANNEL_LABEL, STAGE_LABEL, type Channel } from "@/lib/intel/types";
import { useFocus } from "@/lib/focus";

export default function RiskBoard() {
  const data = useQuery(api.intel.riskBoard);
  const { toggle } = useFocus();
  const navigate = useNavigate();

  if (!data) {
    return (
      <PageLoading
        eyebrow="Risk"
        title="Risk surface"
        lede="Every event against every transmission channel, with the 30-day composite and its 80% interval."
      />
    );
  }

  const { rows, channels, summary } = data;
  const severe = rows.filter((r) => r.band === "severe" || r.band === "high").length;

  return (
    <PageFrame
      eyebrow="Risk"
      title="Risk board"
      lede="Every event against every transmission channel, with the 30-day composite and its 80% interval."
    >

      {/* Aggregate strip */}
      <div className="border-b border-rule bg-card">
        <dl className="grid gm-width grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-5 lg:px-8">
          <Aggregate caption="Events on board" value={String(rows.length)} note="Ranked by 30-day composite" />
          <Aggregate caption="High or severe" value={String(severe)} note="Events breaching the elevated band" />
          {channels.map((c) => (
            <Aggregate
              key={c}
              caption={`${CHANNEL_LABEL[c]} load`}
              value={pct0(summary.byChannel[c])}
              note="Mean pressure across the corpus"
            />
          ))}
        </dl>
      </div>

      {/* Matrix */}
      <div className="border-b border-rule">
        <div className="gm-width px-5 py-8 lg:px-8 lg:py-10">
          <Panel
            caption="Event × channel pressure matrix"
            aside="0–100 channel pressure · sorted by 30-day composite"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule">
                    <th className="label w-[26rem] px-4 py-3 text-muted-foreground">
                      Event
                    </th>
                    {channels.map((c) => (
                      <th
                        key={c}
                        className="label px-2 py-3 text-center text-muted-foreground"
                      >
                        {CHANNEL_LABEL[c]}
                      </th>
                    ))}
                    <th className="label w-[16rem] px-4 py-3 text-muted-foreground">
                      30-day composite
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <motion.tr
                      key={row.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.3, delay: Math.min(i * 0.025, 0.3) }}
                      className="group border-b border-rule last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => toggle({ kind: "event", id: row.id })}
                          onDoubleClick={() => navigate(`/app/event/${row.id}`)}
                          className="block w-full text-left focus-visible:outline-none"
                        >
                          <span className="num label text-signal">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <p className="mt-1 text-[13px] leading-snug font-medium transition-colors group-hover:text-signal">
                            {row.title}
                          </p>
                          <p className="mt-1 text-[10px] text-muted-foreground">
                            {STAGE_LABEL[row.stage]} · dominant{" "}
                            {CHANNEL_LABEL[row.dominantChannel]}
                          </p>
                        </button>
                      </td>

                      {channels.map((c) => (
                        <td key={c} className="p-1">
                          <button
                            type="button"
                            onClick={() => toggle({ kind: "channel", id: c as Channel })}
                            title={`Inspect ${CHANNEL_LABEL[c as Channel]} pressure`}
                            className="block w-full focus-visible:outline-none"
                          >
                            <HeatCell value={row.channelPressure[c]} />
                          </button>
                        </td>
                      ))}

                      <td className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="num text-[15px] font-semibold">
                            {row.score30.toFixed(1)}
                          </span>
                          <BandChip band={row.band} />
                        </div>
                        <IntervalBar
                          score={row.score30}
                          low={row.low30}
                          high={row.high30}
                          band={row.band}
                          className="mt-1.5"
                        />
                        <p className="num mt-1 text-[10px] text-muted-foreground">
                          {row.low30.toFixed(0)}–{row.high30.toFixed(0)} · ±
                          {(row.uncertainty / 2).toFixed(0)}
                        </p>
                      </td>

                      <td className="pr-3">
                        <ArrowUpRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between gap-4 border-t border-rule px-4 py-3">
              <HeatLegend />
              <span className="label text-muted-foreground">
                Cell value = channel pressure, 0–100
              </span>
            </div>
          </Panel>
        </div>
      </div>

      {/* Network load + tails */}
      <div>
        <div className="grid gm-width gap-8 px-5 py-8 lg:grid-cols-12 lg:px-8 lg:py-10">
          <div className="lg:col-span-5">
            <Panel
              caption="Most loaded network nodes"
              aside="Summed across all events"
              className="h-full"
            >
              <ul className="divide-y divide-rule">
                {summary.hottest.map((entry) => (
                  <li key={`${entry.channel}-${entry.node.id}`} className="px-4 py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[13px] font-medium">
                        {entry.node.label}
                      </span>
                      <span className="label text-[9px] text-muted-foreground">
                        {CHANNEL_LABEL[entry.channel]} · {entry.node.region}
                      </span>
                    </div>
                    <Meter
                      value={Math.min(1, entry.load / (summary.hottest[0]?.load || 1))}
                      tone={entry.channel === "energy" ? "signal" : "ink"}
                      className="mt-2"
                    />
                    <p className="num mt-1 text-[10px] text-muted-foreground">
                      criticality {pct0(entry.node.criticality)} · load{" "}
                      {entry.load.toFixed(2)}
                    </p>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <div className="lg:col-span-7">
            <Panel
              caption="Tail scenarios"
              aside="Beyond the 90-day interval"
              className="h-full"
            >
              <ol className="divide-y divide-rule">
                {rows.map((row, i) => (
                  <li key={row.id} className="px-4 py-4">
                    <div className="flex items-baseline gap-3">
                      <span className="num text-[11px] text-signal">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <Link
                        to={`/app/event/${row.id}`}
                        className="text-[13px] font-medium underline decoration-rule underline-offset-4 transition-colors hover:decoration-ink"
                      >
                        {row.title}
                      </Link>
                    </div>
                    <p className="mt-2 pl-8 text-[12px] leading-relaxed text-muted-foreground">
                      {row.tailScenario}
                    </p>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        </div>
      </div>

      <footer className="border-t border-rule">
        <div className="flex gm-width flex-wrap items-center justify-between gap-3 px-5 py-6 lg:px-8">
          <Label>
            Model: deterministic composite · all coefficients stated in
            src/lib/intel/engine.ts
          </Label>
          <Label>
            Mean interval width ±
            {summary.meanUncertainty.toFixed(1)} points
          </Label>
        </div>
      </footer>
  </PageFrame>
  );
}

function pct0(value: number): string {
  return `${Math.round(value * 100)}`;
}

function Aggregate({
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