import { Database, Info } from "lucide-react";
import {
  STATUS_HELP,
  STATUS_LABEL,
  formatAsOf,
  sourceById,
  type DataStatus,
  type Provenance,
} from "@/lib/sources";
import { timestamp } from "@/lib/format";

/**
 * Provenance chrome.
 *
 * Every verified figure on the site carries one of these. It is deliberately
 * small and quiet: the point is that a reader can always find out what a number
 * is and where it came from without having to read a paragraph about it.
 */

const DOT: Record<DataStatus, string> = {
  observed: "bg-stable",
  model: "bg-signal",
  scenario: "bg-warning",
  stale: "bg-elevated",
  unavailable: "bg-muted-foreground/50",
};

const TEXT: Record<DataStatus, string> = {
  observed: "text-stable",
  model: "text-signal",
  scenario: "text-warning",
  stale: "text-elevated",
  unavailable: "text-muted-foreground",
};

/**
 * What kind of number this is: observed, model output, scenario, or absent.
 * The dot carries the meaning so it stays legible at a glance; the title
 * attribute explains it for anyone who stops to ask.
 */
export function StatusBadge({
  status,
  className = "",
}: {
  status: DataStatus;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap ${className}`}
      title={STATUS_HELP[status]}
    >
      <span className={`size-1.5 shrink-0 rounded-full ${DOT[status]}`} aria-hidden="true" />
      <span className={`label ${TEXT[status]}`}>{STATUS_LABEL[status]}</span>
    </span>
  );
}

/**
 * The single line that sits under a verified figure: who reported it, for what
 * period, and when we pulled it. Links to the publisher so the reader can
 * always go and check for themselves.
 */
export function SourceLine({
  provenance,
  className = "",
}: {
  provenance: Provenance;
  className?: string;
}) {
  const source = sourceById(provenance.sourceId);
  // GDELT publishes `20261002T080000Z`; printing that verbatim puts an API
  // token on screen. Anything we cannot parse is dropped rather than shown.
  const asOf = formatAsOf(provenance.asOf);

  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1 ${className}`}>
      {source ? (
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="label inline-flex min-w-0 items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Database className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{source.label}</span>
        </a>
      ) : null}
      {asOf ? (
        <span className="label whitespace-nowrap text-muted-foreground">
          as of {asOf}
        </span>
      ) : null}
      <span className="label whitespace-nowrap text-muted-foreground/70">
        fetched {timestamp(provenance.retrievedAt)}
      </span>
      <StatusBadge status={provenance.status} />
    </div>
  );
}

/**
 * A caveat printed verbatim from the source. Kept separate from SourceLine so a
 * limitation sits with the number it qualifies, not buried in a methodology
 * page nobody opens.
 */
export function SourceNote({ note }: { note?: string }) {
  if (!note) return null;
  return (
    <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
      <Info className="mt-px size-3 shrink-0" aria-hidden="true" />
      <span>{note}</span>
    </p>
  );
}

/** Convenience: status dot plus source name, for dense table rows. */
export function SourceTag({ sourceId }: { sourceId: string }) {
  const source = sourceById(sourceId);
  if (!source) return null;
  return (
    <span className="label inline-flex items-center gap-1.5 text-muted-foreground">
      <span className="size-1.5 shrink-0 rounded-full bg-stable" aria-hidden="true" />
      <span className="truncate">{source.label}</span>
    </span>
  );
}

export type { Provenance };