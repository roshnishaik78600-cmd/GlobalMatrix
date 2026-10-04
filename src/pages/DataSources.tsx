import { Link } from "react-router";
import { useConvex, useQuery } from "convex/react";
import { ExternalLink, RefreshCw } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageFrame } from "@/components/viz/exec/design";
import { Panel, Skeleton } from "@/components/viz/core";
import { StatusBadge } from "@/components/viz/Provenance";
import { SOURCE_LIST, formatAsOf } from "@/lib/sources";
import { timestamp } from "@/lib/format";

/**
 * Data sources and their live status.
 *
 * This page exists so the claim "every number here is sourced" is checkable
 * rather than decorative: it lists what is connected, what it currently
 * returns, when it was last fetched, and — just as importantly — which
 * domains have no source at all.
 */

/**
 * Domains a reader might reasonably expect and that have no connected feed.
 * Listed rather than hidden, so an empty panel elsewhere on the site is
 * predictable instead of mysterious.
 */
const NOT_CONNECTED = [
  {
    title: "Google Trends / search interest",
    why: "Google publishes no supported public API for Trends data. Coverage volume from GDELT is shown instead, labelled as media attention.",
  },
  {
    title: "Equity and FX market prices",
    why: "No licensed price feed is connected. World Bank macro aggregates are shown instead; they are annual and are not market prices.",
  },
  {
    title: "Company filings",
    why: "No structured filing feed is connected, so no company-level claims are made anywhere on the site.",
  },
  {
    title: "Bilateral trade corridors",
    why: "UN Comtrade's public preview tier reports reporter totals, not a full corridor matrix. Only totals are shown.",
  },
  {
    title: "Commodity-level flows and prices",
    why: "Commodity detail needs a feed this build does not have. The map draws reporter totals, so no bilateral or per-commodity arrow is drawn either.",
  },
  {
    title: "Company supply relationships",
    why: "No company dataset is connected, so the company stage of the event chain is left open rather than filled with an estimate.",
  },
  {
    title: "Policy lifecycle registry",
    why: "Policy activity is surfaced through the event corpus rather than a dated legislative tracker.",
  },
];

/** Header cells, kept in one place so the grid stays a real grid. */
const COLUMNS = "minmax(0,2.2fr) 8.5rem 10.5rem minmax(0,2fr)";

export default function DataSources() {
  const health = useQuery(api.observations.sourceHealth);
  const convex = useConvex();

  return (
    <PageFrame
      eyebrow="Sources"
      title="Data sources"
      lede="Every connector, its last successful fetch, how current that makes it, and what it is not evidence of."
    >
      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <Panel title="Connected sources" meta="live status" className="h-full">
            {health === undefined ? (
              <div className="space-y-2 p-3">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div
                  className="label grid gap-x-3 border-b border-rule px-3 py-2 text-[10px] text-muted-foreground/70"
                  style={{ gridTemplateColumns: COLUMNS }}
                >
                  <span>Source</span>
                  <span>Status</span>
                  <span>Last updated</span>
                  <span className="hidden sm:block">Data type</span>
                </div>
                <ul className="divide-y divide-rule">
                  {SOURCE_LIST.map((source) => {
                    const row = health.find((h) => h.sourceId === source.id);
                    const asOf = formatAsOf(row?.asOf ?? "");
                    // "Never contacted" and "contacted and failed" are different
                    // facts, and the reader is entitled to tell them apart.
                    const neverContacted = row === undefined || row.retrievedAt === 0;
                    return (
                      <li
                        key={source.id}
                        className="grid gap-x-3 gap-y-1.5 px-3 py-3"
                        style={{ gridTemplateColumns: COLUMNS }}
                      >
                        <div className="min-w-0">
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium transition-colors hover:text-signal"
                          >
                            <span className="truncate">{source.label}</span>
                            <ExternalLink className="size-3 shrink-0" aria-hidden />
                          </a>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground/70">
                            <span className="label text-foreground/60">Limits —</span>{" "}
                            {source.limits}
                          </p>
                        </div>

                        <div className="min-w-0">
                          <StatusBadge
                            status={neverContacted ? "unavailable" : row.status}
                          />
                          {!neverContacted && !row.ok && row.problem ? (
                            <p className="mt-1 text-[10px] leading-snug text-warning">
                              {row.problem}
                            </p>
                          ) : null}
                        </div>

                        <div className="num min-w-0 text-[10.5px] leading-snug text-muted-foreground">
                          {neverContacted ? (
                            <span className="text-muted-foreground/60">
                              Never contacted
                            </span>
                          ) : (
                            <>
                              {row.lastSuccessAt > 0 ? (
                                <>
                                  <span className="block text-foreground/80">
                                    {asOf || "Date unavailable"}
                                  </span>
                                  <span className="block text-muted-foreground/70">
                                    fetched {timestamp(row.lastSuccessAt)}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <span className="block text-warning">
                                    No successful fetch
                                  </span>
                                  <span className="block text-muted-foreground/70">
                                    last tried {timestamp(row.retrievedAt)}
                                  </span>
                                </>
                              )}
                            </>
                          )}
                        </div>

                        <p className="hidden min-w-0 text-[10.5px] leading-relaxed text-muted-foreground sm:block">
                          {source.dataType}
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </Panel>
        </section>

        <section className="xl:col-span-5">
          <Panel
            title="Not connected"
            meta="stated rather than hidden"
            className="h-full"
          >
            <ul className="divide-y divide-rule">
              {NOT_CONNECTED.map((row) => (
                <li key={row.title} className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <StatusBadge status="unavailable" />
                    <p className="text-[12.5px] font-medium">{row.title}</p>
                  </div>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {row.why}
                  </p>
                </li>
              ))}
            </ul>
            <div className="border-t border-rule px-3 py-2.5">
              <button
                type="button"
                onClick={() => {
                  // Fire-and-forget: failures are already recorded per source and
                  // render as an honest empty state, so nothing to surface here.
                  void convex.action(api.sources.refreshMacro, {});
                  void convex.action(api.sources.refreshTrade, {});
                  void convex.action(api.sources.refreshAttention, {});
                }}
                className="label flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
              >
                <RefreshCw className="size-3" aria-hidden />
                Re-fetch from all sources
              </button>
            </div>
          </Panel>
        </section>

        <section className="xl:col-span-12">
          <Panel title="How to read a figure" meta="four kinds of number">
            <div className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  status: "observed" as const,
                  title: "Observed",
                  body: "Reported by a named public source and shown with the period it covers. If the source could not be reached, the figure is hidden rather than estimated.",
                },
                {
                  status: "model" as const,
                  title: "Model output",
                  body: "Computed by GlobalMatrix from observed inputs using a published formula. Deterministic and re-derivable, but it is our arithmetic, not a measurement.",
                },
                {
                  status: "scenario" as const,
                  title: "Scenario",
                  body: "A hypothetical change you asked us to run. Nothing in a scenario has happened, and nothing in it is evidence about the world.",
                },
                {
                  status: "unavailable" as const,
                  title: "Data unavailable",
                  body: "No verified reading exists for this field right now. We show the gap rather than filling it with an estimate, a carry-forward, or an interpolation.",
                },
              ].map((row) => (
                <div key={row.title} className="bg-card p-4">
                  <StatusBadge status={row.status} />
                  <p className="mt-2.5 text-[13px] font-medium">{row.title}</p>
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                    {row.body}
                  </p>
                </div>
              ))}
            </div>
            <div className="border-t border-rule px-3 py-2.5">
              <Link
                to="/app"
                className="label text-muted-foreground transition-colors hover:text-foreground"
              >
                Back to the overview →
              </Link>
            </div>
          </Panel>
        </section>
      </div>
    </PageFrame>
  );
}