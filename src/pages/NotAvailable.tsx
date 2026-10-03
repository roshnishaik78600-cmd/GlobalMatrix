import { useLocation } from "react-router";
import { PageFrame } from "@/components/viz/exec/design";
import { Panel } from "@/components/viz/core";
import { QuestionStrip } from "@/components/viz/Unavailable";

const REASONS: Record<string, { data: string; because: string }> = {
  Companies: {
    data: "company graph, supplier relationships, filings",
    because:
      "There is no company dataset behind this application. Any dependency or exposure shown for a company would be invented.",
  },
  Policy: {
    data: "policy registry with lifecycle status",
    because:
      "Policies appear inside event pathways, but there is no standalone registry tracking proposed → enacted → implemented status.",
  },
  Analogues: {
    data: "historical event corpus with outcome records",
    because:
      "Similarity search needs a labelled history. None exists, so any 'historical analogue' would be fabricated rather than retrieved.",
  },
};

const SLUG_TO_MODULE: Record<string, string> = {
  companies: "Companies",
  policy: "Policy",
  analogues: "Analogues",
};

export default function NotAvailable() {
  const { pathname } = useLocation();
  const slug = pathname.split("/").filter(Boolean).pop() ?? "";
  const module = SLUG_TO_MODULE[slug];
  const reason = module ? REASONS[module] : undefined;

  return (
      <PageFrame
        eyebrow={module ?? "Unavailable"}
        title={module ?? "Unavailable"}
        lede={
          reason
            ? "This module is intentionally empty rather than populated with invented data."
            : "This module has no data source in the current build."
        }
      >
      <QuestionStrip
        className="border-b border-rule"
        answers={[
          {
            q: "What's happening?",
            a: "Nothing here, and nothing is faked to fill the gap.",
          },
          {
            q: "Why is it empty?",
            a: reason?.data
              ? `It needs ${reason.data}.`
              : "It needs a data source that is not connected.",
          },
          {
            q: "What can I use instead?",
            a: "The same question, answered one level up: countries, sectors and the propagation chain.",
            href: "/app/chain",
          },
          {
            q: "Show evidence",
            a: "The source register lists every feed that is connected, and what each one is not evidence of.",
            href: "/app/data",
          },
        ]}
      />
      <div className="grid grid-cols-1 gap-3 p-3 xl:grid-cols-12">
        <section className="xl:col-span-7">
          <Panel title="Status" meta="no data available">
            <div className="space-y-3 p-4">
              <div className="flex items-baseline justify-between border-b border-rule pb-2">
                <span className="label text-muted-foreground">
                  Required data source
                </span>
                <span className="text-[12.5px]">{reason?.data ?? "—"}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                {reason?.because ??
                  "No dataset is connected for this surface, so it renders nothing rather than plausible-looking placeholders."}
              </p>
              <p className="border-l-2 border-signal pl-3 text-[12.5px] leading-relaxed">
                Every surface that <em>is</em> populated is driven by the
                propagation engine and can be traced back to a signal, a
                pathway or a stated coefficient.
              </p>
            </div>
          </Panel>
        </section>

        <section className="xl:col-span-5">
          <Panel title="Available now" meta="fully data-backed">
            <ul className="divide-y divide-rule">
              {[
                ["Overview", "/app", "map, six signals, live change"],
                ["Event → world", "/app/chain", "event to market, stage by stage"],
                ["Events", "/app/events", "ranked detection feed"],
                ["World", "/app/world", "real geography, couplings, events"],
                ["Countries", "/app/countries", "economies + infrastructure"],
                ["Industries", "/app/industries", "sector exposure"],
                ["Supply chains", "/app/supply", "dependency chains"],
                ["Trade", "/app/trade", "reported merchandise values"],
                ["Markets", "/app/markets", "reported growth, coverage"],
                ["Risk", "/app/risk", "event × channel matrix"],
                ["Graph", "/app/graph", "propagation explorer"],
                ["Scenarios", "/app/scenarios", "re-scored perturbations"],
                ["AI analyst", "/app/analyst", "evidence-grounded briefs"],
                ["Sources", "/app/data", "what is connected, and its limits"],
              ].map(([label, to, note]) => (
                <li key={to}>
                  <a
                    href={to}
                    className="flex items-center justify-between gap-3 px-3 py-2.5 transition-colors hover:bg-white/4"
                  >
                    <span className="text-[12.5px]">{label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {note}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </Panel>
        </section>
      </div>
    </PageFrame>
  );
}