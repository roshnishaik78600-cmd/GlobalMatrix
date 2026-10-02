import type { GraphNode } from "./types";

/**
 * The transmission graph. Nodes are the things a geopolitical shock can
 * travel through: economies, blocs, chokepoints and financial corridors.
 *
 * `criticality` is the model's single structural parameter — how strongly a
 * perturbation at this node propagates to everything downstream of it.
 */
export const NODES: GraphNode[] = [
  { id: "CN", label: "China", short: "CN", kind: "economy", region: "East Asia", criticality: 1.0, lat: 35.0, lon: 104.2 },
  { id: "US", label: "United States", short: "US", kind: "economy", region: "North America", criticality: 1.0, lat: 39.8, lon: -98.6 },
  { id: "EU", label: "European Union", short: "EU", kind: "bloc", region: "Europe", criticality: 0.92, lat: 50.1, lon: 10.4 },
  { id: "RU", label: "Russia", short: "RU", kind: "economy", region: "Eurasia", criticality: 0.86, lat: 61.5, lon: 90.0 },
  { id: "IR", label: "Iran", short: "IR", kind: "economy", region: "Middle East", criticality: 0.8, lat: 32.4, lon: 53.7 },
  { id: "TW", label: "Taiwan", short: "TW", kind: "economy", region: "East Asia", criticality: 0.95, lat: 23.7, lon: 121.0 },
  { id: "KR", label: "South Korea", short: "KR", kind: "economy", region: "East Asia", criticality: 0.82, lat: 35.9, lon: 127.8 },
  { id: "JP", label: "Japan", short: "JP", kind: "economy", region: "East Asia", criticality: 0.78, lat: 36.2, lon: 138.3 },
  { id: "NL", label: "Netherlands", short: "NL", kind: "economy", region: "Europe", criticality: 0.74, lat: 52.1, lon: 5.3 },
  { id: "GB", label: "United Kingdom", short: "GB", kind: "economy", region: "Europe", criticality: 0.72, lat: 54.0, lon: -2.0 },
  { id: "DE", label: "Germany", short: "DE", kind: "economy", region: "Europe", criticality: 0.76, lat: 51.2, lon: 10.4 },
  { id: "IN", label: "India", short: "IN", kind: "economy", region: "South Asia", criticality: 0.62, lat: 21.1, lon: 78.7 },
  { id: "TR", label: "Türkiye", short: "TR", kind: "corridor", region: "Eurasia", criticality: 0.7, lat: 39.0, lon: 35.2 },
  { id: "AE", label: "United Arab Emirates", short: "AE", kind: "corridor", region: "Middle East", criticality: 0.74, lat: 24.0, lon: 54.0 },
  { id: "SA", label: "Saudi Arabia", short: "SA", kind: "economy", region: "Middle East", criticality: 0.72, lat: 24.0, lon: 45.0 },
  { id: "SG", label: "Singapore", short: "SG", kind: "corridor", region: "Asia-Pacific", criticality: 0.68, lat: 1.35, lon: 103.8 },
  { id: "BR", label: "Brazil", short: "BR", kind: "economy", region: "South America", criticality: 0.46, lat: -10.8, lon: -52.0 },
  { id: "ZA", label: "South Africa", short: "ZA", kind: "economy", region: "Africa", criticality: 0.36, lat: -29.0, lon: 24.7 },
  { id: "MY", label: "Malaysia", short: "MY", kind: "corridor", region: "Asia-Pacific", criticality: 0.58, lat: 3.1, lon: 101.7 },
  { id: "HORMUZ", label: "Strait of Hormuz", short: "HZ", kind: "chokepoint", region: "Middle East", criticality: 0.97, lat: 26.6, lon: 56.3 },
  { id: "REDSEA", label: "Bab el-Mandeb", short: "BM", kind: "chokepoint", region: "East Africa", criticality: 0.83, lat: 12.6, lon: 43.3 },
  { id: "MALACCA", label: "Strait of Malacca", short: "ML", kind: "chokepoint", region: "Asia-Pacific", criticality: 0.88, lat: 2.5, lon: 101.0 },
  { id: "TAIWANSTR", label: "Taiwan Strait", short: "TS", kind: "chokepoint", region: "East Asia", criticality: 0.99, lat: 24.8, lon: 119.5 },
  { id: "SUZK", label: "Suez Canal", short: "SZ", kind: "chokepoint", region: "North Africa", criticality: 0.79, lat: 30.5, lon: 32.3 },
  { id: "ARCTIC", label: "Northern Sea Route", short: "NSR", kind: "corridor", region: "Arctic", criticality: 0.52, lat: 74.0, lon: 60.0 },
  { id: "SWIFT", label: "Cross-border settlement", short: "XBS", kind: "institution", region: "Global", criticality: 0.91 },
  { id: "INSTL", label: "Institutional portfolios", short: "INS", kind: "institution", region: "Global", criticality: 0.75 },
  { id: "CBRICKS", label: "Multilateral creditors", short: "MLT", kind: "institution", region: "Global", criticality: 0.58 },
];

/** Nodes with a real geographic position, i.e. everything the map can plot. */
export const GEO_NODES = NODES.filter(
  (n) => n.lat !== undefined && n.lon !== undefined,
);

/** Nodes that are abstractions rather than places; never plotted. */
export function isAbstract(node: GraphNode): boolean {
  return node.kind === "institution";
}

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