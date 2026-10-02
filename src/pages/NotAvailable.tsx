import { useLocation } from "react-router";
import { PageHead } from "@/components/viz/Shell";
import { Panel } from "@/components/viz/core";

const REASONS: Record<string, { data: string; because: string }> = {
  Companies: {
    data: "company graph, supplier relationships, filings",
    because:
      "There is no company dataset behind this application. Any dependency or exposure shown for a company would be invented.",
  },
  Trade: {
    data: "bilateral trade flows, values, commodities",
    because:
      "No trade-flow dataset exists here. The map shows transmission links computed by the model, not commercial trade lanes, and they are not interchangeable.",
  },
  Markets: {
    data: "prices, indices, FX, rates, volatility",
    because:
      "No market feed is connected. Prices, sparklines and heatmaps would be fabricated numbers, which is the one thing an intelligence product must never do.",
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
  trade: "Trade",
  markets: "Markets",
  policy: "Policy",
  analogues: "Analogues",
};

export default function NotAvailable() {
  const { pathname } = useLocation();
  const slug = pathname.split("/").filter(Boolean).pop() ?? "";
  const module = SLUG_TO_MODULE[slug];
  const reason = module ? REASONS[module] : undefined;

  return (
    <main className="min-w-0">
      <PageHead
        title={module ?? "Unavailable"}
        lede={
          reason
            ? "This module is intentionally empty rather than populated with invented data."
            : "This module has no data source in the current build."
        }
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
                ["Overview", "/app", "map, radar, gauges, timeline"],
                ["Events", "/app/events", "ranked detection feed"],
                ["World", "/app/world", "geospatial transmission graph"],
                ["Countries", "/app/countries", "19 economies + infrastructure"],
                ["Industries", "/app/industries", "10 sectors"],
                ["Supply chains", "/app/supply", "dependency chains"],
                ["Risk", "/app/risk", "event × channel matrix"],
                ["Graph", "/app/graph", "propagation explorer"],
                ["Scenarios", "/app/scenarios", "re-scored perturbations"],
                ["AI analyst", "/app/analyst", "evidence-grounded briefs"],
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
    </main>
  );
}