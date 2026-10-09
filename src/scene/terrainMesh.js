import { environmentOf } from "../palette.js";
import { createLandCover, SNOWLINE } from "./landCover.js";
import { makeRng } from "../rng.js";
import { createNoise2, fbm, smoothstep } from "../course/noise.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { lengthScale } from "../worldScale.js";

const m = (v) => v * lengthScale;
const FAR_REACH = m(9100),
  EDGE_STEP = m(10);
const mixColor = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * Indexed terrain mesh: the course heightfield plus a coarse far landscape around it.
 * Attributes: positions, colors (rgb + emissive), surface (facet jitter, flat weight), normals.
 * Where the flat weight is low the shader paints strata bands from world height instead.
 * Valley courses are coloured by land cover and ringed by snow-capped ranges.
 */
export function buildTerrainMesh(course) {
  const environment = environmentOf(course);
  const valley = course.type === "valley";
  const cover = valley ? createLandCover(course, environment) : null;
  const FAR_CELL = m(valley ? 150 : 260);
  const { origin, cellSize, columns, rows, heights } = course.terrain;
  const random = makeRng(`terrain-colour:${course.seed}`);
  const noise = createNoise2(makeRng(`far:${course.seed}`));
  const positions = [],
    colors = [],
    surface = [],
    normals = [],
    indices = [];
  const floorLevel = Math.min(...course.path.map((p) => p.floor));
  const push = (x, y, z, color, flat, normal) => {
    positions.push(x, y, z);
    colors.push(color[0], color[1], color[2], 0);
    surface.push(0.95 + random() * 0.1, flat);
    normals.push(...normal);
    return positions.length / 3 - 1;
  };
  const gridNormal = (at, c, r, size) => {
    const nx = (at(c - 1, r) - at(c + 1, r)) / (2 * size),
      nz = (at(c, r - 1) - at(c, r + 1)) / (2 * size);
    const l = Math.hypot(nx, 1, nz);
    return [nx / l, 1 / l, nz / l];
  };
  const triangulate = (base, cols, rws, skip) => {
    for (let r = 0; r < rws - 1; r++)
      for (let c = 0; c < cols - 1; c++) {
        if (skip?.(c, r)) continue;
        const k = base + r * cols + c;
        if ((r + c) % 2) indices.push(k, k + cols, k + 1, k + 1, k + cols, k + cols + 1);
        else indices.push(k, k + cols + 1, k + 1, k, k + cols, k + cols + 1);
      }
  };

  const at = (c, r) =>
    heights[Math.max(0, Math.min(rows - 1, r)) * columns + Math.max(0, Math.min(columns - 1, c))];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const x = origin[0] + c * cellSize,
        z = origin[1] + r * cellSize,
        y = heights[r * columns + c];
      const normal = gridNormal(at, c, r, cellSize);
      const level = smoothstep(0.8, 0.95, normal[1]);
      let color, flat;
      if (cover) ({ color, flat } = cover(x, y, z, normal[1]));
      else if (y < floorLevel + m(4)) {
        color = environment.sand;
        flat = level * 0.92;
      } else if (y > m(230)) {
        const patch = smoothstep(0.58, 0.72, fbm(noise, x / m(160), z / m(160), 2));
        color = mixColor(environment.mesa, environment.scrub, patch * 0.4);
        flat = level * 0.9;
      } else {
        color = mixColor(environment.sand, environment.mesa, 0.4);
        flat = level * 0.6;
      }
      push(x, y, z, color, flat, normal);
    }
  triangulate(0, columns, rows);

  const x0 = origin[0],
    z0 = origin[1],
    x1 = origin[0] + (columns - 1) * cellSize,
    z1 = origin[1] + (rows - 1) * cellSize;
  const lines = (a, b) => {
    const out = [];
    for (let v = a - FAR_REACH; v < a; v += FAR_CELL) out.push(v);
    const inner = Math.max(1, Math.round((b - a) / FAR_CELL));
    for (let i = 0; i <= inner; i++) out.push(a + ((b - a) * i) / inner);
    for (let v = b + FAR_CELL; v <= b + FAR_REACH; v += FAR_CELL) out.push(v);
    return out;
  };
  const xs = lines(x0, x1),
    zs = lines(z0, z1);
  const edgeHeight = (x, z) => {
    let low = Infinity;
    for (let k = -FAR_CELL; k <= FAR_CELL; k += EDGE_STEP) {
      const px = Math.max(x0, Math.min(x1, x + (z <= z0 || z >= z1 ? k : 0))),
        pz = Math.max(z0, Math.min(z1, z + (z <= z0 || z >= z1 ? 0 : k)));
      low = Math.min(low, terrainHeight(course.terrain, px, pz));
    }
    return low;
  };
  const outside = (x, z) => Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(z0 - z, 0, z - z1));
  // Receding ranges: a tent across each crest line, peaks along it where a ridged noise crosses it.
  const backdrop = environment.backdrop;
  const ranges = (x, z, d) => {
    const reach = d / lengthScale + (fbm(noise, x / m(3000) + 11, z / m(3000), 2) - 0.5) * 2 * backdrop.wobble;
    let top = 0;
    backdrop.ranges.forEach(([distance, height, half], i) => {
      const across = 1 - Math.abs(reach - distance) / half;
      if (across <= 0) return;
      const peaks = 1 - Math.abs(2 * fbm(noise, x / m(backdrop.peakSpacing) + 23 + i * 5, z / m(backdrop.peakSpacing), 2) - 1);
      top = Math.max(top, height * (backdrop.saddle + (1 - backdrop.saddle) * peaks) * across);
    });
    return m(top);
  };
  // Land cover read at a height scaled down on the ranges, so its life zones and snowline climb with them.
  const coverHeight = (y, d) => (backdrop ? y / (1 + (backdrop.snowline / SNOWLINE - 1) * smoothstep(0, m(1100), d)) : y);
  // Far colours drift toward a cool grey and pale toward the mist with distance (baked into the vertices), and lose the strata.
  const recede = ({ color, flat }, d) => {
    if (!backdrop) return { color, flat };
    const t = Math.sqrt(Math.min(1, d / m(backdrop.ranges[1]?.[0] ?? 4000)));
    const grey = color[0] * 0.3 + color[1] * 0.55 + color[2] * 0.15;
    const muted = mixColor(color, backdrop.cool.map((v) => v * grey), t * backdrop.fade).map((v) => v * (1 + Math.max(0, backdrop.floor / grey - 1) * t));
    return { color: mixColor(muted, backdrop.mist, t * backdrop.lift), flat: flat + (1 - flat) * smoothstep(0, m(1100), d) };
  };
  const far = (x, z) => {
    const d = outside(x, z);
    const shape = fbm(noise, x / m(2600), z / m(2600), 3);
    let raw;
    if (valley) {
      const ridge = 1 - Math.abs(2 * fbm(noise, x / m(600) + 3, z / m(600), 3) - 1);
      raw = m((380 + (shape - 0.35) * 700 + 300 * ridge * ridge) * (backdrop?.hills ?? 1));
      if (backdrop) raw = Math.max(raw, ranges(x, z, d));
    } else {
      const mesa = smoothstep(0.5, 0.58, fbm(noise, x / m(1100) + 7, z / m(1100), 2));
      raw = m(280 + (shape - 0.35) * 260 + mesa * 150);
    }
    const edge = edgeHeight(x, z);
    return edge + (raw - edge) * smoothstep(0, m(1100), d);
  };
  const farAt = (c, r) => far(xs[Math.max(0, Math.min(xs.length - 1, c))], zs[Math.max(0, Math.min(zs.length - 1, r))]);
  const base = positions.length / 3;
  for (let r = 0; r < zs.length; r++)
    for (let c = 0; c < xs.length; c++) {
      const normal = gridNormal(farAt, c, r, FAR_CELL);
      const level = smoothstep(0.75, 0.93, normal[1]);
      const x = xs[c],
        z = zs[r];
      const edge = x === x0 || x === x1 || z === z0 || z === z1 ? m(1.5) : 0;
      const y = farAt(c, r) - edge;
      if (cover) {
        const d = outside(x, z);
        const { color, flat } = recede(cover(x, coverHeight(y, d), z, normal[1]), d);
        push(x, y, z, color, flat, normal);
        continue;
      }
      const patch = smoothstep(0.58, 0.72, fbm(noise, x / m(160), z / m(160), 2));
      push(x, y, z, mixColor(environment.mesa, environment.scrub, patch * 0.4), level * 0.9, normal);
    }
  triangulate(base, xs.length, zs.length, (c, r) => xs[c] >= x0 && xs[c + 1] <= x1 && zs[r] >= z0 && zs[r + 1] <= z1);

  const perimeter = [];
  for (let c = 0; c < columns; c++) perimeter.push([c, 0]);
  for (let r = 1; r < rows; r++) perimeter.push([columns - 1, r]);
  for (let c = columns - 2; c >= 0; c--) perimeter.push([c, rows - 1]);
  for (let r = rows - 2; r >= 0; r--) perimeter.push([0, r]);
  const curtain = perimeter.map(([c, r]) => {
    const y = heights[r * columns + c];
    return push(origin[0] + c * cellSize, y - m(160), origin[1] + r * cellSize, valley ? environment.rock : environment.mesa, 1, [0, 1, 0]);
  });
  for (let i = 0; i < perimeter.length - 1; i++) {
    const [a, b] = [perimeter[i], perimeter[i + 1]].map(([c, r]) => r * columns + c);
    indices.push(a, curtain[i], b, b, curtain[i], curtain[i + 1]);
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    surface: new Float32Array(surface),
    normals: new Float32Array(normals),
    indices: new Uint32Array(indices),
  };
}
