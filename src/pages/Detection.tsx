import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useFocus } from "@/lib/focus";
import { CHANNELS, CHANNEL_LABEL, STAGE_LABEL, type Channel, type Stage } from "@/lib/intel/types";
import { getNode } from "@/lib/intel/nodes";
import { pct } from "@/lib/format";
import { WorldMap, MapLegend } from "@/components/viz/WorldMap";
import { loadColour } from "@/components/viz/exec/Topology";
import {
  Action,
  PageFrame,
  Region,
} from "@/components/viz/exec/design";
import {
  ExecCard,
  DominantCard,
  SectionTitle,
  BasisTag,
  NoDataAvailable,
  SegmentedControl,
} from "@/components/viz/exec/system";

/**
 * The global event observatory.
 *
 * Left, a dense stream of every event in the corpus. Right, a map that clusters
 * them where they land. The two are one selection: choosing an event in the
 * stream highlights it on the map and pulls its footprint forward, and clicking
 * a marker scrolls the stream to that event. A reader can work entirely from
 * either side without losing the other.
 */
export default function Detection() {
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [stage, setStage] = useState<Stage | "all">("all");
  const [watchedOnly, setWatchedOnly] = useState(false);
  const { focus, toggle } = useFocus();

  const args = useMemo(
    () => ({
      ...(channel !== "all" ? { channel } : {}),
      ...(stage !== "all" ? { stage } : {}),
      ...(watchedOnly ? { watchlistOnly: true } : {}),
    }),
    [channel, stage, watchedOnly],
  );

  const data = useQuery(api.intel.detectionFeed, args);
  // Stable across renders while the query payload is unchanged, so the map and
  // stream memos below do not recompute on every keystroke in the palette.
  const rows = useMemo(() => data?.rows ?? [], [data]);
  const selectedEvent = focus?.kind === "event" ? focus.id : null;

  /**
   * The map plots each event where it lands hardest, at the size of its own
   * composite score. Where several events land on one place they overlap by
   * design — that density is the signal, and the stream counts it.
   */
  const mapEvents = useMemo(
    () =>
      rows
        .filter((r) => r.topNodes.length > 0)
        .map((r) => ({
          id: r.id,
          label: r.title,
          nodeId: r.topNodes[0].nodeId,
          score: r.score30,
          channel: r.dominantChannel,
          detectedAt: r.detectedAt,
        })),
    [rows],
  );

  const mapNodes = useMemo(() => {
    const byNode = new Map<string, { load: number; count: number; criticality: number }>();
    for (const e of mapEvents) {
      const current = byNode.get(e.nodeId) ?? { load: 0, count: 0, criticality: 0 };
      current.load += e.score / 100;
      current.count += 1;
      current.criticality = Math.max(current.criticality, e.score / 100);
      byNode.set(e.nodeId, current);
    }
    const max = Math.max(...[...byNode.values()].map((v) => v.load), 0.01);
    return [...byNode.entries()].map(([nodeId, v]) => ({
      nodeId,
      label: getNode(nodeId).label,
      kind: getNode(nodeId).kind,
      load: v.load / max,
      eventCount: v.count,
      criticality: getNode(nodeId).criticality,
    }));
  }, [mapEvents]);

  const active = rows.find((r) => r.id === selectedEvent) ?? null;

  return (
        <PageFrame
      eyebrow="Events"
      title="Global event observatory"
      lede="Every event in the corpus with the pressure, evidence and interval behind its score."
      actions={
        <>
<Action to="/app/chain">Event → world</Action>
        </>
      }
    >{/* Filters drive the query, the stream and the map together. */}
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--exec-hairline)] px-4 py-2">
        <span className="exec-label">Channel</span>
        <SegmentedControl
          options={[
            { id: "all", label: "ALL" },
            ...CHANNELS.map((c) => ({ id: c, label: c.toUpperCase() })),
          ]}
          value={channel}
          onChange={setChannel}
        />
        <span className="exec-label ml-2">Stage</span>
        <SegmentedControl
          options={[
            { id: "all", label: "ALL" },
            { id: "emerging", label: "EMERGING" },
            { id: "escalating", label: "ESCALATING" },
            { id: "active", label: "ACTIVE" },
            { id: "de-escalating", label: "EASING" },
          ]}
          value={stage}
          onChange={setStage}
        />
        <button
          type="button"
          onClick={() => setWatchedOnly((v) => !v)}
          aria-pressed={watchedOnly}
          className={`exec-label border px-2 py-1 transition-colors ${
            watchedOnly
              ? "border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)] bg-[color-mix(in_srgb,var(--exec-cyan)_12%,transparent)] text-[var(--exec-ink)]"
              : "border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] hover:text-[var(--exec-ink)]"
          }`}
        >
          WATCHLIST ({data?.watchlistSize ?? 0})
        </button>
        <span className="exec-label ml-auto">
          {rows.length} of {data?.total ?? 0} events
        </span>
      </div>

      
        {/* LEFT: the stream. Compact rows, not cards. */}
        <Region width={5}>
          <ExecCard className="h-full">
            <SectionTitle
              meta="30-day composite, ranked"
              right={<BasisTag basis="scenario" />}
            >
              Event stream
            </SectionTitle>
            {rows.length === 0 ? (
              <NoDataAvailable
                title="No event matches these filters"
                reason="The corpus is finite and fully enumerated. Narrowing by channel, stage or watchlist can return nothing — which is a real answer, not a loading state."
                hint={
                  <button
                    type="button"
                    onClick={() => {
                      setChannel("all");
                      setStage("all");
                      setWatchedOnly(false);
                    }}
                    className="exec-label mt-1 border border-[var(--exec-hairline)] px-2 py-1 transition-colors hover:border-[var(--exec-hairline-strong)]"
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <ul className="max-h-[38rem] divide-y divide-[var(--exec-hairline)] overflow-y-auto">
                {rows.map((r) => {
                  const isActive = selectedEvent === r.id;
                  return (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => toggle({ kind: "event", id: r.id })}
                        aria-pressed={isActive}
                        className={`flex w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-[var(--exec-surface-strong)] ${
                          isActive ? "bg-[var(--exec-surface-strong)]" : ""
                        }`}
                      >
                        <span className="flex items-baseline justify-between gap-2">
                          <span
                            className="exec-label max-w-[22ch] truncate"
                            style={{ color: loadColour(r.score30 / 100) }}
                          >
                            {CHANNEL_LABEL[r.dominantChannel]} · {STAGE_LABEL[r.stage]}
                          </span>
                          <span
                            className="exec-num shrink-0 text-[12.5px] font-bold"
                            style={{ color: loadColour(r.score30 / 100) }}
                          >
                            {r.score30.toFixed(1)}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-[12px] leading-snug text-[var(--exec-ink)]">
                          {r.title}
                        </span>
                        <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
                            {r.detectedAt}
                          </span>
                          <span className="exec-num text-[9.5px] text-[var(--exec-ink-dim)]">
                            impact {r.score30.toFixed(0)} · conf{" "}
                            {pct(r.confidence)}
                          </span>
                          <span className="exec-num ml-auto text-[9.5px] text-[var(--exec-ink-dim)]">
                            {r.signalCount} signals
                          </span>
                        </span>
                        <span className="h-1 w-full bg-[var(--exec-hairline)]">
                          <span
                            className="block h-full transition-[width] duration-500"
                            style={{
                              width: `${r.score30}%`,
                              background: loadColour(r.score30 / 100),
                            }}
                          />
                        </span>
                        <span className="flex flex-wrap gap-1">
                          {r.topNodes.map((n) => (
                            <span
                              key={n.nodeId}
                              title={`${n.label} · weight ${n.weight.toFixed(2)}`}
                              className="exec-num border border-[var(--exec-hairline)] px-1 text-[8.5px] text-[var(--exec-ink-dim)]"
                            >
                              {n.short}
                            </span>
                          ))}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </ExecCard>
        </Region>

        {/* RIGHT: the map. Selecting here pulls the event forward in the stream. */}
        <Region width={7} className="flex flex-col gap-3">
          <DominantCard
            title="Event geography"
            meta={`${mapEvents.length} events · ${mapNodes.length} places · clustered where they land`}
            right={<BasisTag basis="scenario" />}
            bodyClassName="flex flex-col"
          >
            {mapEvents.length === 0 ? (
              <NoDataAvailable
                title="No event to place"
                reason="Every corpus event lands on a place with a real coordinate. With no events passing the current filters there is nothing to plot, and no marker is invented."
              />
            ) : (
              <WorldMap
                nodes={mapNodes}
                events={mapEvents}
                height={360}
                selected={active?.topNodes[0]?.nodeId ?? null}
                onSelect={(nodeId) => {
                  // A marker click selects the strongest event landing there,
                  // which is what a reader clicking a cluster means.
                  const hit = mapEvents.find((e) => e.nodeId === nodeId);
                  if (hit) toggle({ kind: "event", id: hit.id });
                }}
                onInspect={(nodeId) => toggle({ kind: "node", id: nodeId })}
              />
            )}
            <div className="border-t border-[var(--exec-hairline)]">
              <MapLegend />
            </div>
            <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[11px] leading-relaxed text-[var(--exec-ink-dim)]">
              Markers are anchored where each event lands hardest, sized by its
              30-day composite. Overlapping markers are separate events at one
              place, not a cluster count. Hover a country to preview it; click to
              pull the strongest event there into focus.
            </p>
          </DominantCard>

          {/* The selected event, at executive density. */}
          <ExecCard>
            <SectionTitle
              meta={active ? `${active.reference} · ${active.detectedAt}` : "nothing selected"}
              right={
                active ? (
                  <Link
                    to={`/app/event/${active.id}`}
                    className="exec-label flex items-center gap-1 transition-colors hover:text-[var(--exec-ink)]"
                  >
                    Full cascade <ArrowUpRight className="size-3" />
                  </Link>
                ) : null
              }
            >
              Selected event
            </SectionTitle>
            {!active ? (
              <p className="px-3 py-4 text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
                Choose an event from the stream or a marker on the map. Its
                channel decomposition, evidence strength and defended interval
                appear here without leaving this page.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-px lg:grid-cols-4">
                <Metric label="Composite" value={active.score30.toFixed(1)} note="30-day" />
                <Metric
                  label="Defended interval"
                  value={`${active.low30.toFixed(0)}–${active.high30.toFixed(0)}`}
                  note="80% interval"
                />
                <Metric
                  label="Evidence strength"
                  value={pct(active.evidenceStrength)}
                  note="corroboration-weighted"
                />
                <Metric
                  label="Confidence"
                  value={pct(active.confidence)}
                  note="as authored"
                />
                {CHANNELS.map((c) => (
                  <Metric
                    key={c}
                    label={CHANNEL_LABEL[c]}
                    value={pct(active.channelPressure[c])}
                    note="channel pressure"
                    tone={loadColour(active.channelPressure[c])}
                  />
                ))}
              </div>
            )}
          </ExecCard>
        </Region>
      
    </PageFrame>
  );
}

function Metric({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note: string;
  tone?: string;
}) {
  return (
    <div className="px-3 py-2">
      <p className="exec-label">{label}</p>
      <p
        className="exec-num mt-1 text-[17px] leading-none font-bold"
        style={{ color: tone ?? "var(--exec-ink)" }}
      >
        {value}
      </p>
      <p className="exec-label mt-1 normal-case">{note}</p>
    </div>
  );
}
