import { useMemo } from "react";
import { Link } from "react-router";
import { arcPath, project, riskColorForScore } from "@/lib/intel/visual";
import { getNode } from "@/lib/intel/nodes";
import { cn } from "@/lib/utils";
import { NoData } from "./core";

export interface FlowStage {
  id: string;
  label: string;
  nodeIds: string[];
}

/**
 * Stage-to-stage flow.
 *
 * Width encodes the real weighted exposure between stages; nothing is
 * normalised for aesthetics. Stages with no resolved members are rendered as
 * gaps rather than hidden, so the missing link is visible.
 */
export function FlowDiagram({
  stages,
  edges,
  className,
}: {
  stages: FlowStage[];
  edges: { from: string; to: string; weight: number }[];
  className?: string;
}) {
  const max = Math.max(...edges.map((e) => e.weight), 0.0001);
  const stageIndex = new Map(stages.map((s, i) => [s.id, i]));

  const byPair = new Map<string, number>();
  for (const e of edges) {
    if (!stageIndex.has(e.from) || !stageIndex.has(e.to)) continue;
    const key = `${e.from}→${e.to}`;
    byPair.set(key, (byPair.get(key) ?? 0) + e.weight);
  }

  if (edges.length === 0) {
    return <NoData reason="No transmission edges resolved for this selection." />;
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <div className="flex min-w-[640px] items-stretch gap-0 p-4">
        {stages.map((stage, si) => {
          const outgoing = stages
            .map((s) => ({
              stage: s,
              weight: byPair.get(`${stage.id}→${s.id}`) ?? 0,
            }))
            .filter((e) => e.weight > 0 && stageIndex.get(e.stage.id)! > si);

          return (
            <div key={stage.id} className="flex flex-1 items-center gap-0">
              <div className="flex w-28 shrink-0 flex-col items-center gap-1.5 border border-rule bg-card px-2 py-3 text-center">
                <span className="label leading-tight text-foreground/90">
                  {stage.label}
                </span>
                <span className="num text-[12px] text-muted-foreground">
                  {stage.nodeIds.length} nodes
                </span>
                <div className="mt-1 flex flex-wrap justify-center gap-0.5">
                  {stage.nodeIds.slice(0, 6).map((id) => (
                    <Link
                      key={id}
                      to={`/app/country/${id}`}
                      className="num border border-rule px-1 text-[12px] text-muted-foreground transition-colors hover:border-signal hover:text-signal"
                      title={getNode(id).label}
                    >
                      {getNode(id).short}
                    </Link>
                  ))}
                  {stage.nodeIds.length > 6 ? (
                    <span className="num text-[12px] text-muted-foreground">
                      +{stage.nodeIds.length - 6}
                    </span>
                  ) : null}
                </div>
              </div>

              {outgoing.length > 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-1 px-1">
                  {outgoing.map((e) => (
                    <div key={e.stage.id} className="flex w-full items-center gap-1">
                      <span
                        className="h-[3px] flex-1"
                        style={{
                          background: `linear-gradient(90deg, transparent, ${riskColorForScore(
                            (e.weight / max) * 100,
                          )})`,
                        }}
                      />
                      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden>
                        <path d="M0 0 L8 4 L0 8 Z" fill={riskColorForScore((e.weight / max) * 100)} />
                      </svg>
                    </div>
                  ))}
                  <span className="num text-[12px] text-muted-foreground">
                    max {max.toFixed(2)}
                  </span>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Producer → consumer chord map for an industry, drawn on the projection. */
export function FlowMap({
  flows,
  height = 220,
}: {
  flows: { from: string; to: string; weight: number }[];
  height?: number;
}) {
  const W = 1000;
  const H = 420;
  const max = Math.max(...flows.map((f) => f.weight), 0.0001);

  const paths = useMemo(
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
              0.26,
            ),
          };
        })
        .filter(Boolean) as { d: string; weight: number }[],
    [flows],
  );

  if (paths.length === 0) {
    return <NoData reason="No resolvable geographic endpoints in this structure." />;
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Flow map with ${paths.length} producer to consumer links`}
    >
      <g stroke="var(--grid)" strokeWidth={1}>
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={i} x1={(i * W) / 8} y1={0} x2={(i * W) / 8} y2={H} />
        ))}
      </g>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill="none"
          stroke={riskColorForScore((p.weight / max) * 100)}
          strokeWidth={0.8 + (p.weight / max) * 4}
          opacity={0.45}
        />
      ))}
    </svg>
  );
}

export interface GraphNodeSpec {
  id: string;
  label: string;
  kind: string;
  weight: number;
}
export interface GraphEdgeSpec {
  from: string;
  to: string;
  weight: number;
  label: string;
}

/**
 * Relationship graph explorer.
 *
 * Layout is deterministic (layered by kind), not force-simulated, so the
 * picture is stable across renders and legible without interaction.
 */
export function GraphExplorer({
  nodes,
  edges,
  height = 420,
  onSelect,
  selected,
}: {
  nodes: GraphNodeSpec[];
  edges: GraphEdgeSpec[];
  height?: number;
  onSelect?: (id: string) => void;
  selected?: string | null;
}) {
  const W = 1000;
  const H = height;

  const order = ["Event", "Channel", "Country", "Corridor", "Industry"];
  const placed = useMemo(() => {
    const cols = new Map<string, GraphNodeSpec[]>();
    for (const kind of order) {
      cols.set(
        kind,
        nodes.filter((n) => n.kind === kind),
      );
    }
    const out: (GraphNodeSpec & { x: number; y: number })[] = [];
    let ci = 0;
    for (const [, list] of cols) {
      if (list.length === 0) continue;
      const x = ((ci + 0.5) / (order.filter((k) => (cols.get(k)?.length ?? 0) > 0).length)) * W;
      list.forEach((n, i) => {
        out.push({
          ...n,
          x,
          y: ((i + 0.5) / list.length) * H,
        });
      });
      ci += 1;
    }
    return out;
  }, [nodes]);

  const pos = new Map(placed.map((p) => [p.id, p]));

  if (placed.length === 0) {
    return <NoData reason="No nodes resolved for this selection." />;
  }

  const maxEdge = Math.max(...edges.map((e) => e.weight), 0.0001);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      style={{ height }}
      role="img"
      aria-label={`Relationship graph with ${placed.length} nodes and ${edges.length} edges`}
    >
      <g fill="none">
        {edges.map((e, i) => {
          const a = pos.get(e.from);
          const b = pos.get(e.to);
          if (!a || !b) return null;
          const dim = selected && e.from !== selected && e.to !== selected;
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} C ${(a.x + b.x) / 2} ${a.y}, ${(a.x + b.x) / 2} ${b.y}, ${b.x} ${b.y}`}
              stroke="var(--foreground)"
              strokeOpacity={dim ? 0.05 : 0.28}
              strokeWidth={0.5 + (e.weight / maxEdge) * 2.5}
            />
          );
        })}
      </g>
      <g>
        {placed.map((n) => {
          const r = 3 + n.weight * 7;
          const active = selected === n.id;
          const dim = selected && !active;
          return (
            <g
              key={n.id}
              className={cn(onSelect && "cursor-pointer")}
              onClick={() => onSelect?.(n.id)}
              opacity={dim ? 0.2 : 1}
            >
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill="var(--background)"
                stroke={riskColorForScore(n.weight * 100)}
                strokeWidth={active ? 2.5 : 1.25}
              />
              <text
                x={n.x}
                y={n.y + r + 10}
                textAnchor="middle"
                className="num"
                fill={active ? "var(--foreground)" : "var(--muted-foreground)"}
                style={{ fontSize: 12 }}
              >
                {n.label.length > 16 ? `${n.label.slice(0, 15)}…` : n.label}
              </text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}