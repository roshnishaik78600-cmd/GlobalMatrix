import { CHANNEL_LABEL, type Channel } from "./types";

/**
 * The propagation chain, as data.
 *
 * One definition of "what the nine stages are and what each one reports", in a
 * plain module with no React and no Convex imports. Two surfaces render it — the
 * console's chain page and the homepage's Follow the Shock section — and they
 * must not be able to disagree about what stage six means.
 *
 * The stages are the order a shock actually travels:
 *
 *   event → country → trade → energy → infrastructure
 *         → supply chain → industry → company → market
 *
 * Two rules this module enforces rather than leaving to a caller:
 *
 * 1. A stage with nothing measured to report carries its own reason. A stage
 *    that silently renders empty reads as "no effect", which is a different and
 *    much stronger claim than "not measured by this build".
 * 2. INFRASTRUCTURE and SUPPLY CHAIN stay separate. Infrastructure is *where*
 *    the shock travels; supply chain is *how far it carries* from there. Merging
 *    them would report one idea twice and call it two.
 */

/** One selectable entry inside a stage. */
export interface ChainRow {
  id: string;
  label: string;
  href?: string;
  meta?: string;
  /** 0..1, normalised; drives both the bar and the risk-ramp tint. */
  weight?: number;
  /** Prose shown in the detail panel when this row is selected. */
  detail?: string;
}

export interface ChainStage {
  id: ChainStageId;
  title: string;
  /** The question this stage answers, as a heading. */
  question: string;
  /** One line on what the stage measures, shown when nothing is selected. */
  about: string;
  rows: ChainRow[];
  /** Set only where the stage genuinely has nothing measured to report. */
  unmeasured?: { title: string; reason: string };
}

export type ChainStageId =
  | "event"
  | "country"
  | "trade"
  | "energy"
  | "infrastructure"
  | "supply"
  | "industry"
  | "company"
  | "market";

/** The payload shape `convex/intel.eventChain` returns. */
export interface ChainPayload {
  event: {
    id: string;
    reference: string;
    title: string;
    summary: string;
    detectedAt: string;
    stage: string;
    score: number;
    low: number;
    high: number;
    band: string;
    uncertainty: number;
    confidence: number;
    regions: string[];
    actors: string[];
  };
  countries: { nodeId: string; label: string; load: number }[];
  trade: ChannelExposure[];
  energy: ChannelExposure[];
  infrastructure: (ChannelExposure & {
    kind: string;
    region: string;
    criticality: number;
  })[];
  supply: {
    nodeId: string;
    label: string;
    load: number;
    via: string | null;
  }[];
  industries: {
    id: string;
    label: string;
    share: number;
    channel?: Channel;
  }[];
  market: ChannelExposure[];
  companyReason: string;
}

interface ChannelExposure {
  nodeId: string;
  label: string;
  mechanism: string;
  lagDays: [number, number];
  confidence: number;
  impact: number;
  note: string;
}

/** The nine stages in travel order. */
export const CHAIN_ORDER: ChainStageId[] = [
  "event",
  "country",
  "trade",
  "energy",
  "infrastructure",
  "supply",
  "industry",
  "company",
  "market",
];

/** One line, for the strip under the chain: what the stage measures. */
export const CHAIN_SUMMARY: Record<ChainStageId, string> = {
  event: "Scored and dated",
  country: "Where it lands",
  trade: "Reported flows",
  energy: "Channel pathways",
  infrastructure: "Chokepoints it crosses",
  supply: "How far it carries",
  industry: "Structural share",
  company: "Not measured",
  market: "Modelled pressure",
};

/**
 * Build the renderable stage list for one event.
 *
 * Returns the stages in a fixed order regardless of which ones have rows, so
 * the chain always draws the same shape and a gap is visibly a gap.
 */
export function buildStages(chain: ChainPayload): ChainStage[] {
  const lag = (l: [number, number]) => `${l[0]}–${l[1]}d`;

  return [
    {
      id: "event",
      title: "Event",
      question: "What happened?",
      about:
        "The scored event this chain is about, with the 30-day composite and the 80% interval it sits inside.",
      rows: [
        {
          id: chain.event.id,
          label: chain.event.title,
          href: `/app/event/${chain.event.id}`,
          meta: `${chain.event.reference} · detected ${chain.event.detectedAt}`,
          weight: chain.event.score / 100,
          detail: chain.event.summary,
        },
      ],
    },
    {
      id: "country",
      title: "Country",
      question: "Where does it land hardest?",
      about:
        "Economies exposed to this event, ranked by summed impact × pathway confidence across every channel it travels on.",
      rows: chain.countries.map((c) => ({
        id: c.nodeId,
        label: c.label,
        href: `/app/country/${c.nodeId}`,
        weight: Math.min(1, c.load),
        detail:
          "Total weighted exposure across the trade, energy, finance and diplomatic pathways this event runs on.",
      })),
    },
    {
      id: "trade",
      title: "Trade",
      question: "How does it travel?",
      about:
        "The trade-channel pathways this event runs on, with the mechanism it travels by and the lag window before it lands.",
      rows: chain.trade.map((t) => ({
        id: t.nodeId,
        label: t.label,
        href: `/app/country/${t.nodeId}`,
        meta: `${t.mechanism} · ${lag(t.lagDays)}`,
        weight: t.impact,
        detail: t.note,
      })),
      unmeasured: {
        title: "No trade pathway",
        reason:
          "This event has no trade-channel pathway in the corpus, so nothing travels along trade for it. That is an absence, not a zero.",
      },
    },
    {
      id: "energy",
      title: "Energy",
      question: "Where does the flow change?",
      about:
        "The energy-channel pathways, with their mechanism and lag window. Energy carries the largest weight of the four channels in the composite.",
      rows: chain.energy.map((t) => ({
        id: t.nodeId,
        label: t.label,
        href: `/app/country/${t.nodeId}`,
        meta: `${t.mechanism} · ${lag(t.lagDays)}`,
        weight: t.impact,
        detail: t.note,
      })),
      unmeasured: {
        title: "No energy pathway",
        reason:
          "This event has no energy-channel pathway in the corpus, so it carries no energy transmission.",
      },
    },
    {
      id: "infrastructure",
      title: "Infrastructure",
      question: "What does it pass through?",
      about:
        "The chokepoints, straits and corridors this event actually travels through. These are places, not flows — the map links elsewhere are couplings, not shipping routes.",
      rows: chain.infrastructure.map((n) => ({
        id: n.nodeId,
        label: n.label,
        href: `/app/country/${n.nodeId}`,
        meta: `${n.kind} · ${n.region}`,
        weight: n.impact * n.confidence,
        detail: `${n.mechanism} · arrives in ${lag(n.lagDays)}. Structural criticality ${(n.criticality * 100).toFixed(0)}%.`,
      })),
      unmeasured: {
        title: "No infrastructure on this path",
        reason:
          "This event's pathways expose no chokepoint or corridor, so it does not route through a tracked node of infrastructure.",
      },
    },
    {
      id: "supply",
      title: "Supply chain",
      question: "How far does it carry?",
      about:
        "Economies reached by coupling to the infrastructure above. The coupling term is derived from shared exposure across the whole corpus; it is a statement about how two places move together, not a shipping lane.",
      rows: chain.supply.map((s) => ({
        id: s.nodeId,
        label: s.label,
        href: `/app/country/${s.nodeId}`,
        meta: s.via ? `carried via ${s.via}` : undefined,
        weight: Math.min(1, s.load),
        detail: s.via
          ? `Carried principally through ${s.via}, the infrastructure node this event presses on hardest.`
          : "No tracked infrastructure couples this economy to the others this event touches.",
      })),
      unmeasured: {
        title: "No supply-chain carry",
        reason:
          "No economy is coupled to this event's infrastructure strongly enough to rank. The chain stops at the infrastructure node itself.",
      },
    },
    {
      id: "industry",
      title: "Industry",
      question: "Which sectors feel it?",
      about:
        "Industries reached by structural share through the nodes this event exposes — the sector-level counterpart to country exposure.",
      rows: chain.industries.map((i) => ({
        id: i.id,
        label: i.label,
        href: `/app/industry/${i.id}`,
        meta: i.channel
          ? `via ${CHANNEL_LABEL[i.channel as Channel].toLowerCase()}`
          : undefined,
        weight: Math.min(1, i.share),
        detail:
          "Structural share of this industry exposed to the nodes this event reaches.",
      })),
      unmeasured: {
        title: "No industry reached",
        reason:
          "No tracked industry shares enough structural exposure with the nodes this event touches to rank.",
      },
    },
    {
      id: "company",
      title: "Company",
      question: "Which firms carry it?",
      about: "Not measured by this build.",
      rows: [],
      unmeasured: {
        title: "Company exposure",
        reason: chain.companyReason,
      },
    },
    {
      id: "market",
      title: "Market",
      question: "What does it do to prices?",
      about:
        "The finance-channel pathways for this event. Model output, not a price: no market quote is connected, so nothing here can be called a market move.",
      rows: chain.market.map((m) => ({
        id: m.nodeId,
        label: m.label,
        href: `/app/country/${m.nodeId}`,
        meta: `${m.mechanism} · ${lag(m.lagDays)}`,
        weight: m.impact,
        detail: m.note,
      })),
      unmeasured: {
        title: "No finance pathway",
        reason:
          "This event carries no finance-channel pathway, so it has no modelled market transmission. No price feed is connected either, so nothing here could be a quote.",
      },
    },
  ];
}

/** True when a stage has at least one row it can honestly show. */
export function hasRows(stage: ChainStage): boolean {
  return stage.rows.length > 0;
}