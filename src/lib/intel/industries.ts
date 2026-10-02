import type { Channel } from "./types";

/**
 * Industry / sector reference layer.
 *
 * Structural parameters are illustrative and always labelled MODELLED. The
 * exposure figures on an industry profile are not stored here — they are
 * computed in the engine from the event corpus by walking the graph to this
 * industry's producers, consumers and routes.
 */

export interface ProducerShare {
  nodeId: string;
  /** Share of global output, 0..1. */
  share: number;
  note?: string;
}

export interface ConsumerShare {
  nodeId: string;
  /** Share of global demand, 0..1. */
  share: number;
}

export interface IndustryInput {
  /** Upstream node or commodity corridor. */
  nodeId: string;
  share: number;
  note: string;
}

export interface IndustryRoute {
  nodeId: string;
  note: string;
}

export interface Industry {
  id: string;
  label: string;
  code: string;
  summary: string;
  /** Raw inputs and upstream corridors. */
  inputs: IndustryInput[];
  /** Global production concentration. */
  producers: ProducerShare[];
  /** Demand centres. */
  consumers: ConsumerShare[];
  /** Chokepoints and corridors the sector depends on. */
  routes: IndustryRoute[];
  /** Channels through which shocks reach this sector most strongly. */
  channelAffinity: Channel[];
  /** Structural single-point-of-failure exposure, 0..1. */
  fragility: number;
  /** Substitution lead time in months — the sector's real constraint. */
  substitutionMonths: number;
  note: string;
}

export const INDUSTRIES: Industry[] = [
  {
    id: "SEMI",
    label: "Semiconductors",
    code: "SEC-MFG-26",
    summary:
      "The most concentrated heavy industry in the corpus: a handful of production nodes, a narrow set of equipment authorities, and a substitution lead time measured in years rather than quarters.",
    inputs: [
      { nodeId: "CN", share: 0.28, note: "Rare-earth and mature-node assembly" },
      { nodeId: "JP", share: 0.2, note: "Photoresist, wafers and precision materials" },
      { nodeId: "TW", share: 0.16, note: "Advanced packaging substrate" },
      { nodeId: "MY", share: 0.12, note: "Assembly and test back-end" },
    ],
    producers: [
      { nodeId: "TW", share: 0.39, note: "Leading-edge logic" },
      { nodeId: "KR", share: 0.24, note: "Memory" },
      { nodeId: "CN", share: 0.18, note: "Mature nodes and assembly" },
      { nodeId: "JP", share: 0.1, note: "Materials and niche devices" },
      { nodeId: "MY", share: 0.07, note: "Test and packaging" },
    ],
    consumers: [
      { nodeId: "US", share: 0.3 },
      { nodeId: "CN", share: 0.24 },
      { nodeId: "EU", share: 0.16 },
      { nodeId: "KR", share: 0.1 },
      { nodeId: "JP", share: 0.08 },
    ],
    routes: [
      { nodeId: "TAIWANSTR", note: "Primary east-west lane for finished devices" },
      { nodeId: "MALACCA", note: "Materials and equipment movement" },
      { nodeId: "HORMUZ", note: "Indirect, via fab power contracts" },
    ],
    channelAffinity: ["trade", "diplomatic", "finance"],
    fragility: 0.91,
    substitutionMonths: 42,
    note: "Concentration, not capacity, is the risk. A capacity shortfall can be met with price; a licensing or tooling restriction cannot be substituted around inside a planning cycle.",
  },
  {
    id: "ENER",
    label: "Energy",
    code: "SEC-ENE-35",
    summary:
      "Hydrocarbon production is geographically concentrated while consumption is broadly distributed, so the sector's exposure lives almost entirely in transport and chokepoints rather than in production.",
    inputs: [
      { nodeId: "RU", share: 0.18, note: "Crude and gas production" },
      { nodeId: "SA", share: 0.17, note: "Crude production" },
      { nodeId: "IR", share: 0.14, note: "Crude and gas production" },
      { nodeId: "HORMUZ", share: 0.2, note: "Transit route rather than production" },
    ],
    producers: [
      { nodeId: "RU", share: 0.17 },
      { nodeId: "SA", share: 0.16 },
      { nodeId: "US", share: 0.15 },
      { nodeId: "IR", share: 0.13 },
      { nodeId: "CN", share: 0.08 },
    ],
    consumers: [
      { nodeId: "US", share: 0.16 },
      { nodeId: "CN", share: 0.15 },
      { nodeId: "EU", share: 0.12 },
      { nodeId: "IN", share: 0.1 },
      { nodeId: "JP", share: 0.08 },
      { nodeId: "KR", share: 0.07 },
    ],
    routes: [
      { nodeId: "HORMUZ", note: "No meaningful bypass at scale" },
      { nodeId: "REDSEA", note: "Alternative for Suez-bound cargoes" },
      { nodeId: "MALACCA", note: "Asian destination route" },
      { nodeId: "SUZK", note: "Canal transit for Atlantic-basin cargoes" },
    ],
    channelAffinity: ["energy", "finance", "trade"],
    fragility: 0.94,
    substitutionMonths: 34,
    note: "The fastest-transmitting channel in the model and the least substitutable on a quarter's horizon. Distance, not volume, sets the price.",
  },
  {
    id: "AUTO",
    label: "Automotive",
    code: "SEC-MFG-29",
    summary:
      "High-value manufacturing with long qualification cycles. Component substitution is possible on paper and impractical in practice, because requalification runs 9–14 months.",
    inputs: [
      { nodeId: "CN", share: 0.22, note: "Rare-earth magnets, cells and electronics" },
      { nodeId: "KR", share: 0.16, note: "Battery cells and modules" },
      { nodeId: "JP", share: 0.14, note: "Power electronics and components" },
      { nodeId: "MY", share: 0.1, note: "Rubber, electronics assembly" },
    ],
    producers: [
      { nodeId: "CN", share: 0.31 },
      { nodeId: "DE", share: 0.12 },
      { nodeId: "JP", share: 0.11 },
      { nodeId: "KR", share: 0.1 },
      { nodeId: "US", share: 0.09 },
      { nodeId: "TR", share: 0.07 },
    ],
    consumers: [
      { nodeId: "US", share: 0.2 },
      { nodeId: "EU", share: 0.18 },
      { nodeId: "CN", share: 0.24 },
      { nodeId: "IN", share: 0.08 },
      { nodeId: "JP", share: 0.05 },
    ],
    routes: [
      { nodeId: "MALACCA", note: "Vehicle and component shipping" },
      { nodeId: "SUZK", note: "Atlantic basin transits" },
      { nodeId: "REDSEA", note: "Asia–Europe routing" },
    ],
    channelAffinity: ["trade", "energy", "diplomatic"],
    fragility: 0.71,
    substitutionMonths: 14,
    note: "Sector exposure is dominated by upstream minerals and magnets rather than by finished-vehicle assembly, which is the one step with genuine alternate capacity.",
  },
  {
    id: "SHIP",
    label: "Shipping & logistics",
    code: "SEC-TRN-49",
    summary:
      "The transmission layer for every other sector. Its own risk is unusual in that it is priced through insurance capacity rather than through physical capacity.",
    inputs: [
      { nodeId: "SUZK", share: 0.22, note: "Canal transit capacity" },
      { nodeId: "MALACCA", share: 0.2, note: "Strait throughput" },
      { nodeId: "HORMUZ", share: 0.16, note: "Energy corridor capacity" },
    ],
    producers: [
      { nodeId: "CN", share: 0.28, note: "Container and bulk fleet ownership" },
      { nodeId: "KR", share: 0.13, note: "Containership and tanker orderbook" },
      { nodeId: "JP", share: 0.12, note: "Tanker and specialised fleet" },
      { nodeId: "SG", share: 0.1, note: "Transshipment and charter intermediation" },
    ],
    consumers: [
      { nodeId: "US", share: 0.19 },
      { nodeId: "EU", share: 0.17 },
      { nodeId: "CN", share: 0.16 },
      { nodeId: "IN", share: 0.1 },
      { nodeId: "BR", share: 0.06 },
    ],
    routes: [
      { nodeId: "REDSEA", note: "Bab el-Mandeb transit" },
      { nodeId: "MALACCA", note: "Strait of Malacca" },
      { nodeId: "SUZK", note: "Canal capacity" },
      { nodeId: "ARCTIC", note: "Seasonal substitute for Europe–Asia" },
    ],
    channelAffinity: ["trade", "finance", "energy"],
    fragility: 0.83,
    substitutionMonths: 8,
    note: "Insurance reprices on renewal and physical capacity reprices over months. When the two diverge, the commercial channel enforces the new reality before the physical one has moved.",
  },
  {
    id: "MINE",
    label: "Mining & critical minerals",
    code: "SEC-MIN-07",
    summary:
      "Extraction is geographically dispersed but processing is not. The binding constraint is almost never ore supply — it is the licensed processing and refining step.",
    inputs: [
      { nodeId: "CN", share: 0.34, note: "Separation, refining and magnet-grade processing" },
      { nodeId: "MY", share: 0.12, note: "Bauxite and refining" },
      { nodeId: "TR", share: 0.08, note: "Chromite and boron processing" },
    ],
    producers: [
      { nodeId: "CN", share: 0.31, note: "Extraction and, decisively, processing" },
      { nodeId: "BR", share: 0.12, note: "Iron ore and bauxite extraction" },
      { nodeId: "RU", share: 0.1, note: "Nickel, potash and bauxite" },
      { nodeId: "ZA", share: 0.09, note: "PGM and manganese extraction" },
      { nodeId: "MY", share: 0.06, note: "Bauxite and refining" },
      { nodeId: "TR", share: 0.05, note: "Chromite and boron processing" },
    ],
    consumers: [
      { nodeId: "CN", share: 0.46 },
      { nodeId: "US", share: 0.13 },
      { nodeId: "EU", share: 0.11 },
      { nodeId: "JP", share: 0.09 },
      { nodeId: "IN", share: 0.06 },
    ],
    routes: [
      { nodeId: "MALACCA", note: "Asian bulk movement" },
      { nodeId: "SUZK", note: "Atlantic basin bulk routes" },
      { nodeId: "TAIWANSTR", note: "Pacific basin movement" },
    ],
    channelAffinity: ["trade", "energy", "diplomatic"],
    fragility: 0.86,
    substitutionMonths: 26,
    note: "Processing concentration is the whole story. Controls that stop at ore are a tariff; controls that reach alloy and magnet grade are a chokepoint.",
  },
  {
    id: "PHARMA",
    label: "Pharmaceuticals",
    code: "SEC-MFG-21",
    summary:
      "High regulatory and high qualification barriers, which make supply chains unusually rigid and unusually protected by long-term contracting.",
    inputs: [
      { nodeId: "IN", share: 0.2, note: "Generic active ingredient production" },
      { nodeId: "CN", share: 0.18, note: "Intermediate and API production" },
    ],
    producers: [
      { nodeId: "US", share: 0.26 },
      { nodeId: "DE", share: 0.16 },
      { nodeId: "GB", share: 0.13 },
      { nodeId: "IN", share: 0.14 },
      { nodeId: "CN", share: 0.12 },
    ],
    consumers: [
      { nodeId: "US", share: 0.24 },
      { nodeId: "EU", share: 0.2 },
      { nodeId: "CN", share: 0.16 },
      { nodeId: "IN", share: 0.1 },
      { nodeId: "BR", share: 0.05 },
    ],
    routes: [
      { nodeId: "MALACCA", note: "API and formulation shipping" },
      { nodeId: "SUZK", note: "Transatlantic supply" },
    ],
    channelAffinity: ["trade", "diplomatic"],
    fragility: 0.52,
    substitutionMonths: 22,
    note: "Long-term contracting and dual sourcing make this the most buffered heavy sector in the corpus, at the cost of the slowest recovery if a disruption does land.",
  },
  {
    id: "DEF",
    label: "Defence",
    code: "SEC-MFG-25",
    summary:
      "Policy-driven demand meets concentrated inputs. Magnet and energetic-material dependency is the binding constraint, not finished-systems capacity.",
    inputs: [
      { nodeId: "CN", share: 0.28, note: "Magnet-grade rare earths" },
      { nodeId: "TR", share: 0.12, note: "Energetic materials and components" },
      { nodeId: "KR", share: 0.1, note: "Semiconductor and component supply" },
    ],
    producers: [
      { nodeId: "US", share: 0.32 },
      { nodeId: "DE", share: 0.12 },
      { nodeId: "RU", share: 0.11 },
      { nodeId: "CN", share: 0.14 },
      { nodeId: "TR", share: 0.08 },
      { nodeId: "IN", share: 0.07 },
    ],
    consumers: [
      { nodeId: "US", share: 0.34 },
      { nodeId: "EU", share: 0.16 },
      { nodeId: "IN", share: 0.11 },
      { nodeId: "TR", share: 0.08 },
      { nodeId: "SA", share: 0.07 },
    ],
    routes: [
      { nodeId: "SUZK", note: "Transatlantic materiel movement" },
      { nodeId: "MALACCA", note: "Indo-Pacific delivery" },
    ],
    channelAffinity: ["diplomatic", "trade", "energy"],
    fragility: 0.64,
    substitutionMonths: 30,
    note: "The sector whose demand rises during exactly the events that raise its input costs, which is why its exposure is usually understated in market commentary.",
  },
  {
    id: "AGRI",
    label: "Agriculture & food",
    code: "SEC-MFG-01",
    summary:
      "Trade-dependent and weather-dependent, with thin short-run elasticity. Food security exposure concentrates in import-dependent states with limited reserve cover.",
    inputs: [
      { nodeId: "BR", share: 0.28, note: "Soya, maize and sugar" },
      { nodeId: "RU", share: 0.16, note: "Wheat and fertiliser" },
      { nodeId: "AE", share: 0.1, note: "Re-export and fertiliser routing" },
    ],
    producers: [
      { nodeId: "US", share: 0.16 },
      { nodeId: "BR", share: 0.2 },
      { nodeId: "RU", share: 0.13 },
      { nodeId: "NL", share: 0.06 },
      { nodeId: "IN", share: 0.08 },
      { nodeId: "ZA", share: 0.04 },
    ],
    consumers: [
      { nodeId: "CN", share: 0.22 },
      { nodeId: "IN", share: 0.14 },
      { nodeId: "EU", share: 0.12 },
      { nodeId: "US", share: 0.08 },
      { nodeId: "TR", share: 0.05 },
    ],
    routes: [
      { nodeId: "REDSEA", note: "Grain and fertiliser routing" },
      { nodeId: "SUZK", note: "Bulk carrier transit" },
      { nodeId: "MALACCA", note: "Asian destination routes" },
    ],
    channelAffinity: ["trade", "energy"],
    fragility: 0.58,
    substitutionMonths: 5,
    note: "Short substitution lead time makes this the fastest-moving consumer price channel, and the one where a trade shock reaches households before it reaches headline inflation statistics.",
  },
  {
    id: "BANK",
    label: "Banking & finance",
    code: "SEC-FIN-64",
    summary:
      "Exposure arrives through pricing and settlement rather than through goods. Credit and trade-finance terms move before any physical quantity does.",
    inputs: [
      { nodeId: "SWIFT", share: 0.3, note: "Cross-border settlement infrastructure" },
      { nodeId: "SG", share: 0.16, note: "Regional settlement and re-export chain" },
      { nodeId: "AE", share: 0.12, note: "Correspondent and re-export channels" },
    ],
    producers: [
      { nodeId: "US", share: 0.3 },
      { nodeId: "GB", share: 0.16 },
      { nodeId: "EU", share: 0.18 },
      { nodeId: "SG", share: 0.1 },
      { nodeId: "CN", share: 0.1 },
      { nodeId: "AE", share: 0.06 },
    ],
    consumers: [
      { nodeId: "US", share: 0.28 },
      { nodeId: "EU", share: 0.2 },
      { nodeId: "CN", share: 0.18 },
      { nodeId: "IN", share: 0.08 },
      { nodeId: "BR", share: 0.06 },
    ],
    routes: [
      { nodeId: "SWIFT", note: "Settlement rails" },
      { nodeId: "INSTL", note: "Institutional portfolio concentration" },
    ],
    channelAffinity: ["finance", "diplomatic", "trade"],
    fragility: 0.68,
    substitutionMonths: 3,
    note: "This is the channel where enforcement outruns law: correspondent banks re-price a corridor before any statute requires them to, and the commercial channel then does the enforcing.",
  },
  {
    id: "TECH",
    label: "Technology & equipment",
    code: "SEC-MFG-26",
    summary:
      "Concentrated in a very small number of equipment authorities and assembly nodes, with demand far less cyclical than the upstream hardware it depends on.",
    inputs: [
      { nodeId: "TW", share: 0.24, note: "Foundry capacity for advanced silicon" },
      { nodeId: "NL", share: 0.14, note: "Lithography equipment authority" },
      { nodeId: "JP", share: 0.12, note: "Precision components and materials" },
      { nodeId: "MY", share: 0.1, note: "Assembly and test" },
    ],
    producers: [
      { nodeId: "US", share: 0.28 },
      { nodeId: "CN", share: 0.22 },
      { nodeId: "KR", share: 0.14 },
      { nodeId: "NL", share: 0.08 },
      { nodeId: "JP", share: 0.08 },
      { nodeId: "SG", share: 0.06 },
      { nodeId: "MY", share: 0.06 },
    ],
    consumers: [
      { nodeId: "US", share: 0.3 },
      { nodeId: "EU", share: 0.18 },
      { nodeId: "CN", share: 0.2 },
      { nodeId: "IN", share: 0.1 },
      { nodeId: "BR", share: 0.05 },
    ],
    routes: [
      { nodeId: "TAIWANSTR", note: "Advanced silicon movement" },
      { nodeId: "MALACCA", note: "Component assembly and shipping" },
      { nodeId: "SUZK", note: "Equipment distribution" },
    ],
    channelAffinity: ["trade", "finance", "diplomatic"],
    fragility: 0.82,
    substitutionMonths: 28,
    note: "Overlaps semiconductors almost entirely; the distinction is demand profile rather than supply chain, which is why the two sectors move together and are scored separately.",
  },
];

const INDUSTRY_MAP = new Map(INDUSTRIES.map((i) => [i.id, i]));

export function getIndustry(id: string): Industry | undefined {
  return INDUSTRY_MAP.get(id);
}

export const INDUSTRY_LABEL = new Map(INDUSTRIES.map((i) => [i.id, i.label]));