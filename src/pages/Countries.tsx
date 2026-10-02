import { Link } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel, SectionHeader } from "@/components/intel/AppShell";
import { ChannelBars, Label, Meter } from "@/components/intel/primitives";
import { pct } from "@/lib/format";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";

export default function Countries() {
  const data = useQuery(api.intel.countryDirectory);

  if (!data) {
    return (
      <main className="mx-auto max-w-[1600px] px-5 py-20 lg:px-8">
        <p className="label text-muted-foreground">Resolving country exposure…</p>
      </main>
    );
  }

  const { countries, corridors } = data;
  const regions = [...new Set(countries.map((c) => c.region))].sort();

  return (
    <main>
      <SectionHeader
        index="03"
        title="Countries"
        lede="Every economy and bloc in the graph, ranked by live exposure derived from the current event corpus. A country appears here because a propagation pathway reaches it — not because it was assigned a score. Where the panel reads MODELLED, the figure is a structural reference parameter; where it reads OBSERVED, it is computed from the corpus."
      />

      <div className="border-b border-rule bg-card">
        <dl className="mx-auto grid max-w-[1600px] grid-cols-2 divide-x divide-rule px-5 lg:grid-cols-4 lg:px-8">
          <Stat caption="Economies & blocs" value={String(countries.length)} note="Profiled nodes with structural parameters" />
          <Stat
            caption="Infrastructure nodes"
            value={String(corridors.length)}
            note="Chokepoints, corridors and settlement rails"
          />
          <Stat
            caption="Most exposed"
            value={countries[0]?.short ?? "—"}
            note={countries[0] ? `${countries[0].label} · ${pct(countries[0].load)} live load` : ""}
          />
          <Stat
            caption="Uncontested"
            value={String(countries.filter((c) => c.load < 0.1).length)}
            note="No current event reaches these nodes"
          />
        </dl>
      </div>

      <div className="mx-auto max-w-[1600px] px-5 py-8 lg:px-8 lg:py-10">
        <Panel
          caption={`Economies & blocs · ${countries.length}`}
          aside="Live load = Σ impact × magnitude × confidence across all pathways"
        >
          <div className="divide-y divide-rule">
            {regions.map((region) => (
              <section key={region}>
                <h3 className="label border-b border-rule bg-secondary px-4 py-2 text-muted-foreground">
                  {region}
                </h3>
                <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
                  {countries
                    .filter((c) => c.region === region)
                    .map((row, i) => (
                      <motion.li
                        key={row.nodeId}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.25) }}
                        className="group border-b border-rule md:border-r xl:border-b-0"
                      >
                        <Link
                          to={`/app/country/${row.nodeId}`}
                          className="flex h-full flex-col gap-3 p-4 transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <div className="flex items-baseline gap-2.5">
                              <span className="num text-[11px] text-signal">
                                {row.short}
                              </span>
                              <span className="text-[14px] font-semibold tracking-[-0.01em]">
                                {row.label}
                              </span>
                            </div>
                            <ArrowUpRight className="size-3.5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                          </div>

                          <div className="grid grid-cols-12 items-end gap-3">
                            <div className="col-span-5">
                              <Label>Live load</Label>
                              <p className="num display mt-1 text-2xl leading-none">
                                {pct(row.load)}
                              </p>
                            </div>
                            <div className="col-span-7">
                              <ChannelBars
                                pressure={Object.fromEntries(
                                  row.byChannel.map((c) => [c.channel, c.load]),
                                ) as Record<Channel, number>}
                              />
                            </div>
                          </div>

                          <div className="mt-auto space-y-2 border-t border-rule pt-3">
                            <div className="flex items-center justify-between">
                              <span className="label text-[9px] text-muted-foreground">
                                Structural fragility
                              </span>
                              <span className="num text-[11px]">
                                {pct(row.fragility)}
                              </span>
                            </div>
                            <Meter value={row.fragility} tone="ink" />
                            <p className="text-[11px] text-muted-foreground">
                              {row.eventCount} events reach this node · dominant{" "}
                              {CHANNEL_LABEL[row.topChannel]}
                              {row.offAffinityCount > 0
                                ? ` · ${row.offAffinityCount} off-channel`
                                : ""}
                            </p>
                          </div>
                        </Link>
                      </motion.li>
                    ))}
                </ul>
              </section>
            ))}
          </div>
        </Panel>
      </div>

      <div>
        <div className="mx-auto max-w-[1600px] px-5 pb-12 lg:px-8">
          <Panel
            caption={`Infrastructure · ${corridors.length}`}
            aside="Nodes that transmit rather than absorb"
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-rule">
                    {["Node", "Type", "Region", "Criticality", "Live load", "Events"].map((h) => (
                      <th key={h} className="label px-4 py-2.5 text-muted-foreground">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {corridors.map((row) => (
                    <tr key={row.nodeId} className="border-b border-rule last:border-b-0">
                      <td className="px-4 py-3">
                        <Link
                          to={`/app/country/${row.nodeId}`}
                          className="text-[13px] font-medium transition-colors hover:text-signal"
                        >
                          {row.label}
                        </Link>
                      </td>
                      <td className="label px-4 py-3 text-[9px] text-muted-foreground">
                        {row.kind}
                      </td>
                      <td className="px-4 py-3 text-[12px] text-muted-foreground">
                        {row.region}
                      </td>
                      <td className="num px-4 py-3 text-[12px]">
                        {pct(row.criticality)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Meter
                            value={row.load}
                            tone={row.load > 0.5 ? "signal" : "ink"}
                            className="max-w-[160px]"
                          />
                          <span className="num text-[11px]">{pct(row.load)}</span>
                        </div>
                      </td>
                      <td className="num px-4 py-3 text-[12px]">
                        {row.eventCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
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
      <dd className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{note}</dd>
    </div>
  );
}