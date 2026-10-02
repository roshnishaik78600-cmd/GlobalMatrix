import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTradeData } from "@/hooks/use-verified-data";
import { freshnessOf } from "@/lib/freshness";
import { getNode } from "@/lib/intel/nodes";
import { CHANNEL_LABEL } from "@/lib/intel/types";
import { useFocus } from "@/lib/focus";
import { WorldMap, MapLegend } from "@/components/viz/WorldMap";
import { loadColour } from "@/components/viz/exec/Topology";
import { TradeBalance, TradeOpenness, TradeSankey } from "@/components/viz/exec/TradeEngine";
import {
  BasisTag,
  Col,
  DominantCard,
  ExecCard,
  ExecGrid,
  ExecLink,
  ExecPage,
  FreshnessTag,
  PageTitle,
  ProvenanceFoot,
  SectionTitle,
} from "@/components/viz/exec/system";

/**
 * Trade — bilateral and commodity flow engine.
 *
 * One dominant visual: the flow of reported exports and imports into world
 * trade, where every ribbon is a published dollar figure. Supporting boards
 * carry the balance ranking, where each reporter sits, and how open each economy
 * is. Trade-channel events sit apart, because they are the model's view of
 * pressure and are not evidence that a tariff moved.
 */
export default function Trade() {
  const trade = useTradeData();
  const feed = useQuery(api.intel.detectionFeed, {});
  const { toggle, isFocused } = useFocus();

  const flows = useMemo(() => trade.data ?? [], [trade.data]);

  const tradeEvents = (feed?.rows ?? [])
    .filter((r) => r.channelPressure.trade > 0.3)
    .slice(0, 8);

  const mapNodes = useMemo(() => {
    const rows = trade.data ?? [];
    if (rows.length === 0) return [];
    const max = Math.max(...rows.map((f) => f.exportsUsd + f.importsUsd), 1);
    return rows
      .map((f) => {
        const node = getNode(f.reporter);
        if (node.lat === undefined || node.lon === undefined) return null;
        return {
          nodeId: f.reporter,
          label: node.label,
          kind: node.kind,
          load: (f.exportsUsd + f.importsUsd) / max,
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
  }, [trade.data]);

  const freshness = trade.data === null
    ? "unavailable"
    : freshnessOf(trade.retrievedAt, "comtrade");

  return (
    <ExecPage>
      <PageTitle
        title="Trade flow engine"
        lede="Reported merchandise values for every economy GlobalMatrix follows, flowed into world trade and ranked by balance. The flows are measurements; the trade-channel events at the foot of this page are the model's view of pressure, and the two are never merged."
        right={
          <>
            <FreshnessTag freshness={freshness} />
            <ExecLink to="/app/data">How this is collected →</ExecLink>
          </>
        }
      />

      <ExecGrid>
        {/* DOMINANT VISUAL — the flow engine. */}
        <Col span={8}>
          <DominantCard
            title="Reported trade flows"
            meta={
              trade.asOf
                ? `UN Comtrade · ${trade.asOf} · ${flows.length} reporters`
                : "UN Comtrade · awaiting a reading"
            }
            right={<BasisTag basis="observed" />}
            bodyClassName="flex flex-col"
          >
            <TradeSankey flows={flows} />
            <ProvenanceFoot
              sourceId="comtrade"
              retrievedAt={trade.retrievedAt}
              freshness={freshness}
              period={trade.asOf || undefined}
              note="The public preview tier reports total merchandise trade per reporter with the counterparty always 'World'. It returns no bilateral corridor and no commodity split, so neither is drawn here: a bilateral chord built from a source that does not contain counterparties would be a fabrication, and this page would rather be smaller than wrong."
            />
          </DominantCard>
        </Col>

        <Col span={4} className="flex flex-col gap-3">
          <ExecCard>
            <TradeBalance flows={flows} />
          </ExecCard>

          <ExecCard className="flex-1">
            <TradeOpenness />
          </ExecCard>
        </Col>

        {/* GLOBAL TRADE MAP — where the reporting happens. */}
        <Col span={7}>
          <ExecCard className="h-full">
            <SectionTitle
              meta={
                mapNodes.length === 0
                  ? "no mappable reporter"
                  : `${mapNodes.length} economies · total merchandise trade`
              }
              right={<BasisTag basis="observed" />}
            >
              Trade map
            </SectionTitle>
            {mapNodes.length === 0 ? (
              <div className="px-3 py-6">
                <p className="exec-label text-[var(--exec-ink)]">
                  NO VERIFIED GEOGRAPHIC DATA AVAILABLE
                </p>
                <p className="mt-1.5 max-w-md text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
                  {trade.data === null
                    ? "UN Comtrade has not returned a reading, so there is nothing to place on a map. GlobalMatrix does not fall back to approximate national output shares to fill it."
                    : "No reporter returned a total for a place GlobalMatrix can plot. Nothing is drawn rather than substituting an estimate."}
                </p>
              </div>
            ) : (
              <WorldMap
                nodes={mapNodes}
                height={330}
                onSelect={(id) => toggle({ kind: "node", id })}
              />
            )}
            <div className="border-t border-[var(--exec-hairline)]">
              <MapLegend />
            </div>
            <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[11px] leading-relaxed text-[var(--exec-ink-dim)]">
              Marker size and shading are each reporter&apos;s own total
              merchandise trade. No arcs are drawn between economies: this tier
              has no counterparty detail, and an arc would imply a shipping lane
              the data does not contain.
            </p>
          </ExecCard>
        </Col>

        {/* The ranking, in full, so the Sankey is auditable against it. */}
        <Col span={5}>
          <ExecCard className="h-full">
            <SectionTitle meta="descending by total" right={<BasisTag basis="observed" />}>
              Reporter ledger
            </SectionTitle>
            {flows.length === 0 ? (
              <p className="px-3 py-6 text-[11.5px] text-[var(--exec-ink-dim)]">
                No reported values stored.
              </p>
            ) : (
              <div className="max-h-[19rem] overflow-y-auto">
                <table className="w-full text-left">
                  <thead className="sticky top-0 bg-[var(--exec-base)]">
                    <tr className="border-b border-[var(--exec-hairline)]">
                      {["Reporter", "Exports", "Imports", "Balance"].map((h, i) => (
                        <th
                          key={h}
                          className={`exec-label px-3 py-1.5 ${i === 0 ? "" : "text-right"}`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...flows]
                      .sort(
                        (a, b) =>
                          b.exportsUsd + b.importsUsd - (a.exportsUsd + a.importsUsd),
                      )
                      .map((f) => {
                        const balance = f.exportsUsd - f.importsUsd;
                        return (
                          <tr
                            key={f.key}
                            onClick={() => toggle({ kind: "node", id: f.reporter })}
                            className={`cursor-pointer border-b border-[var(--exec-hairline)] transition-colors hover:bg-[var(--exec-surface-strong)] ${
                              isFocused("node", f.reporter) ? "bg-[var(--exec-surface-strong)]" : ""
                            }`}
                          >
                            <td className="px-3 py-1.5 text-[11.5px] text-[var(--exec-ink)]">
                              {getNode(f.reporter).label}
                            </td>
                            <td className="exec-num px-3 py-1.5 text-right text-[11px]">
                              {money(f.exportsUsd)}
                            </td>
                            <td className="exec-num px-3 py-1.5 text-right text-[11px]">
                              {money(f.importsUsd)}
                            </td>
                            <td
                              className="exec-num px-3 py-1.5 text-right text-[11px] font-semibold"
                              style={{
                                color:
                                  balance >= 0
                                    ? "var(--exec-emerald)"
                                    : "var(--exec-crimson)",
                              }}
                            >
                              {balance >= 0 ? "+" : "−"}
                              {money(Math.abs(balance))}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
            <ProvenanceFoot
              sourceId="comtrade"
              retrievedAt={trade.retrievedAt}
              freshness={freshness}
              period={trade.asOf || undefined}
            />
          </ExecCard>
        </Col>

        {/* Trade-channel events. Kept last and visibly separate. */}
        <Col span={12}>
          <ExecCard>
            <SectionTitle
              meta="MODEL OUTPUT · not a reported policy change"
              right={<BasisTag basis="scenario" />}
            >
              Trade-channel events
            </SectionTitle>
            {tradeEvents.length === 0 ? (
              <p className="px-3 py-4 text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
                No event in the current corpus carries material pressure on the
                trade channel. No tariff, quota or sanctions registry is
                connected, so no policy change is asserted here in either
                direction.
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-px md:grid-cols-2 xl:grid-cols-4">
                {tradeEvents.map((e) => (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => toggle({ kind: "event", id: e.id })}
                      className="flex h-full w-full flex-col gap-1 px-3 py-2 text-left transition-colors hover:bg-[var(--exec-surface-strong)]"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="exec-label">
                          {CHANNEL_LABEL.trade} {(e.channelPressure.trade * 100).toFixed(0)}%
                        </span>
                        <span
                          className="exec-num text-[12px] font-semibold"
                          style={{ color: loadColour(e.score30 / 100) }}
                        >
                          {e.score30.toFixed(0)}
                        </span>
                      </span>
                      <span className="line-clamp-2 text-[12px] leading-snug text-[var(--exec-ink)]">
                        {e.title}
                      </span>
                      <span className="exec-num mt-auto text-[9.5px] text-[var(--exec-ink-dim)]">
                        {e.detectedAt} · 80% {e.low30.toFixed(0)}–{e.high30.toFixed(0)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </ExecCard>
        </Col>
      </ExecGrid>
    </ExecPage>
  );
}

/** Reporter ledger formatting: the same convention the balance board uses. */
function money(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${(value / 1e9).toFixed(0)}B`;
  return `${(value / 1e6).toFixed(0)}M`;
}
