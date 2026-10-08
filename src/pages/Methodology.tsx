import { useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ChevronDown } from "lucide-react";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import { SOURCE_LIST } from "@/lib/sources";
import { ExecPage } from "@/components/viz/exec/system";
import { flagFor } from "@/lib/flags";

/**
 * Methodology.
 *
 * Five stages, drawn: SOURCE → SIGNAL → MODEL → PROPAGATION → IMPACT. The point
 * of the diagram is that each stage is a separate kind of evidence with a
 * separate failure mode, and a reader who knows where a number came from knows
 * what could be wrong with it. The arithmetic behind each stage lives one click
 * away rather than in the middle of the page, because most readers never want it
 * and the ones who do should not have to scroll past it to get there.
 */
const STAGES = [
  {
    key: "source",
    title: "Source",
    summary: "Named publishers, fetched on a schedule.",
    detail:
      "Three connectors, all public and keyless: the World Bank for annual national accounts, UN Comtrade for reported merchandise trade, and GDELT for the volume of news coverage. Each one is polled on its own refresh window and each stores its own last successful reading, so one failing connector cannot date the rest.",
    advanced:
      "The World Bank connector covers 18 of the 19 tracked economies across 5 indicator series. Comtrade's public preview tier is sampled and abbreviated, so mirrored flows do not sum to world totals. GDELT measures media attention, which is not evidence that an event occurred.",
  },
  {
    key: "signal",
    title: "Signal",
    summary: "Dated observations, each with a reliability prior.",
    detail:
      "Every observation is a dated, attributed statement with a reliability, a corroboration count and an anomaly z-score against that source's own history. Source class sets the prior — official filings outrank wires, which outrank analytical desks, which outrank open-source aggregation.",
    advanced:
      "A thin evidence set widens the interval rather than lowering the score. Half-width decomposes into evidence gap, confidence gap, centrality gap and horizon growth, and all four terms are printed wherever a score appears.",
  },
  {
    key: "model",
    title: "Model",
    summary: "A stated formula, re-derivable by hand.",
    detail:
      "Exposure is never a stored score. It is computed by walking the event corpus to the nodes that make up each entity, so changing the corpus moves every profile with it.",
    advanced:
      "load = Σ ( impact × structural share × magnitude × confidence × affinity ). Every coefficient lives in src/lib/intel/engine.ts and every term is printed next to its result on the profile it supports, so the number can be re-derived or the coefficient disputed directly.",
  },
  {
    key: "propagation",
    title: "Propagation",
    summary: "Four channels, each with its own lag.",
    detail:
      "Every event is resolved against a graph of economies, blocs, chokepoints and settlement infrastructure, scored independently on trade, energy, finance and diplomatic channels with explicit transmission lags.",
    advanced:
      "A pathway with no material transmission on a channel is reported as having none rather than as zero, because 'we did not measure this' and 'this is zero' are different claims.",
  },
  {
    key: "impact",
    title: "Impact",
    summary: "A composite, always inside an interval.",
    detail:
      "A composite risk score on 7, 30 and 90-day horizons, always published as a central estimate inside an 80% interval. Weak evidence widens the interval rather than lowering the score.",
    advanced:
      "The model's edge decays with time even when the signal does not, so the 90-day estimate is pulled toward the corpus median instead of extrapolating the current shock.",
  },
];

export default function Methodology() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <ExecPage className="min-h-full">
      <nav className="sticky top-0 z-30 border-b border-[var(--exec-hairline)] bg-[var(--exec-base)]/90 backdrop-blur">
        <div className="gm-width flex h-16 items-center gap-4 px-4 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span className="size-2 shrink-0 rounded-sm bg-[var(--exec-cyan)]" aria-hidden />
            <span className="truncate text-[14px] font-semibold tracking-[0.2em] text-[var(--exec-ink)] uppercase">
              Globalmatrix
            </span>
          </Link>
          <span className="exec-label ml-auto text-[var(--exec-ink-dim)]">
            Methodology
          </span>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-full border border-[var(--exec-hairline-strong)] px-3.5 py-2 text-[13px] font-medium text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3.5" /> Back
          </Link>
        </div>
      </nav>

      <header className="border-b border-[var(--exec-hairline)]">
        <div className="gm-width px-4 pt-12 pb-8 lg:px-8 lg:pt-16">
          {/* The kicker is the page's name, not a strapline. Every entry in the
              navigation names the destination it opens, and this is the string
              the "Methodology" item lands on — a reader who clicks it should
              see the same word at the top of the page. */}
          <p className="exec-label text-[var(--exec-cyan)]">Methodology</p>
          <h1 className="t-page mt-2 max-w-3xl text-[var(--exec-ink)]">
            A model you can argue with.
          </h1>
          <p className="t-body mt-3 max-w-2xl text-[var(--exec-ink-dim)]">
            Five stages take a published dataset to a number you can act on.
            Each is a different kind of evidence with a different way of being
            wrong, and each one is labelled wherever it appears on screen.
          </p>
        </div>
      </header>

      <main className="min-w-0">
        <div className="gm-width flex flex-col gap-6 px-4 py-10 lg:gap-8 lg:px-8 lg:py-12">
          {/* --------------------------------------------------- THE STAGE FLOW --
              The diagram is the page. Each stage is a card; the connector between
              them is a travelling dash, so the chain reads as directed flow
              rather than as a row of equal options. */}
          <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {STAGES.map((stage, i) => (
              <motion.li
                key={stage.key}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.32, delay: i * 0.07 }}
                className="card relative flex min-w-0 flex-col gap-2 p-4"
              >
                {i < STAGES.length - 1 ? (
                  <span
                    aria-hidden
                    className="absolute top-8 -right-4 hidden h-px w-4 xl:block"
                  >
                    <span className="flow-arc block h-px w-full bg-[var(--exec-violet)] opacity-70" />
                  </span>
                ) : null}
                <span className="border-violet flex size-8 items-center justify-center rounded-lg border">
                  <span className="accent-violet exec-num text-[12px] font-semibold">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </span>
                <span className="text-[16px] font-semibold text-[var(--exec-ink)]">
                  {stage.title}
                </span>
                <span className="text-[13px] leading-snug text-[var(--exec-ink-dim)]">
                  {stage.summary}
                </span>
              </motion.li>
            ))}
          </ol>

          {/* --------------------------------------------------- THE EXPLANATION --
              One row per stage: the one-paragraph answer on the left, the advanced
              detail behind a disclosure on the right. Reading the five rows gives
              the whole model; opening one gives the arithmetic. */}
          <div className="card flex min-w-0 flex-col">
            <div className="border-b border-[var(--exec-hairline)] px-4 py-3">
              <h2 className="t-card text-[var(--exec-ink)]">Each stage in detail</h2>
            </div>
            <ul className="flex flex-col divide-y divide-[var(--exec-hairline)]">
              {STAGES.map((stage, i) => {
                const expanded = open === stage.key;
                return (
                  <li key={stage.key}>
                    <button
                      type="button"
                      onClick={() => setOpen(expanded ? null : stage.key)}
                      aria-expanded={expanded}
                      className="flex w-full items-start gap-4 p-4 text-left transition-colors hover:bg-[var(--exec-surface)]"
                    >
                      <span className="accent-violet exec-num shrink-0 pt-1 text-[12px]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[16px] font-semibold text-[var(--exec-ink)]">
                          {stage.title}
                        </span>
                        <span className="mt-1 block max-w-2xl text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                          {stage.detail}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5 pt-1">
                        <span className="exec-label">
                          {expanded ? "Hide detail" : "Advanced detail"}
                        </span>
                        <ChevronDown
                          className={`size-4 text-[var(--exec-ink-dim)] transition-transform duration-200 ${
                            expanded ? "rotate-180" : ""
                          }`}
                          aria-hidden
                        />
                      </span>
                    </button>

                    <AnimatePresence initial={false}>
                      {expanded ? (
                        <motion.div
                          key="advanced"
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                          className="overflow-hidden"
                        >
                          <div className="border-t border-[var(--exec-hairline)] bg-[var(--exec-surface)] px-4 py-4 pl-14">
                            <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--exec-ink)]">
                              {stage.advanced}
                            </p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* ------------------------------------------------------ WHAT IS NOT --
              Stated on the methodology page as well as in the product, because a
              reader who audits the method should find the gaps in the method. */}
          <div className="card flex min-w-0 flex-col">
            <div className="border-b border-[var(--exec-hairline)] px-4 py-3">
              <h2 className="t-card text-[var(--exec-ink)]">
                What GlobalMatrix does not know
              </h2>
            </div>
            <div className="flex flex-col gap-3 p-4">
              <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                No IMF data, company filings, commodity prices, port throughput,
                policy registry, bilateral trade corridors or price feeds are
                connected in this build. Where a surface depends on one of those
                it renders an explicit empty state instead of a
                plausible-looking stand-in.
              </p>
              <p className="max-w-3xl text-[14px] leading-relaxed text-[var(--exec-ink-dim)]">
                The event corpus behind the model is a synthetic, internally
                consistent scenario set — not a newswire. It is labelled{" "}
                <span className="font-semibold text-[var(--exec-amber)]">
                  SCENARIO
                </span>{" "}
                everywhere it appears so it is never mistaken for something that
                happened.
              </p>
            </div>
          </div>

          {/* ------------------------------------------------------------ SOURCES */}
          <div>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="t-section text-[var(--exec-ink)]">
                Verified sources
              </h2>
              <Link
                to="/app/data"
                className="text-[13px] text-[var(--exec-cyan)] transition-opacity hover:opacity-80"
              >
                Live status →
              </Link>
            </div>
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {SOURCE_LIST.map((s) => (
                <li key={s.id} className="card flex flex-col gap-2 p-4">
                  <p className="text-[15px] font-semibold text-[var(--exec-ink)]">
                    {s.label}
                  </p>
                  <p className="exec-num text-[12px] text-[var(--exec-ink-dim)]">
                    {s.publisher}
                  </p>
                  <p className="text-[13px] leading-relaxed text-[var(--exec-ink-dim)]">
                    {s.covers}
                  </p>
                  <p className="mt-auto border-t border-[var(--exec-hairline)] pt-3 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
                    <span className="text-[var(--exec-ink-dim)]">Limits —</span>{" "}
                    {s.limits}
                  </p>
                </li>
              ))}
            </ul>
          </div>

          {/* ----------------------------------------------------------- TRACKED --
              The countries the model actually resolves. Rendered with the same
              flag rule as the rest of the product, so a bloc never gets a
              national flag beside it. */}
          <div className="card flex min-w-0 flex-col">
            <div className="border-b border-[var(--exec-hairline)] px-4 py-3">
              <h2 className="t-card text-[var(--exec-ink)]">Tracked economies</h2>
            </div>
            <ul className="flex flex-wrap gap-2 p-4">
              {TRACKED.map(([id, name]) => {
                const flag = flagFor(id);
                return (
                  <li key={id} className="chip text-[var(--exec-ink-dim)]">
                    {flag ? `${flag} ` : ""}
                    {name}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </main>

      <footer className="border-t border-[var(--exec-hairline)]">
        <div className="gm-width flex flex-wrap items-center justify-between gap-3 px-4 py-6 lg:px-8">
          <span className="exec-label text-[var(--exec-ink-dim)]">
            GlobalMatrix · methodology
          </span>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              to="/app/data"
              className="exec-label text-[var(--exec-ink-dim)] transition-colors hover:text-[var(--exec-ink)]"
            >
              Source register
            </Link>
            <span className="exec-label text-[var(--exec-ink-dim)]">
              {CORPUS_LABEL}
            </span>
          </div>
        </div>
      </footer>
    </ExecPage>
  );
}

/**
 * The sovereign economies the model resolves, as id → name.
 *
 * Drawn from the same node ids the map plots, so the list cannot claim a place
 * the product cannot actually show.
 */
const TRACKED: [string, string][] = [
  ["CN", "China"],
  ["US", "United States"],
  ["RU", "Russia"],
  ["IR", "Iran"],
  ["TW", "Taiwan"],
  ["KR", "South Korea"],
  ["JP", "Japan"],
  ["NL", "Netherlands"],
  ["GB", "United Kingdom"],
  ["DE", "Germany"],
  ["IN", "India"],
  ["TR", "Türkiye"],
  ["AE", "United Arab Emirates"],
  ["SA", "Saudi Arabia"],
  ["SG", "Singapore"],
  ["BR", "Brazil"],
  ["ZA", "South Africa"],
  ["MY", "Malaysia"],
];