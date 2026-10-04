import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageFrame } from "@/components/viz/exec/design";
import { Bar, NoData, Panel, Skeleton } from "@/components/viz/core";
import { MapLegend, MapSelection, WorldMap, isPlottable } from "@/components/viz/WorldMap";
import { riskColorForScore } from "@/lib/intel/visual";
import { useFocus } from "@/lib/focus";

/** Full-width map explorer. Filters re-scope every panel below the map. */
export default function World() {
  const overview = useQuery(api.intel.overview);
  const directory = useQuery(api.intel.countryDirectory);
  const navigate = useNavigate();
  const { focus, toggle, clear } = useFocus();
  const selected = focus?.kind === "node" ? focus.id : null;
  const setSelected = (id: string | null) =>
    id === null ? clear() : toggle({ kind: "node", id });
  const [region, setRegion] = useState<string | null>(null);
  const [showFlows, setShowFlows] = useState(true);

  const regions = useMemo(
    () => [...new Set((directory?.countries ?? []).map((c) => c.region))].sort(),
    [directory],
  );

  const allNodes = useMemo(
    () => (overview?.mapNodes ?? []).map((n) => ({ ...n, region: null as string | null })),
    [overview],
  );

  const nodes = useMemo(() => {
    if (!region) return allNodes;
    const allowed = new Set(
      (directory?.countries ?? [])
        .filter((c) => c.region === region)
        .map((c) => c.nodeId),
    );
    return allNodes.filter((n) => allowed.has(n.nodeId));
  }, [allNodes, region, directory]);

  if (!overview) {
    return (
      <main>
        <div className="p-3">
          <Skeleton className="h-[520px] w-full" />
        </div>
      </main>
    );
  }

  const corridors = directory?.corridors ?? [];
  // Institutions have no coordinate, so counting them would put a number on
  // the page that no marker can be matched against.
  const plottableTotal = allNodes.filter((n) => isPlottable(n.nodeId)).length;
  const plottedCount = nodes.filter((n) => isPlottable(n.nodeId)).length;

  return (
      <PageFrame
      eyebrow="World"
      title="World"
      lede="Every plotted point is a real coordinate on real country geometry; radius and shading both encode derived load."
      actions={
        <>
          <button
            type="button"
            onClick={() => setShowFlows((v) => !v)}
            aria-pressed={showFlows}
            className="exec-label border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            {showFlows ? "Hide couplings" : "Show couplings"}
          </button>
        </>
      }
    >

      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <section className="xl:col-span-9">
          <Panel
            title="World map"
            meta={`${plottedCount} of ${plottableTotal} places`}
          >
            <WorldMap
              nodes={nodes}
              flows={showFlows ? overview.flows : []}
              events={(overview.mapEvents ?? []).filter((e) => e.nodeId !== "")}
              height={540}
              selected={selected}
              onSelect={setSelected}
              onInspect={(id) => navigate(`/app/country/${id}`)}
            />
            <div className="border-t border-rule">
              <MapLegend />
            </div>
          </Panel>
        </section>

        <section className="space-y-3 xl:col-span-3">
          {selected ? (
            <MapSelection nodeId={selected} onClose={() => setSelected(null)} />
          ) : null}

          <Panel title="Region" meta="filter">
            <div className="flex flex-wrap gap-1 p-3">
              <button
                type="button"
                onClick={() => setRegion(null)}
                className={`chip ${
                  region === null
                    ? "border-signal text-signal"
                    : "border-rule text-muted-foreground"
                }`}
              >
                All
              </button>
              {regions.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(region === r ? null : r)}
                  className={`chip ${
                    region === r
                      ? "border-signal text-signal"
                      : "border-rule text-muted-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </Panel>

          <Panel title="Chokepoints" meta="transmit, not absorb">
            <ul className="divide-y divide-rule">
              {corridors
                .filter((c) => c.kind === "chokepoint")
                .map((c) => (
                  <li key={c.nodeId}>
                    <button
                      type="button"
                      onClick={() => setSelected(c.nodeId)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/4"
                    >
                      <span className="num w-7 shrink-0 text-[10px] text-muted-foreground">
                        {c.short}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px]">
                        {c.label}
                      </span>
                      <span className="w-12 shrink-0">
                        <Bar
                          value={c.load}
                          tone={riskColorForScore(c.load * 100)}
                          height={3}
                        />
                      </span>
                      <span className="num w-7 shrink-0 text-right text-[10px]">
                        {(c.load * 100).toFixed(0)}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </Panel>

          <Panel title="Load ranking" meta="derived">
            {nodes.length === 0 ? (
              <NoData reason="No nodes match this region filter." />
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <ul className="divide-y divide-rule">
                  {[...nodes]
                    .sort((a, b) => b.load - a.load)
                    .map((n) => (
                      <li key={n.nodeId}>
                        <button
                          type="button"
                          onClick={() => setSelected(n.nodeId)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-white/4"
                        >
                          <span className="min-w-0 flex-1 truncate text-[12px]">
                            {n.label}
                          </span>
                          <span className="w-14 shrink-0">
                            <Bar
                              value={n.load}
                              tone={riskColorForScore(n.load * 100)}
                              height={3}
                            />
                          </span>
                          <span className="num w-7 shrink-0 text-right text-[10px]">
                            {(n.load * 100).toFixed(0)}
                          </span>
                        </button>
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </Panel>

          <Panel title="On these arcs">
            <p className="px-3 py-3 text-[11px] leading-relaxed text-muted-foreground">
              An arc means a chokepoint and an economy are pulled by the same
              events, weighted by the weaker of the two contribution terms. It
              is a coupling in the model, not a shipping lane and not a trade
              flow — reported merchandise values live on the trade page, with
              their own source.
            </p>
          </Panel>
        </section>
      </div>
    </PageFrame>
  );
}