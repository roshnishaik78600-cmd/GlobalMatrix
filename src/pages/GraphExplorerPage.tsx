import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHead } from "@/components/viz/Shell";
import { GraphExplorer } from "@/components/viz/Flow";
import { Bar, NoData, Panel, Skeleton } from "@/components/viz/core";
import { getNode } from "@/lib/intel/nodes";
import { riskColorForScore } from "@/lib/intel/visual";
import { useFocus } from "@/lib/focus";

/**
 * Graph explorer.
 *
 * Layout is deterministic (layered by node kind) rather than force-directed,
 * so the same selection always produces the same readable picture.
 */
export default function GraphExplorerPage() {
  const feed = useQuery(api.intel.detectionFeed, {});
  const [params, setParams] = useSearchParams();
  const { focus, toggle } = useFocus();
  const navigate = useNavigate();
  const selected = focus?.kind === "node" ? focus.id : null;

  const eventId = params.get("event") ?? feed?.rows[0]?.id;
  const graph = useQuery(
    api.intel.eventGraph,
    eventId ? { eventId } : "skip",
  );

  const nodeCount = graph?.nodes.length ?? 0;
  const [isolate, setIsolate] = useState(false);

  // Relationship filter: with a node selected, the graph can collapse to its
  // immediate neighbourhood. Nothing is recomputed — the same edges are simply
  // hidden, so the picture stays a subset of the real graph.
  const view = useMemo(() => {
    if (!graph) return { nodes: [], edges: [] };
    if (!isolate || !selected) return { nodes: graph.nodes, edges: graph.edges };
    const keep = new Set<string>([selected]);
    const edges = graph.edges.filter((e) => {
      if (e.from === selected || e.to === selected) {
        keep.add(e.from);
        keep.add(e.to);
        return true;
      }
      return false;
    });
    return {
      nodes: graph.nodes.filter((n) => keep.has(n.id)),
      edges,
    };
  }, [graph, isolate, selected]);
  const kindCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of graph?.nodes ?? []) m.set(n.kind, (m.get(n.kind) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [graph]);

  if (!feed) {
    return (
      <main>
        <PageHead title="Graph" lede="Relationship explorer." />
        <div className="p-3">
          <Skeleton className="h-[520px] w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0">
      <PageHead
        title="Graph"
        lede="How a single event reaches the network: event → channel → node. Edge weight is the real propagation term; node size is the resolved impact."
        actions={
          <select
            value={eventId ?? ""}
            onChange={(e) => setParams({ event: e.target.value })}
            className="h-8 border border-rule bg-card px-2 text-[12px] outline-none focus:border-foreground"
            aria-label="Select event"
          >
            {feed.rows.map((r) => (
              <option key={r.id} value={r.id}>
                {r.reference} — {r.title.slice(0, 48)}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <section className="xl:col-span-9">
          <Panel
            title="Propagation graph"
            meta={`${view.nodes.length} of ${nodeCount} nodes · ${view.edges.length} edges`}
            actions={
              <button
                type="button"
                onClick={() => setIsolate((v) => !v)}
                disabled={!selected}
                title={
                  selected
                    ? "Show only the selected node's immediate neighbourhood"
                    : "Select a node first"
                }
                className="label flex items-center gap-1.5 border border-rule px-2 py-1 transition-colors enabled:hover:border-foreground disabled:opacity-40"
              >
                {isolate ? "Show all" : "Isolate selection"}
              </button>
            }
          >
            {graph ? (
              <GraphExplorer
                nodes={view.nodes}
                edges={view.edges}
                height={560}
                selected={selected}
                onSelect={(id) => {
                  // Graph ids are node ids, except the synthetic event and
                  // channel hubs, which are not places and open their own page.
                  if (id.startsWith("ch:")) {
                    navigate("/app/risk");
                    return;
                  }
                  if (id === eventId) {
                    navigate(`/app/event/${id}`);
                    return;
                  }
                  toggle({ kind: "node", id });
                }}
              />
            ) : (
              <Skeleton className="h-[560px] w-full" />
            )}
            <div className="flex flex-wrap items-center gap-4 border-t border-rule px-3 py-2">
              {kindCounts.map(([kind, count]) => (
                <span key={kind} className="flex items-center gap-1.5">
                  <span
                    className="inline-block size-2 border border-current"
                    style={{ borderRadius: "9999px" }}
                  />
                  <span className="label text-muted-foreground">
                    {kind} · {count}
                  </span>
                </span>
              ))}
              <span className="label text-muted-foreground">
                Node radius = impact · edge width = impact × magnitude
              </span>
            </div>
          </Panel>
        </section>

        <section className="space-y-3 xl:col-span-3">
          <Panel title="Selection" meta="click a node">
            {selected ? (
              <div className="space-y-3 p-3">
                <div>
                  <p className="text-[14px] font-semibold">{selectedLabel(selected)}</p>
                  <p className="num mt-0.5 text-[10px] text-muted-foreground">
                    {selected}
                  </p>
                </div>
                <Bar
                  value={nodeWeight(selected, graph?.nodes ?? [])}
                  tone={riskColorForScore(nodeWeight(selected, graph?.nodes ?? []) * 100)}
                  height={5}
                />
                <Link
                  to={`/app/country/${selected}`}
                  className="label block border border-rule px-3 py-2 text-center transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
                >
                  Open profile
                </Link>
              </div>
            ) : (
              <NoData reason="Select a node on the graph to inspect it." />
            )}
          </Panel>

          <Panel title="Edge legend">
            <ul className="divide-y divide-rule text-[11px]">
              {[
                ["propagates via", "Event → Channel, weighted by pathway magnitude"],
                ["exposes", "Channel → Node, weighted by impact × magnitude"],
              ].map(([label, note]) => (
                <li key={label} className="px-3 py-2">
                  <p className="font-medium">{label}</p>
                  <p className="mt-0.5 text-muted-foreground">{note}</p>
                </li>
              ))}
            </ul>
          </Panel>

          <Panel title="Not available">
            <p className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
              Company, commodity and policy nodes are absent because this build
              has no company graph, commodity registry or policy dataset. Adding
              them would mean inventing relationships, so they are not drawn.
            </p>
          </Panel>
        </section>
      </div>
    </main>
  );
}

function selectedLabel(id: string): string {
  return getNode(id).label;
}

function nodeWeight(id: string, nodes: { id: string; weight: number }[]): number {
  return nodes.find((n) => n.id === id)?.weight ?? 0;
}