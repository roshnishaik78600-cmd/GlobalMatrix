/**
 * Regenerate the bundled world geometry.
 *
 *   bun scripts/build-geo.mjs
 *
 * Reads Natural Earth 1:50m boundaries from `world-atlas`, projects them onto
 * the map grid used by `src/lib/geo.ts`, simplifies each ring to what is
 * actually visible at that resolution, and writes a compact asset the app
 * imports directly.
 *
 * Doing this once, offline, keeps the runtime free of TopoJSON decoding and
 * cuts roughly three quarters off the map payload. The output is real Natural
 * Earth geometry either way — only the intermediate encoding changes.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const world = require("world-atlas/countries-50m.json");

/** Must match MAP_W / MAP_H in src/lib/geo.ts. */
const W = 1000;
const H = 500;
/** Douglas-Peucker tolerance in grid units. Below a pixel; above the noise. */
const TOLERANCE = 0.7;

const [sx, sy] = world.transform.scale;
const [tx, ty] = world.transform.translate;

const arcs = world.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx * sx;
    y += dy * sy;
    return [x + tx, y + ty];
  });
});

const px = (lon) => Math.round(((lon + 180) / 360) * W);
const py = (lat) => Math.round(((90 - lat) / 180) * H);

const stitch = (indices) => {
  const points = [];
  for (const index of indices) {
    const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
    for (let i = points.length === 0 ? 0 : 1; i < arc.length; i++) {
      points.push(arc[i]);
    }
  }
  return points.map(([lon, lat]) => [px(lon), py(lat)]);
};

/** Perpendicular-distance simplification, iterative so deep rings can't blow up. */
function simplify(points, tolerance) {
  if (points.length < 4) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = 1;
  keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const limit = tolerance * tolerance;

  while (stack.length > 0) {
    const [first, last] = stack.pop();
    const [ax, ay] = points[first];
    const [bx, by] = points[last];
    const dx = bx - ax;
    const dy = by - ay;
    const lenSq = dx * dx + dy * dy;
    let worst = -1;
    let worstIndex = -1;

    for (let i = first + 1; i < last; i++) {
      const [pxp, pyp] = points[i];
      let dist;
      if (lenSq === 0) {
        dist = (pxp - ax) ** 2 + (pyp - ay) ** 2;
      } else {
        const t = Math.max(
          0,
          Math.min(1, ((pxp - ax) * dx + (pyp - ay) * dy) / lenSq),
        );
        dist = (pxp - (ax + t * dx)) ** 2 + (pyp - (ay + t * dy)) ** 2;
      }
      if (dist > worst) {
        worst = dist;
        worstIndex = i;
      }
    }

    if (worst > limit && worstIndex > 0) {
      keep[worstIndex] = 1;
      stack.push([first, worstIndex], [worstIndex, last]);
    }
  }

  return points.filter((_, i) => keep[i] === 1);
}

/** Bounding box and plan area of a simplified ring, for labels and hit-tests. */
function bounds(points) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const [x, y] = points[i];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
    const [nx, ny] = points[(i + 1) % points.length];
    area += x * ny - nx * y;
  }
  return {
    cx: Math.round((minX + maxX) / 2),
    cy: Math.round((minY + maxY) / 2),
    r: Math.round(Math.max(maxX - minX, maxY - minY) / 2),
    area: Math.abs(area / 2),
  };
}

const countries = [];
let before = 0;
let after = 0;

for (const geometry of world.objects.countries.geometries) {
  const polygons =
    geometry.type === "Polygon"
      ? [geometry.arcs]
      : geometry.arcs;
  const rings = [];
  let main = null;
  for (const polygon of polygons) {
    for (const ring of polygon) {
      const points = stitch(ring);
      before += points.length;
      const simple = simplify(points, TOLERANCE);
      after += simple.length;
      if (simple.length >= 3) {
        rings.push(
          simple.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x} ${y}`).join("") + "Z",
        );
        const box = bounds(simple);
        if (!main || box.area > main.area) main = box;
      }
    }
  }
  if (rings.length > 0 && main) {
    countries.push({
      i: String(geometry.id ?? ""),
      n: String(geometry.properties?.name ?? ""),
      d: rings.join(""),
      x: main.cx,
      y: main.cy,
      r: main.r,
    });
  }
}

const payload = { v: 1, countries };
writeFileSync(
  "src/assets/world-50m.json",
  JSON.stringify(payload),
  "utf8",
);

console.log(
  `countries: ${countries.length} · vertices ${before} → ${after} ` +
    `(${(after / before * 100).toFixed(0)}%) · ${JSON.stringify(payload).length} bytes`,
);