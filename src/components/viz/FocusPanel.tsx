import { Link } from "react-router";
import type { ReactNode } from "react";
import { useQuery } from "convex/react";
import { ArrowUpRight } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { Drawer } from "@/components/viz/Drawer";
import { StatusBadge } from "@/components/viz/Provenance";
import { NodeEvidence } from "@/components/viz/NodeEvidence";
import { NoVerifiedData } from "@/components/viz/Unavailable";
import { Bar, Expandable } from "@/components/viz/core";
import { useFocus } from "@/lib/focus";
import { getNode } from "@/lib/intel/nodes";
import { CHANNEL_LABEL, STAGE_LABEL, type Channel } from "@/lib/intel/types";
import { riskColorForScore } from "@/lib/intel/visual";
import { pct } from "@/lib/format";

/**
 * "Inspect whatever I clicked."
 *
 * One drawer for the whole console, so a country, an event and a sector all
 * answer the same six questions in the same order: what, where, what changed,
 * who is affected, why it matters, and what the evidence is. Every figure here
 * comes from a query that already exists — nothing is recomputed for display and
 * nothing is invented to fill a gap.
 */
export function FocusDrawer() {
  const { focus, clear } = useFocus();
  const feed = useQuery(api.intel.detectionFeed, {});
  const countries = useQuery(api.intel.countryDirectory);
  // Subscriptions are scoped to the kind of thing being inspected, so opening
  // a country never pays for the sector and signal-matrix payloads.
  const matrix = useQuery(
    api.intel.signalMatrix,
    focus?.kind === "node" ? {} : "skip",
  );
  const industries = useQuery(
    api.intel.industryDirectory,
    focus?.kind === "industry" ? {} : "skip",
  );

  const open = focus !== null;

  if (focus?.kind === "node") {
    const node = getNode(focus.id);
    const row = countries?.countries.find((c) => c.nodeId === focus.id);
    const corridor = countries?.corridors.find((c) => c.nodeId === focus.id);
    const signals = matrix?.rows.find((r) => r.nodeId === focus.id);
    // Events that name this node among the places they land hardest on.
    const events = (feed?.rows ?? []).filter((r) =>
      r.topNodes.some((n) => n.nodeId === focus.id),
    );
    const peers = (row?.nodeId ? countries?.countries ?? [] : [])
      .filter((c) => c.nodeId !== focus.id)
      .slice(0, 5);

    return (
      <Drawer
        open={open}
        onClose={clear}
        eyebrow={
          <>
            <StatusBadge status="model" />
            <span className="label text-muted-foreground">
              {node.kind} · {node.region}
            </span>
          </>
        }
        title={node.label}
        subtitle={`Live load ${pct((row ?? corridor)?.load ?? 0)} from ${
          (row ?? corridor)?.eventCount ?? 0
        } events · criticality ${pct(node.criticality)}`}
        footer={
          <Link
            to={`/app/country/${focus.id}`}
            className="label flex items-center justify-center gap-2 border border-rule px-3 py-2 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
          >
            Explore this profile <ArrowUpRight className="size-3" />
          </Link>
        }
      >
        <Section title="What is it exposed to?" note="model output, by channel">
          {signals ? (
            <ul className="divide-y divide-rule">
              {(
                [
                  ["Trade", signals.trade],
                  ["Energy", signals.energy],
                  ["Geopolitical", signals.geopolitical],
                  ["Supply chain", signals.supply],
                  ["Market", signals.market],
                ] as const
              ).map(([label, value]) => (
                <li key={label} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-24 shrink-0 text-[13px]">{label}</span>
                  <Bar
                    value={value}
                    tone={riskColorForScore(value * 100)}
                    height={4}
                    className="flex-1"
                  />
                  <span className="num w-9 shrink-0 text-right text-[12px] text-muted-foreground">
                    {(value * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              No channel profile resolved for this node.
            </p>
          )}
        </Section>

        <Section
          title="What changed?"
          note={`${events.length} events in the corpus land hardest here`}
        >
          {events.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              No event currently ranks this node among the places it lands on
              hardest.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {events.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/app/event/${e.id}`}
                    className="block px-4 py-2.5 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="line-clamp-2 text-[12px] leading-snug">
                        {e.title}
                      </span>
                      <span className="num shrink-0 text-[12px]">
                        {e.score30.toFixed(0)}
                      </span>
                    </div>
                    <p className="num mt-1 text-[12px] text-muted-foreground">
                      {e.reference} · {STAGE_LABEL[e.stage]} ·{" "}
                      {CHANNEL_LABEL[e.dominantChannel as Channel]}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Who is affected alongside it?" note="ranked by live load">
          {peers.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              Nothing else to compare against in this selection.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {peers.slice(0, 3).map((c) => (
                <li key={c.nodeId}>
                  <Link
                    to={`/app/country/${c.nodeId}`}
                    className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <span className="num w-7 shrink-0 text-[12px] text-muted-foreground">
                      {c.short}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[12px]">
                      {c.label}
                    </span>
                    <span className="w-14 shrink-0">
                      <Bar
                        value={c.load}
                        tone={riskColorForScore(c.load * 100)}
                        height={3}
                      />
                    </span>
                    <span className="num w-8 shrink-0 text-right text-[12px]">
                      {(c.load * 100).toFixed(0)}%
                    </span>
                  </Link>
                </li>
              ))}
              {peers.length > 3 ? (
                <Expandable
                  className="border-t border-rule"
                  summary={
                    <span className="label text-muted-foreground">
                      {peers.length - 3} more comparable{" "}
                      {peers.length - 3 === 1 ? "economy" : "economies"}
                    </span>
                  }
                >
                  <ul className="divide-y divide-rule">
                    {peers.slice(3).map((c) => (
                      <li key={c.nodeId}>
                        <Link
                          to={`/app/country/${c.nodeId}`}
                          className="flex items-center gap-2 px-4 py-2 transition-colors hover:bg-[var(--exec-surface)]"
                        >
                          <span className="num w-7 shrink-0 text-[12px] text-muted-foreground">
                            {c.short}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[12px]">
                            {c.label}
                          </span>
                          <span className="num w-8 shrink-0 text-right text-[12px]">
                            {(c.load * 100).toFixed(0)}%
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </Expandable>
              ) : null}
            </ul>
          )}
        </Section>

        <Section title="Show evidence" note="reported, with source and time">
          <NodeEvidence nodeId={focus.id} />
        </Section>
      </Drawer>
    );
  }

  if (focus?.kind === "event") {
    const event = (feed?.rows ?? []).find((r) => r.id === focus.id);
    if (!event) {
      return (
        <Drawer open={open} onClose={clear} title="Event">
          <NoVerifiedData title="Event" domain="this event in the corpus" />
        </Drawer>
      );
    }
    return (
      <Drawer
        open={open}
        onClose={clear}
        eyebrow={
          <>
            <StatusBadge status="scenario" />
            <span className="label text-muted-foreground">
              {event.reference} · {STAGE_LABEL[event.stage]}
            </span>
          </>
        }
        title={event.title}
        subtitle={`${event.score30.toFixed(1)} / 100 at 30 days · 80% interval ${event.low30.toFixed(
          0,
        )}–${event.high30.toFixed(0)} · detected ${event.detectedAt}`}
        footer={
          <Link
            to={`/app/event/${event.id}`}
            className="label flex items-center justify-center gap-2 border border-rule px-3 py-2 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
          >
            Open full analysis <ArrowUpRight className="size-3" />
          </Link>
        }
      >
        <Section title="How it travels" note="channel pressure">
          <ul className="divide-y divide-rule">
            {(
              Object.entries(event.channelPressure) as [Channel, number][]
            )
              .sort((a, b) => b[1] - a[1])
              .map(([channel, value]) => (
                <li key={channel} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-24 shrink-0 text-[13px]">
                    {CHANNEL_LABEL[channel]}
                  </span>
                  <Bar
                    value={value}
                    tone={riskColorForScore(value * 100)}
                    height={4}
                    className="flex-1"
                  />
                  <span className="num w-9 shrink-0 text-right text-[12px] text-muted-foreground">
                    {(value * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
          </ul>
        </Section>

        <Section title="Where it lands" note="largest weighted terms">
          <ul className="divide-y divide-rule">
            {event.topNodes.map((n) => (
              <li key={n.nodeId} className="px-4 py-2">
                <div className="flex items-baseline justify-between gap-2">
                  <Link
                    to={`/app/country/${n.nodeId}`}
                    className="min-w-0 truncate text-[12px] hover:text-signal"
                  >
                    {n.label}
                  </Link>
                  <span className="num shrink-0 text-[12px] text-muted-foreground">
                    {n.weight.toFixed(2)}
                  </span>
                </div>
                <Bar
                  value={Math.min(1, n.weight / 1.5)}
                  tone={riskColorForScore(n.weight * 100)}
                  height={3}
                  className="mt-1.5"
                />
              </li>
            ))}
          </ul>
        </Section>

        <Section
          title="Show evidence"
          note={`${event.signalCount} observations in the ledger`}
        >
          <p className="px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
            The full evidence ledger — every observation, its source class, its
            reliability weight and its corroboration count — is on the event
            page, where each row can be read against the score it supports.
          </p>
        </Section>
      </Drawer>
    );
  }

  if (focus?.kind === "industry") {
    const row = industries?.industries.find((r) => r.id === focus.id);
    return (
      <Drawer
        open={open}
        onClose={clear}
        eyebrow={<StatusBadge status="model" />}
        title={row?.label ?? focus.id}
        subtitle={
          row
            ? `${row.code} · live load ${pct(row.load)} from ${row.eventCount} events · fragility ${pct(
                row.fragility,
              )}`
            : "Sector not found in the current taxonomy."
        }
        footer={
          <Link
            to={`/app/industry/${focus.id}`}
            className="label flex items-center justify-center gap-2 border border-rule px-3 py-2 transition-colors hover:border-foreground hover:bg-foreground hover:text-background"
          >
            Explore this sector <ArrowUpRight className="size-3" />
          </Link>
        }
      >
        <Section title="What is it exposed to?" note="by channel">
          {row ? (
            <ul className="divide-y divide-rule">
              {row.byChannel.map((c) => (
                <li key={c.channel} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-24 shrink-0 text-[13px]">
                    {CHANNEL_LABEL[c.channel as Channel]}
                  </span>
                  <Bar
                    value={c.load}
                    tone={riskColorForScore(c.load * 100)}
                    height={4}
                    className="flex-1"
                  />
                  <span className="num w-9 shrink-0 text-right text-[12px] text-muted-foreground">
                    {(c.load * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              No exposure profile resolved.
            </p>
          )}
        </Section>
        <Section title="Show evidence" note="reported">
          <p className="px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
            Sector-level figures in this build are model output. Reported figures
            are published per economy, on that economy&apos;s page.
          </p>
        </Section>
      </Drawer>
    );
  }

  if (focus?.kind === "channel") {
    const events = (feed?.rows ?? []).filter(
      (r) => r.channelPressure[focus.id] > 0.3,
    );
    return (
      <Drawer
        open={open}
        onClose={clear}
        eyebrow={<StatusBadge status="model" />}
        title={`${CHANNEL_LABEL[focus.id]} pressure`}
        subtitle={`${events.length} events currently press on this channel above the corpus threshold.`}
      >
        <Section title="Who is affected?" note="ranked by 30-day composite">
          {events.length === 0 ? (
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              No event in the corpus presses on this channel above the threshold.
            </p>
          ) : (
            <ul className="divide-y divide-rule">
              {events.map((e) => (
                <li key={e.id}>
                  <Link
                    to={`/app/event/${e.id}`}
                    className="block px-4 py-2.5 transition-colors hover:bg-[var(--exec-surface)]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="line-clamp-2 text-[12px] leading-snug">
                        {e.title}
                      </span>
                      <span className="num shrink-0 text-[12px]">
                        {(e.channelPressure[focus.id as Channel] * 100).toFixed(0)}%
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </Drawer>
    );
  }

  return null;
}

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-rule last:border-b-0">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-1.5">
        <h3 className="label text-foreground/85">{title}</h3>
        {note ? <span className="label text-muted-foreground">{note}</span> : null}
      </div>
      {children}
    </section>
  );
}