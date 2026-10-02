import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageHead } from "@/components/viz/Shell";
import { FlowDiagram, FlowMap } from "@/components/viz/Flow";
import { Bar, NoData, Panel, Skeleton } from "@/components/viz/core";
import { getNode } from "@/lib/intel/nodes";
import { riskColorForScore } from "@/lib/intel/visual";

/** Supply-chain explorer: stage flow + geographic flow for one sector. */
export default function Supply() {
  const directory = useQuery(api.intel.industryDirectory);
  const [industryId, setIndustryId] = useState<string | null>(null);
  const active = industryId ?? directory?.industries[0]?.id ?? null;
  const flow = useQuery(
    api.intel.supplyFlow,
    active ? { industryId: active } : "skip",
  );

  const geoFlows = useMemo(
    () =>
      (flow?.edges ?? []).map((e) => ({
        from: e.from === "input" || e.from === "route" ? e.to : e.from,
        to: e.to,
        weight: e.weight,
      })),
    [flow],
  );

  if (!directory) {
    return (
      <main>
        <PageHead title="Supply chains" lede="Dependency structure per sector." />
        <div className="p-3">
          <Skeleton className="h-[420px] w-full" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0">
      <PageHead
        title="Supply chains"
        lede="The declared dependency chain for a sector, with live corpus weight on each link. Stage membership is structural reference data; edge weight is derived."
        actions={
          <select
            value={active ?? ""}
            onChange={(e) => setIndustryId(e.target.value)}
            className="h-8 border border-rule bg-card px-2 text-[12px] outline-none focus:border-foreground"
            aria-label="Select sector"
          >
            {directory.industries.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        }
      />

      <div className="space-y-3 p-3">
        <Panel
          title="Dependency chain"
          meta={flow?.industry.label ?? "—"}
          actions={
            <span className="label text-muted-foreground">
              edge width = live corpus weight
            </span>
          }
        >
          {flow ? (
            flow.stages.length === 0 ? (
              <NoData reason="This sector declares no stages." />
            ) : (
              <FlowDiagram stages={flow.stages} edges={flow.edges} />
            )
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Panel>

        <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
          <section className="xl:col-span-7">
            <Panel title="Stage members" meta="declared structure">
              {flow ? (
                <div className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-4">
                  {flow.stages.map((stage) => (
                    <div key={stage.id} className="bg-card p-3">
                      <p className="label">{stage.label}</p>
                      <ul className="mt-2 space-y-1">
                        {stage.nodeIds.map((id) => (
                          <li
                            key={id}
                            className="flex items-center justify-between gap-2"
                          >
                            <span className="truncate text-[11.5px]">
                              {getNode(id).label}
                            </span>
                            <span className="num shrink-0 text-[10px] text-muted-foreground">
                              {getNode(id).short}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ) : (
                <Skeleton className="h-48 w-full" />
              )}
            </Panel>
          </section>

          <section className="xl:col-span-5">
            <Panel title="Sector load" meta="derived">
              {directory.industries
                .filter((r) => r.id === active)
                .map((r) => (
                  <div key={r.id} className="space-y-3 p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[13px]">{r.label}</span>
                      <span className="h-metric">{(r.load * 100).toFixed(0)}%</span>
                    </div>
                    <Bar
                      value={r.load}
                      tone={riskColorForScore(r.load * 100)}
                      height={6}
                    />
                    <dl className="grid grid-cols-2 gap-y-2 border-t border-rule pt-3">
                      {[
                        ["Concentration", `${(r.concentration * 100).toFixed(0)}%`],
                        ["Fragility", `${(r.fragility * 100).toFixed(0)}%`],
                        ["Substitution lead", `${r.substitutionMonths} mo`],
                        ["Events reaching", String(r.eventCount)],
                      ].map(([k, v]) => (
                        <div key={k}>
                          <dt className="label text-muted-foreground">{k}</dt>
                          <dd className="num text-[13px]">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                ))}
            </Panel>
          </section>
        </div>

        <Panel title="Geographic flow of the dependency chain" meta="producer → consumer">
          <FlowMap flows={geoFlows} height={260} />
        </Panel>
      </div>
    </main>
  );
}