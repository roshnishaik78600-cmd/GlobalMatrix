import { useMemo } from "react";
import { Panel, Skeleton } from "@/components/viz/core";
import { WorldMap, MapLegend } from "@/components/viz/WorldMap";
import { useTradeData } from "@/hooks/use-verified-data";
import { getNode } from "@/lib/intel/nodes";

/**
 * Reported trade, drawn where it is reported.
 *
 * Circle size is each reporter's own reported total merchandise trade. This
 * build has reporter totals only, not a bilateral partner breakdown, so no
 * arrow is drawn between two economies: an arc would imply a counterparty the
 * data does not contain.
 */
export function TradeFlowMap() {
  const trade = useTradeData();

  const nodes = useMemo(() => {
    const flows = trade.data ?? [];
    if (flows.length === 0) return [];
    const max = Math.max(...flows.map((f) => f.exportsUsd + f.importsUsd), 1);
    return flows
      .filter((f) => {
        const node = getNode(f.reporter);
        return node.lat !== undefined && node.lon !== undefined;
      })
      .map((f) => {
        const node = getNode(f.reporter);
        return {
          nodeId: f.reporter,
          label: node.label,
          kind: node.kind,
          load: (f.exportsUsd + f.importsUsd) / max,
          eventCount: 0,
          criticality: node.criticality,
        };
      });
  }, [trade.data]);

  if (trade.data === null) {
    return (
      <Panel title="Reported trade, by reporter" meta="UN Comtrade">
        <Skeleton className="m-3 h-56 w-full" />
      </Panel>
    );
  }

  if (nodes.length === 0) {
    return (
      <Panel title="Reported trade, by reporter" meta="UN Comtrade">
        <p className="px-3 py-4 text-[12px] leading-relaxed text-muted-foreground">
          No reporter returned a mappable total for this period, so nothing is
          drawn. The table beside this panel reports the same absence.
        </p>
      </Panel>
    );
  }

  return (
    <Panel
      title="Reported trade, by reporter"
      meta={`${nodes.length} economies · ${trade.asOf || "latest period"}`}
    >
      <WorldMap nodes={nodes} height={320} />
      <div className="border-t border-rule">
        <MapLegend />
      </div>
      <p className="px-3 py-2 text-[12px] leading-relaxed text-muted-foreground">
        Size and shading are each reporter&apos;s own total merchandise trade.
        No bilateral arrows are drawn: this tier returns reporter totals, not
        counterparty detail.
      </p>
    </Panel>
  );
}