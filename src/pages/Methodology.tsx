import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";
import { SOURCE_LIST } from "@/lib/sources";
import { ExecPage } from "@/components/viz/exec/system";

/**
 * Methodology.
 *
 * This is the detail the homepage deliberately left out. It lives on its own
 * route so the landing page can stay visual without the platform having to
 * choose between being legible and being auditable — a reader who wants the
 * arithmetic follows one link and gets all of it.
 *
 * Everything below describes how the model works. None of it is a claim about
 * the world; the world claims are on the pages that carry the data, each one
 * labelled with its source.
 */
const STEPS = [
  {
    index: "01",
    title: "Detect",
    body: "Corpus-scale screening over diplomatic, market, official and open-source signals. Each candidate event is scored for novelty against the precedent set, so routine recurrence is filtered before it reaches an analyst.",
  },
  {
    index: "02",
    title: "Propagate",
    body: "Every event is resolved against a graph of economies, blocs, chokepoints and settlement infrastructure, scored independently on trade, energy, finance and diplomatic channels with explicit transmission lags.",
  },
  {
    index: "03",
    title: "Resolve",
    body: "That graph is joined to the structure of 19 economies and 10 industries — production shares, demand centres, upstream inputs and route dependencies — so a shock can be attributed to the entities it actually lands on.",
  },
  {
    index: "04",
    title: "Estimate",
    body: "A composite risk score on 7, 30 and 90-day horizons, always published as a central estimate inside an 80% interval. Weak evidence widens the interval rather than lowering the score.",
  },
  {
    index: "05",
    title: "Explain",
    body: "Every number resolves to a signal, a pathway or a stated coefficient. The evidence ledger and the causal path trace show the arithmetic the model actually ran, term by term.",
  },
];

const UNCERTAINTY = [
  {
    t: "Evidence widens the interval, it does not lower the score",
    d: "Evidence strength enters the composite as a multiplier on the structural signal. A thinly-sourced event is not scored down for being thinly sourced — it is scored with a wider band.",
  },
  {
    t: "Every interval is decomposed into its four reasons",
    d: "Half-width = evidence gap + confidence gap + centrality gap + horizon growth. All four terms are printed, so a wide interval is diagnosable rather than merely disappointing.",
  },
  {
    t: "Source class sets the reliability prior",
    d: "Official filings outrank wires, which outrank analytical desks, which outrank open-source aggregation. Weight and corroboration count modulate the prior rather than replacing it.",
  },
  {
    t: "Long horizons mean-revert toward the median",
    d: "The model's edge decays with time even when the signal does not, so the 90-day estimate is pulled toward the corpus median instead of extrapolating the current shock.",
  },
];

export default function Methodology() {
  return (
    <ExecPage className="min-h-screen">
      <nav className="sticky top-0 z-30 border-b border-[var(--exec-hairline)] bg-[var(--exec-base)]/90 backdrop-blur">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center gap-4 px-4 lg:px-8">
          <Link to="/" className="flex shrink-0 items-center gap-2">
            <span className="size-2 bg-[var(--exec-cyan)]" aria-hidden />
            <span className="text-[12px] font-semibold tracking-[0.18em] text-[var(--exec-ink)] uppercase">
              GlobalMatrix
            </span>
          </Link>
          <span className="exec-label ml-auto text-[var(--exec-ink-dim)]">
            Methodology
          </span>
          <Link
            to="/"
            className="exec-label flex items-center gap-1.5 border border-[var(--exec-hairline-strong)] px-2.5 py-1.5 text-[var(--exec-ink)] transition-colors hover:border-[var(--exec-cyan)]"
          >
            <ArrowLeft className="size-3" />
            Back
          </Link>
        </div>
      </nav>

      <header className="border-b border-[var(--exec-hairline)] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1600px]">
          <h1 className="text-[1.9rem] font-semibold tracking-[-0.03em] text-[var(--exec-ink)] sm:text-[2.4rem]">
            A model you can argue with.
          </h1>
          <p className="mt-3 max-w-2xl text-[13.5px] leading-relaxed text-[var(--exec-ink-dim)]">
            There are no black boxes here. The composite is four stated terms over
            a declared coefficient set, and every term is printed on the same
            screen as the conclusion it supports.
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-8 lg:px-8">
        <section>
          <h2 className="exec-label border-b border-[var(--exec-hairline)] pb-2 text-[var(--exec-ink)]">
            01 — The derivation
          </h2>
          <div className="glass mt-3 px-4 py-3.5">
            <p className="exec-num text-[13px] leading-relaxed text-[var(--exec-ink)]">
              load = Σ ( impact × structural share × magnitude × confidence ×
              affinity )
            </p>
            <p className="mt-2.5 text-[12px] leading-relaxed text-[var(--exec-ink-dim)]">
              Exposure is never a stored score. It is computed by walking the
              event corpus to the nodes that make up each entity, so changing the
              corpus moves every profile with it. Each term is printed next to its
              result on the profile it supports, which means the number can be
              re-derived by hand or the coefficient can be disputed directly.
            </p>
          </div>

          <ol className="mt-4 border-t border-[var(--exec-hairline)]">
            {STEPS.map((step) => (
              <li
                key={step.index}
                className="grid grid-cols-12 gap-x-4 border-b border-[var(--exec-hairline)] py-5"
              >
                <span className="exec-num col-span-4 text-[11px] text-[var(--exec-cyan)] sm:col-span-1">
                  {step.index}
                </span>
                <h3 className="col-span-8 text-[14px] font-semibold text-[var(--exec-ink)] sm:col-span-3">
                  {step.title}
                </h3>
                <p className="col-span-12 mt-2 text-[13px] leading-relaxed text-[var(--exec-ink-dim)] sm:col-span-8 sm:mt-0">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="exec-label border-b border-[var(--exec-hairline)] pb-2 text-[var(--exec-ink)]">
            02 — On uncertainty
          </h2>
          <div className="border-t border-[var(--exec-hairline)]">
            {UNCERTAINTY.map((row) => (
              <div
                key={row.t}
                className="grid grid-cols-12 gap-x-4 border-b border-[var(--exec-hairline)] py-5"
              >
                <p className="col-span-12 text-[13.5px] leading-snug font-medium text-[var(--exec-ink)] sm:col-span-5">
                  {row.t}
                </p>
                <p className="col-span-12 mt-2 text-[12.5px] leading-relaxed text-[var(--exec-ink-dim)] sm:col-span-7 sm:mt-0">
                  {row.d}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="exec-label border-b border-[var(--exec-hairline)] pb-2 text-[var(--exec-ink)]">
            03 — What GlobalMatrix does not know
          </h2>
          <div className="glass mt-3 px-4 py-3.5">
            <p className="text-[12.5px] leading-relaxed text-[var(--exec-ink-dim)]">
              No company filings, commodity prices, port throughput, policy
              registry, bilateral trade corridors or price feeds are connected in
              this build. Where a surface depends on one of those it renders an
              explicit empty state instead of a plausible-looking stand-in.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-[var(--exec-ink-dim)]">
              The event corpus behind the model is a scenario set, not a newswire.
              It is labelled{" "}
              <span className="text-[var(--exec-ink)]">Scenario</span> everywhere it
              appears so it is never mistaken for something that happened.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="exec-label border-b border-[var(--exec-hairline)] pb-2 text-[var(--exec-ink)]">
            04 — Verified sources
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {SOURCE_LIST.map((s) => (
              <li key={s.id} className="glass px-3.5 py-3">
                <p className="text-[12.5px] font-semibold text-[var(--exec-ink)]">
                  {s.label}
                </p>
                <p className="exec-num mt-0.5 text-[9.5px] text-[var(--exec-ink-dim)]">
                  {s.publisher}
                </p>
                <p className="mt-2 text-[11.5px] leading-relaxed text-[var(--exec-ink-dim)]">
                  {s.covers}
                </p>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--exec-ink-dim)]">
                  <span className="exec-label">Limits</span> {s.limits}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="border-t border-[var(--exec-hairline)] px-4 py-5">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2">
          <span className="exec-label text-[var(--exec-ink-dim)]">
            GlobalMatrix · methodology
          </span>
          <div className="flex items-center gap-4">
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
