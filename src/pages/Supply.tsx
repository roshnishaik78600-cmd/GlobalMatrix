import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useFocus } from "@/lib/focus";
import { getNode } from "@/lib/intel/nodes";
import { pct } from "@/lib/format";
import { WorldMap, MapLegend } from "@/components/viz/WorldMap";
import { FlowDiagram } from "@/components/viz/Flow";
import {
  ChokepointBoard,
  ChokepointRoster,
} from "@/components/viz/exec/ChokepointBoard";
import { loadColour } from "@/components/viz/exec/Topology";
import {
  BasisTag,
  Col,
  DominantCard,
  ExecCard,
  ExecGrid,
  ExecLink,
  ExecPage,
  NoDataAvailable,
  PageTitle,
  SectionTitle,
  SegmentedControl,
} from "@/components/viz/exec/system";

/**
 * Supply chains — the chokepoint analyzer.
 *
 * The dominant visual is a single bottleneck at a time: what feeds it, what
 * routes through it, and which economies share its exposure. That is the
 * question this page exists to answer, and it is answered by choosing a node
 * rather than by showing every node at once.
 *
 * No animation appears here. Particles on a supply-chain diagram imply freight
 * moving on a lane the data does not measure.
 */
export default function Supply() {
  const board = useQuery(api.chokepoints.chokepointBoard);
  const directory = useQuery(api.intel.industryDirectory);
  const [selected, setSelected] = useState<string | null>(null);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const [view, setView] = useState<"chokepoints" | "sectors">("chokepoints");
  const { toggle } = useFocus();

  const activeIndustry =
    industryId ?? directory?.industries[0]?.id ?? null;
  const flow = useQuery(
    api.intel.supplyFlow,
    activeIndustry ? { industryId: activeIndustry } : "skip",
  );

  const rows = board?.rows ?? [];
  const active = selected ?? rows[0]?.nodeId ?? null;

  // Geospatial flow. The chain's edges are stage-to-stage ("route" → "producer"),
  // so the arcs are built from real stage membership: each declared route and
  // input node feeds each producer, and each producer feeds each consumer. That
  // keeps every drawn point a real economy or chokepoint with real coordinates.
  const { geoNodes, geoFlows } = useMemo(() => {
    const stages = new Map((flow?.stages ?? []).map((s) => [s.id, s.nodeIds]));
    const producers = stages.get("producer") ?? [];
    const upstreams = [...(stages.get("input") ?? []), ...(stages.get("route") ?? [])];
    const consumers = stages.get("consumer") ?? [];

    const ids = new Set<string>([...upstreams, ...producers, ...consumers]);
    const nodes = [...ids]
      .map((id) => {
        const node = getNode(id);
        if (node.lat === undefined || node.lon === undefined) return null;
        return {
          nodeId: id,
          label: node.label,
          kind: node.kind,
          load: 0.5,
          eventCount: 0,
          criticality: node.criticality,
        };
      })
      .filter(Boolean) as {
      nodeId: string;
      label: string;
      kind: string;
      load: number;
      eventCount: number;
      criticality: number;
    }[];
    const plotted = new Set(nodes.map((n) => n.nodeId));

    const arcs = [
      ...upstreams.flatMap((u) =>
        producers.map((p) => ({ from: u, to: p, weight: 1 })),
      ),
      ...producers.flatMap((p) =>
        consumers.map((c) => ({ from: p, to: c, weight: 1 })),
      ),
    ].filter((a) => plotted.has(a.from) && plotted.has(a.to));

    return { geoNodes: nodes, geoFlows: arcs };
  }, [flow]);

  const sector = directory?.industries.find((i) => i.id === activeIndustry);

  return (
    <ExecPage>
      <PageTitle
        title="Supply chain chokepoint analyzer"
        lede="Single points of failure, one at a time. Pick a bottleneck to see which sectors depend on it and which economies share its exposure. Dependency edges are declared structure; load is derived from the current corpus."
        right={
          <>
            <SegmentedControl
              options={[
                { id: "chokepoints", label: "CHOKEPOINTS" },
                { id: "sectors", label: "BY SECTOR" },
              ]}
              value={view}
              onChange={setView}
            />
            <ExecLink to="/app/industries">Industry matrix →</ExecLink>
          </>
        }
      />

      {view === "chokepoints" ? (
        <ExecGrid>
          <Col span={8}>
            <DominantCard
              title="Bottleneck flow"
              meta={
                active
                  ? `${getNode(active).label} · structural dependency and derived load`
                  : "awaiting the chokepoint board"
              }
              right={<BasisTag basis="model" />}
            >
              <ChokepointBoard
                rows={rows}
                selected={active}
                onSelect={setSelected}
              />
            </DominantCard>
          </Col>

          <Col span={4} className="flex flex-col gap-3">
            <ExecCard>
              <SectionTitle
                meta="ranked by derived load"
                right={<BasisTag basis="model" />}
              >
                All bottlenecks
              </SectionTitle>
              <ChokepointRoster
                rows={rows}
                selected={active}
                onSelect={setSelected}
                onInspect={(id) => toggle({ kind: "node", id })}
              />
            </ExecCard>

            <ExecCard className="flex-1">
              <SectionTitle meta="derived + structural">Sector load</SectionTitle>
              {directory?.industries.length ? (
                <ul className="divide-y divide-[var(--exec-hairline)]">
                  {directory.industries.map((r) => (
                    <li key={r.id} className="flex items-center gap-2.5 px-3 py-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIndustryId(r.id);
                          setView("sectors");
                        }}
                        className="min-w-0 flex-1 truncate text-left text-[11.5px] text-[var(--exec-ink)] transition-colors hover:underline"
                      >
                        {r.label}
                      </button>
                      <span className="h-1.5 w-16 shrink-0 bg-[var(--exec-hairline)]">
                        <span
                          className="block h-full"
                          style={{ width: pct(r.load), background: loadColour(r.load) }}
                        />
                      </span>
                      <span
                        className="exec-num w-9 shrink-0 text-right text-[10.5px]"
                        style={{ color: loadColour(r.load) }}
                      >
                        {pct(r.load)}
                      </span>
                      <span
                        className="exec-num w-12 shrink-0 text-right text-[9.5px] text-[var(--exec-ink-dim)]"
                        title="Substitution lead time — the sector's real constraint"
                      >
                        {r.substitutionMonths}mo
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <NoDataAvailable
                  title="No sector exposure resolved"
                  reason="Sector exposure is derived by walking the corpus to each sector's producers and consumers. Nothing has resolved yet."
                />
              )}
            </ExecCard>
          </Col>
        </ExecGrid>
      ) : (
        <ExecGrid>
          <Col span={12}>
            <DominantCard
              title="Sector dependency chain"
              meta={`${flow?.industry.label ?? "—"} · declared structure, derived edge weight`}
              right={
                <>
                  <BasisTag basis="model" />
                  <select
                    value={activeIndustry ?? ""}
                    onChange={(e) => setIndustryId(e.target.value)}
                    className="h-6 border border-[var(--exec-hairline)] bg-[var(--exec-surface)] px-1.5 text-[11px] text-[var(--exec-ink)] outline-none"
                    aria-label="Select sector"
                  >
                    {directory?.industries.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </>
              }
            >
              {flow && flow.stages.length > 0 ? (
                <FlowDiagram stages={flow.stages} edges={flow.edges} />
              ) : (
                <NoDataAvailable
                  title="This sector declares no dependency stages"
                  reason="Stage membership is structural reference data. A sector with no declared input, route, producer or consumer stage renders nothing rather than a generic chain."
                />
              )}
            </DominantCard>
          </Col>

          <Col span={4}>
            <ExecCard className="h-full">
              <SectionTitle meta="declared structure">Sector structure</SectionTitle>
              {sector ? (
                <ul className="divide-y divide-[var(--exec-hairline)]">
                  <li className="px-3 py-2">
                    <p className="exec-label">Concentration</p>
                    <p className="exec-num mt-1 text-[15px] font-bold text-[var(--exec-ink)]">
                      {pct(sector.concentration)}
                    </p>
                    <p className="exec-label mt-0.5 normal-case">
                      Largest single producer&apos;s share of this sector&apos;s output
                    </p>
                  </li>
                  <li className="px-3 py-2">
                    <p className="exec-label">Fragility</p>
                    <p className="exec-num mt-1 text-[15px] font-bold text-[var(--exec-ink)]">
                      {pct(sector.fragility)}
                    </p>
                  </li>
                  <li className="px-3 py-2">
                    <p className="exec-label">Substitution lead</p>
                    <p className="exec-num mt-1 text-[15px] font-bold text-[var(--exec-ink)]">
                      {sector.substitutionMonths} mo
                    </p>
                  </li>
                  <li className="px-3 py-2">
                    <p className="exec-label">Events reaching it</p>
                    <p className="exec-num mt-1 text-[15px] font-bold text-[var(--exec-ink)]">
                      {sector.eventCount}
                    </p>
                  </li>
                  <li className="px-3 py-2">
                    <p className="exec-label">Dominant channel</p>
                    <p className="mt-1 text-[12px] text-[var(--exec-ink)]">
                      {sector.topChannel}
                    </p>
                  </li>
                </ul>
              ) : (
                <NoDataAvailable
                  title="No sector selected"
                  reason="Choose a sector from the list above to read its structural parameters."
                />
              )}
            </ExecCard>
          </Col>

          <Col span={8}>
            <ExecCard className="h-full">
              <SectionTitle meta="producers and consumers with real coordinates">
                Geospatial flow
              </SectionTitle>
              {geoNodes.length === 0 ? (
                <div className="px-3 py-6">
                  <p className="exec-label text-[var(--exec-ink)]">
                    NO VERIFIED GEOGRAPHIC DATA AVAILABLE
                  </p>
                  <p className="mt-1.5 max-w-lg text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
                    Every stage in this sector&apos;s chain is an abstraction such as
                    &ldquo;input&rdquo; or &ldquo;route&rdquo;, which has no place on
                    the map. GlobalMatrix does not place those at approximate
                    coordinates to fill the frame; the chain is shown above in full
                    instead.
                  </p>
                </div>
              ) : (
                <>
                  <WorldMap nodes={geoNodes} flows={geoFlows} height={300} />
                  <div className="border-t border-[var(--exec-hairline)]">
                    <MapLegend />
                  </div>
                  <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[11px] leading-relaxed text-[var(--exec-ink-dim)]">
                    Arcs follow the sector&apos;s declared structure: each input and
                    route node feeds each declared producer, and each producer feeds
                    each declared consumer. Their weights are structural shares, not
                    measured tonnage — no shipment-level data is connected.
                  </p>
                </>
              )}
            </ExecCard>
          </Col>
        </ExecGrid>
      )}
    </ExecPage>
  );
}
