# 🌍 GlobalMatrix

**See what changed. Trace the impact. Understand exposure.**

GlobalMatrix is a geopolitical and supply-chain exposure intelligence platform. It connects real-world events to the countries, trade flows, infrastructure, industries, and companies they can affect, and shows *why* each is exposed.

Most tools tell you **what happened**. GlobalMatrix answers: **what does it affect next, and who is exposed?**

---

## The Problem

When a major event happens, the information needed to understand its impact is scattered across news feeds, trade databases, government statistics, commodity data, and company disclosures. Analysts connect these pieces by hand, slowly and inconsistently.

GlobalMatrix links that evidence into a single, traceable view.

## How It Works

At the core is the **Impact Graph**: a visual network showing how an event propagates. Different events take different paths.

```text
Oil disruption                         Semiconductor export restriction
  → Energy supply risk                   → Trade flows
  → Shipping costs                       → Chip supply
  → Import-dependent economies           → AI infrastructure
  → Affected industries                  → Data centers
  → Exposed companies                    → Technology companies
```

Every node is clickable and every relationship links back to its evidence.

### The workflow

| Step | Question | What you get |
|------|----------|--------------|
| **Discover** | What changed? | Verified, source-attributed events |
| **Trace** | How does it propagate? | An explorable Impact Graph |
| **Assess** | Who is exposed, and why? | Exposure by country, industry, supply chain, company |
| **Monitor** | What should I watch? | Watchlists and alerts on exposure changes |

## Trust by Design

Intelligence is only useful if it can be trusted. Every output is labelled by how it was produced:

| Label | Meaning |
|-------|---------|
| **Observed** | Directly supported by available data |
| **Modelled** | Derived through an analytical process |
| **Scenario** | A hypothetical future condition, never a prediction |
| **AI interpretation** | AI-generated explanation grounded in cited evidence |

The platform exposes sources and data freshness, states its confidence, and says so plainly when verified information is unavailable. It does not fabricate data.

## Exposure Intelligence

Exposure is rated **Low · Moderate · High · Critical**, but the score is never the point. The point is the *explanation*: geographic dependency, supplier concentration, trade or commodity dependency, and event severity. Only dimensions backed by evidence contribute to a rating.

## Who It's For

Built first for **supply-chain, procurement, and risk teams** who need to understand how geopolitical events reach their suppliers and operations. Also useful to analysts, consultants, researchers, and students.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS, shadcn/ui, Framer Motion |
| Backend | Convex (TypeScript, reactive data layer) |
| Intelligence | Event detection, entity extraction, graph-based propagation, AI-assisted analysis, provenance tracking |

**Data sources (where available):** GDELT, UN Comtrade, World Bank, IMF, OECD, FRED, government and regulatory publications, public corporate disclosures. Availability and licensing vary by source.

## Getting Started

```bash
# Install dependencies
npm install

# Start the Convex backend (follow the prompts on first run)
npx convex dev

# In a second terminal, start the frontend
npm run dev
```

Copy `.env.example` to `.env.local` and add the required keys. See the comments in that file for details.

## Roadmap

- [ ] **Foundation:** stable architecture, verified event ingestion, source attribution, error handling, responsive UI
- [ ] **Impact Intelligence:** Impact Graph, entity relationships, supply-chain and company exposure
- [ ] **Monitoring:** watchlists, exposure-change alerts, historical event analysis
- [ ] **AI Intelligence:** evidence-grounded analysis, intelligence briefs, scenario analysis, natural-language graph exploration
- [ ] **Commercial:** team workflows, exports, API access

Expansion follows validated user demand, not feature accumulation.

## Design Principles

- Evidence before decoration
- Clarity over dashboard clutter
- Uncertainty is shown, never hidden
- Every feature must explain impact, exposure, or propagation

## Project Status

🚧 **Active development.** Current focus: platform stability, data integrity, the Impact Graph, and supply-chain exposure.

## Responsible Use

GlobalMatrix is a decision-support tool, not financial, legal, or investment advice. Modelled outputs and scenarios are analytical aids and should be verified against primary sources before acting on them.

## License

Add your license here (e.g., MIT).

---

**GlobalMatrix. Global intelligence, connected.**
