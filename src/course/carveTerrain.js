import { createNoise2, fbm, smoothstep } from "./noise.js";

const TERRACE = 22;

/**
 * Carves a canyon into a high plateau. Each sample carries `position`, `halfWidth`,
 * `bed` (the lowest ground under the corridor) and `slope` (wall steepness).
 * The corridor footprint plus `margin` stays at bed height, so the flyable volume stays clear.
 */
export function carveTerrain(samples, random, options = {}) {
  const cellSize = options.cellSize ?? 10;
  const margin = options.margin ?? cellSize * 1.5;
  const plateauNoise = createNoise2(random),
    wallNoise = createNoise2(random),
    bedNoise = createNoise2(random);
  const plateauBase = options.plateau ?? 270;
  const plateauMax = plateauBase + 135;
  const reach = samples.map(
    (p) =>
      p.halfWidth + margin + (plateauMax - p.bed + TERRACE + 60) / p.slope + 20,
  );
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  samples.forEach((p, i) => {
    minX = Math.min(minX, p.position[0] - reach[i]);
    maxX = Math.max(maxX, p.position[0] + reach[i]);
    minZ = Math.min(minZ, p.position[2] - reach[i]);
    maxZ = Math.max(maxZ, p.position[2] + reach[i]);
  });
  const origin = [
    Math.floor(minX / cellSize) * cellSize,
    Math.floor(minZ / cellSize) * cellSize,
  ];
  const columns = Math.ceil((maxX - origin[0]) / cellSize) + 1,
    rows = Math.ceil((maxZ - origin[1]) / cellSize) + 1;
  const heights = new Float32Array(columns * rows);
  const jitter = new Float32Array(columns * rows);
  const ripple = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) {
      const x = origin[0] + c * cellSize,
        z = origin[1] + r * cellSize,
        k = r * columns + c;
      const broad = fbm(plateauNoise, x / 900, z / 900, 3);
      const mesa = smoothstep(0.52, 0.6, fbm(plateauNoise, x / 300 + 40, z / 300, 3));
      const raw = plateauBase + broad * 55 + mesa * 75;
      heights[k] = raw;
      jitter[k] = fbm(wallNoise, x / 70, z / 70, 3) - 0.5;
      ripple[k] = bedNoise(x / 45, z / 45);
    }
  for (let i = 0; i < samples.length - 1; i++) {
    const a = samples[i],
      b = samples[i + 1];
    const ax = a.position[0],
      az = a.position[2];
    const dx = b.position[0] - ax,
      dz = b.position[2] - az;
    const len2 = dx * dx + dz * dz || 1;
    const R = Math.max(reach[i], reach[i + 1]);
    const c0 = Math.max(0, Math.floor((Math.min(ax, ax + dx) - R - origin[0]) / cellSize)),
      c1 = Math.min(columns - 1, Math.ceil((Math.max(ax, ax + dx) + R - origin[0]) / cellSize)),
      r0 = Math.max(0, Math.floor((Math.min(az, az + dz) - R - origin[1]) / cellSize)),
      r1 = Math.min(rows - 1, Math.ceil((Math.max(az, az + dz) + R - origin[1]) / cellSize));
    const zLow = Math.min(az, az + dz),
      zHigh = Math.max(az, az + dz),
      xLow = Math.min(ax, ax + dx),
      xHigh = Math.max(ax, ax + dx);
    for (let r = r0; r <= r1; r++) {
      const z = origin[1] + r * cellSize;
      const gap = z < zLow ? zLow - z : z > zHigh ? z - zHigh : 0;
      if (gap > R) continue;
      const half = Math.sqrt(R * R - gap * gap);
      const cStart = Math.max(c0, Math.floor((xLow - half - origin[0]) / cellSize)),
        cEnd = Math.min(c1, Math.ceil((xHigh + half - origin[0]) / cellSize));
      for (let c = cStart; c <= cEnd; c++) {
        const x = origin[0] + c * cellSize,
          k = r * columns + c;
        let t = ((x - ax) * dx + (z - az) * dz) / len2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const px = x - ax - dx * t,
          pz = z - az - dz * t;
        const d = Math.sqrt(px * px + pz * pz);
        const hw = a.halfWidth + (b.halfWidth - a.halfWidth) * t;
        const bed = a.bed + (b.bed - a.bed) * t;
        const e = d - hw - margin;
        let h;
        if (e <= 0) {
          const u = Math.min(1, d / hw);
          h = bed - 4 * (1 - u * u) - ripple[k] * 2;
        } else {
          const slope = a.slope + (b.slope - a.slope) * t;
          const run = e + jitter[k] * Math.min(e, 24) * 1.6;
          const q = (slope * Math.max(0, run)) / TERRACE;
          const f = q - Math.floor(q);
          h = bed + TERRACE * (Math.floor(q) + smoothstep(0.5, 0.95, f));
        }
        if (h < heights[k]) heights[k] = h;
      }
    }
  }
  return {
    origin,
    cellSize,
    columns,
    rows,
    heights: Array.from(heights, (h) => Math.round(h * 100) / 100),
  };
}
