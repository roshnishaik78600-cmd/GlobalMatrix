import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { ArrowRight, Building2, LineChart } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Panel, Skeleton } from "@/components/viz/core";
import { StatusBadge } from "@/components/viz/Provenance";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";
import { cn } from "@/lib/utils";

/**
 * Follow one event all the way through the world.
 *
 * Eight stages, in the order a shock actually travels: event, the economies it
 * lands on, the trade and energy routes it uses, the infrastructure it depends
 * on, the industries it reaches, and then company and market effects. The last
 * two are not measured in this build, and they say so in place instead of being
 * quietly dropped — a chain with a missing link looks like a finished analysis,
 * and this one is not.
 */

interface ChainRow {
  id: string;
  label: string;
  href?: string;
  meta?: string;
  weight?: number;
  channel?: string;
}

interface Stage {
  id: string;
  title: string;
  question: string;
  rows: ChainRow[];
  /** Shown in place when the stage has nothing measured to report. */
  empty?: { title: string; domain: string };
}

export function ChainExplorer({ className }: { className?: string }) {
  const feed = useQuery(api.intel.detectionFeed, {});
  const [eventId, setEventId] = useState<string | null>(null);

  const active = eventId ?? feed?.rows[0]?.id ?? null;
  const chain = useQuery(
    api.intel.eventChain,
    active ? { eventId: active } : "skip",
  );

  if (!feed) {
    return (
      <Panel title="Follow an event through the world" className={className}>
        <Skeleton className="m-3 h-64 w-full" />
      </Panel>
    );
  }

  const stages: Stage[] = chain
    ? [
        {
          id: "event",
          title: "Event",
          question: "What happened?",
          rows: [
            {
              id: chain.event.id,
              label: chain.event.title,
              href: `/app/event/${chain.event.id}`,
              meta: `${chain.event.reference} · ${chain.event.detectedAt} · ${chain.event.score.toFixed(0)} / 100 (80% ${chain.event.low.toFixed(0)}–${chain.event.high.toFixed(0)})`,
              weight: chain.event.score / 100,
            },
          ],
        },
        {
          id: "country",
          title: "Countries",
          question: "Who is affected?",
          rows: chain.countries.map((c) => ({
            id: c.nodeId,
            label: c.label,
            href: `/app/country/${c.nodeId}`,
            weight: Math.min(1, c.load),
          })),
        },
        {
          id: "trade",
          title: "Trade",
          question: "How does it travel?",
          rows: chain.trade.map((t) => ({
            id: t.nodeId,
            label: t.label,
            href: `/app/country/${t.nodeId}`,
            meta: `${t.mechanism} · ${t.lagDays[0]}–${t.lagDays[1]}d`,
            weight: t.impact,
          })),
          empty: {
            title: "Trade route",
            domain: "a trade pathway on this event",
          },
        },
        {
          id: "energy",
          title: "Energy",
          question: "Where does the flow change?",
          rows: chain.energy.map((t) => ({
            id: t.nodeId,
            label: t.label,
            href: `/app/country/${t.nodeId}`,
            meta: `${t.mechanism} · ${t.lagDays[0]}–${t.lagDays[1]}d`,
            weight: t.impact,
          })),
          empty: {
            title: "Energy route",
            domain: "an energy pathway on this event",
          },
        },
        {
          id: "supply",
          title: "Supply chain",
          question: "What has to move through it?",
          rows: chain.supply.map((s) => ({
            id: s.nodeId,
            label: s.label,
            href: `/app/country/${s.nodeId}`,
            weight: s.impact,
          })),
          empty: {
            title: "Chokepoint",
            domain: "a chokepoint on this event's pathways",
          },
        },
        {
          id: "industry",
          title: "Industries",
          question: "Which sectors feel it?",
          rows: chain.industries.map((i) => ({
            id: i.id,
            label: i.label,
            href: `/app/industry/${i.id}`,
            meta: i.channel
              ? `via ${CHANNEL_LABEL[i.channel as Channel].toLowerCase()}`
              : undefined,
            weight: Math.min(1, i.share),
          })),
          empty: {
            title: "Industry",
            domain: "an industry structurally exposed to this event",
          },
        },
        {
          id: "company",
          title: "Companies",
          question: "Which firms carry it?",
          rows: [],
          empty: {
            title: "Company exposure",
            domain: "company filings, ownership or supply contracts",
          },
        },
        {
          id: "market",
          title: "Markets",
          question: "What does it do to prices?",
          rows: [],
          empty: {
            title: "Market prices",
            domain: "a live price or index feed",
          },
        },
      ]
    : [];

  return (
    <Panel
      title="Follow an event through the world"
      meta="event → country → trade → energy → supply chain → industry → company → market"
      className={cn("min-w-0", className)}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2">
        <label className="label text-muted-foreground" htmlFor="chain-event">
          Event
        </label>
        <select
          id="chain-event"
          value={active ?? ""}
          onChange={(e) => setEventId(e.target.value)}
          className="h-8 min-w-0 flex-1 border border-rule bg-background px-2 text-[12px] outline-none focus:border-foreground"
        >
          {feed.rows.map((r) => (
            <option key={r.id} value={r.id}>
              {r.reference} — {r.title.slice(0, 56)}
            </option>
          ))}
        </select>
        {chain ? (
          <span className="flex items-center gap-2">
            <StatusBadge status="scenario" />
            <span
              className="num text-[12px] font-semibold"
              style={{ color: riskColorForScore(chain.event.score) }}
            >
              {chain.event.score.toFixed(0)}
            </span>
          </span>
        ) : null}
      </div>

      {!chain ? (
        <Skeleton className="m-3 h-56 w-full" />
      ) : (
        <>
          {/* The chain reads left to right; on narrow screens it stacks. */}
          <ol className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 xl:grid-cols-4">
            {stages.map((stage, i) => (
              <li key={stage.id} className="flex flex-col bg-card">
                <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
                  <span className="num text-[12px] text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="label text-foreground/85">{stage.title}</span>
                  {i < stages.length - 1 ? (
                    <ArrowRight
                      className="ml-auto size-3 shrink-0 text-muted-foreground/50"
                      aria-hidden
                    />
                  ) : null}
                </div>
                <p className="px-3 pt-2 text-[12px] text-muted-foreground">
                  {stage.question}
                </p>
                {stage.rows.length === 0 ? (
                  <div className="flex flex-1 flex-col justify-center px-3 py-4">
                    {stage.id === "company" ? (
                      <Building2 className="mb-2 size-4 text-muted-foreground" aria-hidden />
                    ) : (
                      <LineChart className="mb-2 size-4 text-muted-foreground" aria-hidden />
                    )}
                    <p className="text-[12px] font-medium">
                      {stage.empty?.title ?? stage.title}: not measured
                    </p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      GlobalMatrix has no {stage.empty?.domain ?? `${stage.title.toLowerCase()} data`}{" "}
                      connected, so this link of the chain stays open rather than
                      being filled with an estimate.
                    </p>
                  </div>
                ) : (
                  <ul className="divide-y divide-rule">
                    {stage.rows.slice(0, 6).map((row) => {
                      const body = (
                        <>
                          <span className="flex items-baseline justify-between gap-2">
                            <span className="min-w-0 truncate text-[12px]">
                              {row.label}
                            </span>
                            {row.weight !== undefined ? (
                              <span className="num shrink-0 text-[12px] text-muted-foreground">
                                {(row.weight * 100).toFixed(0)}
                              </span>
                            ) : null}
                          </span>
                          {row.weight !== undefined ? (
                            <span className="mt-1.5 block h-[3px] w-full bg-[var(--exec-surface)]">
                              <span
                                className="block h-full"
                                style={{
                                  width: `${Math.min(100, row.weight * 100)}%`,
                                  backgroundColor: riskColorForScore(row.weight * 100),
                                }}
                              />
                            </span>
                          ) : null}
                          {row.meta ? (
                            <span className="mt-1 block text-[12px] leading-snug text-muted-foreground">
                              {row.meta}
                            </span>
                          ) : null}
                        </>
                      );
                      return (
                        <li key={row.id}>
                          {row.href ? (
                            <Link
                              to={row.href}
                              className="block px-3 py-2 transition-colors hover:bg-[var(--exec-surface)]"
                            >
                              {body}
                            </Link>
                          ) : (
                            <div className="px-3 py-2">{body}</div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ol>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-rule px-3 py-2">
            <span className="label text-muted-foreground">
              Steps 1–6 are model output · 7–8 are unmeasured, not zero
            </span>
            <Link
              to={`/app/event/${chain.event.id}`}
              className="label ml-auto text-muted-foreground transition-colors hover:text-foreground"
            >
              Open the full event →
            </Link>
          </div>
        </>
      )}
    </Panel>
  );
}