import { useState } from "react";
import { Link } from "react-router";
import { useMutation, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { FilterToggle, Panel, SectionHeader } from "@/components/intel/AppShell";
import { ChannelBars, Label, Meter } from "@/components/intel/primitives";
import { pct } from "@/lib/format";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";

export default function Industries() {
  const data = useQuery(api.intel.industryDirectory);
  const toggleWatch = useMutation(api.research.toggleWatch);
  const [watchedOnly, setWatchedOnly] = useState(false);

  if (!data) {
    return (
      <main className="mx-auto max-w-[1600px] px-5 py-20 lg:px-8">
        <p className="label text-muted-foreground">Resolving sector exposure…</p>
      </main>
    );
  }

  const { industries: allIndustries, watchlistSize } = data;
  const industries = watchedOnly
    ? allIndustries.filter((i) => i.watched)
    : allIndustries;
  const mostConcentrated = [...allIndustries].sort(
    (a, b) => b.concentration - a.concentration,
  )[0];
  const leastSubstitutable = [...allIndustries].sort(
    (a, b) => b.substitutionMonths - a.substitutionMonths,
  )[0];

  return (
    <main>
      <SectionHeader
        index="04"
        title="Industries"
        lede="Sector exposure is not assigned — it is derived. For each event, every node exposure is looked up in that sector's production, consumption, input and route structure, weighted by the share the node holds, then multiplied by the pathway's magnitude and confidence. Change the event corpus and these numbers move with it."
      />

      <div className="border-b border-rule bg-card">
        <dl className="mx-auto grid max-w-[1600px] grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-4 lg:px-8">
          <Stat
            caption="Sectors modelled"
            value={String(allIndustries.length)}
            note="Each with production, demand and route structure"
          />
          <Stat
            caption="Most exposed sector"
            value={allIndustries[0]?.id ?? "—"}
            note={allIndustries[0] ? `${allIndustries[0].label} · ${pct(allIndustries[0].load)}` : ""}
          />
          <Stat
            caption="Most concentrated"
            value={mostConcentrated ? pct(mostConcentrated.concentration) : "—"}
            note={
              mostConcentrated
                ? `Largest producer share in ${mostConcentrated.label}`
                : ""
            }
          />
          <Stat
            caption="Longest substitution lead"
            value={leastSubstitutable ? `${leastSubstitutable.substitutionMonths}m` : "—"}
            note={
              leastSubstitutable
                ? `${leastSubstitutable.label} — the sector's real constraint`
                : ""
            }
          />
        </dl>
      </div>

      <div className="border-b border-rule">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4 px-5 py-3 lg:px-8">
          <span className="label text-muted-foreground">
            Showing {industries.length} of {allIndustries.length} sectors
          </span>
          <FilterToggle
            active={watchedOnly}
            onClick={() => setWatchedOnly((v) => !v)}
          >
            Watchlist ({watchlistSize})
          </FilterToggle>
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
        <Panel
          caption={`Sectors · ${industries.length}`}
          aside="Ranked by live exposure to the current corpus"
        >
          <ul className="divide-y divide-rule">
            {industries.map((row, i) => (
              <motion.li
                key={row.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.32, delay: Math.min(i * 0.04, 0.3) }}
                className="group relative"
              >
                <Link
                  to={`/app/industry/${row.id}`}
                  className="grid grid-cols-12 items-start gap-x-4 gap-y-3 px-4 py-5 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                >
                  <div className="col-span-6 lg:col-span-1">
                    <span className="num text-[11px] text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <div className="col-span-6 lg:col-span-4">
                    <span className="num label text-signal">{row.code}</span>
                    <h3 className="mt-1.5 text-[15px] font-semibold tracking-[-0.01em]">
                      {row.label}
                    </h3>
                    <p className="mt-1.5 max-w-prose text-[12.5px] leading-relaxed text-muted-foreground">
                      {row.summary}
                    </p>
                  </div>

                  <div className="col-span-6 lg:col-span-2">
                    <Label>Live load</Label>
                    <p className="num display mt-1 text-2xl leading-none">
                      {pct(row.load)}
                    </p>
                    <ChannelBars
                      pressure={Object.fromEntries(
                        row.byChannel.map((c) => [c.channel, c.load]),
                      ) as Record<Channel, number>}
                      className="mt-2.5"
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      dominant {CHANNEL_LABEL[row.topChannel]}
                    </p>
                  </div>

                  <div className="col-span-6 lg:col-span-3">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-baseline justify-between">
                          <span className="label text-[9px] text-muted-foreground">
                            Concentration
                          </span>
                          <span className="num text-[11px]">
                            {pct(row.concentration)}
                          </span>
                        </div>
                        <Meter
                          value={row.concentration}
                          tone={row.concentration > 0.3 ? "signal" : "ink"}
                          className="mt-1.5"
                        />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Largest single-producer share
                        </p>
                      </div>
                      <div>
                        <div className="flex items-baseline justify-between">
                          <span className="label text-[9px] text-muted-foreground">
                            Structural fragility
                          </span>
                          <span className="num text-[11px]">
                            {pct(row.fragility)}
                          </span>
                        </div>
                        <Meter value={row.fragility} tone="ink" className="mt-1.5" />
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {row.substitutionMonths}-month substitution lead
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="col-span-12 lg:col-span-2">
                    <Label>Leading event</Label>
                    {row.topEvent ? (
                      <>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-snug">
                          {row.topEvent.title}
                        </p>
                        <p className="num mt-1 text-[10px] text-muted-foreground">
                          {CHANNEL_LABEL[row.topEvent.channel]} ·{" "}
                          {row.topEvent.contribution.toFixed(3)} ·{" "}
                          {row.eventCount} events
                        </p>
                      </>
                    ) : (
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        None
                      </p>
                    )}
                  </div>

                  <div className="col-span-1 hidden justify-end pt-1 lg:flex">
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                  </div>
                </Link>

                  <button
                    type="button"
                    aria-label={
                      row.watched ? "Remove from watchlist" : "Add to watchlist"
                    }
                    onClick={() =>
                      toggleWatch({ eventId: `SECTOR:${row.id}` })
                    }
                    className="absolute top-4 right-3 p-1.5 text-muted-foreground transition-colors hover:text-ink"
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