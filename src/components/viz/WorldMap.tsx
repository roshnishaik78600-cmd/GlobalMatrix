import { useMemo, useState } from "react";
import { Link } from "react-router";
import { getNode } from "@/lib/intel/nodes";
import { arcPath, project, riskColorForScore } from "@/lib/intel/visual";
import type { Channel } from "@/lib/intel/types";
import { cn } from "@/lib/utils";
import { NoData, Skeleton } from "./core";

export interface MapNode {
  nodeId: string;
  load: number;
  eventCount: number;
  criticality: number;
  byChannel?: { channel: Channel; load: number }[];
}

export interface MapFlow {
  from: string;
  to: string;
  weight: number;
}

/**
 * Global activity map.
 *
 * Equirectangular projection on a graticule. Landmass outlines are
 * deliberately not drawn: a hand-authored coastline would be cartographically
 * wrong, and a wrong map is worse than an abstract one. Coordinates are real.
 * Institution nodes are excluded rather than given an invented location.
 */
export function WorldMap({
  nodes,
  flows = [],
  loading,
  height = 380,
  onSelect,
  selected,
}: {
  nodes: MapNode[];
  flows?: MapFlow[];
  loading?: boolean;
  height?: number;
  onSelect?: (nodeId: string) => void;
  selected?: string | null;
}) {
  const W = 1000;
  const H = 500;
  const [hover, setHover] = useState<string | null>(null);

  const plotted = useMemo(
    () =>
      nodes
        .map((n) => {
          const node = getNode(n.nodeId);
          if (node.lat === undefined || node.lon === undefined) return null;
          const p = project(node.lat, node.lon, W, H);
          return { ...n, node, ...p };
        })
        .filter(Boolean) as (MapNode & {
        node: ReturnType<typeof getNode>;
        x: number;
        y: number;
      })[],
    [nodes],
  );

  const flowsPlotted = useMemo(
    () =>
      flows
        .map((f) => {
          const a = getNode(f.from);
          const b = getNode(f.to);
          if (a.lat === undefined || a.lon === undefined) return null;
          if (b.lat === undefined || b.lon === undefined) return null;
          return {
            ...f,
            d: arcPath(
              project(a.lat, a.lon, W, H),
              project(b.lat, b.lon, W, H),
              0.18,
            ),
          };
        })
        .filter(Boolean) as (MapFlow & { d: string })[],
    [flows],
  );

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        <Skeleton className="h-[320px] w-full" />
        <div className="flex gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
      </div>
    );
  }

  if (plotted.length === 0) {
    return (
      <NoData reason="No node in the current corpus carries a geographic position." />
    );
  }

  const maxLoad = Math.max(...plotted.map((n) => n.load), 0.01);

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height }}
        role="img"
        aria-label={`Global activity map with ${plotted.length} nodes plotted. Highest load: ${plotted[0].node.label}.`}
      >
        <defs>
          <radialGradient id="gm-node">
            <stop offset="0%" stopColor="currentColor" stopOpacity={0.55} />
            <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
          </radialGradient>
        </defs>

        {/* Graticule */}
        <g stroke="var(--grid)" strokeWidth={1}>
          {Array.from({ length: 11 }).map((_, i) => (
            <line
              key={`m${i}`}
              x1={(i * W) / 10}
              y1={0}
              x2={(i * W) / 10}
              y2={H}
            />
          ))}
          {Array.from({ length: 5 }).map((_, i) => (
            <line
              key={`p${i}`}
              x1={0}
              y1={(i * H) / 4}
              x2={W}
              y2={(i * H) / 4}
            />
          ))}
        </g>
        {/* Equator emphasised */}
        <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="var(--rule)" strokeWidth={1} />

        {/* Flow arcs */}
        <g fill="none">
          {flowsPlotted.map((f, i) => (
            <path
              key={i}
              d={f.d}
              stroke={riskColorForScore(f.weight * 100)}
              strokeWidth={0.6 + f.weight * 3}
              opacity={selected && f.from !== selected && f.to !== selected ? 0.08 : 0.4}
              strokeLinecap="round"
            />
          ))}
        </g>

        {/* Nodes */}
        <g>
          {plotted.map((n) => {
            const r = 4 + (n.load / maxLoad) * 12;
            const colour = riskColorForScore(n.load * 100);
            const active = selected === n.nodeId || hover === n.nodeId;
            const dim = selected && !active;
            return (
              <g
                key={n.nodeId}
                className={cn(onSelect && "cursor-pointer")}
                onMouseEnter={() => setHover(n.nodeId)}
                onMouseLeave={() => setHover(null)}
                onClick={() => onSelect?.(n.nodeId)}
                opacity={dim ? 0.25 : 1}
              >
                <circle cx={n.x} cy={n.y} r={r * 2.4} fill="url(#gm-node)" style={{ color: colour }} />
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={r}
                  fill="var(--background)"
                  stroke={colour}
                  strokeWidth={active ? 2.5 : 1.5}
                />
                {n.node.kind === "chokepoint" ? (
                  <path
                    d={`M ${n.x} ${n.y - r * 0.6} L ${n.x + r * 0.6} ${n.y} L ${n.x} ${n.y + r * 0.6} L ${n.x - r * 0.6} ${n.y} Z`}
                    fill={colour}
                  />
                ) : null}
                <text
                  x={n.x}
                  y={n.y - r - 5}
                  textAnchor="middle"
                  className="num"
                  fill={active ? "var(--foreground)" : "var(--muted-foreground)"}
                  style={{ fontSize: 11, letterSpacing: "0.08em" }}
                >
                  {n.node.short}
                </text>
              </g>
            );
          })}
        </g>
      </svg>

      {/* Hover read-out */}
      {hover
        ? (() => {
            const n = plotted.find((p) => p.nodeId === hover);
            if (!n) return null;
            return (
              <div className="pointer-events-none absolute left-3 bottom-3 border border-rule bg-popover/95 px-3 py-2 backdrop-blur">
                <p className="text-[12.5px] font-semibold">{n.node.label}</p>
                <p className="num mt-0.5 text-[10px] text-muted-foreground">
                  {n.node.region} · {n.node.kind} · load{" "}
                  {(n.load * 100).toFixed(0)}% · {n.eventCount} events
                </p>
              </div>
            );
          })()
        : null}
    </div>
  );
}

/** Legend for the map encoding. */
export function MapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2">
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
              transform:
                g.glyph === "diamond" ? "rotate(45deg) scale(0.8)" : undefined,
            }}
          />
          <span className="label text-muted-foreground">{g.label}</span>
        </span>
      ))}
      <span className="label text-muted-foreground">
        Radius = live load · ring colour = risk band
      </span>
    </div>
  );
}

/** Selected-node side panel entry. */
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
      <div className="space-y-3 p-3">
        <dl className="grid grid-cols-2 gap-y-2">
          {[
            ["Region", node.region],
            ["Type", node.kind],
            ["Criticality", node.criticality.toFixed(2)],
            ["Node id", node.id],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="label text-muted-foreground">{k}</dt>
              <dd className="num text-[12px]">{v}</dd>
            </div>
          ))}
        </dl>
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