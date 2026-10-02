import type { Channel } from "./types";

/**
 * Country / bloc reference layer.
 *
 * IMPORTANT — these are *illustrative structural parameters*, not live
 * statistics. They are labelled as MODELLED everywhere they surface. The
 * reason they exist is to give the graph's static dependency structure a
 * reference frame; the *exposure* figures shown on every profile are computed
 * live from the event corpus and are genuinely derived.
 */

export interface CountryMacro {
  /** Share of global output, 0..1 (modelled). */
  outputShare: number;
  /** Openness to trade, 0..1 (modelled). */
  tradeOpenness: number;
  /** Dependence on imported energy, 0..1 (modelled). */
  energyImportDependence: number;
  /** Sovereign external buffer capacity, 0..1 (modelled). */
  externalBuffer: number;
}

export interface Dependency {
  nodeId: string;
  /** 0..1 — how binding this relationship is. */
  strength: number;
  basis: string;
}

export interface IndustryWeight {
  industryId: string;
  /** Share of the country's industrial exposure, 0..1. */
  weight: number;
}

export interface EnergySource {
  source: string;
  /** 0..1 share of primary energy. */
  share: number;
  nodeId?: string;
  note: string;
}

export interface CountryProfile {
  nodeId: string;
  /** Channels this country is structurally most exposed through. */
  primaryChannels: Channel[];
  macro: CountryMacro;
  dependencies: Dependency[];
  industries: IndustryWeight[];
  energy: EnergySource[];
  /** Structural vulnerability independent of any current event. */
  structuralFragility: number;
  note: string;
}

export const COUNTRIES: CountryProfile[] = [
  {
    nodeId: "CN",
    primaryChannels: ["trade", "energy", "finance"],
    macro: { outputShare: 0.31, tradeOpenness: 0.42, energyImportDependence: 0.78, externalBuffer: 0.72 },
    dependencies: [
      { nodeId: "MY", strength: 0.72, basis: "Commodity and rare-earth processing upstream" },
      { nodeId: "RU", strength: 0.58, basis: "Discounted hydrocarbon supply" },
      { nodeId: "AE", strength: 0.44, basis: "Re-export and payment channels" },
      { nodeId: "SG", strength: 0.41, basis: "Transhipment and settlement node" },
      { nodeId: "TW", strength: 0.38, basis: "Advanced-node foundry dependence" },
    ],
    industries: [
      { industryId: "SEMI", weight: 0.26 },
      { industryId: "MINE", weight: 0.18 },
      { industryId: "TECH", weight: 0.16 },
      { industryId: "AUTO", weight: 0.14 },
      { industryId: "SHIP", weight: 0.08 },
      { industryId: "DEF", weight: 0.08 },
    ],
    energy: [
      { source: "Domestic coal and hydro", share: 0.58, note: "Structurally import-independent" },
      { source: "Imported crude and LNG", share: 0.42, nodeId: "HORMUZ", note: "Pricing exposure despite low volume dependence" },
    ],
    structuralFragility: 0.62,
    note: "High output share and high energy import dependence pull in opposite directions: absolute volumes absorb shocks that would be severe elsewhere, but the chokepoint exposure is pricing-driven rather than volume-driven.",
  },
  {
    nodeId: "US",
    primaryChannels: ["finance", "trade", "diplomatic"],
    macro: { outputShare: 0.25, tradeOpenness: 0.37, energyImportDependence: 0.34, externalBuffer: 0.86 },
    dependencies: [
      { nodeId: "TW", strength: 0.79, basis: "Advanced logic manufacturing" },
      { nodeId: "JP", strength: 0.46, basis: "Materials, tooling and components" },
      { nodeId: "NL", strength: 0.42, basis: "Lithography equipment" },
      { nodeId: "SA", strength: 0.34, basis: "Refined product supply" },
      { nodeId: "IN", strength: 0.29, basis: "IT and business services" },
    ],
    industries: [
      { industryId: "TECH", weight: 0.24 },
      { industryId: "ENER", weight: 0.2 },
      { industryId: "DEF", weight: 0.14 },
      { industryId: "PHARMA", weight: 0.12 },
      { industryId: "AGRI", weight: 0.1 },
      { industryId: "BANK", weight: 0.08 },
    ],
    energy: [
      { source: "Domestic shale and renewables", share: 0.66, note: "Volume-independent of chokepoints" },
      { source: "Imported refined product", share: 0.34, nodeId: "HORMUZ", note: "Refining capacity, not crude, is the constraint" },
    ],
    structuralFragility: 0.44,
    note: "The most buffered node in the graph on energy, and the least buffered on advanced logic. Policy authority compounds exposure because controls are self-applied.",
  },
  {
    nodeId: "EU",
    primaryChannels: ["trade", "energy", "diplomatic"],
    macro: { outputShare: 0.22, tradeOpenness: 0.61, energyImportDependence: 0.68, externalBuffer: 0.64 },
    dependencies: [
      { nodeId: "TR", strength: 0.71, basis: "Energy corridor and export market" },
      { nodeId: "CN", strength: 0.62, basis: "Manufactured inputs and critical minerals" },
      { nodeId: "AE", strength: 0.38, basis: "Hydrocarbon routing" },
      { nodeId: "US", strength: 0.35, basis: "Defence, technology and dollar settlement" },
    ],
    industries: [
      { industryId: "AUTO", weight: 0.22 },
      { industryId: "PHARMA", weight: 0.18 },
      { industryId: "MINE", weight: 0.14 },
      { industryId: "ENER", weight: 0.14 },
      { industryId: "BANK", weight: 0.1 },
      { industryId: "AGRI", weight: 0.1 },
    ],
    energy: [
      { source: "Imported gas via southern corridor", share: 0.36, nodeId: "TR", note: "Corridor dependency rather than chokepoint" },
      { source: "North Sea and imported crude", share: 0.38, nodeId: "HORMUZ", note: "Partly substitutable at a cost" },
      { source: "Domestic renewables and nuclear", share: 0.26, note: "Structural decarbonisation offset" },
    ],
    structuralFragility: 0.68,
    note: "Import dependence is diversified by route but not by grade. Regulatory intensity converts external exposure into internal friction, which is why trade is its highest-variance channel.",
  },
  {
    nodeId: "RU",
    primaryChannels: ["energy", "diplomatic", "trade"],
    macro: { outputShare: 0.05, tradeOpenness: 0.44, energyImportDependence: 0.12, externalBuffer: 0.28 },
    dependencies: [
      { nodeId: "CN", strength: 0.74, basis: "Export destination and technology supply" },
      { nodeId: "IN", strength: 0.62, basis: "Hydrocarbon demand and refining" },
      { nodeId: "AE", strength: 0.55, basis: "Re-export and settlement" },
      { nodeId: "TR", strength: 0.47, basis: "Corridor and payment routing" },
      { nodeId: "ARCTIC", strength: 0.41, basis: "Northern routing optionality" },
    ],
    industries: [
      { industryId: "ENER", weight: 0.4 },
      { industryId: "MINE", weight: 0.2 },
      { industryId: "AGRI", weight: 0.14 },
      { industryId: "DEF", weight: 0.1 },
      { industryId: "SHIP", weight: 0.08 },
    ],
    energy: [
      { source: "Domestic hydrocarbon production", share: 0.88, note: "Net exporter; the node transmits rather than absorbs" },
      { source: "Imported refined product and equipment", share: 0.12, nodeId: "EU", note: "Refining and machinery are the reverse dependency" },
    ],
    structuralFragility: 0.79,
    note: "Structurally self-sufficient on energy and structurally dependent on everything downstream of it. Exposure runs through payment and routing channels far more than through physical supply.",
  },
  {
    nodeId: "IR",
    primaryChannels: ["energy", "diplomatic", "finance"],
    macro: { outputShare: 0.02, tradeOpenness: 0.38, energyImportDependence: 0.0, externalBuffer: 0.22 },
    dependencies: [
      { nodeId: "CN", strength: 0.81, basis: "Largest crude export destination" },
      { nodeId: "IN", strength: 0.7, basis: "Crude demand and refining feedstock" },
      { nodeId: "TR", strength: 0.58, basis: "Corridor routing and settlement" },
      { nodeId: "AE", strength: 0.56, basis: "Re-export, storage and mediation" },
    ],
    industries: [
      { industryId: "ENER", weight: 0.46 },
      { industryId: "MINE", weight: 0.14 },
      { industryId: "SHIP", weight: 0.1 },
      { industryId: "AGRI", weight: 0.08 },
    ],
    energy: [{ source: "Domestic crude and gas production", share: 1.0, nodeId: "HORMUZ", note: "Output and export capacity are routed through a single chokepoint" }],
    structuralFragility: 0.86,
    note: "The highest structural fragility in the corpus: total export dependence routed through one chokepoint, with no substitution capacity and a narrow set of counterparties.",
  },
  {
    nodeId: "TW",
    primaryChannels: ["trade", "finance", "diplomatic"],
    macro: { outputShare: 0.06, tradeOpenness: 0.83, energyImportDependence: 0.97, externalBuffer: 0.58 },
    dependencies: [
      { nodeId: "CN", strength: 0.72, basis: "Demand and manufacturing hinterland" },
      { nodeId: "US", strength: 0.58, basis: "Technology standard and security guarantee" },
      { nodeId: "JP", strength: 0.44, basis: "Materials and capital equipment" },
      { nodeId: "KR", strength: 0.36, basis: "Memory and component complementarity" },
      { nodeId: "TAIWANSTR", strength: 0.79, basis: "Primary east-west shipping lane" },
    ],
    industries: [
      { industryId: "SEMI", weight: 0.42 },
      { industryId: "TECH", weight: 0.2 },
      { industryId: "SHIP", weight: 0.08 },
    ],
    energy: [
      { source: "Imported LNG and crude", share: 0.98, nodeId: "MALACCA", note: "Near-total import dependence via two straits" },
      { source: "Domestic nuclear", share: 0.02, note: "The only meaningful buffer" },
    ],
    structuralFragility: 0.88,
    note: "Concentration is total in both directions: one chokepoint for inputs, one for outputs, and a single industry dominating the export base.",
  },
  {
    nodeId: "KR",
    primaryChannels: ["trade", "energy", "finance"],
    macro: { outputShare: 0.07, tradeOpenness: 0.78, energyImportDependence: 0.93, externalBuffer: 0.66 },
    dependencies: [
      { nodeId: "CN", strength: 0.68, basis: "Materials and component supply" },
      { nodeId: "TW", strength: 0.52, basis: "Foundry allocation" },
      { nodeId: "JP", strength: 0.44, basis: "Materials and machinery" },
      { nodeId: "US", strength: 0.46, basis: "Technology standard and demand" },
      { nodeId: "MALACCA", strength: 0.63, basis: "Hydrocarbon and component routing" },
    ],
    industries: [
      { industryId: "SEMI", weight: 0.32 },
      { industryId: "AUTO", weight: 0.2 },
      { industryId: "SHIP", weight: 0.1 },
      { industryId: "MINE", weight: 0.08 },
      { industryId: "TECH", weight: 0.08 },
    ],
    energy: [
      { source: "Imported LNG and crude", share: 0.93, nodeId: "MALACCA", note: "Refinery configuration is optimised to a Middle East slate" },
      { source: "Domestic nuclear", share: 0.07, note: "Growing but not yet substitutive" },
    ],
    structuralFragility: 0.71,
    note: "Export base concentrated in memory and vehicles, import base concentrated in one maritime corridor. Refining configuration is the binding constraint, not crude availability.",
  },
  {
    nodeId: "JP",
    primaryChannels: ["trade", "energy", "diplomatic"],
    macro: { outputShare: 0.05, tradeOpenness: 0.44, energyImportDependence: 0.94, externalBuffer: 0.61 },
    dependencies: [
      { nodeId: "CN", strength: 0.63, basis: "Intermediate goods supply" },
      { nodeId: "MY", strength: 0.52, basis: "LNG and feedstock" },
      { nodeId: "US", strength: 0.48, basis: "Defence guarantee and market" },
      { nodeId: "TW", strength: 0.34, basis: "Component supply" },
      { nodeId: "AE", strength: 0.38, basis: "Crude routing" },
    ],
    industries: [
      { industryId: "AUTO", weight: 0.22 },
      { industryId: "SEMI", weight: 0.2 },
      { industryId: "MINE", weight: 0.14 },
      { industryId: "SHIP", weight: 0.1 },
      { industryId: "PHARMA", weight: 0.08 },
    ],
    energy: [
      { source: "Imported LNG and crude", share: 0.94, nodeId: "MALACCA", note: "Highest import dependence among large advanced economies" },
      { source: "Domestic renewables and nuclear", share: 0.06, note: "Fastest-growing buffer in the graph" },
    ],
    structuralFragility: 0.66,
    note: "Deep exposure to Northeast Asian sea lanes and to Chinese intermediate goods, partially offset by a domestic manufacturing base that is unusually diversified across industries.",
  },
  {
    nodeId: "NL",
    primaryChannels: ["trade", "diplomatic"],
    macro: { outputShare: 0.03, tradeOpenness: 0.88, energyImportDependence: 0.52, externalBuffer: 0.7 },
    dependencies: [
      { nodeId: "CN", strength: 0.66, basis: "Transshipment goods and end demand" },
      { nodeId: "DE", strength: 0.54, basis: "Intra-bloc manufacturing chain" },
      { nodeId: "US", strength: 0.44, basis: "Export-control authority" },
    ],
    industries: [
      { industryId: "TECH", weight: 0.26 },
      { industryId: "AGRI", weight: 0.24 },
      { industryId: "SHIP", weight: 0.14 },
      { industryId: "MINE", weight: 0.1 },
    ],
    energy: [
      { source: "Imported gas via European network", share: 0.52, note: "Network-integrated rather than route-dependent" },
      { source: "Domestic offshore gas", share: 0.48, note: "A meaningful buffer, declining over time" },
    ],
    structuralFragility: 0.58,
    note: "Small in output, outsized in leverage: this node holds the export-control authority that the semiconductor policy layer depends on, so its decisions propagate further than its GDP share suggests.",
  },
  {
    nodeId: "GB",
    primaryChannels: ["finance", "diplomatic", "energy"],
    macro: { outputShare: 0.04, tradeOpenness: 0.56, energyImportDependence: 0.41, externalBuffer: 0.62 },
    dependencies: [
      { nodeId: "US", strength: 0.58, basis: "Financial and technology standard linkage" },
      { nodeId: "EU", strength: 0.62, basis: "Single largest trading partner" },
      { nodeId: "CN", strength: 0.36, basis: "Goods trade and services" },
      { nodeId: "SA", strength: 0.3, basis: "Energy and services contracts" },
    ],
    industries: [
      { industryId: "BANK", weight: 0.26 },
      { industryId: "PHARMA", weight: 0.2 },
      { industryId: "TECH", weight: 0.14 },
      { industryId: "ENER", weight: 0.14 },
      { industryId: "AGRI", weight: 0.08 },
    ],
    energy: [
      { source: "North Sea production", share: 0.59, note: "Net energy exporter" },
      { source: "Imported LNG via European network", share: 0.41, nodeId: "SUZK", note: "Maritime route exposure" },
    ],
    structuralFragility: 0.48,
    note: "Exposure runs through the financial and diplomatic channels rather than through physical supply. Its inherited chokepoint posture carries more risk than its own resource position implies.",
  },
  {
    nodeId: "DE",
    primaryChannels: ["trade", "energy", "diplomatic"],
    macro: { outputShare: 0.08, tradeOpenness: 0.64, energyImportDependence: 0.81, externalBuffer: 0.6 },
    dependencies: [
      { nodeId: "CN", strength: 0.61, basis: "Input costs and rare-earth content" },
      { nodeId: "TR", strength: 0.46, basis: "Supplier base and energy corridor" },
      { nodeId: "NL", strength: 0.42, basis: "Port and equipment chain" },
      { nodeId: "RU", strength: 0.28, basis: "Residual feedstock exposure" },
    ],
    industries: [
      { industryId: "AUTO", weight: 0.3 },
      { industryId: "PHARMA", weight: 0.16 },
      { industryId: "MINE", weight: 0.14 },
      { industryId: "DEF", weight: 0.1 },
      { industryId: "ENER", weight: 0.1 },
      { industryId: "TECH", weight: 0.08 },
    ],
    energy: [
      { source: "Imported gas via southern corridor", share: 0.44, nodeId: "TR", note: "Corridor and peer-dependency combined" },
      { source: "Imported crude and products", share: 0.37, nodeId: "SUZK", note: "Partly substitutable at a cost" },
      { source: "Domestic renewables", share: 0.19, note: "Structural offset" },
    ],
    structuralFragility: 0.74,
    note: "The most industry-concentrated large economy in the corpus. Automotive exposure dominates, which converts a minerals or corridor shock directly into an output shock.",
  },
  {
    nodeId: "IN",
    primaryChannels: ["trade", "energy", "finance"],
    macro: { outputShare: 0.09, tradeOpenness: 0.47, energyImportDependence: 0.88, externalBuffer: 0.4 },
    dependencies: [
      { nodeId: "AE", strength: 0.66, basis: "Crude sourcing" },
      { nodeId: "RU", strength: 0.52, basis: "Discounted crude and refined product" },
      { nodeId: "SG", strength: 0.44, basis: "Trade finance and settlement" },
      { nodeId: "CN", strength: 0.4, basis: "Equipment and electronics inputs" },
      { nodeId: "HORMUZ", strength: 0.61, basis: "Two of three crude import routes" },
    ],
    industries: [
      { industryId: "ENER", weight: 0.22 },
      { industryId: "TECH", weight: 0.2 },
      { industryId: "AGRI", weight: 0.16 },
      { industryId: "BANK", weight: 0.12 },
      { industryId: "MINE", weight: 0.1 },
      { industryId: "PHARMA", weight: 0.08 },
    ],
    energy: [
      { source: "Imported crude and LNG", share: 0.88, nodeId: "HORMUZ", note: "Limited strategic reserve relative to import volume" },
      { source: "Domestic coal and renewables", share: 0.12, note: "Cannot substitute for crude at scale" },
    ],
    structuralFragility: 0.77,
    note: "Rapidly industrialising against an import structure that has not diversified at the same rate. Refining margin is the earliest macro aggregate to respond to a supply or freight shock.",
  },
  {
    nodeId: "TR",
    primaryChannels: ["trade", "diplomatic", "finance"],
    macro: { outputShare: 0.03, tradeOpenness: 0.68, energyImportDependence: 0.54, externalBuffer: 0.34 },
    dependencies: [
      { nodeId: "EU", strength: 0.74, basis: "Export market for manufactured goods" },
      { nodeId: "RU", strength: 0.48, basis: "Trade flows and payment routing" },
      { nodeId: "IR", strength: 0.52, basis: "Energy transit" },
      { nodeId: "AE", strength: 0.44, basis: "Re-export and settlement" },
    ],
    industries: [
      { industryId: "AUTO", weight: 0.3 },
      { industryId: "MINE", weight: 0.16 },
      { industryId: "AGRI", weight: 0.16 },
      { industryId: "SHIP", weight: 0.1 },
      { industryId: "DEF", weight: 0.08 },
    ],
    energy: [
      { source: "Domestic lignite and hydro", share: 0.46, note: "Structurally import-independent" },
      { source: "Imported gas via pipeline", share: 0.54, nodeId: "RU", note: "Pipeline dependency, not maritime" },
    ],
    structuralFragility: 0.68,
    note: "The pivot node in the corpus. Leverage and exposure are the same fact here: routing utility raises its negotiating position and its vulnerability simultaneously.",
  },
  {
    nodeId: "AE",
    primaryChannels: ["finance", "trade", "energy"],
    macro: { outputShare: 0.02, tradeOpenness: 0.82, energyImportDependence: 0.0, externalBuffer: 0.66 },
    dependencies: [
      { nodeId: "IR", strength: 0.55, basis: "Hydrocarbon routing through territory" },
      { nodeId: "SA", strength: 0.48, basis: "Regional energy aggregation" },
      { nodeId: "SG", strength: 0.46, basis: "Settlement and re-export chain" },
      { nodeId: "IN", strength: 0.5, basis: "Trade finance and corridor demand" },
    ],
    industries: [
      { industryId: "ENER", weight: 0.22 },
      { industryId: "MINE", weight: 0.14 },
      { industryId: "TECH", weight: 0.12 },
      { industryId: "SHIP", weight: 0.1 },
      { industryId: "BANK", weight: 0.1 },
    ],
    energy: [
      { source: "Domestic hydrocarbon production", share: 1.0, nodeId: "HORMUZ", note: "Net exporter with in-transit chokepoint exposure" },
      { source: "Regional re-export flows", share: 0.0, nodeId: "IR", note: "Not an energy import but a routing exposure" },
    ],
    structuralFragility: 0.52,
    note: "Storage capacity and re-export routing give it an unusual shock absorber, but that same routing role makes it the node where enforcement actions concentrate.",
  },
  {
    nodeId: "SA",
    primaryChannels: ["energy", "finance", "trade"],
    macro: { outputShare: 0.02, tradeOpenness: 0.5, energyImportDependence: 0.0, externalBuffer: 0.62 },
    dependencies: [
      { nodeId: "CN", strength: 0.68, basis: "Largest crude export destination" },
      { nodeId: "IN", strength: 0.62, basis: "Crude and product demand" },
      { nodeId: "JP", strength: 0.46, basis: "Refined product and petrochemical demand" },
      { nodeId: "KR", strength: 0.38, basis: "Product demand" },
      { nodeId: "HORMUZ", strength: 0.72, basis: "Sole export route" },
    ],
    industries: [
      { industryId: "ENER", weight: 0.4 },
      { industryId: "MINE", weight: 0.1 },
      { industryId: "PHARMA", weight: 0.08 },
      { industryId: "AGRI", weight: 0.08 },
      { industryId: "TECH", weight: 0.06 },
    ],
    energy: [
      { source: "Domestic crude production", share: 1.0, nodeId: "HORMUZ", note: "Export capacity entirely route-dependent" },
      { source: "Domestic renewables programme", share: 0.0, note: "Oil-for-power transition is a multi-decade project" },
    ],
    structuralFragility: 0.6,
    note: "Export exposure is total and route-dependent, but demand-side concentration in a small number of large Asian buyers provides an offset that is unavailable to most exporters.",
  },
  {
    nodeId: "SG",
    primaryChannels: ["finance", "trade"],
    macro: { outputShare: 0.02, tradeOpenness: 0.95, energyImportDependence: 0.97, externalBuffer: 0.78 },
    dependencies: [
      { nodeId: "CN", strength: 0.58, basis: "Transhipment volume and re-export demand" },
      { nodeId: "MY", strength: 0.5, basis: "Feeder cargo and commodity origin" },
      { nodeId: "AE", strength: 0.42, basis: "Settlement and re-export chain" },
      { nodeId: "US", strength: 0.38, basis: "Financial and technology linkage" },
      { nodeId: "MALACCA", strength: 0.74, basis: "Transshipment chokepoint" },
    ],
    industries: [
      { industryId: "SHIP", weight: 0.22 },
      { industryId: "TECH", weight: 0.2 },
      { industryId: "BANK", weight: 0.18 },
      { industryId: "MINE", weight: 0.08 },
      { industryId: "PHARMA", weight: 0.06 },
    ],
    energy: [
      { source: "Imported LNG, crude and refined product", share: 0.97, nodeId: "MALACCA", note: "Also the physical transshipment node for the same corridor" },
      { source: "Solar and gas generation", share: 0.03, note: "Small but growing buffer" },
    ],
    structuralFragility: 0.51,
    note: "Functions as the network's settlement and routing layer. Financial exposure is moderate; the concentration is structural — one strait carries both its own imports and the transshipment volume of others.",
  },
  {
    nodeId: "BR",
    primaryChannels: ["trade", "finance", "energy"],
    macro: { outputShare: 0.05, tradeOpenness: 0.44, energyImportDependence: 0.48, externalBuffer: 0.52 },
    dependencies: [
      { nodeId: "CN", strength: 0.66, basis: "Largest export destination" },
      { nodeId: "US", strength: 0.42, basis: "Commodity and financial linkage" },
      { nodeId: "IN", strength: 0.38, basis: "Commodity demand" },
    ],
    industries: [
      { industryId: "AGRI", weight: 0.28 },
      { industryId: "MINE", weight: 0.22 },
      { industryId: "ENER", weight: 0.16 },
      { industryId: "BANK", weight: 0.12 },
      { industryId: "SHIP", weight: 0.06 },
    ],
    energy: [
      { source: "Domestic hydropower and biofuel", share: 0.62, note: "One of the few genuinely low-import energy structures" },
      { source: "Imported crude and diesel", share: 0.38, note: "Refining capacity rather than crude is the constraint" },
    ],
    structuralFragility: 0.46,
    note: "Commodity-export dependent but energy-self-sufficient, which inverts the usual emerging-market fragility profile. Policy-transition risk sits alongside the external risk rather than adding to it.",
  },
  {
    nodeId: "ZA",
    primaryChannels: ["trade", "finance", "energy"],
    macro: { outputShare: 0.01, tradeOpenness: 0.55, energyImportDependence: 0.22, externalBuffer: 0.24 },
    dependencies: [
      { nodeId: "CN", strength: 0.58, basis: "Largest export destination" },
      { nodeId: "US", strength: 0.4, basis: "Commodity and financial linkage" },
      { nodeId: "EU", strength: 0.36, basis: "Export market and finance" },
    ],
    industries: [
      { industryId: "MINE", weight: 0.42 },
      { industryId: "AGRI", weight: 0.2 },
      { industryId: "ENER", weight: 0.18 },
      { industryId: "BANK", weight: 0.08 },
    ],
    energy: [
      { source: "Domestic coal", share: 0.78, note: "Import-independent and carbon-intensive" },
      { source: "Imported liquid fuel", share: 0.22, note: "Low exposure" },
    ],
    structuralFragility: 0.56,
    note: "Extreme commodity concentration in a small export base. Single-commodity price or route shocks transmit almost directly to the fiscal account.",
  },
  {
    nodeId: "MY",
    primaryChannels: ["trade", "diplomatic"],
    macro: { outputShare: 0.02, tradeOpenness: 0.9, energyImportDependence: 0.46, externalBuffer: 0.74 },
    dependencies: [
      { nodeId: "CN", strength: 0.66, basis: "Export destination and upstream inputs" },
      { nodeId: "SG", strength: 0.54, basis: "Settlement and transshipment chain" },
      { nodeId: "JP", strength: 0.44, basis: "LNG contracting and trade" },
    ],
    industries: [
      { industryId: "TECH", weight: 0.28 },
      { industryId: "MINE", weight: 0.18 },
      { industryId: "SHIP", weight: 0.08 },
      { industryId: "AGRI", weight: 0.08 },
      { industryId: "SEMI", weight: 0.08 },
    ],
    energy: [
      { source: "Domestic gas and palm-based biofuel", share: 0.54, note: "Structurally import-light" },
      { source: "Imported LNG from Northeast Asia", share: 0.46, note: "Contract-linked, which dampens spot exposure" },
    ],
    structuralFragility: 0.49,
    note: "Occupies the highest-leverage position in the critical-minerals chain while carrying relatively low energy exposure. Policy targeting here propagates further upstream than its size suggests.",
  },
];

const COUNTRY_MAP = new Map(COUNTRIES.map((c) => [c.nodeId, c]));

export function getCountry(nodeId: string): CountryProfile | undefined {
  return COUNTRY_MAP.get(nodeId);
}

/** Corridor and institution nodes have no country profile but carry load. */
export const NON_COUNTRY_NODES = ["HORMUZ", "REDSEA", "MALACCA", "TAIWANSTR", "SUZK", "ARCTIC", "SWIFT", "INSTL", "CBRICKS"];