import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageFrame } from "@/components/viz/exec/design";
import { Panel, Skeleton } from "@/components/viz/core";
import { NoVerifiedData, QuestionStrip } from "@/components/viz/Unavailable";
import { MacroTable } from "@/components/viz/VerifiedPanels";
import { MacroTrend } from "@/components/viz/MacroTrend";
import { TemporalSlider } from "@/components/viz/TemporalSlider";
import { useAttentionData } from "@/hooks/use-verified-data";
import { CHANNEL_LABEL } from "@/lib/intel/types";

/**
 * Markets, honestly.
 *
 * There is no price feed connected to this build, and this page will not
 * pretend otherwise. What it can show is real: reported economic growth, the
 * model's finance-channel pressure, and how much news coverage the watched
 * topics are receiving. The gap is stated in the place a reader would look for
 * a chart, not buried below the fold.
 */
export default function Markets() {
  const attention = useAttentionData();
  const risk = useQuery(api.intel.riskBoard);

  const financeEvents = (risk?.rows ?? [])
    .filter((r) => r.channelPressure.finance > 0.35)
    .slice(0, 8);

  const attentionSeries = aggregateHourly(attention.data ?? []);

  return (
      <PageFrame
      eyebrow="Markets"
      title="Markets"
      lede="Macro context and measured news attention, with the missing price feed stated in the place a reader looks for a chart."
    >

      <QuestionStrip
        className="border-b border-rule"
        answers={[
          {
            q: "What's happening?",
            a: financeEvents[0]
              ? `${financeEvents[0].title} carries the strongest finance-channel pressure in the corpus.`
              : "No event currently carries material finance-channel pressure.",
            href: financeEvents[0] ? `/app/event/${financeEvents[0].id}` : undefined,
          },
          {
            q: "What's changing?",
            a: attentionSeries.length
              ? `${attentionSeries[attentionSeries.length - 1].value.toFixed(
                  0,
                )} mentions in the most recent hour of tracked coverage.`
              : "No attention series is stored yet.",
          },
          {
            q: "Who's affected?",
            a: "Finance-channel exposure is ranked per economy on the risk board.",
            href: "/app/risk",
          },
          {
            q: "Why it matters?",
            a: "Without a price feed, nothing here can be called a market move. Coverage volume and reported growth are what can actually be evidenced.",
            href: "/app/data",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="lg:col-span-5">
          <Panel
            title="Price feed"
            meta="not connected"
            className="h-full"
          >
            <NoVerifiedData
              title="Market prices"
              domain="live quotes, indices or rates"
              action={
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Connecting a price source needs a licensed feed. Until one is
                  connected, no panel on this site will print a price, a return
                  or a spread — an unattributed number is worse than an absent
                  one.
                </p>
              }
            />
          </Panel>
        </section>

        <section className="lg:col-span-7">
          <MacroTrend className="h-full" />
        </section>

        <section className="lg:col-span-6">
          <MacroTable />
        </section>

        <section className="lg:col-span-6">
          {attentionSeries.length > 1 ? (
            <TemporalSlider
              className="h-full"
              series={{
                title: "Measured attention",
                axisLabel: "one step = one hour",
                caption:
                  "How much coverage the watched topics are receiving, from the GDELT media index. Attention is not a market: a coverage spike can mean an event, a press conference, or nothing at all.",
                format: (v) => `${Math.round(v).toLocaleString("en-GB")} mentions`,
                points: attentionSeries,
              }}
            />
          ) : (
            <Panel title="Measured attention" meta="GDELT" className="h-full">
              <Skeleton className="m-3 h-40 w-full" />
            </Panel>
          )}
        </section>

        <section className="lg:col-span-12">
          <Panel
            title="Finance-channel pressure"
            meta="model output, not a market move"
          >
            {financeEvents.length === 0 ? (
              <p className="px-3 py-4 text-[12px] text-muted-foreground">
                No event in the corpus currently clears the finance-channel
                threshold.
              </p>
            ) : (
              <ul className="divide-y divide-rule">
                {financeEvents.map((e) => (
                  <li key={e.id}>
                    <Link
                      to={`/app/event/${e.id}`}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 transition-colors hover:bg-[var(--exec-surface)]"
                    >
                      <span className="min-w-0 flex-1 truncate text-[13px]">
                        {e.title}
                      </span>
                      <span className="num text-[12px] text-muted-foreground">
                        {CHANNEL_LABEL.finance}{" "}
                        {(e.channelPressure.finance * 100).toFixed(0)}%
                      </span>
                      <span className="num w-14 text-right text-[12px] font-semibold">
                        {e.score30.toFixed(1)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </section>
      </div>
    </PageFrame>
  );
}

/** All watched topics summed into one hourly series, oldest first. */
function aggregateHourly(
  points: { at: string; attention: number }[],
): Array<{ at: number; value: number }> {
  const totals = new Map<number, number>();
  for (const p of points) {
    const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})\d{2}\d{2}Z?$/.exec(p.at);
    if (!m) continue;
    const hour = Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
    );
    totals.set(hour, (totals.get(hour) ?? 0) + p.attention);
  }
  return [...totals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([at, value]) => ({ at, value }));
}