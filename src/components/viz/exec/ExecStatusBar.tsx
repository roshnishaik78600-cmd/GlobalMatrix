import { Link } from "react-router";
import { useQuery } from "convex/react";
import { Activity, Boxes, Database, Globe2, Layers } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { CORPUS_VERSION } from "@/lib/intel/scenarios";
import { cn } from "@/lib/utils";

/**
 * The status bar above the board.
 *
 * Every figure is read from a query: how many connected sources are answering,
 * when the last one answered, and how much the corpus covers. Nothing here is
 * typed in by hand, and a quiet source shows as quiet rather than as zero.
 */

function Badge({
  label,
  value,
  dot,
  accent,
  title,
}: {
  label: string;
  value: string;
  dot?: string;
  accent?: string;
  title?: string;
}) {
  return (
    <span className="glass flex items-center gap-2 px-2.5 py-1.5" title={title}>
      <span className="exec-label whitespace-nowrap">{label}</span>
      <span className="exec-num text-[12px] font-bold whitespace-nowrap" style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {dot ? (
        <span
          className={cn("live-dot size-1.5 rounded-full", !accent && "live-dot")}
          style={{ background: dot }}
          aria-hidden
        />
      ) : null}
    </span>
  );
}

function timeAgo(ms: number): string {
  if (!ms) return "never";
  const minutes = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function ExecStatusBar({ countryCount }: { countryCount: number }) {
  const health = useQuery(api.observations.sourceHealth);
  const stats = useQuery(api.intel.corpusStats);

  const live = (health ?? []).filter((h) => h.ok).length;
  const total = health?.length ?? 0;
  const lastUpdate = (health ?? []).reduce((max, h) => Math.max(max, h.retrievedAt), 0);
  const liveColour = live > 0 ? "var(--exec-emerald)" : "var(--exec-ink-dim)";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge
        label="Live data"
        value={total === 0 ? "connecting" : `${live}/${total}`}
        dot={liveColour}
        title="Connected sources currently returning readings"
      />
      <Badge
        label="Last updated"
        value={timeAgo(lastUpdate)}
        title="When a connected source last answered"
      />
      <Badge label="Sources" value={String(total)} />
      <Badge label="Events" value={String(stats?.events ?? 0)} />
      <Badge label="Countries" value={String(countryCount)} />
      <Badge
        label="Scenario corpus"
        value={CORPUS_VERSION}
        accent="var(--exec-amber)"
        title="The event corpus is a scenario set, not a live feed"
      />
    </div>
  );
}

/** The board's own section navigation. */
export function ExecFilters({
  regions,
  region,
  onRegion,
  watchedOnly,
  onWatched,
  watchCount,
  onSearch,
}: {
  regions: string[];
  region: string | null;
  onRegion: (r: string | null) => void;
  watchedOnly: boolean;
  onWatched: (v: boolean) => void;
  watchCount: number;
  onSearch: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onSearch}
        className="glass glass-hover flex h-8 items-center gap-2 px-2.5 text-left"
        title="Search (⌘K)"
      >
        <span className="exec-label">Search</span>
        <kbd className="exec-num border border-[var(--exec-hairline)] px-1 text-[9px] text-[var(--exec-ink-dim)]">
          ⌘K
        </kbd>
      </button>

      <div className="flex flex-wrap items-center gap-1">
        <FilterChip active={region === null} onClick={() => onRegion(null)} icon={<Globe2 className="size-3" />}>
          All regions
        </FilterChip>
        {regions.map((r) => (
          <FilterChip
            key={r}
            active={region === r}
            onClick={() => onRegion(region === r ? null : r)}
          >
            {r}
          </FilterChip>
        ))}
        <FilterChip
          active={watchedOnly}
          onClick={() => onWatched(!watchedOnly)}
          icon={<Activity className="size-3" />}
          title={`${watchCount} tracked`}
        >
          Tracked {watchCount > 0 ? `(${watchCount})` : ""}
        </FilterChip>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  icon,
  title,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={title}
      className={cn(
        "flex h-7 items-center gap-1.5 border px-2 text-[11px] font-medium transition-colors",
        active
          ? "border-[var(--exec-cyan)]/70 bg-[color-mix(in_srgb,var(--exec-cyan)_12%,transparent)] text-[var(--exec-ink)]"
          : "border-[var(--exec-hairline)] text-[var(--exec-ink-dim)] hover:text-[var(--exec-ink)]",
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Compact legend for the board's encodings. */
export function ExecLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {[
        ["Live load", "var(--exec-cyan)"],
        ["Fragility · low", "var(--exec-emerald)"],
        ["Fragility · moderate", "var(--exec-amber)"],
        ["Fragility · high", "var(--exec-crimson)"],
      ].map(([label, colour]) => (
        <span key={label} className="flex items-center gap-1.5">
          <span className="size-2" style={{ background: colour }} aria-hidden />
          <span className="exec-label">{label}</span>
        </span>
      ))}
      <span className="exec-label flex items-center gap-1.5">
        <Layers className="size-3" aria-hidden />
        Radar = exposure shape · dial = fragility · trace = 14-day corpus pressure
      </span>
    </div>
  );
}

/** Small stat tiles used along the top of the board. */
export function ExecStat({
  label,
  value,
  tone,
  note,
}: {
  label: string;
  value: string;
  tone?: string;
  note?: string;
}) {
  return (
    <div className="glass px-3 py-2">
      <p className="exec-label">{label}</p>
      <p
        className="exec-num mt-1 text-[19px] leading-none font-bold tracking-[-0.02em]"
        style={{ color: tone ?? "var(--exec-ink)" }}
      >
        {value}
      </p>
      {note ? <p className="exec-label mt-1.5 normal-case">{note}</p> : null}
    </div>
  );
}

export function ExecIconLink({
  to,
  label,
  icon,
}: {
  to: string;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="glass glass-hover flex items-center gap-2 px-2.5 py-1.5"
    >
      <span className="text-[var(--exec-ink-dim)]">{icon}</span>
      <span className="exec-label">{label}</span>
    </Link>
  );
}

export { Boxes, Database };