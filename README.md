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

### Environment

Vite only exposes variables prefixed with `VITE_` to the browser. Everything
else is read by the Convex CLI — and variables consumed by the Convex
**functions** must be set on the deployment itself, not in `.env.local`
(`npx convex env set NAME value`, `npx convex env list`).

| Variable | Where it lives | Required | Purpose |
|---|---|---|---|
| `VITE_CONVEX_URL` | `.env.local` | Yes | Convex deployment URL. Without it the app renders an explicit "configuration required" screen rather than a blank page. |
| `CONVEX_DEPLOYMENT` | `.env.local` | Yes | Deployment targeted by `npx convex dev`. |
| `CONVEX_SITE_URL` | Convex deployment env | Yes | Origin Convex Auth issues tokens for (`http://localhost:5173` in dev). |
| `ANTHROPIC_API_KEY` | Convex deployment env | Optional | Enables the AI analyst brief (`src/convex/brief.ts`). With no key the action returns a structured "add ANTHROPIC_API_KEY" refusal instead of degrading to invented prose. |
| `VLY_INTEGRATION_KEY` | Convex deployment env | Auto | Sends email sign-in codes (`src/convex/auth/emailOtp.ts`). Injected on Freebuff-created projects. |

`.env`, `.env.*` and `.env.keys` are git-ignored. No secret may ever carry a
`VITE_` prefix: that prefix compiles the value into the public client bundle.

### Quality gates

```bash
bunx convex dev --once  # push functions and regenerate types
bunx tsc -b --noEmit    # typecheck
bun run lint            # eslint
bun test                # unit suite
bun run build           # production build
```

### Tests

The suite runs on Bun's built-in runner — `bun test`, no framework to install.
It covers the parts of the product where a silent error would be a lie rather
than a crash, which is why it leans on data contracts rather than on rendering:

| Area | What is pinned |
|------|----------------|
| `freshness` | The five freshness states and their boundaries. In particular that an annual publisher is **never** LIVE however recently it was fetched, and that a missing timestamp is UNAVAILABLE and never a zero. |
| `sources` | Every source declares what it is *not* evidence of; `asOf` formatting normalises all three upstream shapes and returns nothing rather than guessing at an unparseable one. |
| `ecb` | The connector's failure contract. Every failure path must produce **no reading**: `ok: false`, an empty payload, and a plain-language problem — never a salvaged partial body, and never a fabricated value. |
| `exposure` | The exposure model is bounded, deterministic, reconciles its parts with its total, and traces every contribution back to a real event. |
| `engine` | The 80% interval contains its own score at every horizon and widens with time; band thresholds are exact and monotone; the corpus memo is keyed on identity. |
| `corpus` | Graph and corpus integrity: unique node ids, placed-or-abstract nodes, and **no dangling node references**. |

The corpus test is not hypothetical. It was written against a real defect: four
pathway exposures pointed at node ids the transmission graph did not define, so
`getNode` answered with its placeholder and the UI printed a bare ISO code where
a country name belongs. Nothing threw. See *Known limitations* below for what
is still modelled but not profiled.

## Known limitations (stated, not hidden)

- **No company-level data.** No filings, ownership or issuer-level source is connected, so no company is ever named as affected. The event page says exactly this instead of showing a blank.
- **No price feed.** Markets shows reported growth, coverage and ECB reference rates only — nothing tradeable, nothing presented as a price.
- **No email alerts.** Watchlists store what you track; delivery of alerts is not built.
- **Scenario corpus.** Events are a versioned scenario set, labelled everywhere it renders.
- **Search-interest signals**, where ever added, must be labelled SEARCH INTEREST SIGNAL and never used as causal evidence.
- **Four modelled economies have no national-accounts profile.** Egypt, Argentina, the Philippines and Ukraine appear in the corpus and are defined as nodes in the transmission graph, because events genuinely reach them — but `countries.ts` has no macro profile for them. Their profile page renders the exposure the model derives and shows no trade or energy section, rather than filling one with estimates. They carry the reference `criticality` of 0.5, which is the value the model was already applying to them through `getNode`'s fallback; adding them changed no score.

## Responsible use

GlobalMatrix is a decision-support tool, not financial, legal, or investment advice. Modelled outputs and scenarios are analytical aids and should be verified against primary sources before acting on them.

## License

Add your license here (e.g., MIT).

---

**GlobalMatrix. See what changed. Trace the impact.**
