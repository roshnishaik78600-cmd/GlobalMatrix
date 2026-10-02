import { useState } from "react";
import { Link } from "react-router";
import { useQuery } from "convex/react";
import { motion } from "framer-motion";
import { Play, TriangleAlert } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { PageHead } from "@/components/viz/Shell";
import { Bar, NoData, Panel, Skeleton } from "@/components/viz/core";
import { riskColorForScore } from "@/lib/intel/visual";
import { CHANNEL_LABEL, type Channel } from "@/lib/intel/types";
import { GEO_NODES } from "@/lib/intel/nodes";

type Mode = "amplify" | "suppress" | "remove_node" | "decay";

/**
 * Scenario lab.
 *
 * Nothing here is simulated by a separate invented model. A scenario is a
 * stated perturbation of the actual corpus, and the results are produced by
 * re-running the actual engine over it. Every output is conditional on the
 * assumption shown, which is why the panel is permanently watermarked.
 */
export default function Scenarios() {
  const meta = useQuery(api.intel.scenarioMeta);
  const [eventId, setEventId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("amplify");
  const [magnitude, setMagnitude] = useState(0.5);
  const [nodeId, setNodeId] = useState<string>("HORMUZ");
  const [horizon, setHorizon] = useState(30);
  const [ran, setRan] = useState(false);

  const activeEvent = eventId ?? meta?.events[0]?.id ?? null;

  const result = useQuery(
    api.intel.runScenarioQuery,
    ran && activeEvent
      ? {
          eventId: activeEvent,
          mode,
          magnitude,
          ...(mode === "remove_node" ? { nodeId } : {}),
          horizonDays: horizon,
        }
      : "skip",
  );

  if (!meta) {
    return (
      <main>
        <PageHead title="Scenario lab" lede="Perturb the corpus and re-score it." />
        <div className="p-3">
          <Skeleton className="h-[520px] w-full" />
        </div>
      </main>
    );
  }

  const selectedMode = meta.modes.find((m) => m.mode === mode);

  return (
    <main className="min-w-0">
      <PageHead
        title="Scenario lab"
        lede="Choose a shock, then re-run the real propagation engine over a perturbed corpus. These are not predictions — they are the model's own arithmetic recomputed under a stated assumption."
      />

      {/* Builder */}
      <div className="border-b border-rule bg-card">
        <div className="grid grid-cols-1 gap-px bg-rule lg:grid-cols-4">
          <div className="bg-card p-4">
            <p className="label text-muted-foreground">What changes?</p>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as Mode)}
              className="mt-2 h-9 w-full border border-rule bg-background px-2 text-[12.5px] outline-none focus:border-foreground"
              aria-label="Shock type"
            >
              {meta.modes.map((m) => (
                <option key={m.mode} value={m.mode}>
                  {m.label}
                </option>
              ))}
            </select>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {selectedMode?.description}
            </p>
          </div>

          <div className="bg-card p-4">
            <p className="label text-muted-foreground">
              {mode === "remove_node" ? "Which node goes offline?" : "Which event?"}
            </p>
            {mode === "remove_node" ? (
              <select
                value={nodeId}
                onChange={(e) => setNodeId(e.target.value)}
                className="mt-2 h-9 w-full border border-rule bg-background px-2 text-[12.5px] outline-none focus:border-foreground"
                aria-label="Node"
              >
                {GEO_NODES.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.label}
                  </option>
                ))}
              </select>
            ) : (
              <select
                value={activeEvent ?? ""}
                onChange={(e) => setEventId(e.target.value)}
                className="mt-2 h-9 w-full border border-rule bg-background px-2 text-[12.5px] outline-none focus:border-foreground"
                aria-label="Event"
              >
                {meta.events.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.reference} — {e.title.slice(0, 44)}
                  </option>
                ))}
              </select>
            )}
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              {mode === "remove_node"
                ? "The node is deleted from the graph and the whole corpus is re-scored."
                : "The corpus is re-scored under this assumption."}
            </p>
          </div>

          <div className="bg-card p-4">
            <div className="flex items-baseline justify-between">
              <p className="label text-muted-foreground">Magnitude</p>
              <p className="num text-[13px] font-semibold">
                {(magnitude * 100).toFixed(0)}%
              </p>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {[0, 0.25, 0.5, 0.75, 1].map((step) => (
                <button
                  key={step}
                  type="button"
                  onClick={() => setMagnitude(step)}
                  aria-label={`${step * 100}%`}
                  className={`h-2 flex-1 transition-colors ${
                    magnitude >= step ? "bg-signal" : "bg-white/12"
                  }`}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between">
              <span className="label text-muted-foreground">None</span>
              <span className="label text-muted-foreground">Extreme</span>
            </div>
          </div>

          <div className="bg-card p-4">
            <p className="label text-muted-foreground">Horizon</p>
            <div className="mt-2 flex gap-1">
              {[7, 30, 90].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setHorizon(h)}
                  className={`chip flex-1 justify-center ${
                    horizon === h
                      ? "border-signal text-signal"
                      : "border-rule text-muted-foreground"
                  }`}
                >
                  {h}d
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setRan(true)}
              className="mt-4 flex h-9 w-full items-center justify-center gap-2 bg-foreground text-background transition-opacity hover:opacity-85"
            >
              <Play className="size-3.5" />
              <span className="label">Run simulation</span>
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      {!ran ? (
        <div className="p-3">
          <Panel title="Results">
            <NoData reason="Choose a shock and run the simulation. Nothing is computed until you do." />
          </Panel>
        </div>
      ) : !result ? (
        <div className="p-3">
          <Skeleton className="h-[420px] w-full" />
        </div>
      ) : (
        <div className="space-y-3 p-3">
          <div className="flex items-center gap-2 border border-signal/40 bg-signal/10 px-3 py-2">
            <TriangleAlert className="size-4 shrink-0 text-signal" aria-hidden />
            <p className="text-[12px]">
              <strong className="font-semibold">Scenario — not a forecast.</strong>{" "}
              Every figure below is the existing model recomputed under the
              assumption &ldquo;{selectedMode?.label.toLowerCase()}&rdquo; at{" "}
              {(magnitude * 100).toFixed(0)}% intensity. It is not a prediction
              that this will happen.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-12">
            <section className="xl:col-span-4">
              <Panel title="Event composite" meta={`${horizon}-day horizon`}>
                <div className="space-y-4 p-3">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="label text-muted-foreground">
                        Baseline
                      </span>
                      <span className="num text-[15px] font-semibold">
                        {result.baselineEventScore.toFixed(1)}
                      </span>
                    </div>
                    <Bar
                      value={result.baselineEventScore}
                      tone={riskColorForScore(result.baselineEventScore)}
                      height={6}
                      className="mt-1.5"
                    />
                    <p className="num mt-1 text-[10px] text-muted-foreground">
                      80% interval {result.baselineLow.toFixed(0)}–
                      {result.baselineHigh.toFixed(0)}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <span className="label" style={{ color: "var(--signal)" }}>
                        Scenario
                      </span>
                      <span className="num text-[15px] font-semibold text-signal">
                        {result.scenarioEventScore.toFixed(1)}
                      </span>
                    </div>
                    <Bar
                      value={result.scenarioEventScore}
                      tone="var(--signal)"
                      height={6}
                      className="mt-1.5"
                    />
                    <p className="num mt-1 text-[10px] text-muted-foreground">
                      80% interval {result.scenarioLow.toFixed(0)}–
                      {result.scenarioHigh.toFixed(0)}
                    </p>
                  </div>
                  <p className="border-t border-rule pt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                    {result.eventTitle}
                  </p>
                </div>
              </Panel>
            </section>

            <section className="xl:col-span-4">
              <Panel title="Channel response" meta="pressure change">
                {result.affectedChannels.length === 0 ? (
                  <NoData reason="No channel pressure moved under this assumption." />
                ) : (
                  <ul className="space-y-3 p-3">
                    {result.affectedChannels.map((c) => {
                      const delta = (c.scenario - c.baseline) * 100;
                      return (
                        <li key={c.channel}>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[12.5px]">
                              {CHANNEL_LABEL[c.channel as Channel]}
                            </span>
                            <span
                              className="num text-[12px]"
                              style={{
                                color: delta >= 0 ? "var(--signal)" : "var(--stable)",
                              }}
                            >
                              {delta >= 0 ? "+" : "−"}
                              {Math.abs(delta).toFixed(1)} pts
                            </span>
                          </div>
                          <div className="mt-1.5 flex gap-px">
                            <Bar
                              value={c.baseline}
                              tone="var(--muted-foreground)"
                              height={5}
                            />
                          </div>
                          <Bar
                            value={c.scenario}
                            tone={riskColorForScore(c.scenario * 100)}
                            height={5}
                            className="mt-px"
                          />
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>
            </section>

            <section className="xl:col-span-4">
              <Panel title="Drivers under scenario" meta="decomposed">
                <ul className="divide-y divide-rule">
                  {result.topDrivers.map((d) => (
                    <li key={d.id} className="px-3 py-2.5">
                      <div className="flex items-baseline justify-between">
                        <span className="text-[12px]">{d.label}</span>
                        <span className="num text-[12px] font-semibold">
                          {d.contribution >= 0 ? "+" : "−"}
                          {Math.abs(d.contribution).toFixed(1)}
                        </span>
                      </div>
                      <Bar
                        value={Math.min(1, Math.abs(d.contribution) / 30)}
                        tone="var(--foreground)"
                        height={3}
                        className="mt-1.5"
                      />
                    </li>
                  ))}
                </ul>
              </Panel>
            </section>
          </div>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
            <Panel
              title="Most affected countries"
              meta="largest live-load change"
            >
              {result.countryDeltas.length === 0 ? (
                <NoData reason="No country load moved under this assumption." />
              ) : (
                <ul className="divide-y divide-rule">
                  {result.countryDeltas.map((d) => (
                    <DeltaRow key={d.id} d={d} to={`/app/country/${d.id}`} />
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              title="Most affected industries"
              meta="largest live-load change"
            >
              {result.industryDeltas.length === 0 ? (
                <NoData reason="No sector load moved under this assumption." />
              ) : (
                <ul className="divide-y divide-rule">
                  {result.industryDeltas.map((d) => (
                    <DeltaRow key={d.id} d={d} to={`/app/industry/${d.id}`} />
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </div>
      )}
    </main>
  );
}

function DeltaRow({
  d,
  to,
}: {
  d: { id: string; label: string; baseline: number; scenario: number; delta: number };
  to: string;
}) {
  const up = d.delta > 0;
  return (
    <li>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Link
          to={to}
          className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-white/4"
        >
          <span className="min-w-0 flex-1 truncate text-[12.5px]">
            {d.label}
          </span>
          <span className="num w-12 shrink-0 text-right text-[10px] text-muted-foreground">
            {(d.baseline * 100).toFixed(0)}%
          </span>
          <span className="w-16 shrink-0">
            <Bar
              value={d.scenario}
              tone={riskColorForScore(d.scenario * 100)}
              height={4}
            />
          </span>
          <span
            className="num w-14 shrink-0 text-right text-[11px] font-semibold"
            style={{ color: up ? "var(--signal)" : "var(--stable)" }}
          >
            {up ? "+" : "−"}
            {Math.abs(d.delta * 100).toFixed(1)}
          </span>
        </Link>
      </motion.div>
    </li>
  );
}