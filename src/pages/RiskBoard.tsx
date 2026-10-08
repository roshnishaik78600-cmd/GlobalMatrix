import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { DataType, PageFrame, PageLoading } from "@/components/viz/exec/design";
import { SectionTitle, SegmentedControl } from "@/components/viz/exec/system";
import { NoData } from "@/components/viz/core";
import { WorldMap, MapLegend, isPlottable } from "@/components/viz/WorldMap";
import { BandChip, HeatLegend } from "@/components/intel/primitives";
import { riskColorForScore } from "@/lib/intel/visual";
import { CHANNEL_LABEL, STAGE_LABEL, type Channel } from "@/lib/intel/types";
import { useFocus } from "@/lib/focus";

/**
 * The six lenses the risk map can be read through.
 *
 * `risk` and the four transmission channels are shading lenses over the same
 * node set — each re-weights encodings the map already has. `supply` is a
 * different emphasis: it shades only the economies that *receive* chokepoint
 * coupling, because that is what this build can honestly call supply-chain
 * exposure. There is no per-node supply statistic to shade by, so the lens
 * reports the coupling itself and says so.
 */
type RiskDomain = Channel | "risk" | "supply";

const LENS_OPTIONS: { id: RiskDomain; label: string; hint: string }[] = [
  {
    id: "risk",
    label: "RISK",
    hint: "Blended load across every channel, with every event and coupling arc.",
  },
  {
    id: "trade",
    label: "TRADE",
    hint: "Shade places by the trade-channel load they carry; event rings follow trade-dominant events.",
  },
  {
    id: "energy",
    label: "ENERGY",
    hint: "Shade places by the energy-channel load they carry; event rings follow energy-dominant events.",
  },
  {
    id: "finance",
    label: "FINANCE",
    hint: "Shade places by the finance-channel load they carry; event rings follow finance-dominant events.",
  },
  {
    id: "supply",
    label: "SUPPLY CHAIN",
    hint: "Shade the economies that receive chokepoint coupling — the shared-event coupling the nine-stage chain reports as supply. Arcs emphasised; event rings hidden.",
  },
  {
    id: "diplomatic",
    label: "GEOPOLITICS",
    hint: "Shade places by diplomatic-channel load; event rings follow diplomatic events.",
  },
];

/**
 * Global risk.
 *
 * A hero, a map, and then the five questions the board answers: what is driving
 * it, where it lands, which channels are carrying it, how it has moved, and
 * what it is standing on. The map is the second object on the page rather than
 * a supporting picture, because "where" is the question a heat table answers
 * worst.
 */
export default function RiskBoard() {
  const data = useQuery(api.intel.riskBoard);
  const overview = useQuery(api.intel.overview);
  const { toggle, focus } = useFocus();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [domain, setDomain] = useState<RiskDomain>("risk");

  // Supply-chain lens: per-place load summed from the chokepoint→economy
  // coupling arcs the overview already publishes — the same shared-event
  // coupling the nine-stage chain reports as its supply stage. Only receivers
  // are handed to the map, so every other place stays quiet context rather
  // than being shaded with someone else's coupling.
  //
  // Declared before the loading return: a hook called conditionally is an
  // invalid hook call, and this memo must exist on every render.
  const supplyNodes = useMemo(() => {
    const received = new Map<string, number>();
    for (const f of overview?.flows ?? []) {
      received.set(f.to, (received.get(f.to) ?? 0) + f.weight);
    }
    return (overview?.mapNodes ?? [])
      .filter((n) => received.has(n.nodeId))
      .map((n) => ({
        ...n,
        load: Math.min(1, received.get(n.nodeId) ?? 0),
      }));
  }, [overview]);

  if (!data) {
    return (
      <PageLoading
        eyebrow="Risk explorer"
        title="Global risk"
        lede="Where risk is concentrated, what is driving it, and how it has moved."
        dominant="lg:col-span-12"
      />
    );
  }

  const { rows, channels, summary } = data;
  const severe = rows.filter((r) => r.band === "severe" || r.band === "high").length;
  const mean = summary.meanUncertainty;
  const selectedEvent = focus?.kind === "event" ? focus.id : null;

  // The map reuses the overview payload's node and flow set rather than
  // re-deriving one: it is the same network, and a second derivation would be a
  // second thing that can drift from the picture on the homepage.
  const mapNodes = (overview?.mapNodes ?? []).filter((n) =>
    isPlottable(n.nodeId),
  );

  return (
    <PageFrame
      eyebrow="Risk explorer"
      title="Global risk"
      lede="Where risk is concentrated right now, what is driving it, and how far it can be trusted."
      actions={
        <Link
          to="/app/events"
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
        >
          All events <ArrowUpRight className="size-3.5" />
        </Link>
      }
    >
      {/* ------------------------------------------------------------- HERO -- */}
      <div className="lg:col-span-12">
        <div className="card flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:gap-10 lg:p-8">
          <div className="min-w-0">
            <p className="exec-label text-[var(--exec-cyan)]">Composite board</p>
            <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-[var(--exec-ink-dim)]">
              Every event in the corpus, scored on a 0–100 composite at 7, 30 and
              90 days, always published as a central estimate inside an 80%
              interval.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4 lg:ml-auto">
            <Hero figure={String(rows.length)} label="Events on board" />
            <Hero
              figure={String(severe)}
              label="High or severe"
              tone={severe > 0 ? "var(--exec-crimson)" : undefined}
            />
            <Hero figure={`±${mean.toFixed(1)}`} label="Mean interval" />
            <Hero
              figure={String(summary.hottest.length)}
              label="Loaded nodes"
            />
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------- MAP -- */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta={`${mapNodes.length} tracked places · click to open a profile`}
            right={<DataType type="model" />}
          >
            Where risk is concentrated
          </SectionTitle>

          {/* The six lenses. The active hint stays visible rather than living
              in a tooltip: the lens changes what the picture *means*, so the
              claim being made must be readable without hovering. */}
          <div className="flex min-w-0 flex-col gap-2 border-b border-[var(--exec-hairline)] px-4 py-3 xl:flex-row xl:items-center xl:justify-between">
            <SegmentedControl
              options={LENS_OPTIONS}
              value={domain}
              onChange={setDomain}
            />
            <p className="min-w-0 text-[12px] leading-snug text-[var(--exec-ink-dim)] xl:max-w-[52ch] xl:text-right">
              {LENS_OPTIONS.find((o) => o.id === domain)?.hint}
            </p>
          </div>

          {mapNodes.length > 0 &&
          (domain !== "supply" || supplyNodes.length > 0) ? (
            <>
              <WorldMap
                nodes={
                  domain === "supply"
                    ? supplyNodes
                    : (overview?.mapNodes ?? [])
                }
                flows={overview?.flows ?? []}
                events={
                  domain === "supply"
                    ? []
                    : (overview?.mapEvents ?? []).filter(
                        (e) => e.nodeId !== "",
                      )
                }
                channel={
                  domain === "risk" || domain === "supply" ? null : domain
                }
                className="map-frame"
                selected={selected}
                onSelect={setSelected}
                onInspect={(id) => navigate(`/app/country/${id}`)}
              />
              <MapLegend />
            </>
          ) : (
            <NoData
              reason={
                domain === "supply"
                  ? "No chokepoint-to-economy coupling resolves in this corpus, so the supply-chain lens has nothing to shade."
                  : "The risk map is resolving its node set."
              }
            />
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- RISK DRIVERS -- */}
      <div className="lg:col-span-5">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="mean pressure across the corpus" right={<DataType type="model" />}>
            Risk drivers
          </SectionTitle>
          <ul className="flex flex-col gap-4 p-4">
            {channels.map((c) => (
              <li key={c} className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[14px] text-[var(--exec-ink)]">
                    {CHANNEL_LABEL[c]}
                  </span>
                  <span className="exec-num text-[15px] font-semibold text-[var(--exec-ink)]">
                    {(summary.byChannel[c] * 100).toFixed(0)}
                  </span>
                </div>
                <span className="h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                  <span
                    className="block h-full rounded-full"
                    style={{
                      width: `${Math.max(1, summary.byChannel[c] * 100)}%`,
                      background: riskColorForScore(summary.byChannel[c] * 100),
                    }}
                  />
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ----------------------------------------------- AFFECTED REGIONS -- */}
      <div className="lg:col-span-7">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="summed across all events">
            Most loaded network nodes
          </SectionTitle>
          {summary.hottest.length === 0 ? (
            <NoData reason="No node carries weighted exposure in this corpus." />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
              {summary.hottest.map((entry) => (
                <li key={`${entry.channel}-${entry.node.id}`} className="p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <Link
                      to={`/app/country/${entry.node.id}`}
                      className="min-w-0 truncate text-[14px] font-medium text-[var(--exec-ink)] transition-colors hover:text-[var(--exec-cyan)]"
                    >
                      {entry.node.label}
                    </Link>
                    <span className="exec-num shrink-0 text-[14px] font-semibold text-[var(--exec-ink)]">
                      {entry.load.toFixed(2)}
                    </span>
                  </div>
                  <span className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-[var(--exec-surface)]">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(
                          2,
                          (entry.load / Math.max(summary.hottest[0]?.load || 1, 0.0001)) * 100,
                        )}%`,
                        background:
                          entry.channel === "energy"
                            ? "var(--exec-crimson)"
                            : "var(--exec-ink-dim)",
                      }}
                    />
                  </span>
                  <span className="exec-label mt-1.5 block">
                    {CHANNEL_LABEL[entry.channel]} · {entry.node.region} ·
                    criticality {(entry.node.criticality * 100).toFixed(0)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ------------------------------------------ HISTORICAL MOVEMENT -- */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle
            meta="each row is one event; the bar is its 80% interval"
            right={<DataType type="scenario" />}
          >
            Historical movement
          </SectionTitle>

          {/* A table here, not cards: this is the one view on the platform where
              a reader lines numbers up against each other, and cards destroy
              that comparison. The container scrolls horizontally rather than
              overflowing, so the page itself never does. */}
          <div className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--exec-hairline)]">
                  <th scope="col" className="exec-label px-4 py-3">
                    Event
                  </th>
                  <th scope="col" className="exec-label px-4 py-3 text-center">
                    Pressure
                  </th>
                  <th scope="col" className="exec-label w-56 px-4 py-3">
                    30-day composite
                  </th>
                  <th scope="col" className="w-10 px-2 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.25) }}
                    className={`border-b border-[var(--exec-hairline)] transition-colors last:border-b-0 hover:bg-[var(--exec-surface)] ${
                      selectedEvent === row.id ? "bg-[var(--exec-surface)]" : ""
                    }`}
                  >
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => toggle({ kind: "event", id: row.id })}
                        className="block w-full min-w-0 text-left"
                      >
                        <span className="line-clamp-1 block text-[14px] font-medium text-[var(--exec-ink)]">
                          {row.title}
                        </span>
                        <span className="exec-label mt-0.5 block">
                          {STAGE_LABEL[row.stage]} · dominant{" "}
                          {CHANNEL_LABEL[row.dominantChannel]}
                        </span>
                      </button>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1">
                        {channels.map((c) => (
                          <span
                            key={c}
                            title={`${CHANNEL_LABEL[c]}: ${(row.channelPressure[c] * 100).toFixed(0)}% pressure`}
                            className="h-6 w-6 shrink-0 rounded-sm"
                            style={{
                              backgroundColor:
                                row.channelPressure[c] <= 0.001
                                  ? "var(--exec-surface)"
                                  : `color-mix(in srgb, ${riskColorForScore(row.channelPressure[c] * 100)} ${Math.round(
                                      16 + row.channelPressure[c] * 72,
                                    )}%, var(--card))`,
                            }}
                          />
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="exec-num w-12 shrink-0 text-[15px] font-semibold"
                          style={{ color: riskColorForScore(row.score30) }}
                        >
                          {row.score30.toFixed(1)}
                        </span>
                        <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-[var(--exec-surface)]">
                          <span
                            className="block h-full rounded-full"
                            style={{
                              width: `${Math.max(2, row.score30)}%`,
                              background: riskColorForScore(row.score30),
                            }}
                          />
                        </span>
                        <BandChip band={row.band} />
                        <span className="exec-num w-20 shrink-0 text-right text-[12px] text-[var(--exec-ink-dim)]">
                          {row.low30.toFixed(0)}–{row.high30.toFixed(0)}
                        </span>
                      </div>
                    </td>

                    <td className="px-2 py-3">
                      <Link
                        to={`/app/event/${row.id}`}
                        aria-label={`Open ${row.title}`}
                        className="flex size-8 items-center justify-center rounded-lg text-[var(--exec-ink-dim)] transition-colors hover:bg-[var(--exec-surface-strong)] hover:text-[var(--exec-ink)]"
                      >
                        <ArrowUpRight className="size-4" />
                      </Link>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-[var(--exec-hairline)] px-4 py-3">
            <HeatLegend />
            <span className="exec-label">
              Cell value = channel pressure, 0–100 · band colours are the engine's
              own thresholds
            </span>
          </div>
        </div>
      </div>

      {/* ------------------------------------------------ TRENDING SIGNALS -- */}
      <div className="lg:col-span-7">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="beyond the 90-day interval">
            Tail scenarios
          </SectionTitle>
          {rows.length === 0 ? (
            <NoData reason="No event resolves a tail scenario in this corpus." />
          ) : (
            <ol className="flex flex-col divide-y divide-[var(--exec-hairline)]">
              {rows.slice(0, 6).map((row, i) => (
                <li key={row.id} className="flex gap-3 p-4">
                  <span className="exec-num shrink-0 text-[12px] text-[var(--exec-crimson)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div className="min-w-0">
                    <Link
                      to={`/app/event/${row.id}`}
                      className="text-[14px] font-medium text-[var(--exec-ink)] transition-colors hover:text-[var(--exec-cyan)]"
                    >
                      {row.title}
                    </Link>
                    <p className="mt-1 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                      {row.tailScenario}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------- EVIDENCE -- */}
      <div className="lg:col-span-5">
        <div className="card flex h-full min-w-0 flex-col">
          <SectionTitle meta="how to read a figure">Evidence</SectionTitle>
          <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
            {[
              {
                label: "Observed",
                tone: "var(--exec-emerald)",
                body: "Reported by a named public source and shown with the period it covers. If the source could not be reached, the figure is hidden rather than estimated.",
              },
              {
                label: "Model output",
                tone: "var(--exec-cyan)",
                body: "Computed by GlobalMatrix from observed inputs using a published formula. Deterministic and re-derivable, but it is our arithmetic, not a measurement.",
              },
              {
                label: "Scenario",
                tone: "var(--exec-amber)",
                body: "A synthetic, internally-consistent scenario set. Nothing in it is a claim about the world, and it is labelled wherever it appears.",
              },
              {
                label: "Unavailable",
                tone: "var(--exec-crimson)",
                body: "No verified reading exists. The gap is shown rather than filled with an estimate, a carry-forward or an interpolation.",
              },
            ].map((row) => (
              <li key={row.label} className="flex flex-col gap-1.5 p-4">
                <span
                  className="text-[14px] font-semibold"
                  style={{ color: row.tone }}
                >
                  {row.label}
                </span>
                <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                  {row.body}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-auto border-t border-[var(--exec-hairline)] px-4 py-3">
            <Link
              to="/app/data"
              className="text-[13px] text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
            >
              Full source register →
            </Link>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ parts -- */

function Hero({
  figure,
  label,
  tone,
}: {
  figure: string;
  label: string;
  tone?: string;
}) {
  return (
    <div className="flex flex-col">
      <span
        className="exec-num text-[2.5rem] leading-none font-bold tracking-[-0.035em]"
        style={{ color: tone ?? "var(--exec-ink)" }}
      >
        {figure}
      </span>
      <span className="exec-label mt-2">{label}</span>
    </div>
  );
}