import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { FilterToggle, Panel, SectionHeader } from "@/components/intel/AppShell";
import {
  BandChip,
  ChannelBars,
  Figure,
  IntervalBar,
  Sparkline,
} from "@/components/intel/primitives";
import { pct, relativeDays } from "@/lib/format";
import { CHANNELS, CHANNEL_LABEL, type Channel, STAGE_LABEL, type Stage } from "@/lib/intel/types";

const STAGE_FILTERS: (Stage | "all")[] = ["all", "emerging", "escalating", "active"];

export default function Detection() {
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [watchedOnly, setWatchedOnly] = useState(false);

  const args = useMemo(
    () => ({
      ...(channel !== "all" ? { channel } : {}),
      ...(stage !== "all" ? { stage } : {}),
      ...(watchedOnly ? { watchlistOnly: true } : {}),
    }),
    [channel, stage, watchedOnly],
  );

  const data = useQuery(api.intel.detectionFeed, args);
  const stats = useQuery(api.intel.corpusStats);
  const toggleWatch = useMutation(api.research.toggleWatch);

  const rows = data?.rows ?? [];

  return (
    <main>
      <SectionHeader
        index="01"
        title="Detection"
        lede="Every emerging event in the corpus, ranked by its 30-day composite risk. Each row states the channel pressure behind the score, the evidence mass behind the confidence, and the interval the model is actually willing to defend."
        actions={
          <div className="border-l-2 border-signal pl-4">
            <p className="label text-muted-foreground">Corpus</p>
            <p className="num mt-1 text-2xl font-semibold">
              {stats?.events ?? "—"}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                events
              </span>
            </p>
          </div>
        }
      />

      {/* Stat strip */}
      <div className="border-b border-rule bg-card">
        <dl className="mx-auto grid max-w-[1600px] grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-4 lg:px-8">
          <Stat
            caption="Signals ingested"
            value={stats?.signals ?? "—"}
            note="Reliability-weighted observations"
          />
          <Stat
            caption="Actors tracked"
            value={stats?.actors ?? "—"}
            note="Economies, blocs and chokepoints"
          />
          <Stat
            caption="Network nodes exposed"
            value={stats?.nodes ?? "—"}
            note="Nodes with a live transmission path"
          />
          <Stat
            caption="Mean 30-day risk"
            value={stats ? stats.meanScore.toFixed(1) : "—"}
            note="Corpus-wide composite, 0–100"
          />
        </dl>
      </div>

      {/* Filters */}
      <div className="border-b border-rule">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 lg:px-8">
          <div className="flex flex-wrap items-center gap-px">
            <span className="label mr-3 text-muted-foreground">Channel</span>
            <FilterToggle active={channel === "all"} onClick={() => setChannel("all")}>
              All
            </FilterToggle>
            {CHANNELS.map((c) => (
              <FilterToggle
                key={c}
                active={channel === c}
                onClick={() => setChannel(c)}
              >
                {CHANNEL_LABEL[c]}
              </FilterToggle>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-px">
            <span className="label mr-3 text-muted-foreground">Stage</span>
            {STAGE_FILTERS.map((s) => (
              <FilterToggle
                key={s}
                active={stage === s}
                onClick={() => setStage(s)}
              >
                {s === "all" ? "All" : STAGE_LABEL[s]}
              </FilterToggle>
            ))}
          </div>

          <div className="ml-auto">
            <FilterToggle
              active={watchedOnly}
              onClick={() => setWatchedOnly((v) => !v)}
            >
              Watchlist ({data?.watchlistSize ?? 0})
            </FilterToggle>
          </div>
        </div>
      </div>

      {/* Feed */}
      <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
        <Panel
          caption={`Ranked feed · ${rows.length} of ${data?.total ?? 0}`}
          aside="Sorted by 30-day composite risk"
        >
          {rows.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-muted-foreground">
              No events match these filters.
            </p>
          ) : (
            <ul>
              {rows.map((row, i) => (
                <motion.li
                  key={row.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.03, 0.3) }}
                  className="group relative border-b border-rule last:border-b-0"
                >
                  <Link
                    to={`/app/event/${row.id}`}
                    className="block px-4 py-5 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none lg:px-6"
                  >
                    <div className="grid grid-cols-12 items-start gap-x-4 gap-y-3">
                      <div className="col-span-6 lg:col-span-1">
                        <span className="num text-[11px] text-muted-foreground">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>

                      <div className="col-span-6 lg:col-span-4">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="num label text-signal">
                            {row.reference}
                          </span>
                          <span className="label text-muted-foreground">
                            {STAGE_LABEL[row.stage]}
                          </span>
                        </div>
                        <h3 className="mt-1.5 text-[15px] leading-snug font-semibold tracking-[-0.01em]">
                          {row.title}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 max-w-prose text-[13px] leading-relaxed text-muted-foreground">
                          {row.summary}
                        </p>
                      </div>

                      <div className="col-span-6 lg:col-span-3">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="label text-muted-foreground">
                            Channel pressure
                          </span>
                          <span className="num text-[10px] text-muted-foreground">
                            {row.signalCount} signals
                          </span>
                        </div>
                        <ChannelBars
                          pressure={row.channelPressure}
                          className="mt-1.5"
                        />
                        <div className="mt-3 flex items-center justify-between gap-2">
                          <span className="label text-[8px] text-muted-foreground">
                            Evidence mass
                          </span>
                          <span className="num text-[10px]">
                            {pct(row.evidenceStrength)}
                          </span>
                        </div>
                        <Sparkline series={row.velocitySeries} className="mt-0.5" />

                        <div className="mt-3 border-t border-rule pt-2.5">
                          <span className="label text-[8px] text-muted-foreground">
                            Lands hardest on
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {row.topNodes.map((node) => (
                              <Link
                                key={node.nodeId}
                                to={`/app/country/${node.nodeId}`}
                                onClick={(e) => e.stopPropagation()}
                                className="label border border-rule px-1.5 py-1 text-[8px] text-muted-foreground transition-colors hover:border-signal hover:text-signal"
                                title={`${node.label} · weight ${node.weight.toFixed(2)}`}
                              >
                                {node.short}
                              </Link>
                            ))}
                          </div>
                        </div>
                      </div>

                      <div className="col-span-12 lg:col-span-3">
                        <div className="flex items-baseline justify-between">
                          <span className="label text-muted-foreground">
                            30-day risk
                          </span>
                          <span className="label text-muted-foreground">
                            Detected {relativeDays(row.detectedAt)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-end gap-3">
                          <span className="num display text-[2.25rem] leading-none">
                            {row.score30.toFixed(1)}
                          </span>
                          <BandChip band={row.band} />
                        </div>
                        <IntervalBar
                          score={row.score30}
                          low={row.low30}
                          high={row.high30}
                          band={row.band}
                          className="mt-2"
                        />
                        <p className="num mt-1 text-[10px] text-muted-foreground">
                          80% interval {row.low30.toFixed(1)}–{row.high30.toFixed(1)}
                        </p>
                      </div>

                      <div className="col-span-1 hidden justify-end pt-1 lg:flex">
                        <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-foreground" />
                      </div>
                    </div>
                  </Link>

                  <button
                    type="button"
                    aria-label={row.watched ? "Remove from watchlist" : "Add to watchlist"}
                    onClick={() => toggleWatch({ eventId: row.id })}
                    className="absolute top-4 right-3 p-1.5 text-muted-foreground transition-colors hover:text-foreground lg:right-4"
                  >
                    {row.watched ? (
                      <BookmarkCheck className="size-4 text-signal" />
                    ) : (
                      <Bookmark className="size-4" />
                    )}
                  </button>
                </motion.li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </main>
  );
}

function Stat({
  caption,
  value,
  note,
}: {
  caption: string;
  value: string | number;
  note: string;
}) {
  return (
    <div className="border-b border-rule px-0 py-6 last:border-b-0 lg:border-b-0 lg:px-6 lg:first:pl-0">
      <dt className="label text-muted-foreground">{caption}</dt>
      <dd className="mt-2">
        <Figure value={value} />
        <span className="mt-1.5 block text-[11px] leading-snug text-muted-foreground">
          {note}
        </span>
      </dd>
    </div>
  );
}