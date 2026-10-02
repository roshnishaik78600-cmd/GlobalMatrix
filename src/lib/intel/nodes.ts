import type { GraphNode } from "./types";

/**
 * The transmission graph. Nodes are the things a geopolitical shock can
 * travel through: economies, blocs, chokepoints and financial corridors.
 *
 * `criticality` is the model's single structural parameter — how strongly a
 * perturbation at this node propagates to everything downstream of it.
 */
export const NODES: GraphNode[] = [
  { id: "CN", label: "China", short: "CN", kind: "economy", region: "East Asia", criticality: 1.0 },
  { id: "US", label: "United States", short: "US", kind: "economy", region: "North America", criticality: 1.0 },
  { id: "EU", label: "European Union", short: "EU", kind: "bloc", region: "Europe", criticality: 0.92 },
  { id: "RU", label: "Russia", short: "RU", kind: "economy", region: "Eurasia", criticality: 0.86 },
  { id: "IR", label: "Iran", short: "IR", kind: "economy", region: "Middle East", criticality: 0.8 },
  { id: "TW", label: "Taiwan", short: "TW", kind: "economy", region: "East Asia", criticality: 0.95 },
  { id: "KR", label: "South Korea", short: "KR", kind: "economy", region: "East Asia", criticality: 0.82 },
  { id: "JP", label: "Japan", short: "JP", kind: "economy", region: "East Asia", criticality: 0.78 },
  { id: "NL", label: "Netherlands", short: "NL", kind: "economy", region: "Europe", criticality: 0.74 },
  { id: "GB", label: "United Kingdom", short: "GB", kind: "economy", region: "Europe", criticality: 0.72 },
  { id: "DE", label: "Germany", short: "DE", kind: "economy", region: "Europe", criticality: 0.76 },
  { id: "IN", label: "India", short: "IN", kind: "economy", region: "South Asia", criticality: 0.62 },
  { id: "TR", label: "Türkiye", short: "TR", kind: "corridor", region: "Eurasia", criticality: 0.7 },
  { id: "AE", label: "United Arab Emirates", short: "AE", kind: "corridor", region: "Middle East", criticality: 0.74 },
  { id: "SA", label: "Saudi Arabia", short: "SA", kind: "economy", region: "Middle East", criticality: 0.72 },
  { id: "SG", label: "Singapore", short: "SG", kind: "corridor", region: "Asia-Pacific", criticality: 0.68 },
  { id: "BR", label: "Brazil", short: "BR", kind: "economy", region: "South America", criticality: 0.46 },
  { id: "ZA", label: "South Africa", short: "ZA", kind: "economy", region: "Africa", criticality: 0.36 },
  { id: "MY", label: "Malaysia", short: "MY", kind: "corridor", region: "Asia-Pacific", criticality: 0.58 },
  { id: "HORMUZ", label: "Strait of Hormuz", short: "HZ", kind: "chokepoint", region: "Middle East", criticality: 0.97 },
  { id: "REDSEA", label: "Bab el-Mandeb", short: "BM", kind: "chokepoint", region: "East Africa", criticality: 0.83 },
  { id: "MALACCA", label: "Strait of Malacca", short: "ML", kind: "chokepoint", region: "Asia-Pacific", criticality: 0.88 },
  { id: "TAIWANSTR", label: "Taiwan Strait", short: "TS", kind: "chokepoint", region: "East Asia", criticality: 0.99 },
  { id: "SUZK", label: "Suez / Panama canals", short: "SZ", kind: "chokepoint", region: "Global", criticality: 0.79 },
  { id: "ARCTIC", label: "Northern Sea Route", short: "NSR", kind: "corridor", region: "Arctic", criticality: 0.52 },
  { id: "SWIFT", label: "Cross-border settlement", short: "XBS", kind: "institution", region: "Global", criticality: 0.91 },
  { id: "INSTL", label: "Institutional portfolios", short: "INS", kind: "institution", region: "Global", criticality: 0.75 },
  { id: "CBRICKS", label: "Multilateral creditors", short: "MLT", kind: "institution", region: "Global", criticality: 0.58 },
];

const NODE_MAP = new Map(NODES.map((n) => [n.id, n]));

export function getNode(id: string): GraphNode {
  return NODE_MAP.get(id) ?? {
    id,
    label: id,
    short: id.slice(0, 3).toUpperCase(),
    kind: "economy",
    region: "Unclassified",
    criticality: 0.5,
  };
}