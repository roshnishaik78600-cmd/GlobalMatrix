import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { TopologyResult } from "@/convex/macroTopology";
import { useFocus } from "@/lib/focus";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";
import { WorldMap } from "@/components/viz/WorldMap";
import { Skeleton } from "@/components/viz/core";
import {
  BasisTag,
  Col,
  DominantCard,
  ExecCard,
  ExecGrid,
  ExecLink,
  ExecPage,
  FreshnessTag,
  NoDataAvailable,
  PageTitle,
  SectionTitle,
  SegmentedControl,
  StatTile,
} from "@/components/viz/exec/system";
import {
  DomainSwitch,
  GaugeCluster,
  RiskTopology,
  ThreatTicker,
  loadColour,
  type TickerEvent,
} from "@/components/viz/exec/Topology";
import { ProvenanceFoot } from "@/components/viz/exec/system";
import { freshnessOf } from "@/lib/freshness";

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
        source: e.signals[0]?.source ?? "Scenario corpus v1.0.0",
        inWindow: Date.parse(e.detectedAt) >= cutoff,
      }));
  }, [data, timeWindow]);

  if (!data || !topology) return <OverviewSkeleton />;

  const mapEvents = (data.mapEvents ?? []).filter((e) => e.nodeId !== "");
  const mapChannel = domain === "risk" ? null : domain;
  const hottest = data.hottestCountries[0];

  return (
    <ExecPage>
      <PageTitle
        title="Executive command centre"
        lede="One map of where risk is concentrated, the macro topology behind it, and what actually changed. Every figure is labelled as observed, modelled or scenario."
        right={
          <>
            <SegmentedControl
              options={[
                { id: "1h", label: "1H" },
                { id: "6h", label: "6H" },
                { id: "24h", label: "24H" },
                { id: "7d", label: "7D" },
              ]}
              value={timeWindow}
              onChange={setWindow}
            />
            <ExecLink to="/app/risk">Risk explorer →</ExecLink>
            <ExecLink to="/app/scenarios">Scenario lab →</ExecLink>
          </>
        }
      />

      <ExecGrid>
        {/* DOMINANT VISUAL — the map. Everything else on the page is sized to
            support it rather than compete with it. */}
        <Col span={8}>
          <DominantCard
            title="Global risk surface"
            meta={`${data.mapNodes.length} places · ${data.flows.length} couplings · ${mapEvents.length} events`}
            right={
              <DomainSwitch
                value={domain}
                onChange={(next) => {
                  setDomain(next);
                  if (next === "risk") setTopologyFilter(null);
                  else setTopologyFilter(next);
                }}
              />
            }
            bodyClassName="flex flex-col"
          >
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
            <ProvenanceFoot
              sourceId="none"
              freshness="historical"
              note={`Land shading and arcs are MODEL OUTPUT derived from ${CORPUS_NOTE}. Hover a place to preview it, click to inspect, double-click to open its profile.`}
            />
          </DominantCard>
        </Col>

        {/* SUPPORTING INTELLIGENCE — the two instruments that explain the map. */}
        <Col span={4} className="flex flex-col gap-3">
          <ExecCard>
            <GaugeCluster data={topology} />
          </ExecCard>

          <ExecCard className="flex-1">
            <SectionTitle meta="corpus census">Exposure leaders</SectionTitle>
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {data.hottestCountries.slice(0, 5).map((row) => {
                const active = isFocused("node", row.nodeId);
                return (
                  <li key={row.nodeId} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => toggle({ kind: "node", id: row.nodeId })}
                      aria-pressed={active}
                      className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2 text-left transition-colors hover:bg-[var(--exec-surface-strong)]"
                    >
                      <span className="exec-num w-7 shrink-0 text-[10px] text-[var(--exec-ink-dim)]">
                        {row.short}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--exec-ink)]">
                        {row.label}
                      </span>
                      <span className="h-1 w-16 shrink-0 bg-[var(--exec-hairline)]">
                        <span
                          className="block h-full"
                          style={{
                            width: `${row.load * 100}%`,
                            background: loadColour(row.load),
                          }}
                        />
                      </span>
                      <span className="exec-num w-8 shrink-0 text-right text-[10.5px] text-[var(--exec-ink)]">
                        {(row.load * 100).toFixed(0)}%
                      </span>
                    </button>
                    <ExecLink
                      to={`/app/country/${row.nodeId}`}
                      className="flex w-7 shrink-0 items-center justify-center border-l border-[var(--exec-hairline)]"
                    >
                      <ArrowUpRight className="size-3" />
                    </ExecLink>
                  </li>
                );
              })}
            </ul>
            <div className="border-t border-[var(--exec-hairline)] px-2.5 py-1.5">
              <BasisTag basis="model" />
            </div>
          </ExecCard>
        </Col>

        {/* MACRO RISK TOPOLOGY — full width, because six tiles side by side at
            half width would be unreadable. */}
        <Col span={12}>
          <ExecCard>
            <RiskTopology
              data={topology}
              selected={topologyFilter}
              onSelect={(id) => {
                setTopologyFilter(id);
                if (id && id !== "risk") {
                  setDomain(
                    (CHANNEL_BY_TOPOLOGY[id] as Channel | undefined) ?? "risk",
                  );
                }
              }}
            />
            <div className="border-t border-[var(--exec-hairline)] px-3 py-1.5">
              <BasisTag basis="model" />
            </div>
          </ExecCard>
        </Col>

        {/* THREAT TICKER — the timeline of what actually happened, deliberately
            scrollable rather than self-advancing. */}
        <Col span={12}>
          <ExecCard>
            {ticker.length === 0 ? (
              <NoDataAvailable
                title="The corpus has no events to place on a timeline"
                reason="The scenario corpus supplies the events behind this board. Without it there is nothing verified to show, and GlobalMatrix does not substitute an illustrative feed for a missing one."
                hint={
                  <ExecLink to="/app/events" className="mt-1 inline-block">
                    Open the event observatory →
                  </ExecLink>
                }
              />
            ) : (
              <ThreatTicker
                events={ticker}
                windowLabel={timeWindow.toUpperCase()}
                selected={focus?.kind === "event" ? focus.id : null}
                onSelect={(id) => toggle({ kind: "event", id })}
              />
            )}
          </ExecCard>
        </Col>

        {/* DETAIL / EVIDENCE — the numbers a briefing would actually quote. */}
        <Col span={3}>
          <div className="grid h-full grid-cols-1 gap-2">
            <StatTile
              label="Corpus events"
              value={String(stats?.events ?? data.stats.events)}
              unit="events"
              basis="scenario"
              note={CORPUS_NOTE}
            />
            <StatTile
              label="Tracked places"
              value={String(stats?.countries ?? 0)}
              unit="with coordinates"
              basis="scenario"
              note="Places the map can plot"
            />
            <StatTile
              label="Mean composite"
              value={(stats?.meanScore ?? 0).toFixed(1)}
              unit="/100"
              basis="model"
              tone={loadColour((stats?.meanScore ?? 0) / 100)}
              note="Corpus mean, 30-day horizon"
            />
            <StatTile
              label="Most exposed"
              value={hottest?.short ?? "—"}
              basis="model"
              tone={loadColour(hottest?.load ?? 0)}
              note={hottest ? `${hottest.label} at ${(hottest.load * 100).toFixed(0)}%` : "No exposure resolved"}
            />
          </div>
        </Col>

        <Col span={5}>
          <ExecCard className="h-full">
            <SectionTitle meta="30-day composite" right={<BasisTag basis="model" />}>
              Top developments
            </SectionTitle>
            <ul className="divide-y divide-[var(--exec-hairline)]">
              {data.topEvents.map((event) => {
                const active = isFocused("event", event.id);
                return (
                  <li key={event.id} className="flex items-stretch">
                    <button
                      type="button"
                      onClick={() => toggle({ kind: "event", id: event.id })}
                      aria-pressed={active}
                      className="min-w-0 flex-1 px-2.5 py-2 text-left transition-colors hover:bg-[var(--exec-surface-strong)]"
                    >
                      <div className="flex items-baseline justify-between gap-2">
                        <span
                          className="exec-label"
                          style={{ color: riskColorForScore(event.score) }}
                        >
                          {CHANNEL_LABEL[event.dominantChannel]}
                        </span>
                        <span className="exec-num text-[12px] font-semibold text-[var(--exec-ink)]">
                          {event.score.toFixed(1)}
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
                            title={`${n.label} · weight ${n.weight.toFixed(2)}`}
                          >
                            {n.short}
                          </span>
                        ))}
                        <span className="exec-num ml-auto text-[9px] text-[var(--exec-ink-dim)]">
                          80% {event.low.toFixed(0)}–{event.high.toFixed(0)}
                        </span>
                      </div>
                    </button>
                    <ExecLink
                      to={`/app/event/${event.id}`}
                      className="flex w-7 shrink-0 items-center justify-center border-l border-[var(--exec-hairline)]"
                    >
                      <ArrowUpRight className="size-3" />
                    </ExecLink>
                  </li>
                );
              })}
            </ul>
          </ExecCard>
        </Col>

        <Col span={4}>
          <ExecCard className="h-full">
            <SectionTitle meta="live sources only">
              Verified external data
            </SectionTitle>
            <VerifiedStrip />
          </ExecCard>
        </Col>
      </ExecGrid>
    </ExecPage>
  );
}

/** Live-source strip: World Bank and Comtrade, each with its own freshness. */
function VerifiedStrip() {
  const health = useQuery(api.observations.sourceHealth);
  const rows = health ?? [];
  if (rows.length === 0) {
    return (
      <NoDataAvailable
        title="No source has reported yet"
        reason="The three connectors refresh in the background. Until one answers there is nothing verified to show, and GlobalMatrix will not substitute a placeholder for it."
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
              {h.asOf ? `as of ${h.asOf}` : "no reference period"} ·{" "}
              {h.ok ? "reading stored" : (h.problem ?? "no reading")}
            </span>
          </li>
        );
      })}
      <li className="px-2.5 py-2">
        <ExecLink to="/app/data">Full source register →</ExecLink>
      </li>
    </ul>
  );
}

/* ------------------------------------------------------------------ */

const CORPUS_NOTE = "Scenario corpus v1.0.0 (synthetic, latest observation 2026-10-02)";

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
    <ExecPage>
      <div className="px-4 pt-4 pb-1">
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-2 h-3 w-full max-w-2xl" />
      </div>
      <ExecGrid>
        <Col span={8}>
          <Skeleton className="h-[540px] w-full" />
        </Col>
        <Col span={4}>
          <Skeleton className="h-52 w-full" />
          <Skeleton className="mt-3 h-64 w-full" />
        </Col>
        <Col span={12}>
          <Skeleton className="h-40 w-full" />
        </Col>
      </ExecGrid>
    </ExecPage>
  );
}
