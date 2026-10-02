import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHead } from "@/components/viz/Shell";
import { Bar, NoData, Panel, Skeleton } from "@/components/viz/core";
import { MapLegend, MapSelection, WorldMap } from "@/components/viz/WorldMap";
import { riskColorForScore } from "@/lib/intel/visual";

/** Full-width map explorer. Filters re-scope every panel below the map. */
export default function World() {
  const overview = useQuery(api.intel.overview);
  const directory = useQuery(api.intel.countryDirectory);
  const [selected, setSelected] = useState<string | null>(null);
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
        <PageHead
          title="World"
          lede="Geospatial view of the transmission graph."
        />
        <div className="p-3">
          <Skeleton className="h-[520px] w-full" />
        </div>
      </main>
    );
  }

  const corridors = directory?.corridors ?? [];

  return (
    <main className="min-w-0">
      <PageHead
        title="World"
        lede="Every plotted node is a real coordinate. Radius encodes live load derived from the corpus; arcs are real transmission links. Institutions are excluded because they have no location."
        actions={
          <button
            type="button"
            onClick={() => setShowFlows((v) => !v)}
            className="label border border-rule px-3 py-2 transition-colors hover:border-foreground"
          >
            {showFlows ? "Hide links" : "Show links"}
          </button>
        }
      />

      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <section className="xl:col-span-9">
          <Panel
            title="Activity map"
            meta={`${nodes.length} of ${allNodes.length} nodes`}
          >
            <WorldMap
              nodes={nodes}
              flows={showFlows ? overview.flows : []}
              height={540}
              selected={selected}
              onSelect={(id) => setSelected(id === selected ? null : id)}
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
              Arcs are chokepoint → dependent-economy links, weighted by the
              exposure term the engine summed into that economy&apos;s load.
              They are not shipping lanes or trade flows — no trade-flow dataset
              exists in this build.
            </p>
          </Panel>
        </section>
      </div>
    </main>
  );
}