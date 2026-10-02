import { Link, useNavigate } from "react-router";
import { motion } from "framer-motion";
import { ArrowUpRight, Bookmark, BookmarkCheck } from "lucide-react";
import { NodeRiskRadar, RadarLegend } from "@/components/viz/exec/NodeRiskRadar";
import { FragilityArc } from "@/components/viz/exec/FragilityArc";
import { StatusBadge } from "@/components/viz/Provenance";
import { useToggleWatch } from "@/hooks/use-auth-action";
import { useFocus } from "@/lib/focus";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * One country, at executive density.
 *
 * Radar, fragility dial, event pills and alert ring all read from the same
 * numbers — nothing here is decoration, and the ring colour is a band, not an
 * effect. Hover raises the card, click inspects it in the shared drawer, and
 * the chevron opens the full profile.
 */

export interface ExecCountry {
  nodeId: string;
  label: string;
  short: string;
  region: string;
  load: number;
  fragility: number;
  eventCount: number;
  offAffinityCount: number;
  topChannel: Channel;
  watched: boolean;
  byChannel: { channel: Channel; load: number }[];
  /** Daily corpus pressure, oldest first. Absent when no series exists. */
  trend?: number[];
}

export function CountryCard({
  row,
  index = 0,
}: {
  row: ExecCountry;
  index?: number;
}) {
  const toggleWatch = useToggleWatch();
  const navigate = useNavigate();
  const { toggle, isFocused } = useFocus();
  const focused = isFocused("node", row.nodeId);

  // Alert ring only where live load is genuinely in the top of the range; it
  // must mean something, so it is not applied to everything.
  const alert = row.load >= 0.55;
  const ringColour = row.load >= 0.75 ? "var(--exec-crimson)" : "var(--exec-amber)";

  const pressure = Object.fromEntries(
    row.byChannel.map((c) => [c.channel, c.load]),
  ) as Partial<Record<Channel, number>>;

  return (
    <motion.article
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.025, 0.24) }}
      role="button"
      tabIndex={0}
      onClick={() => toggle({ kind: "node", id: row.nodeId })}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          toggle({ kind: "node", id: row.nodeId });
        }
      }}
      onDoubleClick={() => navigate(`/app/country/${row.nodeId}`)}
      style={alert ? ({ "--ring-color": ringColour } as Record<string, string>) : undefined}
      className={cn(
        "glass glass-hover group relative flex cursor-pointer flex-col gap-3 p-3 focus-visible:outline-none",
        alert && "alert-ring",
        focused && "border-[var(--exec-cyan)]/60",
      )}
    >
      {/* Identity */}
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="exec-num text-[11px] font-bold tracking-[0.08em] text-[var(--exec-cyan)]">
              {row.short}
            </span>
            <h3 className="truncate text-[13.5px] leading-tight font-semibold text-[var(--exec-ink)]">
              {row.label}
            </h3>
          </div>
          <p className="exec-label mt-1 truncate">
            {row.region} · dominant {CHANNEL_LABEL[row.topChannel]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            aria-label={row.watched ? "Remove from watchlist" : "Add to watchlist"}
            onClick={(e) => {
              e.stopPropagation();
              toggleWatch(`NODE:${row.nodeId}`);
            }}
            className="flex size-6 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
          >
            {row.watched ? (
              <BookmarkCheck className="size-3.5 text-[var(--exec-cyan)]" />
            ) : (
              <Bookmark className="size-3.5" />
            )}
          </button>
          <Link
            to={`/app/country/${row.nodeId}`}
            title={`Open the ${row.label} profile`}
            onClick={(e) => e.stopPropagation()}
            className="flex size-6 items-center justify-center text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
          >
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      {/* Load + fragility */}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="exec-label">Live load</p>
          <p
            className="exec-num mt-1 text-[22px] leading-none font-bold tracking-[-0.02em]"
            style={{
              color:
                row.load >= 0.75
                  ? "var(--exec-crimson)"
                  : row.load >= 0.4
                    ? "var(--exec-amber)"
                    : "var(--exec-emerald)",
            }}
          >
            {pct(row.load)}
          </p>
          <p className="exec-label mt-1.5">
            {row.eventCount} events · {row.offAffinityCount} off-channel
          </p>
        </div>
        <FragilityArc value={row.fragility} trend={row.trend} size={104} />
      </div>

      {/* Exposure shape */}
      <div className="flex items-center gap-3 border-t border-[var(--exec-hairline)] pt-2.5">
        <NodeRiskRadar pressure={pressure} size={96} />
        <RadarLegend pressure={pressure} className="min-w-0 flex-1" />
      </div>

      {/* Event pills */}
      <div className="flex flex-wrap items-center gap-1">
        {row.byChannel
          .filter((c) => c.load > 0.001)
          .sort((a, b) => b.load - a.load)
          .map((c) => (
            <span
              key={c.channel}
              title={`${CHANNEL_LABEL[c.channel]} exposure ${(c.load * 100).toFixed(0)}%`}
              className="exec-num inline-flex items-center gap-1 border border-[var(--exec-hairline)] bg-[var(--exec-surface)] px-1.5 py-0.5 text-[9px] font-semibold tracking-[0.06em] text-[var(--exec-ink-dim)]"
            >
              <span
                className="live-dot size-1 rounded-full"
                style={{
                  background:
                    c.load >= 0.6
                      ? "var(--exec-crimson)"
                      : c.load >= 0.3
                        ? "var(--exec-amber)"
                        : "var(--exec-cyan)",
                }}
              />
              {CHANNEL_LABEL[c.channel].toUpperCase()} {(c.load * 100).toFixed(0)}
            </span>
          ))}
        <StatusBadge status="model" className="ml-auto" />
      </div>
    </motion.article>
  );
}

/** Regional aggregate strip: load, count and the corridor pressure under it. */
export function RegionSummary({
  region,
  rows,
  corridorCount,
  corridorLoad,
}: {
  region: string;
  rows: ExecCountry[];
  corridorCount: number;
  corridorLoad: number;
}) {
  const load = rows.length > 0 ? rows.reduce((s, r) => s + r.load, 0) / rows.length : 0;
  const colour =
    load >= 0.6 ? "var(--exec-crimson)" : load >= 0.35 ? "var(--exec-amber)" : "var(--exec-emerald)";

  return (
    <div className="glass flex flex-wrap items-center gap-x-5 gap-y-2 px-3 py-2">
      <span className="exec-label">{region}</span>
      <span className="exec-num text-[12px] font-semibold text-[var(--exec-ink)]">
        {rows.length} tracked
      </span>
      <span className="flex items-center gap-1.5">
        <span className="exec-label">Mean load</span>
        <span className="exec-num text-[12px] font-bold" style={{ color: colour }}>
          {pct(load)}
        </span>
      </span>
      <span className="h-3 w-px bg-[var(--exec-hairline)]" />
      <span className="flex items-center gap-1.5">
        <span className="exec-label">Corridors</span>
        <span className="exec-num text-[12px] font-semibold text-[var(--exec-ink)]">
          {corridorCount}
        </span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="exec-label">Corridor stress</span>
        <span
          className="exec-num text-[12px] font-bold"
          style={{
            color:
              corridorLoad >= 0.6
                ? "var(--exec-crimson)"
                : corridorLoad >= 0.35
                  ? "var(--exec-amber)"
                  : "var(--exec-emerald)",
          }}
        >
          {pct(corridorLoad)}
        </span>
      </span>
    </div>
  );
}