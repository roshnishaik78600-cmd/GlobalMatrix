import { Link } from "react-router";
import { AlertTriangle, ArrowRight, CircleDot, Layers, Users } from "lucide-react";
import { NoData } from "@/components/viz/core";
import { riskColorForScore } from "@/lib/intel/visual";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";

/**
 * How a shock propagates, drawn as five stages.
 *
 * This is the same scenario result the tables below it report, arranged in the
 * order it happens: the shock, what it hits first, what that does to the next
 * layer, who ends up carrying it, and how much of it is genuinely unknown. The
 * last column is the widest on purpose — an uncertainty that is hard to see is
 * an uncertainty that gets ignored.
 */

export interface ScenarioResult {
  eventTitle: string;
  baselineEventScore: number;
  baselineLow: number;
  baselineHigh: number;
  scenarioEventScore: number;
  scenarioLow: number;
  scenarioHigh: number;
  affectedChannels: {
    channel: string;
    baseline: number;
    scenario: number;
  }[];
  topDrivers: { id: string; label: string; contribution: number; note?: string }[];
  countryDeltas: { id: string; label: string; baseline: number; scenario: number; delta: number }[];
  industryDeltas: { id: string; label: string; baseline: number; scenario: number; delta: number }[];
  eventId?: string;
}

function Step({
  step,
  title,
  question,
  icon,
  children,
}: {
  step: number;
  title: string;
  question: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col border border-rule bg-card">
      <div className="flex items-center gap-2 border-b border-rule px-3 py-2">
        <span className="num text-[12px] text-muted-foreground">
          {String(step).padStart(2, "0")}
        </span>
        {icon}
        <span className="label text-foreground/85">{title}</span>
      </div>
      <p className="px-3 pt-2 text-[12px] text-muted-foreground">{question}</p>
      <div className="min-w-0 flex-1 px-3 pt-2 pb-3">{children}</div>
    </div>
  );
}

export function PropagationRibbon({ result }: { result: ScenarioResult }) {
  const moved = result.affectedChannels.filter(
    (c) => Math.abs(c.scenario - c.baseline) > 0.001,
  );
  const widened =
    result.scenarioHigh - result.scenarioLow -
    (result.baselineHigh - result.baselineLow);
  const topCountries = [...result.countryDeltas]
    .filter((d) => Math.abs(d.delta) > 0.0005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);
  const topIndustries = [...result.industryDeltas]
    .filter((d) => Math.abs(d.delta) > 0.0005)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, 5);

  return (
    <div className="grid grid-cols-1 gap-px bg-rule lg:grid-cols-5">
      <Step
        step={1}
        title="Shock"
        question="What was assumed?"
        icon={<CircleDot className="size-3 text-signal" aria-hidden />}
      >
        <p className="text-[12px] leading-snug">{result.eventTitle}</p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="num text-[18px] leading-none font-semibold">
            {result.scenarioEventScore.toFixed(1)}
          </span>
          <span className="text-[12px] text-muted-foreground">
            from {result.baselineEventScore.toFixed(1)}
          </span>
        </div>
        <div className="mt-2 h-1.5 w-full bg-[var(--exec-surface)]">
          <div
            className="h-full"
            style={{
              width: `${Math.min(100, result.scenarioEventScore)}%`,
              backgroundColor: riskColorForScore(result.scenarioEventScore),
            }}
          />
        </div>
        {result.eventId ? (
          <Link
            to={`/app/event/${result.eventId}`}
            className="label mt-2 inline-block text-muted-foreground hover:text-foreground"
          >
            Open event →
          </Link>
        ) : null}
      </Step>

      <Step
        step={2}
        title="First order"
        question="What does it hit directly?"
        icon={<ArrowRight className="size-3 text-signal" aria-hidden />}
      >
        {moved.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            No channel pressure moved under this assumption.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {moved.slice(0, 4).map((c) => {
              const delta = (c.scenario - c.baseline) * 100;
              return (
                <li key={c.channel} className="min-w-0">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[13px]">
                      {CHANNEL_LABEL[c.channel as Channel]}
                    </span>
                    <span
                      className="num shrink-0 text-[12px]"
                      style={{
                        color: delta >= 0 ? "var(--signal)" : "var(--stable)",
                      }}
                    >
                      {delta >= 0 ? "+" : "−"}
                      {Math.abs(delta).toFixed(1)}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Step>

      <Step
        step={3}
        title="Second order"
        question="What do those channels then move?"
        icon={<Layers className="size-3 text-signal" aria-hidden />}
      >
        {result.topDrivers.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            No driver decomposition is available for this run.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {result.topDrivers.slice(0, 4).map((d) => (
              <li key={d.id} className="min-w-0">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-[13px]">{d.label}</span>
                  <span className="num shrink-0 text-[12px]">
                    {d.contribution >= 0 ? "+" : "−"}
                    {Math.abs(d.contribution).toFixed(1)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Step
        step={4}
        title="Exposed"
        question="Who is left carrying it?"
        icon={<Users className="size-3 text-signal" aria-hidden />}
      >
        {topCountries.length === 0 && topIndustries.length === 0 ? (
          <NoData reason="No country or sector load moved under this assumption." />
        ) : (
          <ul className="space-y-1.5">
            {topCountries.slice(0, 3).map((d) => (
              <li key={d.id} className="min-w-0">
                <Link
                  to={`/app/country/${d.id}`}
                  className="flex items-baseline justify-between gap-2 hover:text-signal"
                >
                  <span className="truncate text-[13px]">{d.label}</span>
                  <span className="num shrink-0 text-[12px] text-signal">
                    +{(d.delta * 100).toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
            {topIndustries.slice(0, 2).map((d) => (
              <li key={d.id} className="min-w-0">
                <Link
                  to={`/app/industry/${d.id}`}
                  className="flex items-baseline justify-between gap-2 hover:text-signal"
                >
                  <span className="truncate text-[13px]">
                    <span className="text-muted-foreground">sector · </span>
                    {d.label}
                  </span>
                  <span className="num shrink-0 text-[12px] text-signal">
                    +{(d.delta * 100).toFixed(1)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Step>

      <Step
        step={5}
        title="Uncertainty"
        question="How much of this is actually known?"
        icon={<AlertTriangle className="size-3 text-warning" aria-hidden />}
      >
        <div className="space-y-2">
          <div>
            <p className="label text-muted-foreground">80% interval</p>
            <p className="num mt-1 text-[13px]">
              {result.scenarioLow.toFixed(0)}–{result.scenarioHigh.toFixed(0)}
            </p>
          </div>
          {/* Two bars, same scale: the width is the message. */}
          <div className="space-y-1.5 pt-1">
            <div>
              <span className="label text-muted-foreground">Baseline width</span>
              <span className="mt-1 block h-1.5 w-full bg-[var(--exec-surface)]">
                <span
                  className="block h-full bg-muted-foreground"
                  style={{
                    width: `${Math.min(
                      100,
                      ((result.baselineHigh - result.baselineLow) / 60) * 100,
                    )}%`,
                  }}
                />
              </span>
            </div>
            <div>
              <span className="label text-muted-foreground">Scenario width</span>
              <span className="mt-1 block h-1.5 w-full bg-[var(--exec-surface)]">
                <span
                  className="block h-full bg-warning"
                  style={{
                    width: `${Math.min(
                      100,
                      ((result.scenarioHigh - result.scenarioLow) / 60) * 100,
                    )}%`,
                  }}
                />
              </span>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-muted-foreground">
            {widened >= 0 ? "Wider by " : "Narrower by "}
            {Math.abs(widened).toFixed(1)} points than the baseline. A wider band
            means the model is less sure about this world, not that it is worse.
          </p>
        </div>
      </Step>
    </div>
  );
}