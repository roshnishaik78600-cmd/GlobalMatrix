import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Radio } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel, Skeleton } from "@/components/viz/core";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { SourceTag } from "@/components/viz/Provenance";
import { useHeadlinesData } from "@/hooks/use-verified-data";
import { sourceById } from "@/lib/sources";
import { WINDOW_MS, useFocus, type TimeWindow } from "@/lib/focus";
import { cn } from "@/lib/utils";

/**
 * What changed, and when.
 *
 * Every entry here is timestamped by the moment the data actually arrived: a
 * connector writing a reading, or a publisher stamping an article. Nothing is
 * invented to fill a quiet hour — if the last hour was quiet, the panel says so
 * and tells the reader which sources it watches.
 */

const WINDOWS: TimeWindow[] = ["1h", "6h", "24h", "7d"];

/** GDELT stamps look like 20261002T080000Z. */
function parseStamp(stamp: string): number {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/.exec(stamp);
  if (!m) return NaN;
  return Date.UTC(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5]),
    Number(m[6]),
  );
}

function ago(ms: number): string {
  const minutes = Math.round((Date.now() - ms) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

interface Change {
  id: string;
  at: number;
  title: string;
  detail: string;
  sourceId: string;
  href?: string;
}

export function ChangeTimeline({ className }: { className?: string }) {
  const { window: windowId, setWindow } = useFocus();
  const health = useQuery(api.observations.sourceHealth);
  const headlines = useHeadlinesData();

  // Fixed once per mount so the render itself stays pure; the windows are
  // short enough that a minute of staleness changes nothing a reader sees.
  const [mountedAt] = useState(() => Date.now());
  const cutoff = mountedAt - WINDOW_MS[windowId];

  const changes = useMemo<Change[]>(() => {
    const out: Change[] = [];

    // Source-level: a connector produced a fresh set of readings.
    for (const row of health ?? []) {
      if (row.retrievedAt < cutoff) continue;
      const source = sourceById(row.sourceId);
      out.push({
        id: `src-${row.sourceId}`,
        at: row.retrievedAt,
        title: row.ok
          ? `${source?.label ?? row.sourceId} readings refreshed`
          : `${source?.label ?? row.sourceId} refresh failed`,
        detail: row.ok
          ? `as of ${row.asOf || "the latest published period"}`
          : (row.problem ?? "The source did not answer."),
        sourceId: row.sourceId,
      });
    }

    // Article-level: coverage stamped with its own publication time.
    for (const item of headlines.data ?? []) {
      const at = parseStamp(item.seenAt);
      if (!Number.isFinite(at) || at < cutoff) continue;
      out.push({
        id: `hl-${item.key}`,
        at,
        title: item.title,
        detail: item.domain,
        sourceId: "gdelt",
        href: item.url,
      });
    }

    return out.sort((a, b) => b.at - a.at).slice(0, 24);
  }, [health, headlines.data, cutoff]);

  const watched = (health ?? []).length;

  return (
    <Panel
      title="What's changing"
      meta={changes.length > 0 ? `${changes.length} in the last ${windowId}` : undefined}
      className={cn("min-w-0", className)}
    >
      <div className="flex flex-wrap items-center gap-1.5 border-b border-rule px-3 py-2">
        {WINDOWS.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => setWindow(w)}
            aria-pressed={w === windowId}
            className={cn(
              "chip transition-colors",
              w === windowId
                ? "border-signal text-signal"
                : "border-rule text-muted-foreground hover:text-foreground",
            )}
          >
            {w}
          </button>
        ))}
        <span className="label ml-auto flex items-center gap-1.5 text-muted-foreground">
          <Radio
            className={cn("size-3", changes.length > 0 && "text-stable")}
            aria-hidden
          />
          {watched} sources watched
        </span>
      </div>

      {health === undefined ? (
        <Skeleton className="m-3 h-40 w-full" />
      ) : changes.length === 0 ? (
        <div className="p-4">
          <p className="flex items-center gap-2 text-[13px] font-medium">
            <Radio className="size-3.5 text-muted-foreground" aria-hidden />
            Nothing new in the last {windowId}.
          </p>
          <p className="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground">
            That is a real reading, not a gap: GlobalMatrix only reports a change
            when a connected source publishes or returns something new. Open the
            sources page to see what is being watched and when it last answered.
          </p>
        </div>
      ) : (
        <ul className="max-h-[380px] divide-y divide-rule overflow-y-auto">
          {changes.map((c) => {
            const body = (
              <>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="line-clamp-2 text-[12px] leading-snug">{c.title}</span>
                  <span className="num shrink-0 text-[12px] text-muted-foreground">
                    {ago(c.at)}
                  </span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <SourceTag sourceId={c.sourceId} />
                  <span className="truncate text-[12px] text-muted-foreground">
                    {c.detail}
                  </span>
                </div>
              </>
            );
            return (
              <li key={c.id}>
                {c.href ? (
                  <a
                    href={c.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block px-3 py-2.5 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    {body}
                  </a>
                ) : (
                  <div className="px-3 py-2.5">{body}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {watched === 0 ? (
        <div className="border-t border-rule">
          <NoVerifiedData
            title="Live change"
            domain="connected source feeds"
          />
        </div>
      ) : null}
    </Panel>
  );
}