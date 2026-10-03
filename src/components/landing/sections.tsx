import { useMemo } from "react";
import { Link } from "react-router";
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
import type {
  TopologyCategory,
  TopologyResult,
} from "@/convex/macroTopology";
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
 * labels. A visitor who crosses from the landing page into the console should
 * feel one product rather than two, and that only works if the primitives are
 * literally the same ones.
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
 * The compact intelligence bar.
 *
 * Six cells, each one line of label, one number, one sparkline and one status
 * word. The temptation on a homepage is to make these cards; they are kept
 * deliberately small so the whole row reads as an instrument strip rather than
 * six competing headlines.
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
          reason="The macro topology is computed from the event corpus. Until the corpus resolves there is no daily series to plot, and this bar does not substitute an illustration for a measurement."
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
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {PULSE.map((cell) => {
          const Icon = cell.icon;
          const cat = byId.get(cell.id);
          return (
            <div
              key={cell.id}
              className="flex min-w-0 flex-col gap-1.5 border-r border-b border-[var(--exec-hairline)] px-2.5 py-2.5 last:border-r-0 lg:border-b-0"
            >
              <span className="flex items-center gap-1.5">
                <Icon className="size-3 shrink-0 text-[var(--exec-ink-dim)]" aria-hidden />
                <span className="exec-label min-w-0 truncate">{cell.label}</span>
              </span>
              {cat ? (
                <>
                  <span className="flex items-baseline gap-1">
                    <span
                      className="exec-num text-[19px] leading-none font-bold tracking-[-0.02em]"
                      style={{ color: loadColour(cat.intensity) }}
                    >
                      {(cat.intensity * 100).toFixed(0)}
                    </span>
                    <span className="exec-label">idx</span>
                    <span
                      className="exec-num ml-auto text-[9.5px]"
                      style={{
                        color:
                          cat.change > 0.001
                            ? "var(--exec-crimson)"
                            : cat.change < -0.001
                              ? "var(--exec-emerald)"
                              : "var(--exec-ink-dim)",
                      }}
                    >
                      {cat.change > 0 ? "▲" : cat.change < 0 ? "▼" : "—"}
                      {Math.abs(cat.change * 100).toFixed(1)}
                    </span>
                  </span>
                  <Sparkline values={cat.values} />
                  <span className="exec-label min-w-0 truncate normal-case" title={cat.measure}>
                    {statusWord(cat)}
                  </span>
                </>
              ) : (
                <span className="exec-num text-[9.5px] leading-snug text-[var(--exec-ink-dim)]">
                  No verified data available.
                </span>
              )}
            </div>
          );
        })}
      </div>
    </ExecCard>
  );
}

/**
 * One honest word per cell.
 *
 * The 30-day trend and the latest reading can disagree — a category whose last
 * day carries no signal reads 0 while the window as a whole trends up. Both
 * figures stay on screen, but the word has to agree with the number the reader
 * is actually looking at, or the cell claims a live index is "building" while
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

/** 30-point sparkline. Filled under the line so six of them still read as one strip. */
function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return <div className="h-5 w-full" />;
  return (
    <svg
      viewBox="0 0 100 20"
      preserveAspectRatio="none"
      className="h-5 w-full"
      aria-hidden
    >
      <polyline
        points={values
          .map((v, i) => {
            // Clamped: the series is a share of its own ceiling, but a value
            // outside 0..1 would otherwise plot outside the viewBox and draw
            // over the neighbouring cell instead of being visibly wrong.
            const y = 1 + (1 - Math.min(1, Math.max(0, v))) * 18;
            return `${((i / (values.length - 1)) * 100).toFixed(1)},${y.toFixed(1)}`;
          })
          .join(" ")}
        fill="none"
        stroke="var(--exec-cyan)"
        strokeWidth={1}
        strokeOpacity={0.85}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ------------------------------------------------------ Propagation flow -- */

/**
 * The eight-stage transmission chain, as one vertical object.
 *
 * This replaces the paragraph of methodology that used to sit here. The claim
 * it makes is a structural one — an event travels through these systems in this
 * order — so it is drawn rather than asserted. Two stages are not measured by
 * this build, and they are drawn differently on purpose: a full eight-node
 * diagram with two nodes quietly faked would be a lie told in the shape of a
 * feature.
 */
const STAGES: { label: string; measured: boolean; note: string }[] = [
  { label: "Event", measured: true, note: "Detected and scored" },
  { label: "Country", measured: true, note: "Where it lands hardest" },
  { label: "Trade", measured: true, note: "Reported flows" },
  { label: "Energy", measured: true, note: "Channel pathways" },
  { label: "Supply chain", measured: true, note: "Chokepoint routes" },
  { label: "Industry", measured: true, note: "Structural share" },
  { label: "Company", measured: false, note: "No filings connected" },
  { label: "Market", measured: false, note: "No price feed connected" },
];

export function PropagationFlow() {
  return (
    <ExecCard>
      <SectionTitle meta="one event, eight stages">
        How a shock travels
      </SectionTitle>
      <div className="px-3 py-4">
        <ol className="relative flex flex-col items-stretch gap-0 sm:flex-row sm:items-center sm:gap-0">
          {STAGES.map((stage, i) => (
            <li
              key={stage.label}
              className="relative flex flex-1 flex-col items-center gap-1.5 pb-4 last:pb-0 sm:pb-0 sm:pr-0"
            >
              {/* Connector. Horizontal on wide screens, vertical on narrow ones,
                  because a hairline drawn in the wrong direction reads as a
                  mistake rather than as a responsive layout. */}
              {i < STAGES.length - 1 ? (
                <span
                  aria-hidden
                  className="absolute top-[13px] left-1/2 h-[calc(100%-13px)] w-px -translate-x-1/2 bg-[var(--exec-hairline)] sm:top-1/2 sm:left-[calc(50%+13px)] sm:h-px sm:w-[calc(100%-26px)] sm:translate-x-0 sm:-translate-y-1/2"
                />
              ) : null}
              <span
                className="relative z-10 flex size-[26px] items-center justify-center border bg-[var(--exec-base)]"
                style={{
                  borderColor: stage.measured
                    ? "color-mix(in srgb, var(--exec-cyan) 55%, transparent)"
                    : "var(--exec-hairline-strong)",
                }}
              >
                <span
                  className="size-1.5 rounded-full"
                  style={{
                    background: stage.measured
                      ? "var(--exec-cyan)"
                      : "var(--exec-ink-dim)",
                  }}
                  aria-hidden
                />
              </span>
              <span
                className="exec-num relative z-10 bg-[var(--exec-base)] px-1 text-center text-[10px] font-semibold tracking-[0.04em] uppercase"
                style={{
                  color: stage.measured ? "var(--exec-ink)" : "var(--exec-ink-dim)",
                }}
              >
                {stage.label}
              </span>
              <span className="exec-label relative z-10 bg-[var(--exec-base)] px-1 text-center text-[8.5px] normal-case">
                {stage.note}
              </span>
            </li>
          ))}
        </ol>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-[var(--exec-hairline)] px-3 py-2">
        <span className="text-[11.5px] text-[var(--exec-ink-dim)]">
          Follow how a global event can move through interconnected systems.
        </span>
        <Link
          to="/app/chain"
          className="exec-label ml-auto inline-flex items-center gap-1 border border-[var(--exec-hairline)] px-2 py-1 transition-colors hover:border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)] hover:text-[var(--exec-ink)]"
        >
          Explore connections <ArrowRight className="size-3" />
        </Link>
      </div>
    </ExecCard>
  );
}

/* --------------------------------------------------------- Explore panels -- */

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
 * Each preview is a real thing: a live bar, a sparkline, a count taken from the
 * board the link opens. Where nothing is connected the preview says so instead
 * of drawing a decorative chart — the panel still exists, because "we don't
 * measure this yet" is itself something a reader is entitled to know before
 * they click.
 */
export function ExploreGrid({ panels }: { panels: ExplorePanel[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {panels.map((panel) => {
        const Icon = panel.icon;
        return (
          <Link
            key={panel.to}
            to={panel.to}
            className="glass glass-hover group flex min-w-0 flex-col overflow-hidden"
          >
            <div className="flex items-center gap-2 px-3 pt-3">
              <Icon className="size-3.5 shrink-0 text-[var(--exec-cyan)]" aria-hidden />
              <h3 className="exec-label min-w-0 truncate text-[var(--exec-ink)]">
                {panel.label}
              </h3>
              <ArrowRight
                className="ml-auto size-3 shrink-0 text-[var(--exec-ink-dim)] transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
            {/* Fixed preview height so the six cards align on one baseline and
                the row never reflows when a value changes width. */}
            <div className="flex h-[74px] items-center px-3 py-2">{panel.preview}</div>
            <p className="mt-auto border-t border-[var(--exec-hairline)] px-3 py-2 text-[11.5px] leading-snug text-[var(--exec-ink-dim)]">
              {panel.unavailable ?? panel.blurb}
            </p>
          </Link>
        );
      })}
    </div>
  );
}

/** Preview: horizontal ranked bars. Real loads, ranked. */
export function BarPreview({
  rows,
}: {
  rows: { label: string; value: number }[];
}) {
  if (rows.length === 0) return <UnavailablePreview />;
  const max = Math.max(...rows.map((r) => r.value), 0.0001);
  return (
    <ul className="flex w-full flex-col justify-center gap-1">
      {rows.slice(0, 4).map((row) => (
        <li key={row.label} className="flex items-center gap-2">
          <span className="exec-num w-14 shrink-0 truncate text-[9px] text-[var(--exec-ink-dim)]">
            {row.label}
          </span>
          <span className="h-1.5 min-w-0 flex-1 bg-[var(--exec-hairline)]">
            <span
              className="block h-full"
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
    <span className="exec-label flex items-center gap-1.5 normal-case">
      <span
        className="size-1.5 shrink-0 rounded-full"
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
    <div className="grid w-full grid-cols-2 gap-3">
      {[left, right].map((cell) => (
        <div key={cell.label} className="min-w-0">
          <p className="exec-label min-w-0 truncate">{cell.label}</p>
          <p
            className="exec-num mt-1 truncate text-[18px] leading-none font-bold"
            style={{ color: cell.tone ?? "var(--exec-ink)" }}
          >
            {cell.value}
          </p>
        </div>
      ))}
    </div>
  );
}
