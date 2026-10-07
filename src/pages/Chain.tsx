import { useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageFrame } from "@/components/viz/exec/design";
import { Skeleton } from "@/components/viz/core";
import { QuestionStrip } from "@/components/viz/Unavailable";
import { ChainExplorer } from "@/components/viz/ChainExplorer";
import { MapLegend, MapSelection, WorldMap, isPlottable } from "@/components/viz/WorldMap";
import { SignalMatrix } from "@/components/viz/SignalMatrix";
import { useFocus } from "@/lib/focus";

/**
 * How an event connects to the rest of the world.
 *
 * The chain at the top is the spine of the product: one event, followed through
 * countries, trade, energy, supply chains, industries, and on to the two stages
 * this build cannot yet measure. The map underneath is the same model seen from
 * above, and the matrix is the same model compared across every economy.
 */
export default function ChainPage() {
  const overview = useQuery(api.intel.overview);
  const navigate = useNavigate();
  const { focus, toggle, clear } = useFocus();
  const selected = focus?.kind === "node" ? focus.id : null;
  const setSelected = (id: string | null) =>
    id === null ? clear() : toggle({ kind: "node", id });

  if (!overview) {
    return (
      <main>
        <div className="p-3">
          <Skeleton className="h-[560px] w-full" />
        </div>
      </main>
    );
  }

  const hottest = overview.hottestCountries[0];
  // Count only places the map can actually draw, so the number in the caption
  // matches the markers in the picture.
  const plottablePlaces = overview.mapNodes.filter((n) => isPlottable(n.nodeId)).length;
  const topEvent = overview.topEvents[0];

  return (
      <PageFrame
      eyebrow="Impact"
      title="Impact graph"
      lede="How one event travels from detection through countries, trade, energy and supply chains into market exposure."
    >

      <QuestionStrip
        className="border-b border-rule"
        answers={[
          {
            q: "What's happening?",
            a: topEvent ? topEvent.title : "No events in the corpus.",
            href: topEvent ? `/app/event/${topEvent.id}` : undefined,
          },
          {
            q: "Where does it land?",
            a: hottest
              ? `${hottest.label} carries the most exposure at ${(hottest.load * 100).toFixed(0)}%.`
              : "No country exposure resolved.",
            href: hottest ? `/app/country/${hottest.nodeId}` : undefined,
          },
          {
            q: "How far does it reach?",
            a: `${overview.flows.length} couplings connect infrastructure to economies in this corpus.`,
            href: "/app/world",
          },
          {
            q: "What can't we see?",
            a: "Company exposure and market prices. Both stages say so in place rather than estimating them.",
            href: "/app/companies",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4">
        <ChainExplorer />

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <section className="xl:col-span-9">
            <div className="panel h-full">
              <div className="panel-head">
                <span className="label">The same model, from above</span>
                <span className="label text-muted-foreground">
                  {plottablePlaces} places ·{" "}
                  {overview.mapEvents?.length ?? 0} events ·{" "}
                  {overview.flows.length} couplings
                </span>
              </div>
              <WorldMap
                nodes={overview.mapNodes}
                flows={overview.flows}
                events={(overview.mapEvents ?? []).filter((e) => e.nodeId !== "")}
                className="map-frame"
                selected={selected}
                onSelect={setSelected}
                onInspect={(id) => navigate(`/app/country/${id}`)}
              />
              <div className="border-t border-rule">
                <MapLegend />
              </div>
            </div>
          </section>

          <section className="space-y-3 xl:col-span-3">
            {selected ? (
              <MapSelection nodeId={selected} onClose={() => setSelected(null)} />
            ) : (
              <div className="panel">
                <div className="panel-head">
                  <span className="label">Pick a place</span>
                </div>
                <p className="p-3 text-[13px] leading-relaxed text-muted-foreground">
                  Select any country, bloc or chokepoint on the map to see its
                  live load, its reported growth and its reported trade — each
                  with the source it came from.
                </p>
              </div>
            )}
          </section>
        </div>

        <SignalMatrix />
      </div>
    </PageFrame>
  );
}