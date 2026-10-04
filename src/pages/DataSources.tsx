import { useConvex, useQuery } from "convex/react";
import { motion } from "framer-motion";
import { ExternalLink, RefreshCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageFrame } from "@/components/viz/exec/design";
import { SectionTitle } from "@/components/viz/exec/system";
import { Skeleton } from "@/components/viz/core";
import { SOURCE_LIST, formatAsOf } from "@/lib/sources";
import { freshnessOf, type Freshness } from "@/lib/freshness";
import { timestamp } from "@/lib/format";

/**
 * Data sources and their live status.
 *
 * A monitoring board rather than a table: one large card per connector, each
 * stating what it is, whether it answered, when it last answered, and what it
 * cannot prove. A reader should be able to check the claim "every number here is
 * sourced" without reading a paragraph first.
 *
 * Sources this build has *not* connected are shown on the same board, in the
 * same card design, marked unavailable. Hiding them would imply the capability
 * exists and merely failed; showing them next to the working ones is what makes
 * the register auditable.
 */

/** Display names. The registry keys are lowercase ids; the card shows the name. */
const DISPLAY: Record<string, string> = {
  worldbank: "WORLD BANK",
  comtrade: "UN COMTRADE",
  gdelt: "GDELT",
};

/**
 * Sources a reader would reasonably expect a platform of this kind to have, and
 * which are genuinely not connected. Listed with the reason, so an empty panel
 * elsewhere is predictable rather than mysterious.
 */
const NOT_CONNECTED: { id: string; title: string; why: string }[] = [
  {
    id: "imf",
    title: "IMF",
    why: "No IMF connector exists in this build. Balance-of-payments and fiscal positions are not measured, and no figure on this site is drawn from them.",
  },
  {
    id: "prices",
    title: "Equity and FX prices",
    why: "No licensed price feed is connected. World Bank macro aggregates are shown instead; they are annual and they are not market prices.",
  },
  {
    id: "filings",
    title: "Company filings",
    why: "No structured filing feed is connected, so no company-level claim is made anywhere on the site.",
  },
  {
    id: "corridors",
    title: "Bilateral trade corridors",
    why: "UN Comtrade's public preview tier reports reporter totals, not a full corridor matrix. Only totals are shown.",
  },
  {
    id: "commodities",
    title: "Commodity flows and prices",
    why: "Commodity detail needs a feed this build does not have. The map draws reporter totals, so no bilateral or per-commodity arrow is drawn either.",
  },
  {
    id: "policy",
    title: "Policy lifecycle registry",
    why: "Policy activity is surfaced through the event corpus rather than a dated legislative tracker.",
  },
];

/** The four labels, defined once so every surface quotes the same wording. */
const KINDS = [
  {
    status: "observed" as const,
    tone: "var(--exec-emerald)",
    body: "Reported by a named public source and shown with the period it covers. If the source could not be reached, the figure is hidden rather than estimated.",
  },
  {
    status: "model" as const,
    tone: "var(--exec-cyan)",
    body: "Computed by GlobalMatrix from observed inputs using a published formula. Deterministic and re-derivable, but it is our arithmetic, not a measurement.",
  },
  {
    status: "scenario" as const,
    tone: "var(--exec-amber)",
    body: "A synthetic, internally-consistent scenario set. Nothing in it is a claim about the world, and it is labelled wherever it appears.",
  },
  {
    status: "unavailable" as const,
    tone: "var(--exec-crimson)",
    body: "No verified reading exists for this field right now. The gap is shown rather than filled with an estimate, a carry-forward, or an interpolation.",
  },
];

export default function DataSources() {
  const health = useQuery(api.observations.sourceHealth);
  const convex = useConvex();

  return (
    <PageFrame
      eyebrow="Sources"
      title="Data sources"
      lede="Every connector, its last successful fetch, how current that makes it, and what it is not evidence of."
    >
      {/* --------------------------------------------------- MONITORING BOARD -- */}
      <div className="lg:col-span-12">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          {health === undefined
            ? Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-56 w-full rounded-lg" />
              ))
            : SOURCE_LIST.map((source, i) => (
                <SourceCard
                  key={source.id}
                  name={DISPLAY[source.id] ?? source.label}
                  source={source}
                  row={health.find((h) => h.sourceId === source.id)}
                  index={i}
                />
              ))}
        </div>
      </div>

      {/* The four labels, before anything the reader has to interpret. */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle meta="four kinds of number">
            How to read a figure
          </SectionTitle>
          <ul className="grid grid-cols-1 divide-y divide-[var(--exec-hairline)] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-4">
            {KINDS.map((row) => (
              <li key={row.status} className="flex flex-col gap-2 p-4">
                <span
                  className="flex items-center gap-2 text-[14px] font-semibold"
                  style={{ color: row.tone }}
                >
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: row.tone }}
                    aria-hidden
                  />
                  {KINDS_LABEL[row.status]}
                </span>
                <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                  {row.body}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ------------------------------------------------------- NOT CONNECTED -- */}
      <div className="lg:col-span-12">
        <div className="card flex min-w-0 flex-col">
          <SectionTitle meta="stated rather than hidden">
            Not connected
          </SectionTitle>
          <ul className="grid grid-cols-1 divide-y divide-[var(--exec-hairline)] md:grid-cols-2 md:divide-x md:divide-y-0 xl:grid-cols-3">
            {NOT_CONNECTED.map((row) => (
              <li key={row.id} className="flex flex-col gap-2 p-4">
                <span className="flex items-center gap-2">
                  <span
                    className="size-2 shrink-0 rounded-full bg-[var(--exec-crimson)]"
                    aria-hidden
                  />
                  <span className="text-[14px] font-semibold text-[var(--exec-ink)]">
                    {row.title}
                  </span>
                  <span
                    className="chip ml-auto shrink-0 text-[var(--exec-crimson)]"
                    title="No connector exists for this source in this build"
                  >
                    UNAVAILABLE
                  </span>
                </span>
                <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                  {row.why}
                </p>
              </li>
            ))}
          </ul>

          <div className="border-t border-[var(--exec-hairline)] px-4 py-3">
            <button
              type="button"
              onClick={() => {
                // Fire-and-forget: failures are already recorded per source and
                // render as an honest unavailable state, so nothing to surface here.
                void convex.action(api.sources.refreshMacro, {});
                void convex.action(api.sources.refreshTrade, {});
                void convex.action(api.sources.refreshAttention, {});
              }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
            >
              <RefreshCw className="size-3.5" aria-hidden />
              Re-fetch from all connected sources
            </button>
          </div>
        </div>
      </div>
    </PageFrame>
  );
}

/* ------------------------------------------------------------------ parts -- */

const KINDS_LABEL: Record<string, string> = {
  observed: "OBSERVED",
  model: "MODEL OUTPUT",
  scenario: "SCENARIO",
  unavailable: "DATA UNAVAILABLE",
};

/**
 * One connector, as a monitoring card.
 *
 * The status is one of four words a reader can act on — verified, delayed,
 * unavailable, never contacted — derived from the connector's own recorded
 * state. The connector's own error string is deliberately never printed: it is a
 * transport message written for a machine, and on this page it would read as
 * the platform having failed rather than one feed being rate-limited.
 */
function SourceCard({
  name,
  source,
  row,
  index,
}: {
  name: string;
  source: (typeof SOURCE_LIST)[number];
  row:
    | { ok: boolean; retrievedAt: number; asOf: string; lastSuccessAt: number; problem?: string }
    | undefined;
  index: number;
}) {
  const neverContacted = row === undefined || row.retrievedAt === 0;
  const hasReading = !neverContacted && row.ok && row.lastSuccessAt > 0;

  const status: Freshness = neverContacted
    ? "unavailable"
    : !hasReading
      ? "unavailable"
      : freshnessOf(row.lastSuccessAt, source.id);

  const word = neverContacted
    ? "NEVER CONTACTED"
    : !hasReading
      ? "UNAVAILABLE"
      : status === "live"
        ? "VERIFIED"
        : status === "recent"
          ? "VERIFIED"
          : status === "delayed"
            ? "DELAYED"
            : status === "historical"
              ? "HISTORICAL"
              : "UNAVAILABLE";

  const tone =
    word === "VERIFIED"
      ? "var(--exec-emerald)"
      : word === "DELAYED"
        ? "var(--exec-amber)"
        : word === "HISTORICAL"
          ? "var(--exec-ink-dim)"
          : "var(--exec-crimson)";

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.05, 0.2) }}
      className="card card-hover flex min-w-0 flex-col gap-3 p-4"
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <h2 className="min-w-0 flex-1 text-[15px] font-semibold tracking-[0.04em] text-[var(--exec-ink)]">
          {name}
        </h2>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-semibold tracking-[0.08em]"
          style={{ color: tone }}
          title={STATUS_HELP[word]}
        >
          <span
            className={`size-2 shrink-0 rounded-full ${status === "live" ? "live-dot" : ""}`}
            style={{ background: tone }}
            aria-hidden
          />
          {word}
        </span>
      </div>

      <dl className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="exec-label">Last updated</dt>
          <dd className="exec-num min-w-0 truncate text-[13px] text-[var(--exec-ink)]">
            {hasReading
              ? formatAsOf(row.asOf) || "Date unavailable"
              : word === "NEVER CONTACTED"
                ? "Never contacted"
                : "No successful fetch"}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="exec-label">Data type</dt>
          <dd className="min-w-0 truncate text-right text-[12px] text-[var(--exec-ink-dim)]">
            {source.dataType}
          </dd>
        </div>
      </dl>

      <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
        {hasReading && row.lastSuccessAt > 0
          ? `Fetched ${timestamp(row.lastSuccessAt)}`
          : word === "NEVER CONTACTED"
            ? "The connector has not been called yet. It reports here as soon as it is."
            : "The connector is not returning a usable reading. The last attempt is recorded on the server."}
      </p>

      <p className="mt-auto border-t border-[var(--exec-hairline)] pt-3 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
        <span className="text-[var(--exec-ink-dim)]">Limits —</span>{" "}
        {source.limits}
      </p>

      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--exec-cyan)] transition-opacity hover:opacity-80"
      >
        {source.publisher}
        <ExternalLink className="size-3.5 shrink-0" aria-hidden />
      </a>
    </motion.article>
  );
}

/** One line of plain language per status word, on the card's tooltip. */
const STATUS_HELP: Record<string, string> = {
  VERIFIED: "Reporting inside its own refresh window. The reading shown is the last one it returned.",
  DELAYED: "Reporting, but the last successful fetch is older than its refresh window. The reading may be out of date.",
  HISTORICAL: "Last reporting long enough ago that it is a historical record rather than a current one.",
  UNAVAILABLE: "No usable reading. The figure is withheld rather than estimated.",
  "NEVER CONTACTED": "This connector has not been called yet.",
};