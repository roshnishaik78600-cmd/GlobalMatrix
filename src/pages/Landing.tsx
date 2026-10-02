import { Link } from "react-router";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { CHANNELS, CHANNEL_LABEL, CHANNEL_CODE } from "@/lib/intel/types";
import { CORPUS_LABEL } from "@/lib/intel/scenarios";

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

const OUTPUTS = [
  {
    index: "01",
    name: "Detection",
    route: "/app",
    body: "The ranked feed. Twelve emerging events with channel pressure, evidence mass and the interval behind each score.",
  },
  {
    index: "02",
    name: "Event analysis",
    route: "/app/event/MER-4130",
    body: "The propagation map: four channels, transmission lags, exposed nodes, driver decomposition and the full evidence ledger.",
  },
  {
    index: "03",
    name: "Risk board",
    route: "/app/risk",
    body: "Every event against every channel, plus loaded nodes and tail scenarios. Built for concentration risk.",
  },
  {
    index: "04",
    name: "Countries",
    route: "/app/countries",
    body: "Economies, blocs and infrastructure ranked by live exposure, with structural dependencies and who depends on them in return.",
  },
  {
    index: "05",
    name: "Industries",
    route: "/app/industries",
    body: "Sectors ranked by derived exposure, with production concentration, demand centres, route dependency and substitution lead time.",
  },
];

export default function Landing() {
  return (
    <main className="bg-background">
      {/* Nav */}
      <header className="border-b border-rule">
        <div className="mx-auto flex h-14 max-w-[1600px] items-center justify-between px-5 lg:px-8">
          <div className="flex items-center gap-2.5">
            <span className="block size-2.5 bg-signal" aria-hidden="true" />
            <span className="text-[13px] font-semibold tracking-[0.16em] uppercase">
              Meridian
            </span>
          </div>
          <nav className="flex items-center gap-6">
            <a
              href="#model"
              className="label hidden text-muted-foreground transition-colors hover:text-ink sm:block"
            >
              Model
            </a>
            <a
              href="#outputs"
              className="label hidden text-muted-foreground transition-colors hover:text-ink sm:block"
            >
              Outputs
            </a>
            <Link
              to="/auth"
              className="label border border-ink px-3.5 py-2 transition-colors hover:bg-ink hover:text-paper"
            >
              Sign in
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 pt-12 pb-14 lg:px-8 lg:pt-20 lg:pb-20">
          <div className="grid grid-cols-12 gap-x-4 gap-y-10">
            <div className="col-span-12 lg:col-span-9">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55 }}
              >
                <div className="flex items-center gap-3">
                  <span className="num text-[11px] font-semibold tracking-[0.2em] text-signal">
                    00
                  </span>
                  <span className="h-px w-10 bg-rule" />
                  <span className="label text-muted-foreground">
                    Applied research instrument · v1
                  </span>
                </div>

                <h1 className="display mt-8 text-[2.7rem] sm:text-[4.2rem] lg:text-[6.2rem]">
                  Geopolitics,
                  <br />
                  traced through
                  <br />
                  the networks that
                  <br />
                  <span className="text-signal">carry them.</span>
                </h1>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
              className="col-span-12 lg:col-span-3"
            >
              <div className="border-l-2 border-signal pl-5">
                <p className="text-[14px] leading-relaxed text-muted-foreground">
                  Meridian detects emerging geopolitical events, resolves how
                  each propagates through trade, energy, finance and diplomatic
                  networks, and estimates near-term risk as a number you can
                  audit — with its uncertainty stated rather than hidden.
                </p>
                <div className="mt-7 flex flex-col gap-3">
                  <Link
                    to="/auth"
                    className="group flex items-center justify-between border border-ink bg-ink px-5 py-4 text-paper transition-opacity hover:opacity-88"
                  >
                    <span className="label">Open the console</span>
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                  </Link>
                  <Link
                    to="/auth?returnTo=%2Fapp%2Fevent%2FMER-4130"
                    className="group flex items-center justify-between border border-ink px-5 py-4 transition-colors hover:bg-ink hover:text-paper"
                  >
                    <span className="label">Inspect a worked event</span>
                    <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Channel strip */}
      <section className="border-b border-rule bg-card">
        <div className="mx-auto max-w-[1600px] px-5 lg:px-8">
          <div className="grid grid-cols-2 divide-rule lg:grid-cols-4 lg:divide-x">
            {CHANNELS.map((channel, i) => (
              <motion.div
                key={channel}
                initial={{ opacity: 0, y: 8 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.4, delay: i * 0.07 }}
                className="border-b border-rule px-0 py-7 last:border-b-0 lg:border-b-0 lg:px-6 lg:first:pl-0"
              >
                <div className="flex items-baseline justify-between">
                  <span className="label">{CHANNEL_LABEL[channel]}</span>
                  <span className="num text-[10px] text-signal">
                    {CHANNEL_CODE[channel]}
                  </span>
                </div>
                <p className="num display mt-4 text-[3.2rem] leading-none opacity-15">
                  {String(i + 1).padStart(2, "0")}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Model */}
      <section id="model" className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 py-14 lg:px-8 lg:py-20">
          <div className="grid grid-cols-12 gap-x-4 gap-y-10">
            <div className="col-span-12 lg:col-span-4">
              <div className="flex items-center gap-3">
                <span className="num text-[11px] font-semibold tracking-[0.2em] text-signal">
                  01
                </span>
                <span className="h-px w-10 bg-rule" />
                <span className="label text-muted-foreground">Method</span>
              </div>
              <h2 className="display mt-6 text-[2.2rem] sm:text-[2.8rem]">
                A model you can
                <br />
                argue with.
              </h2>
              <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-muted-foreground">
                There are no black boxes here. The composite is four stated
                terms over a declared coefficient set, and every term is printed
                on the same screen as the conclusion it supports.
              </p>
              <div className="mt-8 border border-rule bg-card p-5">
                <p className="label text-muted-foreground">Corpus</p>
                <p className="num display mt-2 text-2xl">{CORPUS_LABEL}</p>
                <p className="mt-3 text-[12px] leading-relaxed text-muted-foreground">
                  A synthetic, internally-consistent scenario set — not a live
                  intelligence feed. Every figure is deterministic, so the
                  arithmetic can be re-derived end to end.
                </p>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-8">
              <ol className="border-t border-rule">
                {STEPS.map((step, i) => (
                  <motion.li
                    key={step.index}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.45, delay: i * 0.06 }}
                    className="group grid grid-cols-12 gap-x-4 border-b border-rule py-7 transition-colors hover:bg-secondary"
                  >
                    <div className="col-span-3 sm:col-span-1">
                      <span className="num text-[11px] text-signal">
                        {step.index}
                      </span>
                    </div>
                    <h3 className="col-span-9 text-[1.05rem] font-semibold tracking-[-0.01em] sm:col-span-3">
                      {step.title}
                    </h3>
                    <p className="col-span-12 mt-3 text-[13.5px] leading-relaxed text-muted-foreground sm:col-span-8 sm:mt-0">
                      {step.body}
                    </p>
                  </motion.li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </section>

      {/* Outputs */}
      <section id="outputs" className="border-b border-rule bg-card">
        <div className="mx-auto max-w-[1600px] px-5 py-14 lg:px-8 lg:py-20">
          <div className="flex items-center gap-3">
            <span className="num text-[11px] font-semibold tracking-[0.2em] text-signal">
              02
            </span>
            <span className="h-px w-10 bg-rule" />
            <span className="label text-muted-foreground">Outputs</span>
          </div>

          <h2 className="display mt-6 max-w-3xl text-[2.2rem] sm:text-[3rem]">
            Five screens. Nothing else in version one.
          </h2>

          <div className="mt-12 grid grid-cols-1 gap-px bg-rule md:grid-cols-3 xl:grid-cols-5">
            {OUTPUTS.map((output, i) => (
              <motion.div
                key={output.index}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.08 }}
                className="group flex flex-col justify-between bg-card p-7 transition-colors hover:bg-paper"
              >
                <div>
                  <div className="flex items-baseline justify-between">
                    <span className="num text-[11px] text-signal">
                      {output.index}
                    </span>
                    <ArrowUpRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" />
                  </div>
                  <h3 className="display mt-6 text-2xl">{output.name}</h3>
                  <p className="mt-4 text-[13.5px] leading-relaxed text-muted-foreground">
                    {output.body}
                  </p>
                </div>
                <Link
                  to={`/auth?returnTo=${encodeURIComponent(output.route)}`}
                  className="label mt-8 inline-flex items-center gap-2 text-ink"
                >
                  Open
                  <ArrowRight className="size-3.5" />
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* The graph */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 py-14 lg:px-8 lg:py-20">
          <div className="grid grid-cols-12 gap-x-4 gap-y-10">
            <div className="col-span-12 lg:col-span-5">
              <div className="flex items-center gap-3">
                <span className="num text-[11px] font-semibold tracking-[0.2em] text-signal">
                  03
                </span>
                <span className="h-px w-10 bg-rule" />
                <span className="label text-muted-foreground">
                  Derived, not assigned
                </span>
              </div>
              <h2 className="display mt-6 text-[2.2rem] sm:text-[2.9rem]">
                Nothing here is
                <br />
                a stored score.
              </h2>
              <p className="mt-6 max-w-md text-[14px] leading-relaxed text-muted-foreground">
                Country and industry exposure is computed by walking the event
                corpus to the nodes that make up each entity. Change the corpus
                and every profile moves with it.
              </p>
              <div className="mt-8 border border-rule bg-card p-5">
                <p className="label text-muted-foreground">
                  The derivation, in full
                </p>
                <p className="num mt-3 text-[12px] leading-relaxed">
                  load = Σ ( impact × structural share × magnitude × confidence ×
                  affinity )
                </p>
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  Every term is printed next to its result on each profile, so
                  you can re-derive the number yourself or argue with the
                  coefficient.
                </p>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-7">
              <div className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-2">
                {[
                  {
                    k: "19",
                    v: "Economies & blocs",
                    n: "Macro structure, energy mix, declared dependencies and reverse-dependencies.",
                  },
                  {
                    k: "7",
                    v: "Infrastructure nodes",
                    n: "Chokepoints, corridors and settlement rails that transmit rather than absorb.",
                  },
                  {
                    k: "10",
                    v: "Industries",
                    n: "Production concentration, demand centres, upstream inputs and route dependency.",
                  },
                  {
                    k: "4",
                    v: "Transmission channels",
                    n: "Trade, energy, finance and diplomatic — scored independently, never averaged away.",
                  },
                ].map((cell) => (
                  <div key={cell.v} className="bg-card p-6">
                    <p className="num display text-[3rem] leading-none opacity-15">
                      {cell.k}
                    </p>
                    <p className="mt-3 text-[13px] font-semibold">{cell.v}</p>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted-foreground">
                      {cell.n}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Uncertainty */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[1600px] px-5 py-14 lg:px-8 lg:py-20">
          <div className="grid grid-cols-12 gap-x-4 gap-y-10">
            <div className="col-span-12 lg:col-span-5">
              <div className="flex items-center gap-3">
                <span className="num text-[11px] font-semibold tracking-[0.2em] text-signal">
                  04
                </span>
                <span className="h-px w-10 bg-rule" />
                <span className="label text-muted-foreground">
                  On uncertainty
                </span>
              </div>
              <h2 className="display mt-6 text-[2.2rem] sm:text-[2.9rem]">
                A point estimate is a claim, not a result.
              </h2>
            </div>
            <div className="col-span-12 lg:col-span-7">
              <div className="border-t border-rule">
                {[
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
                ].map((row, i) => (
                  <motion.div
                    key={row.t}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-60px" }}
                    transition={{ duration: 0.4, delay: i * 0.05 }}
                    className="grid grid-cols-12 gap-x-4 border-b border-rule py-6"
                  >
                    <p className="col-span-12 text-[14px] leading-snug font-medium sm:col-span-5">
                      {row.t}
                    </p>
                    <p className="col-span-12 mt-2 text-[13px] leading-relaxed text-muted-foreground sm:col-span-7 sm:mt-0">
                      {row.d}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-[1600px] px-5 py-16 lg:px-8 lg:py-24">
          <div className="grid grid-cols-12 gap-x-4 gap-y-10">
            <div className="col-span-12 lg:col-span-8">
              <p className="label text-paper/50">05 — Access</p>
              <h2 className="display mt-6 text-[2.4rem] sm:text-[3.6rem]">
                Built for researchers
                <br />
                who have to show their work.
              </h2>
              <p className="mt-6 max-w-xl text-[14px] leading-relaxed text-paper/60">
                An account gives you the full console, a watchlist that spans
                events, countries and sectors, and per-event annotations. Nothing
                is published, nothing is shared, and every score remains
                traceable to its evidence.
              </p>
            </div>
            <div className="col-span-12 lg:col-span-4 lg:flex lg:items-end">
              <div className="flex flex-col gap-3">
                <Link
                  to="/auth"
                  className="group flex items-center justify-between border border-paper px-5 py-4 transition-colors hover:bg-paper hover:text-ink"
                >
                  <span className="label">Create an account</span>
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
                <Link
                  to="/auth"
                  className="label px-1 py-2 text-paper/60 transition-colors hover:text-paper"
                >
                  Already registered — sign in
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-3 px-5 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span className="label text-muted-foreground">
            Meridian · Geopolitical propagation model
          </span>
          <span className="label text-muted-foreground">{CORPUS_LABEL}</span>
        </div>
      </footer>
    </main>
  );
}