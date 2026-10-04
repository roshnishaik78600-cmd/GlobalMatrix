import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Drawer } from "@/components/viz/Drawer";
import { useFocus } from "@/lib/focus";
import { getNode } from "@/lib/intel/nodes";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";
import { pct } from "@/lib/format";
import { compact } from "@/lib/numbers";
import { freshnessOf } from "@/lib/freshness";
import { macroSeries, useMacroData, useTradeData } from "@/hooks/use-verified-data";
import { NodeRiskRadar, RadarLegend } from "./NodeRiskRadar";
import { FragilityArc } from "./FragilityArc";
import {
  BasisTag,
  FreshnessTag,
  NoDataAvailable,
  SectionTitle,
} from "./system";
import { loadColour } from "./Topology";

/**
 * The country inspect drawer — ten modules, no paragraphs.
 *
 * Every module either shows a real number with its source, or says plainly that
 * no verified data is connected for it. Companies, markets and policy in
 * particular are empty in this build, and they stay visibly empty: a filled-in
 * company card would be a fabrication, and a fake card is worse than a gap
 * because it costs the reader their trust in the nine that are real.
 */
const TABS = [
  "overview",
  "events",
  "trade",
  "economy",
  "energy",
  "companies",
  "supply",
  "policy",
  "markets",
  "risk",
] as const;

type Tab = (typeof TABS)[number];

export function CountryDrawer({ nodeId }: { nodeId: string }) {
  // Keyed on the node so opening a different country always starts on Overview
  // rather than inheriting the previous reader's tab.
  const [tab, setTab] = useState<Tab>("overview");
  const profile = useQuery(api.intel.countryProfile, { nodeId });
  const { focus, setFocus } = useFocus();
  const node = getNode(nodeId);
  const open = focus?.kind === "node" && focus.id === nodeId;

  const exposure = profile?.exposure;
  const pressure = useMemo(
    () =>
      Object.fromEntries(
        (exposure?.byChannel ?? []).map((c) => [c.channel, c.load]),
      ) as Partial<Record<Channel, number>>,
    [exposure],
  );

  // Returned after every hook, so the hook order never changes with `open`.
  if (!open) return null;

  return (
    <Drawer
      open={open}
      onClose={() => setFocus(null)}
      eyebrow={
        <>
          <span className="exec-label">{node.kind}</span>
          <span className="exec-label">{node.region}</span>
          <FreshnessTag freshness="historical" />
        </>
      }
      title={node.label}
      subtitle={`${profile?.node.short ?? node.short} · ${profile?.country ? "tracked economy" : "infrastructure node"}`}
      width="w-[min(34rem,100vw)]"
      footer={
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to={`/app/country/${nodeId}`}
            className="exec-label flex items-center gap-1 border border-[var(--exec-hairline)] px-2 py-1 transition-colors hover:border-[var(--exec-hairline-strong)]"
          >
            Full profile <ArrowUpRight className="size-3" />
          </Link>
          <Link
            to="/app/world"
            className="exec-label border border-[var(--exec-hairline)] px-2 py-1 transition-colors hover:border-[var(--exec-hairline-strong)]"
          >
            On the map
          </Link>
          <span className="exec-label ml-auto">Esc closes</span>
        </div>
      }
    >
      {/* Ten compact modules, switchable. Scroll position and the rest of the
          page stay exactly where they were. */}
      <div className="flex flex-wrap gap-px border-b border-[var(--exec-hairline)] p-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            aria-pressed={tab === t}
            className={`exec-label border px-1.5 py-1 transition-colors ${
              tab === t
                ? "border-[color-mix(in_srgb,var(--exec-cyan)_55%,transparent)] bg-[color-mix(in_srgb,var(--exec-cyan)_12%,transparent)] text-[var(--exec-ink)]"
                : "border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] hover:text-[var(--exec-ink)]"
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {!profile ? (
        <NoDataAvailable
          title="Resolving this profile"
          reason="The exposure model is still walking the corpus for this node."
        />
      ) : (
        <div className="flex flex-col">
          {tab === "overview" ? <OverviewTab nodeId={nodeId} /> : null}
          {tab === "events" ? <EventsTab nodeId={nodeId} /> : null}
          {tab === "trade" ? <TradeTab nodeId={nodeId} /> : null}
          {tab === "economy" ? <EconomyTab nodeId={nodeId} /> : null}
          {tab === "energy" ? <EnergyTab nodeId={nodeId} /> : null}
          {tab === "companies" ? <CompaniesTab /> : null}
          {tab === "supply" ? <SupplyTab nodeId={nodeId} /> : null}
          {tab === "policy" ? <PolicyTab nodeId={nodeId} /> : null}
          {tab === "markets" ? <MarketsTab /> : null}
          {tab === "risk" ? <RiskTab nodeId={nodeId} pressure={pressure} /> : null}
        </div>
      )}
    </Drawer>
  );
}


/* ------------------------------------------------------------------ tabs */

/** Modules shared by several tabs. */
function Row({
  label,
  value,
  tone,
  hint,
}: {
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--exec-hairline)] px-3 py-1.5 last:border-b-0">
      <span className="min-w-0 truncate text-[13px] text-[var(--exec-ink-dim)]">
        {label}
        {hint ? <span className="exec-label ml-1.5 normal-case">{hint}</span> : null}
      </span>
      <span
        className="exec-num shrink-0 text-[12px] font-semibold"
        style={{ color: tone ?? "var(--exec-ink)" }}
      >
        {value}
      </span>
    </div>
  );
}

function OverviewTab({ nodeId }: { nodeId: string }) {
  const profile = useQuery(api.intel.countryProfile, { nodeId });
  const exposure = profile?.exposure;
  const pressure = Object.fromEntries(
    (exposure?.byChannel ?? []).map((c) => [c.channel, c.load]),
  ) as Partial<Record<Channel, number>>;

  return (
    <>
      <div className="flex items-center gap-3 border-b border-[var(--exec-hairline)] p-3">
        <FragilityArc value={profile?.country?.structuralFragility ?? 0} size={104} />
        <div className="min-w-0">
          <p className="exec-label">Structural fragility</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
            A modelled structural parameter for this economy, independent of any
            current event. It is not a default probability, a credit rating, or a
            forecast of instability.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3 border-b border-[var(--exec-hairline)] p-3">
        <NodeRiskRadar pressure={pressure} size={104} />
        <div className="min-w-0">
          <RadarLegend pressure={pressure} />
          <p className="mt-1 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
            Only axes with a real reading are drawn. Hover an axis to read it.
          </p>
        </div>
      </div>
      <div>
        <SectionTitle meta="MODEL OUTPUT" right={<BasisTag basis="model" />}>
          Load
        </SectionTitle>
        <Row label="Blended exposure" value={pct(exposure?.load ?? 0)} tone={loadColour(exposure?.load ?? 0)} />
        <Row label="Events touching this node" value={String(exposure?.eventCount ?? 0)} />
        <Row
          label="Off-channel arrivals"
          hint="shocks on a channel this node is not exposed to"
          value={String(exposure?.offAffinityCount ?? 0)}
          tone="var(--exec-cyan)"
        />
        <Row label="Node criticality" value={(profile?.node.criticality ?? 0).toFixed(2)} />
        {(exposure?.byChannel ?? []).map((c) => (
          <Row
            key={c.channel}
            label={`${CHANNEL_LABEL[c.channel]} load`}
            value={pct(c.load)}
            tone={loadColour(c.load)}
          />
        ))}
      </div>
    </>
  );
}

function EventsTab({ nodeId }: { nodeId: string }) {
  const profile = useQuery(api.intel.countryProfile, { nodeId });
  const contributions = profile?.exposure.contributions ?? [];
  if (contributions.length === 0) {
    return (
      <NoDataAvailable
        title="No corpus events land on this node"
        reason="Exposure is derived by walking the corpus's propagation graph to this place. Nothing in the current corpus reaches it, which is itself the finding."
      />
    );
  }
  return (
    <div>
      <SectionTitle meta={`${contributions.length} contributions`} right={<BasisTag basis="model" />}>
        Events
      </SectionTitle>
      <ul className="divide-y divide-[var(--exec-hairline)]">
        {contributions.slice(0, 14).map((c) => (
          <li key={`${c.eventId}-${c.viaNodeId}-${c.channel}`}>
            <Link
              to={`/app/event/${c.eventId}`}
              className="block px-3 py-2 transition-colors hover:bg-[var(--exec-surface-strong)]"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className="exec-label"
                  style={{ color: riskColorForScore(c.contribution * 100) }}
                >
                  {CHANNEL_LABEL[c.channel]}
                </span>
                <span className="exec-num text-[12px] text-[var(--exec-ink)]">
                  {c.contribution.toFixed(3)}
                </span>
              </div>
              <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-[var(--exec-ink)]">
                {c.title}
              </p>
              <p className="exec-label mt-1 normal-case">
                via {c.viaNodeLabel} · lag {c.lagDays[0]}–{c.lagDays[1]}d · confidence{" "}
                {(c.confidence * 100).toFixed(0)}%
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TradeTab({ nodeId }: { nodeId: string }) {
  const trade = useTradeData();
  // Both connectors key their readings by GlobalMatrix's own node id, so a
  // profile matches its reporter directly rather than through an ISO guess.
  const rows = (trade.data ?? []).filter((f) => f.reporter === nodeId);

  return (
    <div>
      <SectionTitle
        meta="UN Comtrade"
        right={
          <FreshnessTag
            freshness={
              trade.data === null
                ? "unavailable"
                : freshnessOf(trade.retrievedAt, "comtrade")
            }
          />
        }
      >
        Trade
      </SectionTitle>
      {rows.length === 0 ? (
        <NoDataAvailable
          title={
            trade.data === null
              ? "UN Comtrade has not returned a reading"
              : `UN Comtrade publishes no total for this reporter`
          }
          reason={
            trade.problem ??
            "Comtrade's public preview returns total merchandise trade by reporter. It does not return bilateral corridors or commodity detail at this tier, so GlobalMatrix will not draw a bilateral chord or a commodity split for it."
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--exec-hairline)]">
          {rows.map((f) => (
            <li key={f.key} className="px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] text-[var(--exec-ink)]">
                  {f.reporter} · {f.period}
                </span>
                <BasisTag basis="observed" />
              </div>
              <div className="mt-1.5 flex gap-4">
                <DrawerMetric label="Exports" value={f.exportsUsd} />
                <DrawerMetric label="Imports" value={f.importsUsd} />
                <DrawerMetric label="Balance" value={f.exportsUsd - f.importsUsd} signed />
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
        Reporter totals only. Where a bilateral figure is not published, the
        honest answer is that it is unknown — not an estimate drawn from a
        different dataset.
      </p>
    </div>
  );
}

function DrawerMetric({
  label,
  value,
  signed,
}: {
  label: string;
  value: number;
  signed?: boolean;
}) {
  // compact() rather than a local branch: the previous inline version had no
  // M or K step, so a sub-billion figure rendered as "0.0B".
  const t = compact(value);
  return (
    <span className="min-w-0">
      <span className="exec-label block">{label}</span>
      <span
        className="exec-num block text-[13px] font-semibold"
        style={{
          color:
            signed && value < 0 ? "var(--exec-crimson)" : signed ? "var(--exec-emerald)" : undefined,
        }}
      >
        {signed && value > 0 ? "+" : ""}
        {t}
      </span>
    </span>
  );
}

function EconomyTab({ nodeId }: { nodeId: string }) {
  const macro = useMacroData();
  const series = useMemo(() => macroSeries(macro.data ?? []), [macro.data]);
  const readings = [...series.entries()].filter(([key]) =>
    key.startsWith(`${nodeId}:`),
  );

  return (
    <div>
      <SectionTitle
        meta="World Bank"
        right={
          <FreshnessTag
            freshness={
              macro.data === null
                ? "unavailable"
                : freshnessOf(macro.retrievedAt, "worldbank")
            }
          />
        }
      >
        Economy
      </SectionTitle>
      {readings.length === 0 ? (
        <NoDataAvailable
          title={
            macro.data === null
              ? "World Bank has not returned a reading"
              : "World Bank publishes no series for this economy"
          }
          reason={
            macro.problem ??
            "These are the World Bank's own annual national-account and development indicators, as reported by the member economy. Where the Bank leaves a year empty, the year stays empty here."
          }
        />
      ) : (
        <ul className="divide-y divide-[var(--exec-hairline)]">
          {readings.map(([key, { latest, history }]) => {
            const first = history[0]?.value;
            const delta = first !== undefined ? latest.value - first : null;
            return (
              <li key={key} className="px-3 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[12px] text-[var(--exec-ink)]">{latest.label}</span>
                  <span className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
                    {latest.period}
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="exec-num text-[15px] font-bold text-[var(--exec-ink)]">
                    {latest.value.toFixed(2)}
                    {latest.unit ? ` ${latest.unit}` : ""}
                  </span>
                  {delta !== null ? (
                    <span
                      className="exec-num text-[12px]"
                      style={{
                        color: delta >= 0 ? "var(--exec-emerald)" : "var(--exec-crimson)",
                      }}
                    >
                      {delta >= 0 ? "+" : ""}
                      {delta.toFixed(2)} since {history[0].period}
                    </span>
                  ) : null}
                  <BasisTag basis="observed" className="ml-auto" />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function EnergyTab({ nodeId }: { nodeId: string }) {
  const profile = useQuery(api.intel.countryProfile, { nodeId });
  const energy = profile?.country?.energy ?? [];
  if (energy.length === 0) {
    return (
      <NoDataAvailable
        title="No energy mix published for this node"
        reason="The structural reference layer carries an energy mix for tracked economies only. Chokepoints and corridors have none, and none is invented for them."
      />
    );
  }
  return (
    <div>
      <SectionTitle meta="structural parameter" right={<BasisTag basis="model" />}>
        Energy
      </SectionTitle>
      {energy.map((e) => (
        <div key={e.source} className="border-b border-[var(--exec-hairline)] px-3 py-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12px] text-[var(--exec-ink)]">{e.source}</span>
            <span className="exec-num text-[12px] font-semibold text-[var(--exec-ink)]">
              {pct(e.share)}
            </span>
          </div>
          <div className="mt-1.5 h-1 w-full bg-[var(--exec-hairline)]">
            <div
              className="h-full"
              style={{
                width: pct(e.share),
                background: "var(--exec-cyan)",
              }}
            />
          </div>
          <p className="exec-label mt-1 normal-case">{e.note}</p>
        </div>
      ))}
      <Row
        label="Energy import dependence"
        value={pct(profile?.country?.macro.energyImportDependence ?? 0)}
      />
      <Row
        label="External buffer capacity"
        value={pct(profile?.country?.macro.externalBuffer ?? 0)}
      />
    </div>
  );
}

function CompaniesTab() {
  return (
    <NoDataAvailable
      title="Company-level data is not connected"
      reason="GlobalMatrix models exposure at the level of countries, chokepoints and industries. No filings database, registry or supply-chain disclosure feed is connected to this build, so there is no company figure to show here — and a plausible-looking one would be invented."
      hint={
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
          What is measurable today: industry exposure, the countries that carry it,
          and the events that drive it. Open Industries to see the same
          propagation at sector level.
        </p>
      }
    />
  );
}

function SupplyTab({ nodeId }: { nodeId: string }) {
  const profile = useQuery(api.intel.countryProfile, { nodeId });
  const industries = profile?.industries ?? [];
  const peers = profile?.peers ?? [];
  const dependents = profile?.dependents ?? [];

  return (
    <div>
      <SectionTitle meta="structural" right={<BasisTag basis="model" />}>
        Supply chains
      </SectionTitle>
      <div className="px-3 py-2">
        <p className="exec-label mb-1.5">Industries carried by this node</p>
        {industries.length === 0 ? (
          <p className="text-[13px] text-[var(--exec-ink-dim)]">
            No industry declares this node in its structure.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {industries.slice(0, 8).map((i) => (
              <li key={i.id} className="flex items-center gap-2">
                <Link
                  to={`/app/industry/${i.id}`}
                  className="min-w-0 flex-1 truncate text-[13px] text-[var(--exec-ink)] hover:underline"
                >
                  {i.label}
                </Link>
                <span className="h-1 w-16 bg-[var(--exec-hairline)]">
                  <span
                    className="block h-full"
                    style={{ width: pct(i.live), background: loadColour(i.live) }}
                  />
                </span>
                <span className="exec-num w-9 text-right text-[12px] text-[var(--exec-ink-dim)]">
                  {pct(i.live)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="px-3 py-2">
        <p className="exec-label mb-1.5">Depends on</p>
        {peers.length === 0 ? (
          <p className="text-[13px] text-[var(--exec-ink-dim)]">
            No structural dependency declared.
          </p>
        ) : (
          peers.slice(0, 6).map((p) => (
            <Row
              key={p.nodeId}
              label={p.label}
              hint={p.basis}
              value={p.strength.toFixed(2)}
            />
          ))
        )}
      </div>
      <div className="px-3 py-2">
        <p className="exec-label mb-1.5">Depended on by</p>
        {dependents.length === 0 ? (
          <p className="text-[13px] text-[var(--exec-ink-dim)]">
            No tracked economy declares a strong dependency on this node.
          </p>
        ) : (
          dependents.slice(0, 6).map((d) => (
            <Row
              key={d.nodeId}
              label={d.label}
              hint={d.basis}
              value={d.strength.toFixed(2)}
            />
          ))
        )}
      </div>
    </div>
  );
}

const POLICY_TAG =
  /export control|tariff|sanction|carbon|regulation|industrial policy/i;

function PolicyTab({ nodeId }: { nodeId: string }) {
  const profile = useQuery(api.intel.countryProfile, { nodeId });
  const tagged = (profile?.exposure.contributions ?? []).filter((c) =>
    POLICY_TAG.test(c.title),
  );
  const events = useQuery(api.intel.detectionFeed, {});

  const policyEvents = (events?.rows ?? []).filter(
    (r) =>
      r.topNodes.some((n) => n.nodeId === nodeId) ||
      r.tags.some((t) => POLICY_TAG.test(t)),
  );

  return (
    <div>
      <SectionTitle meta="from corpus tags" right={<BasisTag basis="scenario" />}>
        Policy
      </SectionTitle>
      {policyEvents.length === 0 ? (
        <NoDataAvailable
          title="No policy-linked event reaches this node"
          reason="No policy registry with lifecycle status is connected, so this module reads policy relevance from the corpus's own event tags. Nothing matching has been found for this node — which is a finding, not a gap."
        />
      ) : (
        <ul className="divide-y divide-[var(--exec-hairline)]">
          {policyEvents.slice(0, 10).map((e) => (
            <li key={e.id}>
              <Link
                to={`/app/event/${e.id}`}
                className="block px-3 py-2 transition-colors hover:bg-[var(--exec-surface-strong)]"
              >
                <p className="line-clamp-2 text-[12px] leading-snug text-[var(--exec-ink)]">
                  {e.title}
                </p>
                <p className="exec-label mt-1">
                  {e.stage} · {e.tags.filter((t) => POLICY_TAG.test(t)).join(" · ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {tagged.length > 0 ? (
        <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[12px] text-[var(--exec-ink-dim)]">
          {tagged.length} contribution(s) on this node come from a
          policy-tagged event.
        </p>
      ) : null}
    </div>
  );
}

function MarketsTab() {
  return (
    <NoDataAvailable
      title="No market price feed is connected"
      reason="FX, rates, commodity futures and volatility all require a price feed. None is connected to this build, so no level, change or return is shown. GlobalMatrix does not fill a markets panel with modelled placeholders, because a price that is not a price is worse than no price."
      hint={
        <p className="mt-2 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
          The macro figures that *are* connected — reported growth, reported trade
          totals — appear under Economy and Trade, each with its publisher and
          reference period.
        </p>
      }
    />
  );
}

function RiskTab({
  nodeId,
  pressure,
}: {
  nodeId: string;
  pressure: Partial<Record<Channel, number>>;
}) {
  const profile = useQuery(api.intel.countryProfile, { nodeId });
  const exposure = profile?.exposure;
  const peak = Math.max(...Object.values(pressure).map((v) => v ?? 0), 0.01);

  return (
    <div>
      <SectionTitle meta="MODEL OUTPUT" right={<BasisTag basis="model" />}>
        Risk
      </SectionTitle>
      <div className="px-3 py-2">
        <p className="exec-label mb-2">Channel pressure relative to this node's own peak</p>
        {(Object.keys(pressure) as Channel[]).map((channel) => {
          const value = pressure[channel] ?? 0;
          return (
            <div key={channel} className="mb-1.5 flex items-center gap-2">
              <span className="w-24 shrink-0 text-[12px] text-[var(--exec-ink-dim)]">
                {CHANNEL_LABEL[channel]}
              </span>
              <span className="h-1.5 flex-1 bg-[var(--exec-hairline)]">
                <span
                  className="block h-full transition-[width] duration-500"
                  style={{ width: pct(value / peak), background: loadColour(value) }}
                />
              </span>
              <span className="exec-num w-10 shrink-0 text-right text-[12px] text-[var(--exec-ink)]">
                {pct(value)}
              </span>
            </div>
          );
        })}
      </div>
      <Row label="Blended exposure" value={pct(exposure?.load ?? 0)} tone={loadColour(exposure?.load ?? 0)} />
      <Row
        label="Structural fragility"
        hint="modelled parameter, not a probability"
        value={pct(profile?.country?.structuralFragility ?? 0)}
        tone="var(--exec-amber)"
      />
      <Row label="Network criticality" value={(profile?.node.criticality ?? 0).toFixed(2)} />
      <Row label="Mean model uncertainty" value="see the event analysis" />
      <p className="border-t border-[var(--exec-hairline)] px-3 py-2 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
        Every figure in this module is GlobalMatrix model output derived from the
        scenario corpus. None of it is an observed measurement, and none of it is
        a sovereign-risk probability.
      </p>
    </div>
  );
}
