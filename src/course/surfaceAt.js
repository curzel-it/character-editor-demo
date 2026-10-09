import { terrainHeight } from "./terrainHeight.js";
import { lengthScale } from "../worldScale.js";

// Muddy banks reach this far beyond the river's edge or the lake shore.
const BANK = 5 * lengthScale;

function nearestRiver(points, x, z) {
  let best = { d: Infinity, half: 0, level: 0 };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i],
      b = points[i + 1];
    const dx = b[0] - a[0],
      dz = b[2] - a[2];
    const k = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz || 1)));
    const d = Math.hypot(x - a[0] - dx * k, z - a[2] - dz * k);
    if (d < best.d) best = { d, half: a[3] + (b[3] - a[3]) * k, level: a[1] + (b[1] - a[1]) * k };
  }
  return best;
}

function lakeReach(lake, x, z) {
  const dx = x - lake.position[0],
    dz = z - lake.position[2];
  const a = (dx * lake.forward[0] + dz * lake.forward[2]) / lake.halfLength,
    b = (-dx * lake.forward[2] + dz * lake.forward[0]) / lake.halfWidth;
  return Math.hypot(a, b);
}

/**
 * Ground material at world (x, z): `water` in the river or lake, `mud` on their banks, `sand` in the
 * canyon and `dirt` elsewhere. `ground` is the terrain height and `level` the water surface (or ground).
 * @returns {{ surface: "water" | "mud" | "sand" | "dirt", ground: number, level: number }}
 */
export function surfaceAt(course, x, z) {
  const ground = course.terrain ? terrainHeight(course.terrain, x, z) : -Infinity;
  if (course.type === "canyon") return { surface: "sand", ground, level: ground };
  for (const feature of course.features ?? []) {
    if (feature.type === "lake" && ground < feature.level) {
      const reach = lakeReach(feature, x, z);
      if (reach < 1.16) return { surface: "water", ground, level: feature.level };
    }
    if (feature.type === "river") {
      const river = nearestRiver(feature.points, x, z);
      if (river.half < 0.5) continue;
      if (river.d < river.half && ground < river.level) return { surface: "water", ground, level: river.level };
      if (river.d < river.half + BANK) return { surface: "mud", ground, level: ground };
    }
  }
  return { surface: "dirt", ground, level: ground };
}
