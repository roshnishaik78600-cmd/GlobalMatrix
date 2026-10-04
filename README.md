# GlobalMatrix

**See how the world connects.**

A geopolitical and macroeconomic intelligence platform that maps how global events propagate across trade, energy, finance and supply chains — and shows its own work.

[![Convex](https://img.shields.io/badge/backend-Convex-3c6cff)](https://docs.convex.dev)
[![React](https://img.shields.io/badge/React-19-61dafb)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![Tailwind](https://img.shields.io/badge/Tailwind-v4-06b6d4)](https://tailwindcss.com)

---

## The problem

Geopolitical risk is usually presented as a score on a map — a number with no visible
chain of reasoning behind it. Two teams can look at the same event and reach opposite
conclusions, and neither can say whether the difference came from the data, the
formula, or the assumptions.

GlobalMatrix takes the opposite position. Every figure on the platform carries four
things: the **source** it came from, the **moment** it was retrieved, the **kind** of
thing it is (observed / model output / scenario / AI interpretation), and the
**caveat** that qualifies it. Where a source is unreachable, the panel says
`No verified data available` and shows nothing — the gap is a result, not a bug.

The second problem is propagation. An event does not stop at the country where it
happened. GlobalMatrix represents it as a graph and follows it: event → country →
trade → energy → supply chain → industry → market, with each edge weighted by
magnitude and confidence, and each stage explicitly marked when there is no data
behind it.

## What it does

| Surface | What it answers |
| --- | --- |
| **Overview** | Global map, six-domain global pulse, a visual timeline of what is changing, and the event → world chain |
| **World map** | Every tracked economy and chokepoint on real Natural Earth geometry, shaded by live load, with coupling arcs |
| **Events** | The detection feed: ranked events with velocity, evidence strength, dominant channel and latest signal |
| **Event analysis** | Event → map → propagation graph → timeline → impact → evidence ledger, for one event |
| **Risk** | Global risk map, drivers, affected regions, trends, connected events and the uncertainty interval behind every score |
| **Countries** / **Industries** | Exposure profiles: key metrics, channel load, dependencies, peers, trends and the causal path that produced the load |
| **Trade** | UN Comtrade reporter totals, trade openness against World Bank GDP |
| **Supply chains** | Which single points of failure are load-bearing right now, and which sectors declare a dependency on them |
| **Event → world** | One event followed through every stage, with the two unmeasurable stages left open rather than estimated |
| **Scenarios** | Run a named shock against the model and read the delta it produces, labelled as hypothetical throughout |
| **AI analyst** | Optional model-written briefs, constrained to re-weigh evidence the deterministic engine already surfaced |
| **Sources** | `SOURCE │ STATUS │ LAST UPDATED │ DATA TYPE` for every connector, plus what is *not* connected and why |

## Data integrity

This is the part of the project that matters most, so it is worth being precise about.

**Four kinds of number, always labelled.**

- **Observed** — pulled verbatim from a named public source, shown with the period it
  covers. If the source could not be reached, the figure is hidden, never estimated.
- **Model output** — computed here from observed inputs under a published formula.
  Deterministic and re-derivable, but it is our arithmetic, not a measurement.
- **Scenario** — a hypothetical change the reader asked us to run. Nothing in it has
  happened and nothing in it is evidence about the world.
- **AI interpretation** — model-written prose. Permitted only to re-weigh evidence the
  deterministic engine already surfaced, and required to carry its own caveats.

**No invented data.** The event corpus is code, not a database — a synthetic,
internally-consistent scenario set (`src/lib/intel/scenarios-*.ts`, corpus
`v1.0.0`) whose every number is deterministic and reproducible so a researcher can
audit the arithmetic end to end. It is labelled **Scenario** everywhere it appears.
External readings only ever come from a live connector, and the write path that stores
them is an internal Convex mutation that validates each outcome against the source
registry before it can be read back — a client cannot inject a fabricated World Bank
figure.

**Honest failure.** A connector that times out, is rate-limited or returns an
unexpected shape writes an `unavailable` observation with a plain-language reason. The
UI renders *"No verified data available"* and hides the figures. There is no
placeholder, no carry-forward and no interpolation anywhere in the read path.

## Real data sources

| Source | Publisher | Covers | Keyless |
| --- | --- | --- | --- |
| [World Bank Open Data](https://data.worldbank.org) | The World Bank Group | Annual GDP, inflation, trade openness, population for 18 of the 19 tracked economies | yes |
| [UN Comtrade](https://comtradeplus.un.org) | UN Statistics Division | Annual merchandise trade totals, US$, 10 reporters | yes |
| [GDELT Project](https://www.gdeltproject.org) | George Mason University | 7-day news coverage volume and article headlines | yes |

**Not connected, and stated on the Sources page rather than hidden:** Google Trends
(no supported public API), equity/FX prices (no licensed feed), company filings,
bilateral trade corridors (the Comtrade preview tier reports reporter totals only),
commodity-level flows and prices, company supply relationships, and a policy lifecycle
registry. The product is designed so that each of these absences is visible.

> **GDELT measures media attention, not events.** Coverage volume is not evidence that
> something happened, nor how severe it is. The UI labels it accordingly.

## Architecture

```
Browser ── React 19 + Vite ── Convex client
                                     │
        ┌────────────────────────────┴───────────────────────────┐
        │ Convex runtime (queries + mutations)                   │
        │   schema: observations · watchlist · annotations ·     │
        │           briefs · auth tables                         │
        │   queries: intel · macroTopology · chokepoints ·       │
        │            observations · users                        │
        │   mutations: research (auth-gated) · observations*     │
        └────────────────────────────┬───────────────────────────┘
                                     │
        ┌────────────────────────────┴───────────────────────────┐
        │ Convex Node runtime (actions)                          │
        │   sources: World Bank / Comtrade / GDELT connectors    │
        │   brief:   Anthropic analyst briefs                    │
        └────────────────────────────┬───────────────────────────┘
                                     │
                    World Bank · UN Comtrade · GDELT · Anthropic

* observations.storeObservations is an internalMutation — connector-only.
```

**The core model.** The event corpus is the substrate. A deterministic engine
(`src/lib/intel/engine.ts`) assesses every event once, producing channel pressure,
risk with an 80% interval, velocity and uncertainty. Everything downstream — country
profiles, industry profiles, the chokepoint board, the risk radar, the map — is
*derived* from that one assessment by walking the propagation graph, which is what
makes every number auditable back to the corpus that produced it.

**Propagation.** Each pathway carries a channel, a magnitude, a confidence and an
impact per exposed node. Node load is the sum of `impact × magnitude × confidence`.
Normalisation ceilings are fixed constants rather than corpus maxima, so one severe
event cannot silently rescale every other profile.

## Tech stack

React 19 · TypeScript (strict) · Vite 7 · Tailwind CSS v4 · Convex · Convex Auth ·
Recharts · Framer Motion · shadcn/ui · Lucide · Bun

## Authentication model

**Public intelligence requires no account.** Every dashboard, map, profile and report
is readable while signed out.

An account is needed only for state that belongs to one person:

- watchlists (watched events, countries, sectors)
- saved research annotations
- saved analyst briefs

Sign-in offers email OTP or guest. Auth is Convex Auth with `Anonymous` and a custom
email-OTP provider; the existing configuration is unmodified.

## Setup

Requires [Bun](https://bun.sh) and a [Convex](https://convex.dev) account.

```bash
bun install
bunx convex dev          # link the deployment, push functions, generate types
bun run dev              # http://localhost:5173
```

Push functions once, without the interactive watcher:

```bash
bunx convex dev --once
```

### Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `VITE_CONVEX_URL` | client (`.env.local`) | Convex deployment URL |
| `CONVEX_SITE_URL` | Convex env | Site URL used by the auth provider |
| `CONVEX_DEPLOYMENT` | Convex env | Deployment linked by `convex dev` |
| `ANTHROPIC_API_KEY` | Convex env | **Optional.** Only needed for AI analyst briefs; every other page works without it |

`.env*` files are git-ignored (except `.env.example`). No secret is committed.

## Project structure

```
src/
  convex/
    schema.ts          tables and indexes
    intel.ts           the read model: every page's query
    macroTopology.ts   six-domain 30-day series
    chokepoints.ts     infrastructure board
    observations.ts    verified-data cache (internal write path)
    sources.ts         World Bank / Comtrade / GDELT connectors
    brief.ts           Anthropic analyst briefs
    research.ts        watchlists and annotations (auth-gated)
    auth.ts            Convex Auth providers
  lib/
    intel/             the model: corpus, engine, exposure, geography
    sources.ts         source registry, provenance types, data statuses
  components/
    viz/               maps, charts, the console shell, design system
    intel/             shared app primitives
  pages/               one file per route
```

## Testing and QA

```bash
bun tsc -b --noEmit   # typecheck        — 0 errors
bunx eslint src       # lint             — 0 errors
bun run build         # production build — succeeds
bunx convex dev --once && bunx tsc -b --noEmit   # backend typecheck + codegen
```

Current state: **zero TypeScript errors, zero ESLint errors, clean production
build.** Lint output is limited to `react-refresh/only-export-components` warnings.

There is no automated test suite yet — the QA above is static analysis plus live
`convex run` probes against the deployed functions. Adding a runner and unit tests
around the exposure engine is the first item on the roadmap.

## Current limitations

Stated plainly, because the product's credibility depends on it.

- **No live event feed.** The 12-event corpus is synthetic and labelled Scenario. It
  demonstrates the model; it is not reporting.
- **No price data.** No equity, FX or commodity feed is connected.
- **No company layer.** No filing or supply-relationship dataset, so the company
  stage of the chain is deliberately left open.
- **Reporter totals only.** Comtrade's public preview tier does not give a bilateral
  corridor matrix.
- **No automated tests.**
- **One analyst model.** `claude-sonnet-4-5`, called only when a reader asks for a
  brief.

## Roadmap

1. Vitest suite covering the exposure engine and the connector validators
2. Playwright smoke tests over all 24 routes, including the unauthenticated path
3. A second corpus version to demonstrate delta behaviour
4. IMF WEO connector (the endpoint currently rejects clients without a contact URL)
5. Bilateral trade corridors behind a subscription Comtrade key
6. Export a sourced, citation-complete event brief

---

Built with care for people who need to know where a number came from.