import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { ChevronDown, Compass, Radar as RadarIcon } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useFocus } from "@/lib/focus";
import { CountryCard, RegionSummary, type ExecCountry } from "@/components/viz/exec/CountryCard";
import {
  ExecFilters,
  ExecIconLink,
  ExecLegend,
  ExecStat,
  ExecStatusBar,
} from "@/components/viz/exec/ExecStatusBar";
import { QuestionStrip } from "@/components/viz/Unavailable";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import {
  DataType,
  FilterBar,
  PageFrame,
  PageLoading,
} from "@/components/viz/exec/design";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Countries view — executive density.
 *
 * One board, three questions per card: how exposed is this place, in what
 * shape, and what is the structural fragility underneath it. Everything is
 * derived from the same exposure model as the rest of the console and every
 * card carries its own drill-down; nothing is summarised away and nothing is
 * invented to fill a column.
 */
export default function Countries() {
  const directory = useQuery(api.intel.countryDirectory);
  const trends = useQuery(api.intel.countryTrends);
  const navigate = useNavigate();
  const { toggle } = useFocus();

  const [region, setRegion] = useState<string | null>(null);
  const [watchedOnly, setWatchedOnly] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const trendByNode = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const row of trends?.nodes ?? []) map.set(row.nodeId, row.values);
    return map;
  }, [trends]);

  const countries: ExecCountry[] = useMemo(() => {
    if (!directory) return [];
    return directory.countries.map((c) => ({
      nodeId: c.nodeId,
      label: c.label,
      short: c.short,
      region: c.region,
      load: c.load,
      fragility: c.fragility,
      eventCount: c.eventCount,
      offAffinityCount: c.offAffinityCount,
      topChannel: c.topChannel as Channel,
      watched: c.watched,
      byChannel: c.byChannel as { channel: Channel; load: number }[],
      trend: trendByNode.get(c.nodeId),
    }));
  }, [directory, trendByNode]);

  const corridors = useMemo(
    () => (directory?.corridors ?? []).filter((c) => c.kind !== "institution"),
    [directory],
  );

  const regions = useMemo(
    () => [...new Set(countries.map((c) => c.region))].sort(),
    [countries],
  );

  const visible = useMemo(
    () =>
      countries.filter(
        (c) => (!region || c.region === region) && (!watchedOnly || c.watched),
      ),
    [countries, region, watchedOnly],
  );

  const groups = useMemo(
    () =>
      regions
        .map((r) => {
          const rows = visible.filter((c) => c.region === r);
          const localCorridors = corridors.filter((c) => c.region === r);
          return {
            region: r,
            rows,
            corridorCount: localCorridors.length,
            corridorLoad:
              localCorridors.length > 0
                ? localCorridors.reduce((s, c) => s + c.load, 0) /
                  localCorridors.length
                : 0,
          };
        })
        .filter((g) => g.rows.length > 0),
    [regions, visible, corridors],
  );

  if (!directory) {
    return (
      <PageLoading
        eyebrow="Countries"
        title="Sovereign risk intelligence"
        lede="Every tracked economy and the infrastructure it depends on, ranked by derived exposure."
      />
    );
  }

  const watchCount = directory.watchlistSize;
  const hottest = countries[0];
  const mostFragile = [...countries].sort((a, b) => b.fragility - a.fragility)[0];
  const busiestChannel = (
    ["trade", "energy", "finance", "diplomatic"] as Channel[]
  )
    .map((channel) => ({
      channel,
      value:
        countries.reduce((s, c) => s + (c.byChannel.find((x) => x.channel === channel)?.load ?? 0), 0) /
        Math.max(1, countries.length),
    }))
    .sort((a, b) => b.value - a.value)[0];
  const stressedCorridor = [...corridors].sort((a, b) => b.load - a.load)[0];

  // The persistent system bar above already carries live source state, search
  // and the global map layer, so this page contributes only its own filters
  // rather than a second command bar.
  return (
    <PageFrame
      eyebrow="Countries"
      title="Sovereign risk intelligence"
      lede="Every tracked economy and the infrastructure it depends on, ranked by derived exposure."
      actions={
        <>
          <DataType type="scenario" />
          <ExecStatusBar countryCount={countries.length} />
        </>
      }
      controls={
        <FilterBar>
        <ExecFilters
          regions={regions}
          region={region}
          onRegion={setRegion}
          watchedOnly={watchedOnly}
          onWatched={setWatchedOnly}
          watchCount={watchCount}
          onSearch={() =>
            // The shell owns the palette; this is the same path the
            // keyboard shortcut takes.
            window.dispatchEvent(new CustomEvent("gm:open-search"))
          }
        />
        <div className="flex flex-wrap items-center gap-2">
          <ExecIconLink
            to="/app/chain"
            label="Event → world"
            icon={<Compass className="size-3.5" />}
          />
          <ExecIconLink
            to="/app/risk"
            label="Risk board"
            icon={<RadarIcon className="size-3.5" />}
          />
        </div>
        </FilterBar>
      }
    >

      {/* Plain-language orientation */}
      <QuestionStrip
        className="border-b border-[var(--exec-hairline)] [&_*]:text-[var(--exec-ink)] [&_.label]:text-[var(--exec-ink-dim)]"
        answers={[
          {
            q: "What's happening?",
            a: hottest
              ? `${hottest.label} carries the most live exposure at ${pct(hottest.load)}.`
              : "No country exposure resolved.",
            href: hottest ? `/app/country/${hottest.nodeId}` : undefined,
          },
          {
            q: "What's most fragile?",
            a: mostFragile
              ? `${mostFragile.label} at ${pct(mostFragile.fragility)} structural fragility.`
              : "No fragility profile resolved.",
            href: mostFragile ? `/app/country/${mostFragile.nodeId}` : undefined,
          },
          {
            q: "Which channel dominates?",
            a: busiestChannel
              ? `${CHANNEL_LABEL[busiestChannel.channel]} at ${pct(
                  busiestChannel.value,
                )} mean exposure.`
              : "No channel pressure resolved.",
            href: "/app/risk",
          },
          {
            q: "Where is it pressing?",
            a: stressedCorridor
              ? `${stressedCorridor.label} is the most stressed corridor at ${pct(
                  stressedCorridor.load,
                )}.`
              : "No corridor load resolved.",
            href: stressedCorridor ? `/app/country/${stressedCorridor.nodeId}` : undefined,
          },
          {
            q: "Show evidence",
            a: "Open any card for reported growth and trade, each with its source.",
            href: "/app/data",
          },
        ]}
      />

      {/* Board summary tiles */}
      <section className="grid grid-cols-2 gap-2 px-4 py-3 lg:grid-cols-5">
        <ExecStat
          label="Economies tracked"
          value={String(countries.length)}
          note={`${corridors.length} corridors and rails`}
        />
        <ExecStat
          label="Highest exposure"
          value={hottest ? pct(hottest.load) : "—"}
          tone="var(--exec-crimson)"
          note={hottest?.label}
        />
        <ExecStat
          label="Mean fragility"
          value={pct(
            countries.reduce((s, c) => s + c.fragility, 0) /
              Math.max(1, countries.length),
          )}
          tone="var(--exec-amber)"
          note="structural parameter"
        />
        <ExecStat
          label="Events in corpus"
          value={String(
            new Set(corridors.map((c) => c.eventCount)).size > 0
              ? countries.reduce((s, c) => s + c.eventCount, 0)
              : 0,
          )}
          note="event arrivals summed"
        />
        <ExecStat
          label="Off-channel arrivals"
          value={String(
            countries.reduce((s, c) => s + c.offAffinityCount, 0),
          )}
          tone="var(--exec-cyan)"
          note="shocks arriving off the expected channel"
        />
      </section>

      {/* Regional boards */}
      <div className="space-y-4 px-4 pb-8">
        {groups.length === 0 ? (
          <div className="glass p-4">
            <NoVerifiedData
              title="Countries"
              domain="a country exposure profile matching this filter"
            />
          </div>
        ) : null}

        {groups.map((group) => {
          const isCollapsed = collapsed[group.region] ?? false;
          return (
            <section key={group.region} className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <RegionSummary
                  region={group.region}
                  rows={group.rows}
                  corridorCount={group.corridorCount}
                  corridorLoad={group.corridorLoad}
                />
                <button
                  type="button"
                  onClick={() =>
                    setCollapsed((prev) => ({
                      ...prev,
                      [group.region]: !isCollapsed,
                    }))
                  }
                  aria-expanded={!isCollapsed}
                  className="glass glass-hover flex h-7 items-center gap-1.5 px-2"
                >
                  <span className="exec-label">
                    {isCollapsed ? "Expand" : "Collapse"}
                  </span>
                  <ChevronDown
                    className={cn(
                      "size-3 transition-transform",
                      isCollapsed && "-rotate-90",
                    )}
                    aria-hidden
                  />
                </button>
              </div>

              {!isCollapsed ? (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {group.rows.map((row, i) => (
                    <CountryCard key={row.nodeId} row={row} index={i} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        {/* Infrastructure: the layer countries depend on but are not. */}
        {corridors.length > 0 ? (
          <section className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <div className="glass flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
                <span className="exec-label">Chokepoints &amp; corridors</span>
                <span className="exec-num text-[12px] font-semibold text-[var(--exec-ink)]">
                  {corridors.length} nodes
                </span>
                <span className="exec-label">
                  Transmit shocks rather than absorbing them
                </span>
              </div>
              <ExecLegend />
            </div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {corridors.map((c) => (
                <button
                  key={c.nodeId}
                  type="button"
                  onClick={() => toggle({ kind: "node", id: c.nodeId })}
                  onDoubleClick={() => navigate(`/app/country/${c.nodeId}`)}
                  className="glass glass-hover flex items-center gap-3 px-3 py-2 text-left"
                >
                  <span className="exec-num w-9 shrink-0 text-[11px] font-bold text-[var(--exec-cyan)]">
                    {c.short}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-[var(--exec-ink)]">
                      {c.label}
                    </span>
                    <span className="exec-label mt-0.5 block truncate">
                      {c.region} · {c.eventCount} events
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span
                      className="exec-num block text-[14px] leading-none font-bold"
                      style={{
                        color:
                          c.load >= 0.75
                            ? "var(--exec-crimson)"
                            : c.load >= 0.4
                              ? "var(--exec-amber)"
                              : "var(--exec-emerald)",
                      }}
                    >
                      {pct(c.load)}
                    </span>
                    <span className="exec-label mt-1 block">load</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {trends ? (
          <p className="exec-label max-w-3xl normal-case leading-relaxed">
            The 14-day trace on each card is corpus observation pressure for that
            node, measured over the last 14 days of the corpus timeline
            (latest observation {trends.latest}). It is scenario material, not a
            live news feed, and it is labelled as such wherever it appears.
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link
            to="/app/data"
            className="exec-label transition-colors hover:text-[var(--exec-ink)]"
          >
            Source register &amp; freshness →
          </Link>
          <span className="exec-label">
            Click a card to inspect · double-click to open the profile · Esc clears
          </span>
        </div>
      </div>
    </PageFrame>
  );
}