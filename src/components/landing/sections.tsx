import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Boxes,
  Globe2,
  Landmark,
  Network,
  Package,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type {
  TopologyCategory,
  TopologyResult,
} from "@/convex/macroTopology";
import {
  buildStages,
  CHAIN_SUMMARY,
  type ChainRow,
  type ChainStage,
  type ChainStageId,
} from "@/lib/intel/chain";
import { Skeleton } from "@/components/viz/core";
import { cn } from "@/lib/utils";
import { loadColour } from "@/components/viz/exec/Topology";
import {
  BasisTag,
  ExecCard,
  NoDataAvailable,
  SectionTitle,
} from "@/components/viz/exec/system";

/**
 * The homepage's visual vocabulary.
 *
 * These are marketing surfaces, so they sit outside the console shell, but they
 * deliberately reuse the executive kit — same hairline, same accent, same
 * labels, same card. A visitor who crosses from the landing page into the
 * console should feel one product rather than two, and that only works if the
 * primitives are literally the same ones.
 */

/* ----------------------------------------------------------- Global pulse -- */

/**
 * The six domains the pulse reports.
 *
 * All six always resolve: the topology builds its series from a fixed
 * six-category set, so there is no per-domain "not connected" case to render
 * here. If that ever changes, the honest empty state is the branch below.
 */
const PULSE: { id: string; label: string; icon: LucideIcon }[] = [
  { id: "geopolitical", label: "Geopolitics", icon: Globe2 },
  { id: "trade-bottlenecks", label: "Trade", icon: Package },
  { id: "energy", label: "Energy", icon: Boxes },
  { id: "financial", label: "Markets", icon: TrendingUp },
  { id: "supply-chain", label: "Supply chain", icon: Network },
  { id: "policy", label: "Policy", icon: Landmark },
];

/**
 * The global pulse.
 *
 * Six cards, each one a large value, a signed trend, a sparkline and a single
 * status word. They are cards rather than cells in a table because the homepage's
 * job is to be scanned, not read in columns — a value you can recognise from
 * across a desk is worth more here than perfect vertical alignment.
 */
export function GlobalPulse({ data }: { data: TopologyResult | undefined }) {
  const byId = useMemo(
    () => new Map((data?.categories ?? []).map((c) => [c.id, c])),
    [data],
  );

  if (!data || data.categories.length === 0) {
    return (
      <ExecCard>
        <NoDataAvailable
          title="The global pulse has no series yet"
          reason="The macro topology is computed from the event corpus. Until the corpus resolves there is no daily series to plot, and this strip does not substitute an illustration for a measurement."
        />
      </ExecCard>
    );
  }

  return (
    <ExecCard>
      <SectionTitle
        meta={`30 days to ${data.latest} · each series scaled to its own peak`}
        right={<BasisTag basis="model" />}
      >
        Global pulse
      </SectionTitle>
      <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {PULSE.map((cell, i) => {
          const Icon = cell.icon;
          const cat = byId.get(cell.id);
          return (
            <motion.div
              key={cell.id}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.32, delay: Math.min(i * 0.04, 0.24) }}
              className="card card-hover flex min-w-0 flex-col gap-2 p-4"
            >
              <span className="flex items-center gap-2">
                <Icon className="size-4 shrink-0 text-[var(--exec-ink-dim)]" aria-hidden />
                <span className="exec-label min-w-0 truncate">{cell.label}</span>
              </span>
              {cat ? (
                <>
                  <span className="flex items-baseline gap-1.5">
                    <span
                      className="exec-num text-[2.25rem] leading-none font-bold tracking-[-0.025em]"
                      style={{ color: loadColour(cat.intensity) }}
                    >
                      {(cat.intensity * 100).toFixed(0)}
                    </span>
                    <span className="exec-num text-[13px] text-[var(--exec-ink-dim)]">
                      idx
                    </span>
                    <span
                      className="exec-num ml-auto text-[13px] font-semibold"
                      style={{ color: trendColour(cat.change) }}
                    >
                      {cat.change > 0 ? "▲" : cat.change < 0 ? "▼" : "—"}
                      {Math.abs(cat.change * 100).toFixed(1)}
                    </span>
                  </span>
                  <Sparkline values={cat.values} />
                  <span className="exec-label min-w-0 truncate" title={cat.measure}>
                    {statusWord(cat)}
                  </span>
                </>
              ) : (
                <span className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                  No verified data available.
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </ExecCard>
  );
}

/** Rising is the alarming direction on a risk index, so it takes the red. */
function trendColour(change: number): string {
  if (change > 0.001) return "var(--exec-crimson)";
  if (change < -0.001) return "var(--exec-emerald)";
  return "var(--exec-ink-dim)";
}

/**
 * One honest word per card.
 *
 * The 30-day trend and the latest reading can disagree — a category whose last
 * day carries no signal reads 0 while the window as a whole trends up. Both
 * figures stay on screen, but the word has to agree with the number the reader
 * is actually looking at, or the card claims a live index is "building" while
 * displaying zero.
 */
function statusWord(cat: TopologyCategory): string {
  if (cat.intensity <= 0.001) return "no current reading";
  return cat.trend === "rising"
    ? "building"
    : cat.trend === "falling"
      ? "easing"
      : "steady";
}

/** 30-point sparkline, filled under the line so six of them read as one set. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-8 w-full" />;
  return (
    <svg
      viewBox="0 0 100 28"
      preserveAspectRatio="none"
      className="h-8 w-full"
      aria-hidden
    >
      <polygon
        points={`0,28 ${values
          .map((v, i) => {
            // Clamped: the series is a share of its own ceiling, but a value
            // outside 0..1 would otherwise plot outside the viewBox and draw
            // over the neighbouring card instead of being visibly wrong.
            const y = 2 + (1 - Math.min(1, Math.max(0, v))) * 24;
            return `${((i / (values.length - 1)) * 100).toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")} 100,28`}
        fill="var(--exec-cyan)"
        opacity={0.12}
      />
      <polyline
        points={values
          .map((v, i) => {
            const y = 2 + (1 - Math.min(1, Math.max(0, v))) * 24;
            return `${((i / (values.length - 1)) * 100).toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")}
        fill="none"
        stroke="var(--exec-cyan)"
        strokeWidth={1.5}
        strokeOpacity={0.9}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ------------------------------------------------------ Propagation flow -- */

/**
 * Follow the Shock — the signature section of the product.
 *
 * Nine clickable stage nodes, one detail panel, and a per-event chain behind
 * both. The stage list itself lives in `lib/intel/chain` so this surface and the
 * console's chain page cannot drift apart on what stage six means; only the
 * skin differs.
 *
 * The design constraint that shapes everything here: a reader must be able to
 * see, in one glance, that two of the nine links are *not measured by this
 * build*. Those nodes stay in place and are dimmed, because a chain that quietly
 * drops a link reads as a finished analysis.
 */
export function FollowTheShock({
  events,
}: {
  events: { id: string; reference: string; title: string }[];
}) {
  const [eventId, setEventId] = useState<string | null>(null);
  const [stageId, setStageId] = useState<ChainStageId>("infrastructure");
  const [rowId, setRowId] = useState<string | null>(null);

  const active = eventId ?? events[0]?.id ?? null;
  const chain = useQuery(
    api.intel.eventChain,
    active ? { eventId: active } : "skip",
  );
  const stages = useMemo<ChainStage[]>(
    () => (chain ? buildStages(chain) : []),
    [chain],
  );

  if (events.length === 0) {
    return (
      <ExecCard>
        <SectionTitle meta="one event, nine stages">Follow the shock</SectionTitle>
        <NoDataAvailable
          title="No events to trace"
          reason="Follow the Shock draws a real event's propagation chain. With no event in the corpus there is no chain to draw, and this section does not substitute an illustration for one."
        />
      </ExecCard>
    );
  }

  const stage = stages.find((x) => x.id === stageId) ?? stages[0];
  const row = stage?.rows.find((r) => r.id === rowId) ?? stage?.rows[0] ?? null;
  const measured = stages.filter((x) => x.rows.length > 0).length;

  return (
    <ExecCard>
      <SectionTitle
        meta={`one event, nine stages · ${measured} carry measured rows`}
        right={<BasisTag basis="model" />}
      >
        Follow the shock
      </SectionTitle>

      {/* Event picker. A reader should be able to trace their own event, not the
          one the page happened to choose. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--exec-hairline)] px-4 py-3">
        <label className="exec-label shrink-0" htmlFor="shock-event">
          Event
        </label>
        <select
          id="shock-event"
          value={active ?? ""}
          onChange={(e) => {
            setEventId(e.target.value);
            // The selected row belongs to the event, so it is cleared rather
            // than left pointing at something the new event does not contain.
            setRowId(null);
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-[var(--exec-hairline)] bg-[var(--exec-surface)] px-3 text-[13px] text-[var(--exec-ink)] outline-none transition-colors focus:border-[var(--exec-cyan)]"
        >
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.reference} — {e.title.slice(0, 64)}
            </option>
          ))}
        </select>
      </div>

      {!chain || stages.length === 0 ? (
        <div className="p-4">
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <>
          {/* The nine nodes. Wrapping rather than scrolling, so every link is
              visible without interaction on every viewport — a chain you have to
              scroll to finish is not legible as a chain. */}
          <nav aria-label="Propagation stages" className="border-b border-[var(--exec-hairline)] px-4 py-4">
            <ol className="flex flex-wrap gap-2">
              {stages.map((s, i) => {
                const isActive = s.id === stage?.id;
                const dim = s.rows.length === 0;
                return (
                  <li key={s.id} className="min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        setStageId(s.id);
                        setRowId(null);
                      }}
                      aria-pressed={isActive}
                      className={cn(
                        "flex min-w-0 flex-col gap-1.5 rounded-xl border px-3 py-2 text-left transition-colors",
                        isActive
                          ? "border-[var(--exec-cyan)] bg-[color-mix(in_srgb,var(--exec-cyan)_10%,transparent)]"
                          : dim
                            ? "border-[var(--exec-hairline)] opacity-55 hover:opacity-90"
                            : "border-[var(--exec-hairline)] hover:border-[var(--exec-hairline-strong)]",
                      )}
                    >
                      <span className="flex items-center gap-2">
                        <span className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <span className="text-[13px] font-semibold text-[var(--exec-ink)]">
                          {s.title}
                        </span>
                      </span>
                      <span className="block h-1 w-full min-w-[7rem] rounded-full bg-[var(--exec-surface)]">
                        <span
                          className="block h-full rounded-full transition-[width] duration-300"
                          style={{
                            width: `${Math.max(2, (s.rows[0]?.weight ?? 0) * 100)}%`,
                            background: loadColour(s.rows[0]?.weight ?? 0),
                          }}
                        />
                      </span>
                      <span className="exec-label min-w-0 truncate text-[var(--exec-ink-dim)]">
                        {dim ? "not measured" : CHAIN_SUMMARY[s.id]}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>

          {/* Rows for the stage, and the panel they feed. */}
          <div className="grid grid-cols-1 gap-px bg-[var(--exec-hairline)] lg:grid-cols-12">
            <div className="min-w-0 bg-[var(--card)] lg:col-span-7">
              <p className="exec-label border-b border-[var(--exec-hairline)] px-4 py-2.5 text-[var(--exec-ink)]">
                {stage?.question}
              </p>
              {stage && stage.rows.length > 0 ? (
                <ul className="flex flex-col">
                  {stage.rows.map((r) => (
                    <li key={r.id} className="border-b border-[var(--exec-hairline)] last:border-b-0">
                      <ChainRowButton
                        row={r}
                        selected={row?.id === r.id}
                        onSelect={() => {
                          setStageId(stage.id);
                          setRowId(r.id);
                        }}
                      />
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-4 py-8">
                  <p className="exec-label text-[var(--exec-crimson)]">
                    {stage?.unmeasured?.title ?? "Nothing measured here"}
                  </p>
                  <p className="mt-2 max-w-md text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                    {stage?.unmeasured?.reason ??
                      "This stage has no measured rows for the selected event."}
                  </p>
                </div>
              )}
            </div>

            {/* One panel, cross-faded on every selection change, so a click has
                a visible consequence rather than silently swapping text. */}
            <div className="min-w-0 bg-[var(--card)] lg:col-span-5">
              <p className="exec-label border-b border-[var(--exec-hairline)] px-4 py-2.5">
                Step{" "}
                {stage ? String(stages.indexOf(stage) + 1).padStart(2, "0") : "—"} ·{" "}
                {stage?.title}
              </p>
              <AnimatePresence mode="wait">
                <motion.div
                  key={`${stage?.id}:${row?.id ?? "none"}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="flex min-w-0 flex-col gap-3 px-4 py-4"
                >
                  <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                    {stage?.about}
                  </p>
                  {row ? (
                    <div className="flex min-w-0 flex-col gap-2">
                      <p className="text-[15px] font-semibold text-[var(--exec-ink)]">
                        {row.label}
                      </p>
                      {row.weight !== undefined ? (
                        <span className="flex items-baseline gap-2">
                          <span
                            className="exec-num text-[1.75rem] leading-none font-bold tracking-[-0.025em]"
                            style={{ color: loadColour(row.weight) }}
                          >
                            {(row.weight * 100).toFixed(0)}
                          </span>
                          <span className="exec-label">weighted exposure</span>
                        </span>
                      ) : null}
                      {row.meta ? (
                        <p className="text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
                          {row.meta}
                        </p>
                      ) : null}
                      {row.detail ? (
                        <p className="text-[13px] leading-relaxed text-[var(--exec-ink)]">
                          {row.detail}
                        </p>
                      ) : null}
                      {row.href ? (
                        <Link
                          to={row.href}
                          className="exec-label self-start text-[var(--exec-cyan)] transition-opacity hover:opacity-80"
                        >
                          Open the full analysis →
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[var(--exec-hairline)] px-4 py-3">
            <span className="text-[13px] text-[var(--exec-ink-dim)]">
              {measured} of {stages.length} links carry measured rows for this event. The
              rest are stated as unmeasured, not zero.
            </span>
            <Link
              to="/app/chain"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
            >
              Trace any event <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </>
      )}
    </ExecCard>
  );
}

/** One row inside a stage. A button, so the panel always has a subject. */
function ChainRowButton({
  row,
  selected,
  onSelect,
}: {
  row: ChainRow;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full min-w-0 flex-col gap-1.5 px-4 py-2.5 text-left transition-colors",
        selected ? "bg-[var(--exec-surface)]" : "hover:bg-[var(--exec-surface)]",
      )}
    >
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-[13px] font-medium text-[var(--exec-ink)]">
          {row.label}
        </span>
        {row.weight !== undefined ? (
          <span
            className="exec-num shrink-0 text-[13px] font-semibold"
            style={{ color: loadColour(row.weight) }}
          >
            {(row.weight * 100).toFixed(0)}
          </span>
        ) : null}
      </span>
      <span className="block h-1 w-full rounded-full bg-[var(--exec-surface)]">
        <span
          className="block h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.min(100, (row.weight ?? 0) * 100)}%`,
            background: loadColour(row.weight ?? 0),
          }}
        />
      </span>
      {row.meta ? (
        <span className="exec-label min-w-0 truncate text-[var(--exec-ink-dim)]">
          {row.meta}
        </span>
      ) : null}
    </button>
  );
}

/* --------------------------------------------------------- Entry points -- */

export interface ExplorePanel {
  to: string;
  label: string;
  icon: LucideIcon;
  blurb: string;
  /** A preview drawn from real data, or an honest "not measured" note. */
  preview: React.ReactNode;
  /** True when this destination has no connected source behind it. */
  unavailable?: string;
}

/**
 * The six entry points.
 *
 * Each preview is a real thing: a live bar, a split count taken from the board
 * the link opens. Where nothing is connected the preview says so instead of
 * drawing a decorative chart — the panel still exists, because "we don't measure
 * this yet" is itself something a reader is entitled to know before they click.
 */
export function ExploreGrid({ panels }: { panels: ExplorePanel[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {panels.map((panel) => {
        const Icon = panel.icon;
        return (
          <Link
            key={panel.to}
            to={panel.to}
            className="card card-hover group flex min-w-0 flex-col p-4"
          >
            <div className="flex items-center gap-2">
              <Icon className="size-4 shrink-0 text-[var(--exec-cyan)]" aria-hidden />
              <h3 className="min-w-0 flex-1 truncate text-[15px] font-semibold text-[var(--exec-ink)]">
                {panel.label}
              </h3>
              <ArrowRight
                className="size-4 shrink-0 text-[var(--exec-ink-dim)] transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            {/* Fixed preview height so the cards align on one baseline and the
                row never reflows when a value changes width. */}
            <div className="mt-3 flex h-20 items-center">{panel.preview}</div>
            <p className="mt-3 text-[13px] leading-snug text-[var(--exec-ink-dim)]">
              {panel.unavailable ?? panel.blurb}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

/** Preview: horizontal ranked bars. Real loads, ranked. */
export function BarPreview({ rows }: { rows: { label: string; value: number }[] }) {
  if (rows.length === 0) return <UnavailablePreview />;
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ul className="flex w-full flex-col justify-center gap-1.5">
      {rows.slice(0, 4).map((row) => (
        <li key={row.label} className="flex items-center gap-2">
          <span className="exec-num w-14 shrink-0 truncate text-[12px] text-[var(--exec-ink-dim)]">
            {row.label}
          </span>
          <span className="h-1.5 min-w-0 flex-1 rounded-full bg-[var(--exec-surface)]">
            <span
              className="block h-full rounded-full"
              style={{
                width: `${Math.max(2, (row.value / max) * 100)}%`,
                background: loadColour(row.value),
              }}
            />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Preview: a single honest statement, used where no source is connected. */
export function UnavailablePreview() {
  return (
    <span className="flex items-center gap-2 text-[13px] text-[var(--exec-ink-dim)]">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ background: "var(--exec-crimson)" }}
        aria-hidden
      />
      No verified data available.
    </span>
  );
}

/** Preview: two-column split, for panels that genuinely have two measures. */
export function SplitPreview({
  left,
  right,
}: {
  left: { label: string; value: string; tone?: string };
  right: { label: string; value: string; tone?: string };
}) {
  return (
    <div className="grid w-full grid-cols-2 gap-4">
      {[left, right].map((cell) => (
        <div key={cell.label} className="min-w-0">
          <p className="exec-label min-w-0 truncate">{cell.label}</p>
          <p
            className="exec-num mt-1 truncate text-[1.75rem] leading-none font-bold tracking-[-0.025em]"
            style={{ color: cell.tone ?? "var(--exec-ink)" }}
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}