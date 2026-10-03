import { Link } from "react-router";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { Panel, Skeleton } from "@/components/viz/core";
import { compact } from "@/lib/numbers";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { SourceLine, SourceNote } from "@/components/viz/Provenance";
import {
  macroSeries,
  useAttentionData,
  useHeadlinesData,
  useMacroData,
  useTradeData,
  type AttentionPoint,
  type Headline,
  type MacroReading,
} from "@/hooks/use-verified-data";
import { getNode } from "@/lib/intel/nodes";
import { pct } from "@/lib/format";

/**
 * Panels backed by verified external data.
 *
 * Every figure here is pulled from a named public source and rendered next to
 * that source, the period it covers and the moment we fetched it. When a source
 * is unreachable the panel says so — it does not fall back to the analytical
 * corpus, because mixing a modelled number into a verified panel would make the
 * whole panel untrustworthy.
 */

/**
 * Compact absolute-size formatting for trade values.
 *
 * Deliberately an alias of the one canonical formatter rather than a second
 * implementation: these two used to round the same figure differently, so a
 * reader comparing a Sankey label against a table cell saw two numbers.
 */
export const usd = compact;

/**
 * Zero-baseline sparkline.
 *
 * Growth rates go negative, so this scales against the span either side of zero
 * rather than against the maximum. A series-only sparkline would flatten a
 * contraction to invisibility.
 */
export function MiniSpark({
  values,
  width = 56,
  height = 18,
}: {
  values: number[];
  width?: number;
  height?: number;
}) {
  if (values.length < 2) return <span className="text-[10px] text-muted-foreground">—</span>;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const y = (v: number) => height - 1 - ((v - min) / span) * (height - 2);
  const points = values
    .map((v, i) => `${((i / (values.length - 1)) * width).toFixed(1)},${y(v).toFixed(1)}`)
    .join(" ");
  const zeroY = y(0);

  return (
    <svg width={width} height={height} className="shrink-0" aria-hidden>
      <line
        x1={0}
        y1={zeroY}
        x2={width}
        y2={zeroY}
        stroke="var(--rule)"
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <polyline
        points={points}
        fill="none"
        stroke="var(--signal)"
        strokeWidth={1.25}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Delta({ history }: { history: MacroReading[] }) {
  if (history.length < 2) return null;
  const prev = history[history.length - 2].value;
  const last = history[history.length - 1].value;
  const change = last - prev;
  const Up = change >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`num inline-flex items-center gap-0.5 text-[10px] ${
        change >= 0 ? "text-stable" : "text-warning"
      }`}
      title={`Change from ${history[history.length - 2].period}`}
    >
      <Up className="size-2.5" aria-hidden />
      {change >= 0 ? "+" : ""}
      {change.toFixed(1)}
    </span>
  );
}

/**
 * Real macro indicators, ranked by absolute growth.
 *
 * Sorted on the observed values themselves, so the ordering is a fact about the
 * data rather than a judgement from the model.
 */
export function MacroPanel({ limit = 7 }: { limit?: number }) {
  const macro = useMacroData();

  if (macro.data === null) {
    return (
      <Panel title="Economic indicators" meta="World Bank" className="h-full">
        <Skeleton className="m-3 h-40 w-full" />
      </Panel>
    );
  }

  const series = macroSeries(macro.data);
  const growth = [...series.values()]
    .filter((s) => s.latest.indicatorKey === "gdpGrowth")
    .sort((a, b) => Math.abs(b.latest.value) - Math.abs(a.latest.value))
    .slice(0, limit);

  if (growth.length === 0) {
    return (
      <Panel title="Economic indicators" meta="World Bank" className="h-full">
        <NoVerifiedData
          title="Economic indicators"
          domain="World Bank macro series"
          action={
            <SourceNote
              note={
                macro.refreshing
                  ? "Contacting the World Bank now."
                  : macro.problem ?? "The World Bank returned no readings."
              }
            />
          }
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Economic indicators"
      meta="real GDP growth, reported"
      className="h-full"
    >
      <div className="border-b border-rule px-3 py-2">
        <SourceLine
          provenance={{
            sourceId: "worldbank",
            asOf: macro.asOf,
            retrievedAt: macro.retrievedAt,
            status: "observed",
          }}
        />
      </div>
      <ul className="divide-y divide-rule">
        {growth.map(({ latest, history }) => {
          const node = getNode(latest.node);
          return (
            <li key={latest.node}>
              <div className="flex items-center gap-2.5 px-3 py-2">
                <Link
                  to={`/app/country/${latest.node}`}
                  className="min-w-0 flex-1 truncate text-[12px] transition-colors hover:text-signal"
                >
                  {node?.label ?? latest.node}
                </Link>
                <span className="num w-8 shrink-0 text-[10px] text-muted-foreground">
                  {latest.period}
                </span>
                <span className="hidden shrink-0 sm:block">
                  <MiniSpark values={history.map((h) => h.value)} />
                </span>
                <span className="num w-14 shrink-0 text-right text-[12px]">
                  {pct(latest.value, 1)}
                </span>
                <Delta history={history} />
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/**
 * Real merchandise trade by reporter, as reported to UN Comtrade.
 *
 * Exports and imports are each summed from the source's own flow rows; the
 * balance is our arithmetic on those two observed totals and is labelled as
 * such, not presented as a separate published figure.
 */
export function TradePanel({ limit = 7 }: { limit?: number }) {
  const trade = useTradeData();

  if (trade.data === null) {
    return (
      <Panel title="Trade activity" meta="UN Comtrade" className="h-full">
        <Skeleton className="m-3 h-40 w-full" />
      </Panel>
    );
  }

  const flows = [...trade.data].sort(
    (a, b) => b.exportsUsd + b.importsUsd - (a.exportsUsd + a.importsUsd),
  );

  if (flows.length === 0) {
    return (
      <Panel title="Trade activity" meta="UN Comtrade" className="h-full">
        <NoVerifiedData
          title="Trade"
          domain="UN Comtrade merchandise values"
          action={
            <SourceNote
              note={
                trade.refreshing
                  ? "Contacting UN Comtrade now."
                  : trade.problem ?? "UN Comtrade returned no readings."
              }
            />
          }
        />
      </Panel>
    );
  }

  const max = Math.max(...flows.map((f) => f.exportsUsd + f.importsUsd));

  return (
    <Panel title="Trade activity" meta="merchandise, reported" className="h-full">
      <div className="border-b border-rule px-3 py-2">
        <SourceLine
          provenance={{
            sourceId: "comtrade",
            asOf: trade.asOf,
            retrievedAt: trade.retrievedAt,
            status: "observed",
          }}
        />
        <SourceNote note="Public preview tier: sampled, abbreviated detail. Balance is arithmetic on the two reported totals." />
      </div>
      <ul className="divide-y divide-rule">
        {flows.slice(0, limit).map((f) => {
          const node = getNode(f.reporter);
          const total = f.exportsUsd + f.importsUsd;
          const balance = f.exportsUsd - f.importsUsd;
          return (
            <li key={f.key} className="px-3 py-2">
              <div className="flex items-center gap-2.5">
                <Link
                  to={`/app/country/${f.reporter}`}
                  className="min-w-0 flex-1 truncate text-[12px] transition-colors hover:text-signal"
                >
                  {node?.label ?? f.reporter}
                </Link>
                <span className="num w-16 shrink-0 text-right text-[11px]">
                  {usd(total)}
                </span>
                <span
                  className={`num w-16 shrink-0 text-right text-[10px] ${
                    balance >= 0 ? "text-stable" : "text-warning"
                  }`}
                  title="Exports minus imports"
                >
                  {balance >= 0 ? "+" : ""}
                  {usd(balance)}
                </span>
              </div>
              {/* Exports and imports share one scale so the split is readable. */}
              <div className="mt-1.5 flex h-1 w-full gap-px overflow-hidden">
                <span
                  className="h-full bg-signal"
                  style={{ width: `${(f.exportsUsd / max) * 100}%` }}
                  title={`Exports ${usd(f.exportsUsd)}`}
                />
                <span
                  className="h-full bg-rule"
                  style={{ width: `${(f.importsUsd / max) * 100}%` }}
                  title={`Imports ${usd(f.importsUsd)}`}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center gap-4 border-t border-rule px-3 py-2">
        <span className="label flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 bg-signal" aria-hidden /> Exports
        </span>
        <span className="label flex items-center gap-1.5 text-muted-foreground">
          <span className="size-2 bg-rule" aria-hidden /> Imports
        </span>
        <Link
          to="/app/data"
          className="label ml-auto flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          Sources <ArrowUpRight className="size-3" />
        </Link>
      </div>
    </Panel>
  );
}
/* ------------------------------------------------------------------ */
/* Public attention — the honest stand-in for search-interest data.     */
/* ------------------------------------------------------------------ */

/** GDELT buckets by hour; roll them up to one point per day per topic. */
function dailySeries(
  points: AttentionPoint[],
): Array<{ topic: string; days: string[]; values: number[] }> {
  const byTopic = new Map<string, Map<string, number>>();

  for (const p of points) {
    const topic = p.key.split(":")[0];
    // Bucket keys look like 20261002T080000Z.
    const day = p.at.slice(0, 8);
    const totals = byTopic.get(topic) ?? new Map<string, number>();
    totals.set(day, (totals.get(day) ?? 0) + p.attention);
    byTopic.set(topic, totals);
  }

  const out: Array<{ topic: string; days: string[]; values: number[] }> = [];
  for (const [topic, totals] of byTopic) {
    const days = [...totals.keys()].sort();
    out.push({ topic, days, values: days.map((d) => totals.get(d) ?? 0) });
  }
  return out.sort((a, b) => b.values.length - a.values.length);
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function AttentionPanel() {
  const attention = useAttentionData();

  if (attention.data === null) {
    return (
      <Panel title="Public attention" meta="media coverage" className="h-full">
        <Skeleton className="m-3 h-28 w-full" />
      </Panel>
    );
  }

  const series = dailySeries(attention.data);
  if (series.length === 0) {
    return (
      <Panel title="Public attention" meta="media coverage" className="h-full">
        <NoVerifiedData
          title="Public attention"
          domain="GDELT media-attention coverage"
          action={
            <SourceNote
              note={
                attention.refreshing
                  ? "Contacting GDELT now."
                  : attention.problem ?? "GDELT returned no coverage data."
              }
            />
          }
        />
      </Panel>
    );
  }

  const peak = Math.max(...series.flatMap((s) => s.values), 0.0001);

  return (
    <Panel title="Public attention" meta="media coverage volume" className="h-full">
      <div className="border-b border-rule px-3 py-2">
        <SourceLine
          provenance={{
            sourceId: "gdelt",
            asOf: attention.asOf,
            retrievedAt: attention.retrievedAt,
            status: "observed",
          }}
        />
        <SourceNote note="Measures how much news coverage a topic is getting. It is not evidence that an event occurred, nor how severe it is." />
      </div>
      <ul className="divide-y divide-rule">
        {series.map((s) => {
          const last = s.values[s.values.length - 1] ?? 0;
          const prev = s.values[s.values.length - 2] ?? 0;
          const change = prev === 0 ? 0 : ((last - prev) / prev) * 100;
          return (
            <li key={s.topic} className="px-3 py-2.5">
              <div className="flex items-center gap-2.5">
                <span className="min-w-0 flex-1 truncate text-[12px]">
                  {titleCase(s.topic)}
                </span>
                <span
                  className={`num shrink-0 text-[10px] ${
                    change > 0 ? "text-elevated" : "text-muted-foreground"
                  }`}
                >
                  {change === 0 ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(0)}%`}
                </span>
              </div>
              {/* Each day is a column; the row reads as a coverage profile. */}
              <div className="mt-2 flex h-8 items-end gap-px">
                {s.values.map((v, i) => (
                  <span
                    key={s.days[i]}
                    className="flex-1 bg-signal/70"
                    style={{ height: `${Math.max(3, (v / peak) * 100)}%` }}
                    title={`${s.days[i]}: ${v.toFixed(0)} mentions`}
                  />
                ))}
              </div>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/**
 * Recent coverage, each item linking to the publisher's own article.
 *
 * This is the only place on the site where we show something a reader could
 * reasonably mistake for a confirmed event, so every row carries its publisher
 * and its timestamp.
 */
function HeadlinesPanel() {
  const headlines = useHeadlinesData();

  if (headlines.data === null) {
    return (
      <Panel title="Latest coverage" meta="linked to publishers" className="h-full">
        <Skeleton className="m-3 h-28 w-full" />
      </Panel>
    );
  }

  const items: Headline[] = headlines.data;
  if (items.length === 0) {
    return (
      <Panel title="Latest coverage" meta="linked to publishers" className="h-full">
        <NoVerifiedData
          title="Latest coverage"
          domain="GDELT article index"
          action={
            <SourceNote
              note={headlines.problem ?? "GDELT returned no articles."}
            />
          }
        />
      </Panel>
    );
  }

  return (
    <Panel
      title="Latest coverage"
      meta={`${items.length} articles · linked to publishers`}
      className="h-full"
    >
      <div className="border-b border-rule px-3 py-2">
        <SourceLine
          provenance={{
            sourceId: "gdelt",
            asOf: headlines.asOf,
            retrievedAt: headlines.retrievedAt,
            status: "observed",
          }}
        />
      </div>
      <ul className="divide-y divide-rule">
        {items.slice(0, 9).map((h) => (
          <li key={h.key}>
            <a
              href={h.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block px-3 py-2 transition-colors hover:bg-white/4"
            >
              <p className="line-clamp-2 text-[12px] leading-snug">{h.title}</p>
              <p className="num mt-1 truncate text-[9.5px] text-muted-foreground">
                {h.domain}
                {h.seenAt ? ` · ${h.seenAt.slice(0, 13).replace(/(\d{4})(\d{2})(\d{2})T(\d{2})/, "$1-$2-$3 $4:00")} UTC` : ""}
              </p>
            </a>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/** Every reporter, ranked, with no row cap. Used on the trade page. */
export function TradeTable() {
  return <TradePanel limit={40} />;
}

/** Every economy with a World Bank growth reading, with no row cap. */
export function MacroTable() {
  return <MacroPanel limit={40} />;
}

/** Public attention and coverage, side by side. */
export function AttentionSection() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <AttentionPanel />
      </div>
      <div className="lg:col-span-3">
        <HeadlinesPanel />
      </div>
    </div>
  );
}
