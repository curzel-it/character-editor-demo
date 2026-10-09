import { createNoise2, fbm, smoothstep } from "./noise.js";

const COARSE = 20;
// Stretches of the path closer than this beyond the nearest blend into each other's valley.
const SLACK = 24;
// Parameter smoothing window along the path, in samples per unit of distance from it.
const SOFT = 0.08;
const RELAX = [120, 400];
const KEYS = ["halfWidth", "ground", "hillRun", "mountain", "floor"];
// Banks reach this far past the river's edge, rising at BANK_SLOPE from the water line.
const BANK = 5;
const BANK_SLOPE = 0.8;
const mix = (a, b, t) => a + (b - a) * t;

/**
 * Carves a river valley into a mountain range around a centreline, at reference scale.
 * Each sample carries `position`, `halfWidth`, `ground` (valley floor under the corridor), `floor`,
 * `extra: [left, right]` (flat floor beyond the corridor), `foot: [left, right]` (foothill slope),
 * `hillRun`, `mountain` (upper slope), `riverU`, `riverHalf` and `water` (river surface Y).
 * The corridor footprint plus `margin` stays at ground height, so the flyable volume stays clear.
 * `lakes` flood ellipses to `level`; `hills` raise flat-topped crags beside the corridor.
 */
export function carveValley(samples, random, { cellSize, margin, reach, lakes = [], hills = [] }) {
  const peakNoise = createNoise2(random),
    ridgeNoise = createNoise2(random),
    rollNoise = createNoise2(random),
    jitterNoise = createNoise2(random);
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const p of samples) {
    minX = Math.min(minX, p.position[0]);
    maxX = Math.max(maxX, p.position[0]);
    minZ = Math.min(minZ, p.position[2]);
    maxZ = Math.max(maxZ, p.position[2]);
  }
  const origin = [Math.floor((minX - reach) / cellSize) * cellSize, Math.floor((minZ - reach) / cellSize) * cellSize];
  const columns = Math.ceil((maxX + reach - origin[0]) / cellSize) + 1,
    rows = Math.ceil((maxZ + reach - origin[1]) / cellSize) + 1;

  const n = samples.length - 1;
  const ax = new Float64Array(n),
    az = new Float64Array(n),
    sx = new Float64Array(n),
    sz = new Float64Array(n),
    len2 = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const a = samples[i].position,
      b = samples[i + 1].position;
    ax[i] = a[0];
    az[i] = a[2];
    sx[i] = b[0] - a[0];
    sz[i] = b[2] - a[2];
    len2[i] = sx[i] * sx[i] + sz[i] * sz[i] || 1;
  }
  const table = Object.fromEntries(KEYS.map((key) => [key, Float64Array.from(samples, (p) => p[key])]));
  for (const key of ["extra", "foot"])
    for (const side of [0, 1]) table[`${key}${side}`] = Float64Array.from(samples, (p) => p[key][side]);
  const names = Object.keys(table);
  const columnsOf = names.map((name) => table[name]);
  const at = Object.fromEntries(names.map((name, i) => [name, i]));

  const project = (k, x, z) => {
    let t = ((x - ax[k]) * sx[k] + (z - az[k]) * sz[k]) / len2[k];
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = x - ax[k] - sx[k] * t,
      pz = z - az[k] - sz[k] * t;
    return [Math.sqrt(px * px + pz * pz), t];
  };

  const coarseColumns = Math.ceil((columns * cellSize) / COARSE) + 1,
    coarseRows = Math.ceil((rows * cellSize) / COARSE) + 1;
  const candidates = [];
  const spread = COARSE * Math.SQRT2 + SLACK;
  const coarse = new Float64Array(n);
  for (let r = 0; r < coarseRows; r++)
    for (let c = 0; c < coarseColumns; c++) {
      const x = origin[0] + (c + 0.5) * COARSE,
        z = origin[1] + (r + 0.5) * COARSE;
      let best = Infinity;
      for (let k = 0; k < n; k++) {
        coarse[k] = project(k, x, z)[0];
        if (coarse[k] < best) best = coarse[k];
      }
      const list = [];
      for (let k = 0; k < n; k++) if (coarse[k] <= best + spread) list.push(k);
      candidates.push(Int32Array.from(list));
    }

  // Running integrals of every parameter over sample index, for window averages in constant time.
  const integrals = columnsOf.map((col) => {
    const sum = new Float64Array(col.length);
    for (let i = 1; i < col.length; i++) sum[i] = sum[i - 1] + (col[i - 1] + col[i]) / 2;
    return sum;
  });
  const integral = (p, x) => {
    const col = columnsOf[p],
      sum = integrals[p];
    if (x <= 0) return col[0] * x;
    if (x >= n) return sum[n] + col[n] * (x - n);
    const i = Math.floor(x),
      f = x - i;
    const end = col[i] + (col[i + 1] - col[i]) * f;
    return sum[i] + ((col[i] + end) / 2) * f;
  };
  // Parameters averaged along the path around index `x`, over a window that widens with distance,
  // so far from the path they vary slowly and bends do not fan out into rays.
  const params = new Float64Array(names.length);
  // Far from the path every parameter relaxes to its course-wide mean, so where two stretches of the
  // path meet across a ridge their mountainsides agree.
  const means = columnsOf.map((col) => col.reduce((a, b) => a + b, 0) / col.length);
  for (const key of ["extra", "foot"]) means[at[`${key}0`]] = means[at[`${key}1`]] = (means[at[`${key}0`]] + means[at[`${key}1`]]) / 2;
  const soften = (x, d) => {
    const half = 1 + Math.max(0, d - 60) * SOFT;
    const relax = smoothstep(RELAX[0], RELAX[1], d);
    for (let p = 0; p < names.length; p++)
      params[p] = mix((integral(p, x + half) - integral(p, x - half)) / (2 * half), means[p], relax);
    return params;
  };

  // `w` is 1 on its left and 0 on its right, blended off its ends.
  const carve = (P, d, w, jitter, roll, ridge, spur, vary) => {
    const ground = P[at.ground];
    const e = d - P[at.halfWidth] - margin;
    let y;
    if (e <= 0) y = ground;
    else {
      const extra = mix(P[at.extra1], P[at.extra0], w),
        foot = mix(P[at.foot1], P[at.foot0], w),
        run = P[at.hillRun];
      const q = e - extra + jitter * Math.min(e, 40) * 1.4 - spur * Math.min(e, 160);
      const bump = roll * 3 * smoothstep(0, 14, e);
      if (q <= 0) y = ground + bump;
      else {
        const upper = Math.max(0, q - run);
        const steep = mix(P[at.mountain], 0.62, smoothstep(40, 200, upper));
        y = ground + bump + Math.min(q, run) * foot + upper * steep * vary + Math.min(upper, 220) * 0.3 * ridge;
      }
    }
    return y;
  };

  const channel = carveRiver(samples, origin, coarseColumns, coarseRows);

  const heights = new Float32Array(columns * rows);
  const most = Math.max(...candidates.map((list) => list.length));
  const dists = new Float64Array(most),
    ts = new Float64Array(most),
    sides = new Float64Array(most);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const x = origin[0] + c * cellSize,
        z = origin[1] + r * cellSize;
      const list =
        candidates[
          Math.min(coarseRows - 1, Math.floor((r * cellSize) / COARSE)) * coarseColumns +
            Math.min(coarseColumns - 1, Math.floor((c * cellSize) / COARSE))
        ];
      let near = Infinity,
        nearI = 0;
      const count = list.length;
      for (let i = 0; i < count; i++) {
        const k = list[i];
        const rx = x - ax[k],
          rz = z - az[k];
        let t = (rx * sx[k] + rz * sz[k]) / len2[k];
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = rx - sx[k] * t,
          pz = rz - sz[k] * t;
        const d = Math.sqrt(px * px + pz * pz);
        dists[i] = d;
        ts[i] = t;
        const u = (rz * sx[k] - rx * sz[k]) / Math.sqrt(len2[k]);
        sides[i] = smoothstep(-0.35, 0.35, u / (d || 1));
        if (d < near) {
          near = d;
          nearI = i;
        }
      }
      const jitter = fbm(jitterNoise, x / 60, z / 60, 3) - 0.5;
      const roll = fbm(rollNoise, x / 55, z / 55, 2);
      const ridge = 1 - Math.abs(2 * fbm(ridgeNoise, x / 520, z / 520, 2) - 1);
      const spur = smoothstep(0.45, 0.8, fbm(ridgeNoise, x / 380 + 11, z / 380, 2)) * 0.4;
      const vary = 0.7 + 0.6 * fbm(peakNoise, x / 1300 + 5, z / 1300, 2);
      const peaks = 300 + 460 * fbm(peakNoise, x / 1500, z / 1500, 3) + 120 * ridge * ridge;
      // Every stretch of the path whose closest point is nearly as close as the nearest contributes,
      // so across the ridge between two stretches (inside bends too) their valleys meet without a seam.
      let sum = 0,
        weight = 0,
        floor = 0,
        halfWidth = 0;
      for (let i = 0; i < count; i++) {
        const d = dists[i];
        if (d > near + SLACK) continue;
        if (i > 0 && list[i - 1] === list[i] - 1 && dists[i - 1] <= d) continue;
        if (i + 1 < count && list[i + 1] === list[i] + 1 && dists[i + 1] < d) continue;
        const P = soften(list[i] + ts[i], d);
        if (d === near) {
          floor = P[at.floor];
          halfWidth = P[at.halfWidth];
        }
        const w = (1 - (d - near) / SLACK) ** 2;
        sum += w * Math.min(peaks, carve(P, d, sides[i], jitter, roll, ridge, spur, vary));
        weight += w;
      }
      let h = channel(x, z, sum / weight);
      for (const lake of lakes) {
        const dx = x - lake.position[0],
          dz = z - lake.position[2];
        const al = (dx * lake.forward[0] + dz * lake.forward[2]) / lake.halfLength,
          ac = (-dx * lake.forward[2] + dz * lake.forward[0]) / lake.halfWidth;
        const q = Math.hypot(al, ac) * (0.94 + jitter * 0.12);
        if (q < 1 && h < lake.level + 3) h = Math.min(h, lake.level - 0.5 - 4 * smoothstep(1, 0.55, q));
      }
      const outside = near - halfWidth;
      if (outside > 0) {
        // Beside the corridor a crag may rise to just under its floor, then climbs freely past the margin.
        const cap = floor - 1.5 + Math.max(0, outside - margin) * 6;
        for (const hill of hills) {
          const d = Math.hypot(x - hill.position[0], z - hill.position[2]);
          const fill = d <= hill.radius ? hill.top : hill.top - (d - hill.radius) * hill.slope * (0.8 + jitter * 0.8);
          if (fill > h) h = Math.min(fill, Math.max(h, cap));
          // Higher ground behind the crag is cut back on a slope rather than a sheer wall.
          h = Math.min(h, hill.top + Math.max(0, d - hill.radius) * 1.1);
        }
      }
      heights[r * columns + c] = h;
    }
  return {
    origin,
    cellSize,
    columns,
    rows,
    heights: Array.from(heights, (h) => Math.round(h * 100) / 100),
  };
}

/**
 * Cuts the river's channel along its own centreline (each sample's `riverU` to the left of the path),
 * so the bed follows the water ribbon through bends and up foothill slopes alike.
 * @returns {(x: number, z: number, y: number) => number}
 */
function carveRiver(samples, origin, coarseColumns, coarseRows) {
  const points = samples.map((p) => {
    const l = Math.hypot(p.forward[0], p.forward[2]) || 1;
    return [p.position[0] - (p.forward[2] / l) * p.riverU, p.water, p.position[2] + (p.forward[0] / l) * p.riverU, p.riverHalf];
  });
  const buckets = Array.from({ length: coarseColumns * coarseRows }, () => []);
  for (let k = 0; k < points.length - 1; k++) {
    const a = points[k],
      b = points[k + 1];
    if (a[3] <= 0.3 && b[3] <= 0.3) continue;
    const pad = Math.max(a[3], b[3]) + BANK;
    const c0 = Math.max(0, Math.floor((Math.min(a[0], b[0]) - pad - origin[0]) / COARSE)),
      c1 = Math.min(coarseColumns - 1, Math.floor((Math.max(a[0], b[0]) + pad - origin[0]) / COARSE)),
      r0 = Math.max(0, Math.floor((Math.min(a[2], b[2]) - pad - origin[1]) / COARSE)),
      r1 = Math.min(coarseRows - 1, Math.floor((Math.max(a[2], b[2]) + pad - origin[1]) / COARSE));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) buckets[r * coarseColumns + c].push(k);
  }
  return (x, z, y) => {
    const c = Math.floor((x - origin[0]) / COARSE),
      r = Math.floor((z - origin[1]) / COARSE);
    if (c < 0 || r < 0 || c >= coarseColumns || r >= coarseRows) return y;
    for (const k of buckets[r * coarseColumns + c]) {
      const a = points[k],
        b = points[k + 1];
      const sx = b[0] - a[0],
        sz = b[2] - a[2];
      let t = ((x - a[0]) * sx + (z - a[2]) * sz) / (sx * sx + sz * sz || 1);
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const half = mix(a[3], b[3], t);
      if (half <= 0.3) continue;
      const rd = Math.hypot(x - a[0] - sx * t, z - a[2] - sz * t);
      if (rd >= half + BANK) continue;
      const water = mix(a[1], b[1], t),
        bed = water - 1.4;
      const smooth = mix(bed, y, smoothstep(half * 0.55, half + BANK, rd));
      y = Math.min(y, smooth, Math.max(bed, water + (rd - half) * BANK_SLOPE));
    }
    return y;
  };
}
