# GlobalMatrix

**See what changed. Trace the impact.**

GlobalMatrix is a geopolitical and supply-chain exposure intelligence platform. It connects events to the countries, flows, infrastructure, industries and supply chains they can affect — and shows *why* each is exposed.

Most tools tell you what happened. GlobalMatrix answers: **what does it affect next, and who is exposed?**

---

## What it does

```text
EVENT
  ↓
GEOGRAPHY
  ↓
IMPACT FLOWS          (trade · energy · finance · diplomatic)
  ↓
INFRASTRUCTURE        (chokepoints, corridors — where the shock travels)
  ↓
EXPOSURE              (economies coupled to that infrastructure)
  ↓
INDUSTRY / COMPANY    (sector reach; company-level data is not connected)
  ↓
MACRO OUTCOME         (modelled horizons at 7 / 30 / 90 days)
  ↓
WHAT TO WATCH NEXT
```

Every event resolves its own path: only the flows, places and sectors the event actually reaches are shown. The signature experience is the **Impact Graph** — a full-width interactive propagation panel on every event page, backed by the same nine-stage chain the `/app/chain` view renders end to end.

### The event page answers, in order

1. **Where does it land?** — map of exposed places first
2. **How big is it?** — impact snapshot with score, band and 80% interval
3. **What happens next?** — OBSERVED · CURRENT IMPACT · POTENTIAL NEXT EFFECTS · WATCH · CONFIDENCE
4. **How does it propagate?** — the Impact Graph
5. **What is exposed?** — country, industry and market connections, with companies stated as an honest absence
6. **What is this built on?** — the evidence ledger, source by source

## Core capabilities

- **Global event intelligence** — a versioned event corpus with evidence ledgers per event
- **Impact Graph** — interactive propagation: event → geography → flows → infrastructure → exposure → industry → market → what to watch
- **Risk explorer** — world map with six lenses: Risk, Trade, Energy, Finance, Supply Chain, Geopolitics
- **Country & industry profiles** — exposure snapshot, dependencies, who depends on it, recent events, evidence
- **Exposure ratings** — Low / Moderate / Elevated / High / Severe bands with an explanation of the drivers, never a number alone
- **Scenario lab** — hypothetical runs, always labelled SCENARIO / MODEL OUTPUT
- **Watchlists** — track events, countries and industries per account (`/app/watchlist`)
- **Intelligence briefs** — evidence-grounded summaries generated over the event's own ledger; when evidence is insufficient, it says so
- **Source provenance** — every observation carries source, retrieval time, freshness and data type

## Data

GlobalMatrix integrates publicly accessible authoritative sources where available:

| Source | Status | What it provides |
|--------|--------|------------------|
| **World Bank Open Data** | Connected | Annual national indicators (5 series × 18 economies) |
| **UN Comtrade** | Connected | Reported bilateral merchandise trade (2025) |
| **GDELT** | Connected, rate-limited | Global attention/event signals |
| **European Central Bank** | Connected (keyless) | Daily FX reference rates (9 pairs) and euro-area spot yields (2Y / 10Y / 30Y) |
| IMF, OECD, FRED, energy, search-trend, policy feeds | **Not connected** | Listed as NOT CONNECTED on the sources page rather than simulated |

Each observation is labelled by provenance:

- **OBSERVED** — pulled verbatim from a named source
- **MODEL OUTPUT** — computed by GlobalMatrix from observed inputs
- **SCENARIO** — hypothetical or simulated; never a prediction

Freshness is shown on every data-driven view (LIVE / RECENT / DELAYED / HISTORICAL / UNAVAILABLE). A delayed or failed source keeps its last verified observation on screen, clearly labelled, instead of substituting a stand-in.

**The event corpus itself is a SCENARIO corpus**, versioned in code (`src/lib/intel/scenarios-*.ts`, `CORPUS_VERSION`). Every page that renders it says so.

## Technology

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Framer Motion, Lucide |
| Backend | Convex (reactive queries/mutations, Convex Auth) |
| Charts & maps | Custom SVG maps on Natural Earth geometry, custom charts |
| Intelligence | Exposure model, propagation graph, nine-stage chain, provenance tracking |

## Getting started

```bash
# Install dependencies (Bun)
bun install

# Start the Convex backend (follow the prompts on first run)
bun convex dev

# In a second terminal, start the frontend
bun run dev
```

Copy `.env.example` to `.env.local` and fill in the keys it lists.

### Quality gates

```bash
bunx tsc -b --noEmit   # typecheck
bun run lint           # eslint
bun run build          # production build
```

There is currently **no automated test suite** in this repository; the gates above plus Convex function runs are the verification that exists.

## Known limitations (stated, not hidden)

- **No company-level data.** No filings, ownership or issuer-level source is connected, so no company is ever named as affected. The event page says exactly this instead of showing a blank.
- **No price feed.** Markets shows reported growth, coverage and ECB reference rates only — nothing tradeable, nothing presented as a price.
- **No email alerts.** Watchlists store what you track; delivery of alerts is not built.
- **Scenario corpus.** Events are a versioned scenario set, labelled everywhere it renders.
- **Search-interest signals**, where ever added, must be labelled SEARCH INTEREST SIGNAL and never used as causal evidence.

## Responsible use

GlobalMatrix is a decision-support tool, not financial, legal, or investment advice. Modelled outputs and scenarios are analytical aids and should be verified against primary sources before acting on them.

## License

Add your license here (e.g., MIT).

---

**GlobalMatrix. See what changed. Trace the impact.**
