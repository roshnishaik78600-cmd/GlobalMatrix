import { useQuery } from "convex/react";
import { Link } from "react-router";
import { api } from "@/convex/_generated/api";
import { PageHead } from "@/components/viz/Shell";
import { Panel, Timeline } from "@/components/viz/core";
import { QuestionStrip } from "@/components/viz/Unavailable";
import { SourceNote } from "@/components/viz/Provenance";
import { TradeTable } from "@/components/viz/VerifiedPanels";
import { TradeFlowMap } from "@/components/viz/TradeFlowMap";
import { CHANNEL_COLOR } from "@/lib/intel/visual";
import { CHANNEL_LABEL } from "@/lib/intel/types";
import { dayMonth } from "@/lib/format";

/**
 * Trade, as reported.
 *
 * Merchandise values come from UN Comtrade and carry their own provenance. The
 * events on this page are the model's view of trade pressure and are labelled as
 * such — they are not evidence that a tariff changed, only that the corpus
 * places pressure on this channel.
 */
export default function Trade() {
  const overview = useQuery(api.intel.overview);
  const feed = useQuery(api.intel.detectionFeed, {});

  const tradeEvents = (feed?.rows ?? [])
    .filter((r) => r.channelPressure.trade > 0.3)
    .slice(0, 8);

  const topTrade = tradeEvents[0];

  return (
    <main className="min-w-0">
      <PageHead
        title="Trade"
        lede="Reported merchandise values for every reporter GlobalMatrix follows, next to the trade-channel events in the corpus. The two are kept apart: one is a measurement, the other is a model."
        actions={
          <Link
            to="/app/data"
            className="label flex items-center gap-2 border border-rule px-3 py-2 transition-colors hover:border-foreground"
          >
            How this is collected
          </Link>
        }
      />

      <QuestionStrip
        className="border-b border-rule"
        answers={[
          {
            q: "What's happening?",
            a: topTrade
              ? `${topTrade.title} is the strongest trade-channel event in the corpus.`
              : "No trade-channel event clears the corpus threshold.",
            href: topTrade ? `/app/event/${topTrade.id}` : undefined,
          },
          {
            q: "Who's affected?",
            a:
              overview?.supplyPressure[0]
                ? `${overview.supplyPressure[0].label} carries the most supply-chain load.`
                : "No corridor load resolved yet.",
            href: "/app/supply",
          },
          {
            q: "Why it matters?",
            a: "Trade values are reported by each economy itself, so a break in the series is a break in reporting, not necessarily in trade.",
            href: "/app/data",
          },
          {
            q: "Show evidence",
            a: "Every figure below carries its source, period and fetch time.",
            href: "/app/data",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <TradeTable />
        </section>

        <section className="xl:col-span-5">
          <TradeFlowMap />
          <div className="mt-3">
            <Panel
              title="Trade-channel events"
              meta="model pressure, not reported figures"
            >
              {tradeEvents.length === 0 ? (
                <p className="px-3 py-4 text-[12px] text-muted-foreground">
                  No event in the corpus currently carries material pressure on
                  the trade channel.
                </p>
              ) : (
                <Timeline
                  items={tradeEvents.map((e) => ({
                    time: dayMonth(e.detectedAt),
                    title: e.title,
                    detail: `${CHANNEL_LABEL.trade} pressure ${(
                      e.channelPressure.trade * 100
                    ).toFixed(0)}% · ${e.score30.toFixed(0)} / 100 · 80% ${e.low30.toFixed(
                      0,
                    )}–${e.high30.toFixed(0)}`,
                    tone: CHANNEL_COLOR.trade,
                  }))}
                />
              )}
              <div className="border-t border-rule px-3 py-2">
                <SourceNote note="These are the corpus's own scenario events. No verified tariff, quota or sanctions registry is connected, so none of them is presented as a confirmed policy change." />
              </div>
            </Panel>
          </div>
        </section>
      </div>
    </main>
  );
}