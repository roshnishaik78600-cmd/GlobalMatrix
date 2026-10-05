import { Link } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PageFrame } from "@/components/viz/exec/design";
import { Panel, Skeleton } from "@/components/viz/core";
import { NoVerifiedData, QuestionStrip } from "@/components/viz/Unavailable";
import { MacroTable } from "@/components/viz/VerifiedPanels";
import { MacroTrend } from "@/components/viz/MacroTrend";
import { TemporalSlider } from "@/components/viz/TemporalSlider";
import { useAttentionData, useRateData, useYieldData } from "@/hooks/use-verified-data";
import { freshnessOf } from "@/lib/freshness";
import { FreshnessTag } from "@/components/viz/exec/system";
import { ECB_FX } from "@/lib/ecb";
import { CHANNEL_LABEL } from "@/lib/intel/types";

/**
 * Markets, honestly.
 *
 * There is still no market price feed connected to this build, and this page
 * will not pretend otherwise. What it can show is real: official euro reference
 * rates fixed daily by the European Central Bank, the euro area government bond
 * curve, reported economic growth, the model's finance-channel pressure, and how
 * much news coverage the watched topics are receiving.
 *
 * The distinction matters and is stated on the board itself: an ECB reference
 * rate is a central bank's daily fixing, not an executable quote, and an annual
 * macro aggregate is not a market price. Neither is called "the market" here.
 */
export default function Markets() {
  const attention = useAttentionData();
  const rates = useRateData();
  const yields = useYieldData();
  const risk = useQuery(api.intel.riskBoard);

  const financeEvents = (risk?.rows ?? [])
    .filter((r) => r.channelPressure.finance > 0.35)
    .slice(0, 8);

  const attentionSeries = aggregateHourly(attention.data ?? []);

  // Newest fix per currency. The cache holds one row per key, so this is a
  // de-dup rather than a sort — but the `Date` parse keeps it correct if a
  // future refresh ever stores several observations per key.
  const fxBySeries = new Map(
    (rates.data ?? []).map((p) => [p.series, p] as const),
  );
  // `flatMap` rather than map-then-filter: it discards the undefined entries at
  // the type level, so the render below never has to re-prove that a point is
  // present before reading it.
  const fxRows = ECB_FX.flatMap((c) => {
    const point = fxBySeries.get(c.code);
    return point ? [{ code: c.code, label: c.label, point }] : [];
  });
  const yieldPoints = [...(yields.data ?? [])].sort((a, b) =>
    a.tenor.localeCompare(b.tenor),
  );

  const rateFreshness = rates.retrievedAt
    ? freshnessOf(rates.retrievedAt, "ecb")
    : "unavailable";

  return (
    <PageFrame
      eyebrow="Markets"
      title="Markets"
      lede="Official euro reference rates, the euro area yield curve, and measured news attention — with the market price feed stated as absent rather than approximated."
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
            q: "What are rates?",
            a: rates.asOf
              ? `ECB euro reference rates fixed ${rates.asOf}. Official central-bank fixings, not market quotes.`
              : "No reference-rate fix stored yet.",
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
            a: "Reference rates are official and daily, but they are not prices you could trade. Coverage volume and reported growth are what can actually be evidenced.",
            href: "/app/data",
          },
        ]}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* ------------------------------------------------------ RATE BOARD -- */}
        <section className="lg:col-span-7">
          <div className="card flex h-full min-w-0 flex-col">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--exec-hairline)] px-4 py-3">
              <h2 className="min-w-0 text-[15px] font-semibold text-[var(--exec-ink)]">
                Euro reference rates
              </h2>
              <span className="flex shrink-0 items-center gap-2">
                <span className="exec-label text-[var(--exec-ink-dim)]">
                  {rates.asOf ? `fixed ${rates.asOf}` : "resolving"}
                </span>
                <FreshnessTag freshness={rateFreshness} />
              </span>
            </div>

            {rates.data === undefined ? (
              <Skeleton className="m-4 h-64 w-full" />
            ) : fxRows.length === 0 ? (
              <NoVerifiedData
                title="Reference rates"
                domain="central-bank rate"
                action={
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {rates.problem ??
                      "The European Central Bank connector has not returned a reading. The board stays empty rather than showing a remembered rate."}
                  </p>
                }
              />
            ) : (
              <>
                <dl className="grid grid-cols-2 divide-y divide-[var(--exec-hairline)] sm:grid-cols-3 sm:divide-y-0 lg:grid-cols-3">
                  {fxRows.map((row, i) => (
                    <div
                      key={row.code}
                      className={`flex min-w-0 flex-col gap-1 p-4 ${
                        i > 0 ? "sm:border-l sm:border-[var(--exec-hairline)]" : ""
                      }`}
                    >
                      <dt className="exec-label min-w-0 truncate text-[var(--exec-ink-dim)]">
                        {row.label}
                      </dt>
                      <dd className="flex items-baseline gap-1.5">
                        <span className="exec-num text-[1.5rem] leading-none font-bold tracking-[-0.02em] text-[var(--exec-ink)]">
                          {row.point.value.toLocaleString("en-GB", {
                            maximumFractionDigits: 4,
                          })}
                        </span>
                        <span className="exec-label">{row.code}/EUR</span>
                      </dd>
                      <dd className="exec-label text-[var(--exec-ink-dim)]">
                        {row.point.date}
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-auto border-t border-[var(--exec-hairline)] px-4 py-3">
                  <p className="text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
                    <span className="text-[var(--exec-ink)]">OBSERVED</span> — fixed by
                    the European Central Bank at 14:15 CET on TARGET business days.
                    Units are {`currency`} per one euro. These are official reference
                    rates, not executable quotes, and no rouble rate is tracked: the
                    Bank suspended that fixing in March 2022.
                  </p>
                </div>
              </>
            )}
          </div>
        </section>

        {/* ---------------------------------------------------------- CURVE -- */}
        <section className="lg:col-span-5">
          <div className="card flex h-full min-w-0 flex-col">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b border-[var(--exec-hairline)] px-4 py-3">
              <h2 className="min-w-0 text-[15px] font-semibold text-[var(--exec-ink)]">
                Euro area yield curve
              </h2>
              <span className="exec-label text-[var(--exec-ink-dim)]">
                {yields.asOf ? `as of ${yields.asOf}` : "resolving"}
              </span>
            </div>

            {yields.data === undefined ? (
              <Skeleton className="m-4 h-48 w-full" />
            ) : yieldPoints.length === 0 ? (
              <NoVerifiedData title="Yield curve" domain="bond-curve" />
            ) : (
              <YieldCurve points={yieldPoints} />
            )}
          </div>
        </section>

        {/* -------------------------------------------------- PRICE-FEED GAP -- */}
        <section className="lg:col-span-5">
          <Panel title="Market price feed" meta="not connected" className="h-full">
            <NoVerifiedData
              title="Live quotes, indices or commodity prices"
              domain="market price"
              action={
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  Connecting a price source needs a licensed feed. The two boards
                  above are central-bank fixings, which is a different thing: real,
                  official and daily, but not a price anyone could trade. Until a
                  licensed feed is connected, no panel here prints a return or a
                  spread.
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

/* ------------------------------------------------------------------ parts -- */

/**
 * The three fixed points, drawn as a curve.
 *
 * Three points do not make a curve, and the component does not pretend to: it
 * draws the three observed yields as a connected line, states the observation
 * date, and prints the numeric spread so the slope can be read exactly rather
 * than estimated off a picture.
 */
function YieldCurve({
  points,
}: {
  points: { tenor: string; label: string; value: number; date: string }[];
}) {
  const years = points.map((p) => Number(p.tenor.replace("SR_", "").replace("Y", "")));
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  // A flat curve is a real state, not a divide-by-zero. Give it a band so the
  // three points sit mid-height instead of collapsing onto the frame edge.
  const span = max - min || 0.5;
  const W = 100;
  const H = 60;

  const pts = points.map((p, i) => {
    const x = (years[i] / Math.max(...years)) * (W - 16) + 8;
    const y = H - 6 - ((p.value - min) / span) * (H - 14);
    return { x, y };
  });

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-24 w-full"
        role="img"
        aria-label={`Euro area yields: ${points
          .map((p) => `${p.label} ${p.value.toFixed(2)}%`)
          .join(", ")}`}
      >
        <polyline
          points={pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ")}
          fill="none"
          stroke="var(--exec-cyan)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
        {pts.map((p, i) => (
          <circle
            key={points[i].tenor}
            cx={p.x}
            cy={p.y}
            r={2}
            fill="var(--exec-cyan)"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <ul className="grid grid-cols-3 gap-3">
        {points.map((p) => (
          <li key={p.tenor} className="flex min-w-0 flex-col gap-1">
            <span className="exec-label min-w-0 truncate text-[var(--exec-ink-dim)]">
              {p.label.replace("Euro area ", "")}
            </span>
            <span className="exec-num text-[1.35rem] leading-none font-bold text-[var(--exec-ink)]">
              {p.value.toFixed(2)}
              <span className="exec-label ml-0.5">%</span>
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-auto border-t border-[var(--exec-hairline)] pt-3 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
        <span className="text-[var(--exec-ink)]">OBSERVED</span> — three observed
        points on the euro area spot curve, not an interpolated yield curve.{" "}
        {years[years.length - 1] - years[0]}y−{years[0]}y spread{" "}
        <span className="exec-num text-[var(--exec-ink)]">
          {(values[values.length - 1] - values[0]).toFixed(2)}pp
        </span>
        .
      </p>
    </div>
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