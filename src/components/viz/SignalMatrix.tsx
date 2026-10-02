import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel, Skeleton } from "@/components/viz/core";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { StatusBadge, SourceLine } from "@/components/viz/Provenance";
import { macroSeries, useMacroData } from "@/hooks/use-verified-data";
import { useFocus } from "@/lib/focus";
import { CHANNEL_LABEL } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";
import { cn } from "@/lib/utils";

/**
 * Six signals, side by side, for every tracked economy.
 *
 * Five columns are this model's output and are labelled Model. The sixth —
 * reported economic growth — is a World Bank figure and is labelled Observed,
 * because the whole point of the table is that a reader can tell the two apart
 * at a glance. Where the Bank publishes no reading the cell stays empty rather
 * than borrowing a neighbouring number.
 */

type ColumnId =
  | "geopolitical"
  | "trade"
  | "energy"
  | "supply"
  | "market"
  | "economic";

const COLUMNS: {
  id: ColumnId;
  label: string;
  basis: string;
  observed?: boolean;
}[] = [
  { id: "geopolitical", label: "Geopolitical", basis: "Diplomatic channel load" },
  { id: "trade", label: "Trade", basis: "Trade channel load" },
  { id: "energy", label: "Energy", basis: "Energy channel load" },
  { id: "supply", label: "Supply chain", basis: "Load arriving via loaded corridors" },
  { id: "market", label: "Market", basis: "Finance channel load" },
  {
    id: "economic",
    label: "Economic",
    basis: "Reported real GDP growth",
    observed: true,
  },
];

export function SignalMatrix({ className }: { className?: string }) {
  const matrix = useQuery(api.intel.signalMatrix);
  const macro = useMacroData();
  const { focus, toggle, isFocused } = useFocus();
  const [sort, setSort] = useState<ColumnId | "overall">("overall");

  const growth = useMemo(
    () => (macro.data ? macroSeries(macro.data) : new Map()),
    [macro.data],
  );

  const rows = matrix?.rows ?? [];

  /** A focused country stays visible and pinned to the top of the ranking. */
  const focused = focus?.kind === "node" ? focus.id : null;

  const sorted = useMemo(() => {
    const copy = [...rows];
    if (sort === "economic") {
      copy.sort((a, b) => {
        const av = growth.get(`${a.nodeId}:gdpGrowth`)?.latest.value;
        const bv = growth.get(`${b.nodeId}:gdpGrowth`)?.latest.value;
        if (av === undefined) return 1;
        if (bv === undefined) return -1;
        return bv - av;
      });
    } else if (sort === "overall") {
      copy.sort((a, b) => b.overall - a.overall);
    } else {
      copy.sort((a, b) => b[sort] - a[sort]);
    }
    return copy;
  }, [rows, sort, growth]);

  const ordered = focused
    ? [
        ...sorted.filter((r) => r.nodeId === focused),
        ...sorted.filter((r) => r.nodeId !== focused),
      ]
    : sorted;

  if (!matrix) {
    return (
      <Panel title="Risk across six signals" meta="model vs reported" className={className}>
        <Skeleton className="m-3 h-64 w-full" />
      </Panel>
    );
  }

  const reportingPeriod = growth.size > 0
    ? [...growth.values()][0].latest.period
    : "";

  return (
    <Panel
      title="Risk across six signals"
      meta={`${rows.length} economies · model vs reported`}
      className={cn("min-w-0", className)}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-rule px-3 py-2">
        <span className="label text-muted-foreground">Rank by</span>
        <SortChip active={sort === "overall"} onClick={() => setSort("overall")}>
          Overall
        </SortChip>
        {COLUMNS.map((c) => (
          <SortChip key={c.id} active={sort === c.id} onClick={() => setSort(c.id)}>
            {c.label}
          </SortChip>
        ))}
      </div>

      {/* The grid scrolls inside its own panel so it can never widen the page. */}
      <div className="min-w-0 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th className="label sticky left-0 z-10 bg-card px-3 py-2 text-left text-muted-foreground">
                Economy
              </th>
              {COLUMNS.map((c) => (
                <th key={c.id} className="px-1.5 py-2 align-bottom">
                  <span className="label block text-foreground/85">{c.label}</span>
                  <span className="label mt-1 block text-[8.5px] leading-tight font-normal tracking-normal normal-case text-muted-foreground">
                    {c.basis}
                  </span>
                  <span className="mt-1 flex justify-center">
                    <StatusBadge status={c.observed ? "observed" : "model"} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const observed = growth.get(`${row.nodeId}:gdpGrowth`);
              const active = isFocused("node", row.nodeId);
              return (
                <tr
                  key={row.nodeId}
                  className={cn(
                    "border-t border-rule transition-colors",
                    active && "bg-signal/10",
                    focus && !active && "opacity-60",
                  )}
                >
                  <th className="sticky left-0 z-10 bg-card px-3 py-1.5 text-left font-normal">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggle({ kind: "node", id: row.nodeId })}
                        aria-pressed={active}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left transition-colors hover:text-signal"
                      >
                        <span className="num w-7 shrink-0 text-[10px] text-muted-foreground">
                          {row.short}
                        </span>
                        <span className="min-w-0 truncate text-[12px]">{row.label}</span>
                      </button>
                      <Link
                        to={`/app/country/${row.nodeId}`}
                        title={`Open ${row.label}`}
                        className="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ArrowUpRight className="size-3" />
                      </Link>
                    </div>
                  </th>

                  {COLUMNS.filter((c) => !c.observed).map((c) => {
                    const value = row[c.id as Exclude<ColumnId, "economic">];
                    return (
                      <td key={c.id} className="px-1.5 py-1.5">
                        <RiskCell value={value} label={`${row.label} · ${c.label}`} />
                      </td>
                    );
                  })}

                  <td className="px-1.5 py-1.5">
                    {observed ? (
                      <span
                        className="num block text-center text-[11.5px] font-semibold"
                        style={{
                          color:
                            observed.latest.value >= 0
                              ? "var(--stable)"
                              : "var(--critical)",
                        }}
                        title={`Reported growth in ${observed.latest.period}`}
                      >
                        {observed.latest.value.toFixed(1)}%
                      </span>
                    ) : (
                      <span
                        className="block h-4 w-full min-w-[42px] rounded-none border border-dashed border-rule"
                        title="No World Bank reading for this economy"
                        aria-label="No reported figure"
                      />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="space-y-2 border-t border-rule px-3 py-2">
        <div className="flex items-center gap-4">
          <span className="label flex items-center gap-1.5 text-muted-foreground">
            <span
              className="inline-block h-2.5 w-4"
              style={{
                background: `linear-gradient(90deg, color-mix(in oklch, var(--stable) 15%, transparent), var(--signal))`,
              }}
            />
            Load
          </span>
          <span className="label flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2.5 w-4 border border-dashed border-rule" />
            No reported figure
          </span>
        </div>
        {macro.data && reportingPeriod ? (
          <SourceLine
            provenance={{
              sourceId: "worldbank",
              asOf: reportingPeriod,
              retrievedAt: macro.retrievedAt,
              status: "observed",
            }}
          />
        ) : (
          <NoVerifiedData
            title="Reported growth"
            domain="World Bank macro readings"
            className="p-0"
          />
        )}
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          {COLUMNS.filter((c) => !c.observed).map((c) => c.label).join(", ")} are
          this model&apos;s own load on each channel for that economy.{" "}
          {CHANNEL_LABEL.finance} carries the Market column. Economic growth is
          reported, not modelled, and growth is a direction — a high number is
          not the same kind of thing as a high risk score.
        </p>
      </div>
    </Panel>
  );
}

function SortChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "chip transition-colors",
        active
          ? "border-signal text-signal"
          : "border-rule text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function RiskCell({ value, label }: { value: number; label: string }) {
  const intensity = 12 + value * 70;
  return (
    <span
      className="flex h-5 min-w-[42px] items-center justify-center"
      title={`${label}: ${(value * 100).toFixed(0)}% load`}
    >
      <span
        className="block h-4 w-full"
        style={{
          backgroundColor:
            value <= 0.001
              ? "transparent"
              : `color-mix(in oklch, ${riskColorForScore(value * 100)} ${Math.round(
                  intensity,
                )}%, transparent)`,
          border:
            value <= 0.001
              ? "1px dashed color-mix(in oklch, var(--rule) 100%, transparent)"
              : "none",
        }}
      />
    </span>
  );
}