import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { TopologyResult } from "@/convex/macroTopology";
import { useFocus } from "@/lib/focus";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";
import { WorldMap } from "@/components/viz/WorldMap";
import { Skeleton } from "@/components/viz/core";
import { getNode } from "@/lib/intel/nodes";
import { count, num, pct } from "@/lib/numbers";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import {
  Action,
  DataType,
  EmptyState,
  FilterBar,
  Metric,
  MetricGrid,
  PageFrame,
  PanelHead,
  Region,
  Segmented,
} from "@/components/viz/exec/design";
import { FreshnessTag } from "@/components/viz/exec/system";
import {
  DomainSwitch,
  GaugeCluster,
  RiskTopology,
  ThreatTicker,
  loadColour,
  type TickerEvent,
} from "@/components/viz/exec/Topology";
import { freshnessOf } from "@/lib/freshness";
import { period as periodLabel } from "@/lib/numbers";

/**
 * The executive command centre.
 *
 * Three questions in five seconds: what is the biggest risk surface right now,
 * where is it, and what changed. So the page leads with one dominant map,
 * supports it with the macro topology and three composite gauges, and closes
 * with a ticker of what actually happened — in that order, because that is the
 * order an analyst reads in.
 */
export default function Overview() {
  const data = useQuery(api.intel.overview);
  const topology = useQuery(api.macroTopology.macroTopology) as
    | TopologyResult
    | undefined;
  const stats = useQuery(api.intel.corpusStats);
  const navigate = useNavigate();
  const { focus, toggle, clear, isFocused, window: timeWindow, setWindow } = useFocus();
  const [domain, setDomain] = useState<Channel | "risk">("risk");
  // One selection drives both the topology board and the map, so clicking a tile
  // re-shades the map and switching the map domain highlights the matching tile.
  const [topologyFilter, setTopologyFilter] = useState<string | null>(null);

  const selected = focus?.kind === "node" ? focus.id : null;
  const setSelected = (id: string | null) =>
    id === null ? clear() : toggle({ kind: "node", id });

  // The time window is measured against the corpus's own clock, not the wall
  // clock. The corpus is a scenario with a latest observation date, and treating
  // it as if its events were happening right now would misdate every one of them.
  const ticker = useMemo<TickerEvent[]>(() => {
    if (!data) return [];
    const anchor = corpusClock(data.topEvents.map((e) => e.detectedAt));
    if (!anchor) return [];
    const cutoff = anchor - WINDOW_CUTOFF[timeWindow];
    return [...data.topEvents]
      .sort((a, b) => b.detectedAt.localeCompare(a.detectedAt))
      .map((e) => ({
        id: e.id,
        title: e.title,
        location: e.topNodes[0]?.label ?? "no dominant location",
        at: e.detectedAt.slice(0, 10),
        score: e.score,
        band: e.band,
        channel: e.dominantChannel,
        confidence: e.confidence,
        source: e.signals[0]?.source ?? CORPUS_LABEL,
        inWindow: Date.parse(e.detectedAt) >= cutoff,
      }));
  }, [data, timeWindow]);

  if (!data || !topology) return <OverviewSkeleton />;

  const mapEvents = (data.mapEvents ?? []).filter((e) => e.nodeId !== "");
  const mapChannel = domain === "risk" ? null : domain;
  const hottest = data.hottestCountries[0];
  // Only places the map can actually draw are counted, so the number on the
  // page matches the number of markers in the picture.
  const mappable = data.mapNodes.filter((n) => getNode(n.nodeId).lat !== undefined);

  return (
    <PageFrame
      eyebrow="Overview"
      title="Executive command centre"
      lede="Where global risk is concentrated right now, the macro topology behind it, and what changed."
      actions={
        <>
          <Action to="/app/risk">Risk explorer</Action>
          <Action to="/app/scenarios">Scenario lab</Action>
        </>
      }
      controls={
        <FilterBar scope={`${mappable.length} places · ${data.flows.length} couplings · ${mapEvents.length} events`}>
          <span className="exec-label">Window</span>
          <Segmented
            label="Time window"
            options={[
              { id: "1h", label: "1H" },
              { id: "6h", label: "6H" },
              { id: "24h", label: "24H" },
              { id: "7d", label: "7D" },
            ]}
            value={timeWindow}
            onChange={setWindow}
          />
          <DomainSwitch
            value={domain}
            onChange={(next) => {
              setDomain(next);
              if (next === "risk") setTopologyFilter(null);
              else setTopologyFilter(next);
            }}
          />
        </FilterBar>
      }
      footer={
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <DataType type="scenario" />
          <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
            {CORPUS_NOTE}
          </span>
          <Action to="/methodology">Methodology</Action>
        </div>
      }
    >
      {/* LEVEL 1 — one dominant object. The map. Everything else is sized to
          support it rather than compete with it. */}
      <Region width={8} dominant>
        <PanelHead
          title="Global risk surface"
          meta="land shading and arcs are model output"
          actions={<DataType type="model" />}
        />
        <div className="min-h-0 flex-1">
          <WorldMap
            nodes={data.mapNodes}
            flows={data.flows}
            events={mapEvents}
            height={470}
            selected={selected}
            channel={mapChannel}
            onSelect={setSelected}
            onInspect={(id) => navigate(`/app/country/${id}`)}
          />
        </div>
      </Region>

      {/* LEVEL 2 — where, and what is exposed. */}
      <Region width={4} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <MetricGrid columns={2}>
            <Metric
              label="Mean composite"
              value={num(stats?.meanScore ?? 0, 1)}
              unit="/100"
              basis="model"
              tone={loadColour((stats?.meanScore ?? 0) / 100)}
              period="30D"
              hint="Corpus mean composite risk on the 30-day horizon"
            />
            <Metric
              label="Most exposed"
              value={hottest?.short ?? "\u2014"}
              basis="model"
              tone={loadColour(hottest?.load ?? 0)}
              hint={hottest ? `${hottest.label} at ${pct(hottest.load)}` : "No exposure resolved"}
            />
            <Metric
              label="Corpus events"
              value={count(stats?.events ?? data.stats.events)}
              basis="scenario"
              hint="Synthetic events currently in the corpus"
            />
            <Metric
              label="Tracked places"
              value={count(mappable.length)}
              basis="scenario"
              hint="Places the map can plot"
            />
          </MetricGrid>
        </div>

        <div className="glass flex min-h-0 flex-1 flex-col">
          <PanelHead title="Exposure leaders" meta="composite load" actions={<DataType type="model" />} />
          <GaugeCluster data={topology} />
        </div>
      </Region>

      {/* LEVEL 2 — the six domains, full width so six tiles stay legible. */}
      <Region width={12}>
        <RiskTopology
          data={topology}
          selected={topologyFilter}
          onSelect={(id) => {
            setTopologyFilter(id);
            if (id && id !== "risk") {
              setDomain((CHANNEL_BY_TOPOLOGY[id] as Channel | undefined) ?? "risk");
            }
          }}
        />
      </Region>

      {/* LEVEL 3 — what is affected, and what actually happened. */}
      <Region width={7}>
        <PanelHead
          title="Top developments"
          meta="30-day composite"
          actions={<DataType type="model" />}
        />
        <ul className="divide-y divide-[var(--exec-hairline)]">
          {data.topEvents.map((event) => {
            const active = isFocused("event", event.id);
            return (
              <li key={event.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => toggle({ kind: "event", id: event.id })}
                  aria-pressed={active}
                  className="min-w-0 flex-1 px-3 py-2.5 text-left transition-colors hover:bg-[var(--exec-surface-strong)]"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span
                      className="exec-label"
                      style={{ color: riskColorForScore(event.score) }}
                    >
                      {CHANNEL_LABEL[event.dominantChannel]}
                    </span>
                    <span className="exec-num text-[12px] font-semibold text-[var(--exec-ink)]">
                      {num(event.score, 1)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12px] leading-snug font-medium text-[var(--exec-ink)]">
                    {event.title}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1">
                    {event.topNodes.map((n) => (
                      <span
                        key={n.nodeId}
                        className="exec-num border border-[var(--exec-hairline)] px-1 text-[8.5px] text-[var(--exec-ink-dim)]"
                        title={`${n.label} · weight ${num(n.weight, 2)}`}
                      >
                        {n.short}
                      </span>
                    ))}
                    <span className="exec-num ml-auto text-[9px] text-[var(--exec-ink-dim)]">
                      80% {num(event.low, 0)}\u2013{num(event.high, 0)}
                    </span>
                  </div>
                </button>
                <Link
                  to={`/app/event/${event.id}`}
                  aria-label={`Open ${event.title}`}
                  className="flex w-8 shrink-0 items-center justify-center border-l border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
                >
                  <ArrowUpRight className="size-3.5" />
                </Link>
              </li>
            );
          })}
        </ul>
      </Region>

      {/* LEVEL 2 — the timeline of what happened. */}
      <Region width={5}>
        <PanelHead
          title="Threat timeline"
          meta={timeWindow.toUpperCase()}
          actions={<DataType type="scenario" />}
        />
        {ticker.length === 0 ? (
          <EmptyState
            title="No events in this window"
            reason="The corpus supplies the events behind this board. Nothing falls inside the selected window, and GlobalMatrix will not substitute an illustrative feed for a missing one."
            action={<Action to="/app/events">Open the event observatory</Action>}
          />
        ) : (
          <ThreatTicker
            events={ticker}
            windowLabel={timeWindow.toUpperCase()}
            selected={focus?.kind === "event" ? focus.id : null}
            onSelect={(id) => toggle({ kind: "event", id })}
          />
        )}
      </Region>

      {/* LEVEL 5 — external verified data, with its own freshness per source. */}
      <Region width={12}>
        <PanelHead title="Verified external data" meta="live connectors" />
        <VerifiedStrip />
      </Region>
    </PageFrame>
  );
}

/** Live-source strip: World Bank and Comtrade, each with its own freshness. */
function VerifiedStrip() {
  const health = useQuery(api.observations.sourceHealth);
  const rows = health ?? [];
  if (rows.length === 0) {
    return (
      <EmptyState
        title="No source has reported yet"
        reason="The connectors refresh in the background. Until one answers there is nothing verified to show, and GlobalMatrix will not substitute a placeholder for it."
      />
    );
  }
  return (
    <ul className="divide-y divide-[var(--exec-hairline)]">
      {rows.map((h) => {
        const freshness = h.ok ? freshnessOf(h.retrievedAt, h.sourceId) : "unavailable";
        return (
          <li key={h.sourceId} className="flex flex-col gap-1 px-2.5 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="exec-label max-w-[16ch] truncate text-[var(--exec-ink)]">
                {h.sourceId}
              </span>
              <FreshnessTag freshness={freshness} />
            </div>
            <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
              {h.asOf ? `as of ${periodLabel(h.asOf)}` : "no reference period"} ·{" "}
              {h.ok ? "reading stored" : (h.problem ?? "no reading")}
            </span>
          </li>
        );
      })}
      <li className="px-3 py-2">
        <Action to="/app/data">Full source register</Action>
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------------ */

const CORPUS_NOTE = `${CORPUS_LABEL} · synthetic · latest observation 2026-10-02`;

/** Shared window is a focus concern, so the cut lives with it. */
const WINDOW_CUTOFF = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
} as const;

/** The corpus's own "now": its latest detection timestamp, as epoch ms. */
function corpusClock(dates: string[]): number {
  let latest = 0;
  for (const d of dates) {
    const ms = Date.parse(d);
    if (!Number.isNaN(ms) && ms > latest) latest = ms;
  }
  return latest;
}

/** Which map domain a topology tile implies, so a click connects the two boards. */
const CHANNEL_BY_TOPOLOGY: Record<string, Channel> = {
  "trade-bottlenecks": "trade",
  energy: "energy",
  geopolitical: "diplomatic",
  financial: "finance",
  "supply-chain": "trade",
};

function OverviewSkeleton() {
  return (
    <div className="min-w-0 px-4 py-4 lg:px-6">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-80" />
      <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <Skeleton className="h-[520px] w-full" />
        </div>
        <div className="lg:col-span-4">
          <Skeleton className="h-52 w-full" />
          <Skeleton className="mt-4 h-64 w-full" />
        </div>
        <div className="lg:col-span-12">
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    </div>
  );
}
