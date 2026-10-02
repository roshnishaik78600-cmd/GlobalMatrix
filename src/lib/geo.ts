import worldAsset from "@/assets/world-50m.json";
import { GEO_NODES } from "@/lib/intel/nodes";

/**
 * Real country geometry.
 *
 * Boundaries are Natural Earth 1:50m, projected onto the same equirectangular
 * grid the node coordinates use and pre-simplified to what is visible at that
 * size. `bun scripts/build-geo.mjs` regenerates the asset from the source
 * package; the app only ever reads the projected result, so no topology is
 * decoded in the browser and no coastline can drift out of step with the node
 * coordinates plotted on top of it.
 */

/** The map grid. Shared with `visual.project` so nothing drifts. */
export const MAP_W = 1000;
export const MAP_H = 500;

const px = (lon: number) => ((lon + 180) / 360) * MAP_W;
const py = (lat: number) => ((90 - lat) / 180) * MAP_H;

export interface CountryShape {
  /** ISO 3166-1 numeric code, as published by Natural Earth. */
  iso: string;
  name: string;
  /** Projected SVG path data for the whole country. */
  d: string;
  /** Centre and radius of the main landmass, for labels. */
  cx: number;
  cy: number;
  r: number;
}

interface RawCountry {
  i: string;
  n: string;
  d: string;
  x: number;
  y: number;
  r: number;
}

function buildShapes(): CountryShape[] {
  const raw = (worldAsset as unknown as { countries: RawCountry[] }).countries;
  return raw.map((c) => ({
    iso: c.i,
    name: c.n,
    d: c.d,
    cx: c.x,
    cy: c.y,
    r: c.r,
  }));
}

let cached: CountryShape[] | null = null;

export function countryShapes(): CountryShape[] {
  if (!cached) cached = buildShapes();
  return cached;
}

/**
 * ISO 3166-1 numeric codes for the economies and corridors in the graph.
 *
 * Blocs (the EU) have no country shape and are therefore excluded from the
 * choropleth rather than being painted across several states at once.
 */
export const ISO_NUMERIC: Record<string, string> = {
  CN: "156",
  US: "840",
  RU: "643",
  IR: "364",
  TW: "158",
  KR: "410",
  JP: "392",
  NL: "528",
  GB: "826",
  DE: "276",
  IN: "356",
  TR: "792",
  AE: "784",
  SA: "682",
  SG: "702",
  BR: "076",
  ZA: "710",
  MY: "458",
};

let shapeIndex: Map<string, CountryShape> | null = null;

/** Shape lookup by node id ("CN", "US", "HORMUZ"). Blocs return undefined. */
export function shapeForNode(nodeId: string): CountryShape | undefined {
  const iso = ISO_NUMERIC[nodeId];
  if (!iso) return undefined;
  if (!shapeIndex) {
    shapeIndex = new Map();
    for (const shape of countryShapes()) shapeIndex.set(shape.iso, shape);
  }
  return shapeIndex.get(iso);
}

/** Every shape we can colour, keyed by the node that owns it. */
export function shapesByNode(): Map<string, CountryShape> {
  const map = new Map<string, CountryShape>();
  for (const nodeId of Object.keys(ISO_NUMERIC)) {
    const shape = shapeForNode(nodeId);
    if (shape) map.set(nodeId, shape);
  }
  return map;
}

/** Nearest plotted node to a map point, used for click-to-inspect on land. */
export function nearestNode(
  mx: number,
  my: number,
): { id: string; distance: number } | null {
  let best: { id: string; distance: number } | null = null;
  for (const node of GEO_NODES) {
    if (node.lat === undefined || node.lon === undefined) continue;
    const dx = px(node.lon) - mx;
    const dy = py(node.lat) - my;
    const distance = Math.hypot(dx, dy);
    if (!best || distance < best.distance) best = { id: node.id, distance };
  }
  return best;
}