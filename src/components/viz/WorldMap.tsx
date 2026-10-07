import { useRef, useState } from "react";
import { Link } from "react-router";
import { Minus, Plus, RotateCcw } from "lucide-react";
import { getNode } from "@/lib/intel/nodes";
import { MAP_H, MAP_W, countryShapes, shapeForNode } from "@/lib/geo";
import { arcPath, project, riskColorForScore } from "@/lib/intel/visual";
import type { Channel } from "@/lib/intel/types";
import { CHANNEL_LABEL } from "@/lib/intel/types";
import { cn } from "@/lib/utils";
import { useOptionalFocus, type MapLayer } from "@/lib/focus";
import { SegmentedControl } from "./exec/system";
import { NoData, Skeleton } from "./core";
import { NodeEvidence } from "./NodeEvidence";

export interface MapNode {
  nodeId: string;
  label: string;
  load: number;
  eventCount: number;
  criticality: number;
  kind?: string;
  /** Per-channel load, when the caller has it. Used by the domain layers. */
  byChannel?: { channel: Channel; load: number }[];
}

/**
 * True when a node has a real coordinate and can therefore be drawn.
 *
 * Institutions (SWIFT, the institutional-portfolio node) are part of the intel
 * model but have no location, and the map deliberately never invents one. Every
 * page that counts "places" has to use this test, or it prints a number the
 * reader cannot match against the markers in the picture.
 */
export function isPlottable(nodeId: string): boolean {
  const node = getNode(nodeId);
  return node.lat !== undefined && node.lon !== undefined;
}

/** An event anchored to the place it lands on hardest. */
export interface MapEvent {
  id: string;
  label: string;
  nodeId: string;
  score: number;
  channel: Channel;
}

export interface MapFlow {
  from: string;
  to: string;
  weight: number;
}

interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * What the map is currently emphasising. Each layer re-weights encodings the
 * map already has — land shading, node radius, arcs, event rings — so no layer
 * can show something the others cannot.
 */
type LayerId = "load" | "events" | "links";

const LAYERS: { id: LayerId; label: string; hint: string }[] = [
  { id: "load", label: "Load", hint: "Land shading and node size follow live load" },
  { id: "events", label: "Events", hint: "Where corpus events land hardest" },
  { id: "links", label: "Couplings", hint: "Chokepoint-to-economy shared-event coupling" },
];

/** The system bar speaks the same three names; the map's internal id is `links`. */
const LAYER_TO_MAP: Record<MapLayer, LayerId> = {
  load: "load",
  events: "events",
  couplings: "links",
};
const MAP_TO_LAYER: Record<LayerId, MapLayer> = {
  load: "load",
  events: "events",
  links: "couplings",
};

const FULL: View = { x: 0, y: 0, w: MAP_W, h: MAP_H };

/** Zoom is bounded so the map can never be panned off its own geometry. */
function clampView(v: View): View {
  const w = Math.min(MAP_W, Math.max(240, v.w));
  const h = (w / MAP_W) * MAP_H;
  return {
    w,
    h,
    x: Math.min(MAP_W - w, Math.max(0, v.x)),
    y: Math.min(MAP_H - h, Math.max(0, v.y)),
  };
}

function zoomAround(view: View, factor: number, cx: number, cy: number): View {
  const w = view.w * factor;
  const h = (w / MAP_W) * MAP_H;
  const ratio = (view.w - w) / view.w;
  return clampView({
    w,
    h,
    x: view.x + (cx - view.x) * ratio,
    y: view.y + (cy - view.y) * ratio,
  });
}

/**
 * The world map.
 *
 * Land is real Natural Earth geometry, projected on the same equirectangular
 * grid the node coordinates use. Countries that GlobalMatrix actually tracks are
 * shaded by their live load; everything else is drawn as quiet context so the
 * reader can place the tracked economies in the world rather than on a diagram.
 * Institutions have no location and are never invented one.
 */
export function WorldMap({
  nodes,
  flows = [],
  events = [],
  loading,
  height,
  onSelect,
  onInspect,
  selected,
  className,
  layers = true,
  channel = null,
}: {
  nodes: MapNode[];
  flows?: MapFlow[];
  events?: MapEvent[];
  loading?: boolean;
  /**
   * A fixed pixel height, for a map that is a supporting picture inside a panel
   * that has already sized itself. Omit it for a map that owns its section —
   * those take `className="map-frame"` and get 400/440/600px at
   * phone/tablet/desktop, which is the specified band at every width.
   */
  height?: number;
  onSelect?: (nodeId: string) => void;
  /** Double-click: open the full profile for this place. */
  onInspect?: (nodeId: string) => void;
  selected?: string | null;
  className?: string;
  /** Show the layer switcher. Off where the map is a supporting picture. */
  layers?: boolean;
  /**
   * Re-shade by one transmission channel instead of blended load.
   *
   * This is how the Overview's domain layers work: selecting "Energy" shades
   * every place by the energy load it actually carries, and shows only the
   * events whose dominant channel is energy. It never invents a per-domain
   * value — a place with no energy exposure goes quiet rather than to zero-
   * coloured, because "no reading" and "no exposure" are not the same claim.
   */
  channel?: Channel | null;
}) {
  const [view, setView] = useState<View>(FULL);
  const [hover, setHover] = useState<string | null>(null);
  // The layer is global, so the system bar and this map stay in agreement.
  // Outside the console shell there is no shared context and it falls back to
  // the map's own state.
  const shared = useOptionalFocus();
  const [localLayer, setLocalLayer] = useState<LayerId>("load");
  const layer = shared ? LAYER_TO_MAP[shared.layer] : localLayer;
  const setLayer = (next: LayerId) => {
    if (shared) shared.setLayer(MAP_TO_LAYER[next]);
    else setLocalLayer(next);
  };
  const drag = useRef<{ x: number; y: number; view: View } | null>(null);
  const svg = useRef<SVGSVGElement | null>(null);

  const plotted = nodes
    .map((n) => {
      const node = getNode(n.nodeId);
      if (node.lat === undefined || node.lon === undefined) return null;
      const p = project(node.lat, node.lon, MAP_W, MAP_H);
      return { ...n, node, x: p.x, y: p.y, shape: shapeForNode(n.nodeId) };
    })
    .filter(Boolean) as (MapNode & {
    node: ReturnType<typeof getNode>;
    x: number;
    y: number;
    shape?: ReturnType<typeof shapeForNode>;
  })[];

  if (loading) {
    return (
      <Skeleton className={cn("w-full", className)} />
    );
  }

  if (plotted.length === 0) {
    return (
      <NoData reason="No node in the current corpus carries a geographic position." />
    );
  }

  const maxLoad = Math.max(...plotted.map((n) => n.load), 0.01);
  const shapes = countryShapes();
  const zoom = MAP_W / view.w;
  const zoomedIn = view.w < 780;
  // Each layer re-weights the same three real encodings rather than adding new
  // data, so switching one can never imply information the others lack.
  const showLoad = layer === "load";
  const showEvents = layer === "events" || layer === "load";
  const showLinks = layer === "links" || layer === "load";

  /**
   * Load for the active domain, or the blended load when no domain is chosen.
   * `null` means "this place publishes no reading for that channel", which the
   * renderer treats as quiet rather than as zero.
   */
  const loadFor = (n: MapNode): number | null => {
    if (!channel) return n.load;
    const match = n.byChannel?.find((c) => c.channel === channel);
    return match ? match.load : null;
  };
  const channelMax = Math.max(
    ...plotted.map((n) => loadFor(n) ?? 0),
    0.01,
  );
  const visibleEvents = channel
    ? events.filter((e) => e.channel === channel)
    : events;

  const pointerToView = (clientX: number, clientY: number) => {
    const rect = svg.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: view.x + ((clientX - rect.left) / rect.width) * view.w,
      y: view.y + ((clientY - rect.top) / rect.height) * view.h,
    };
  };

  const hovered = plotted.find((p) => p.nodeId === hover);

  return (
    // Exactly one of three things owns the height, and the order is fixed so two
    // of them can never both apply: an explicit `height` number wins and is set
    // inline; otherwise a caller-supplied class owns it; otherwise the map falls
    // back to the responsive default. Picking by precedence rather than by CSS
    // order is what stops `lg:h-full` and `lg:h-[600px]` from racing.
    <div
      className={cn(
        "relative min-w-0",
        height === undefined && !className && "map-frame",
        className,
      )}
    >
      <svg
        ref={svg}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className={cn(
          "block w-full touch-none select-none",
          // With no inline height the svg fills whatever box the wrapper was
          // given, rather than collapsing to its own intrinsic ratio.
          height === undefined && "h-full",
        )}
        style={height ? { height } : undefined}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label={`World map. ${plotted.length} tracked nodes plotted on real country geometry.`}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          const p = pointerToView(e.clientX, e.clientY);
          drag.current = { x: p.x, y: p.y, view };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const p = pointerToView(e.clientX, e.clientY);
          setView(
            clampView({
              ...drag.current.view,
              x: drag.current.view.x - (p.x - drag.current.x),
              y: drag.current.view.y - (p.y - drag.current.y),
            }),
          );
        }}
        onPointerUp={(e) => {
          drag.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <radialGradient id="gm-node">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.5} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Ocean */}
        <rect x={0} y={0} width={MAP_W} height={MAP_H} fill="var(--background)" />

        {/* Graticule, under the land so coastlines stay legible. */}
        <g stroke="var(--grid)" strokeWidth={0.6} opacity={0.5}>
          {Array.from({ length: 13 }).map((_, i) => (
            <line key={`m${i}`} x1={(i * MAP_W) / 12} y1={0} x2={(i * MAP_W) / 12} y2={MAP_H} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <line key={`p${i}`} x1={0} y1={(i * MAP_H) / 6} x2={MAP_W} y2={(i * MAP_H) / 6} />
          ))}
        </g>

        {/* Land: quiet everywhere, shaded where GlobalMatrix has a reading. */}
        <g stroke="var(--rule)" strokeWidth={0.4} strokeLinejoin="round">
          {shapes.map((shape) => {
            const owner = plotted.find((p) => p.shape?.iso === shape.iso);
            const value = owner ? loadFor(owner) : null;
            const shaded = showLoad && value !== null;
            const scaled = (value ?? 0) / (channel ? channelMax : maxLoad);
            const fill = shaded
              ? `color-mix(in oklch, ${riskColorForScore((value ?? 0) * 100)} ${Math.round(
                  18 + Math.min(1, scaled) * 62,
                )}%, transparent)`
              : "color-mix(in oklch, var(--foreground) 6%, transparent)";
            return (
              <path
                key={shape.iso}
                d={shape.d}
                fill={fill}
                stroke={shaded ? "var(--foreground)" : "var(--rule)"}
                strokeOpacity={shaded ? 0.45 : 0.7}
              />
            );
          })}
        </g>

        {/* Country names, only once there is room for them. */}
        {zoomedIn ? (
          <g>
            {plotted
              .filter((p) => p.shape)
              .map((p) => (
                <text
                  key={`lbl-${p.nodeId}`}
                  x={p.x}
                  y={p.y + 12 / zoom}
                  textAnchor="middle"
                  fill="var(--muted-text)"
                  style={{
                    fontSize: Math.min(13, 10 * zoom),
                    letterSpacing: "0.04em",
                    paintOrder: "stroke",
                    stroke: "var(--background)",
                    strokeWidth: 2.5,
                  }}
                >
                  {p.node.label}
                </text>
              ))}
          </g>
        ) : null}

        {/* Transmission arcs */}
        <g fill="none" opacity={showLinks ? 1 : 0.12}>
          {showLinks
            ? flows.map((f, i) => {
            const a = getNode(f.from);
            const b = getNode(f.to);
            if (a.lat === undefined || a.lon === undefined) return null;
            if (b.lat === undefined || b.lon === undefined) return null;
            return (
              <path
                key={i}
                d={arcPath(
                  project(a.lat, a.lon, MAP_W, MAP_H),
                  project(b.lat, b.lon, MAP_W, MAP_H),
                  0.16,
                )}
                stroke={riskColorForScore(f.weight * 100)}
                strokeWidth={(0.5 + f.weight * 2.4) / zoom}
                opacity={selected && f.from !== selected && f.to !== selected ? 0.07 : 0.38}
                strokeLinecap="round"
                // Motion marks the coupling itself; magnitude stays encoded in
                // width and colour, which never animate.
                className={layer === "links" ? "flow-arc" : undefined}
              />
            );
          })
            : null}
        </g>

        {/* Nodes */}
        <g>
          {plotted.map((n) => {
            const value = loadFor(n);
            // A place with no reading for the active domain shrinks to the
            // baseline marker rather than disappearing: it still exists and can
            // still be inspected, it just has no exposure on this channel.
            const unmeasured = value === null;
            const scaled = (value ?? 0) / (channel ? channelMax : maxLoad);
            const r = (showLoad ? 3.4 + Math.min(1, scaled) * 9 : 2.6) / zoom;
            const colour = unmeasured
              ? "var(--muted-foreground)"
              : riskColorForScore((value ?? 0) * 100);
            const active = selected === n.nodeId || hover === n.nodeId;
            const dim = (selected && !active) || (channel !== null && channel !== undefined && unmeasured && !active);
            return (
              <g
                key={n.nodeId}
                className={cn(onSelect && "cursor-pointer")}
                onMouseEnter={() => setHover(n.nodeId)}
                onClick={() => onSelect?.(n.nodeId)}
                onDoubleClick={() => onInspect?.(n.nodeId)}
                opacity={dim ? 0.3 : 1}
              >
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r * 2.6}
                  fill="url(#gm-node)"
                  style={{ color: colour }}
                />
                {n.node.kind === "chokepoint" ? (
                  <path
                    d={`M ${n.x} ${n.y - r * 1.15} L ${n.x + r * 1.15} ${n.y} L ${n.x} ${
                      n.y + r * 1.15
                    } L ${n.x - r * 1.15} ${n.y} Z`}
                    fill={colour}
                    stroke="var(--background)"
                    strokeWidth={0.8 / zoom}
                  />
                ) : (
                  <circle
                    cx={n.x}
                    cy={n.y}
                    r={r}
                    fill="var(--background)"
                    stroke={colour}
                    strokeWidth={(active ? 2.4 : 1.4) / zoom}
                  />
                )}
                {!zoomedIn ? (
                  <text
                    x={n.x}
                    y={n.y - r - 4 / zoom}
                    textAnchor="middle"
                    className="num"
                    fill={active ? "var(--foreground)" : "var(--muted-foreground)"}
                    style={{
                      fontSize: Math.min(12, 9.5 * zoom),
                      letterSpacing: "0.06em",
                      paintOrder: "stroke",
                      stroke: "var(--background)",
                      strokeWidth: 2.5,
                    }}
                  >
                    {n.node.short}
                  </text>
                ) : null}
              </g>
            );
          })}
        </g>

        {/* Event markers, anchored where each event lands hardest. */}
        {showEvents
          ? visibleEvents.map((e) => {
              const host = plotted.find((p) => p.nodeId === e.nodeId);
              if (!host) return null;
              const r = ((layer === "events" ? 7 : 5) + (e.score / 100) * 8) / zoom;
              return (
                <g key={e.id} opacity={selected && selected !== e.nodeId ? 0.25 : 1}>
                  <circle
                    cx={host.x}
                    cy={host.y}
                    r={r * 1.9}
                    fill="none"
                    stroke="var(--signal)"
                    strokeWidth={0.8 / zoom}
                    opacity={0.4}
                  />
                  <circle cx={host.x} cy={host.y} r={r * 0.55} fill="var(--signal)" />
                  <title>{`${e.label} — ${e.score.toFixed(0)} / 100`}</title>
                </g>
              );
            })
          : null}
      </svg>

      {layers ? (
        <div className="absolute top-2 left-2">
          <SegmentedControl
            options={LAYERS}
            value={layer}
            onChange={setLayer}
            className="glass-strong"
          />
        </div>
      ) : null}

      {/* Zoom controls — deliberately buttons, so the page never hijacks scroll. */}
      <div className="absolute top-2 right-2 flex flex-col gap-px">
        {[
          { icon: Plus, label: "Zoom in", fn: () => setView((v) => zoomAround(v, 0.72, v.x + v.w / 2, v.y + v.h / 2)) },
          { icon: Minus, label: "Zoom out", fn: () => setView((v) => zoomAround(v, 1.4, v.x + v.w / 2, v.y + v.h / 2)) },
          { icon: RotateCcw, label: "Reset view", fn: () => setView(FULL) },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <button
              key={c.label}
              type="button"
              onClick={c.fn}
              title={c.label}
              aria-label={c.label}
              className="flex size-9 items-center justify-center border border-[var(--exec-hairline)] bg-[var(--card)]/95 text-[var(--exec-ink-dim)] backdrop-blur transition-colors hover:text-[var(--exec-ink)]"
            >
              <Icon className="size-4" />
            </button>
          );
        })}
      </div>

      {/* Hover read-out. The load shown follows the active layer, and says
          plainly when a place has no reading for it. */}
      {hovered ? (
        <div className="pointer-events-none absolute bottom-3 left-3 max-w-[min(20rem,70%)] min-w-0 rounded-lg border border-[var(--exec-hairline-strong)] bg-[var(--surface-2)]/95 px-3.5 py-2.5 backdrop-blur">
          <p className="text-[14px] font-semibold">{hovered.node.label}</p>
          <p className="num mt-0.5 text-[12px] text-[var(--exec-ink-dim)]">
            {hovered.node.region} · {hovered.node.kind} ·{" "}
            {loadFor(hovered) === null
              ? `no ${channel ? CHANNEL_LABEL[channel] : "channel"} reading`
              : `${channel ? `${CHANNEL_LABEL[channel]} load` : "load"} ${(
                  (loadFor(hovered) ?? 0) * 100
                ).toFixed(0)}%`}{" "}
            · {hovered.eventCount} events
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Legend for the map encoding. */
export function MapLegend() {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3">
      {[
        { label: "Economy", glyph: "circle" },
        { label: "Bloc", glyph: "square" },
        { label: "Chokepoint", glyph: "diamond" },
      ].map((g) => (
        <span key={g.label} className="flex items-center gap-1.5">
          <span
            className="inline-block size-2.5 border border-current"
            style={{
              borderRadius: g.glyph === "circle" ? "9999px" : 0,
              transform: g.glyph === "diamond" ? "rotate(45deg) scale(0.8)" : undefined,
            }}
          />
          <span className="exec-label-muted">{g.label}</span>
        </span>
      ))}
      <span className="exec-label-muted flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full bg-signal" />
        Event
      </span>
      <span className="exec-label-muted">
        Land shading = live load · click to inspect · double-click to open the
        profile · drag to pan
      </span>
    </div>
  );
}

/** Selected-node side panel entry, with whatever verified data exists for it. */
export function MapSelection({
  nodeId,
  onClose,
}: {
  nodeId: string;
  onClose: () => void;
}) {
  const node = getNode(nodeId);
  return (
    <aside className="panel w-full lg:w-80">
      <div className="panel-head">
        <span className="label">{node.label}</span>
        <button
          type="button"
          onClick={onClose}
          className="label text-muted-foreground hover:text-foreground"
        >
          Close
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-y-2 border-b border-rule p-3">
        {[
          ["Region", node.region],
          ["Type", node.kind],
          ["Criticality", node.criticality.toFixed(2)],
          ["Node id", node.id],
        ].map(([k, v]) => (
          <div key={k} className="min-w-0">
            <dt className="label text-muted-foreground">{k}</dt>
            <dd className="num min-w-0 text-[12px]">{v}</dd>
          </div>
        ))}
      </dl>
      <NodeEvidence nodeId={nodeId} />
      <div className="border-t border-rule p-3">
        <Link
          to={`/app/country/${node.id}`}
          className="label flex items-center justify-center gap-2 border border-rule px-3 py-2 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
        >
          Open full profile
        </Link>
      </div>
    </aside>
  );
}