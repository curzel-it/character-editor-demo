import { makeRng } from "../rng.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { cone, column } from "./meshBuilder.js";

const SPACING = 22;
const LIMIT = 16000;

/** A conifer: two stacked cones, or three soft `sides`-sided tiers for a soft style. */
export function conifer(builder, x, y, z, height, radius, color, phase, sides = SIDES) {
  const c = [x, z];
  builder.styled(
    (plain) => {
      plain.lump(() => cone(plain, c, radius, y + height * 0.12, y + height * 0.7, 5, color, phase));
      plain.lump(() => cone(plain, c, radius * 0.7, y + height * 0.48, y + height, 5, color, phase + 0.6));
    },
    (soft) => {
      TIERS.forEach(([low, high, wide, turn], k) => soft.lump(() => tier(soft, c, radius * wide, y + height * low, y + height * high, color, phase + turn, sides, k === 0)));
    },
  );
}

/** A broadleaf tree: a trunk under a diamond crown, or under a puffy `sides`-sided ball for a soft style. */
export function broadleaf(builder, x, y, z, height, radius, color, trunk, phase, sides = SIDES) {
  const cy = y + height * 0.64,
    half = height * 0.36;
  builder.styled(
    (plain) => {
      column(plain, [x, z], radius * 0.12, y - 1, y + height * 0.45, 3, trunk, { phase });
      const ring = [0, 1, 2, 3].map((k) => {
        const a = phase + (k / 4) * Math.PI * 2;
        return [x + Math.cos(a) * radius, cy, z + Math.sin(a) * radius];
      });
      const top = [x, cy + half, z],
        bottom = [x, cy - half * 0.8, z];
      plain.lump(() => {
        for (let k = 0; k < 4; k++) {
          plain.tri(ring[k], ring[(k + 1) % 4], top, color, 0, 1.04);
          plain.tri(ring[(k + 1) % 4], ring[k], bottom, color, 0, 0.82);
        }
      });
    },
    (soft) => {
      column(soft, [x, z], radius * 0.14, y - 1, y + height * 0.45, 3, trunk, { phase });
      soft.lump(() => puff(soft, [x, cy, z], radius * 1.05, half, color, phase, sides));
    },
  );
}

const SIDES = 8,
  FAR_SIDES = 5,
  NEAR_TREES = 250,
  TIERS = [
    [0.08, 0.5, 1.15, 0],
    [0.32, 0.76, 0.88, 0.5],
    [0.56, 1, 0.58, 1],
  ];

/** A squat cone: a ring of `sides` at `y0` rising to a point at `y1`, with a dished-up underside when `belly`. */
function tier(builder, [x, z], radius, y0, y1, color, phase, sides, belly) {
  const ring = Array.from({ length: sides }, (_, k) => {
    const a = phase + (k / sides) * Math.PI * 2;
    return [x + Math.cos(a) * radius, y0, z + Math.sin(a) * radius];
  });
  const apex = [x, y1, z],
    under = [x, y0 + (y1 - y0) * 0.2, z];
  for (let k = 0; k < sides; k++) {
    builder.tri(ring[k], ring[(k + 1) % sides], apex, color, 0, 1.02);
    if (belly) builder.tri(ring[(k + 1) % sides], ring[k], under, color, 0, 0.85);
  }
}

/** A closed ball of `radius` around `centre`, `half` tall above it: two rings of `sides` between a top and a bottom point. */
function puff(builder, [x, y, z], radius, half, color, phase, sides) {
  const ring = (f, up, turn) =>
    Array.from({ length: sides }, (_, k) => {
      const a = phase + ((k + turn) / sides) * Math.PI * 2;
      return [x + Math.cos(a) * radius * f, y + half * up, z + Math.sin(a) * radius * f];
    });
  const waist = ring(1, 0, 0),
    shoulder = ring(0.72, 0.62, 0.5);
  const top = [x, y + half, z],
    bottom = [x, y - half * 0.7, z];
  for (let k = 0; k < sides; k++) {
    const n = (k + 1) % sides;
    builder.tri(waist[k], waist[n], shoulder[k], color, 0, 1);
    builder.tri(waist[n], shoulder[n], shoulder[k], color, 0, 1);
    builder.tri(shoulder[k], shoulder[n], top, color, 0, 1.04);
    builder.tri(waist[n], waist[k], bottom, color, 0, 0.82);
  }
}

/**
 * Scatters low-poly conifers on slopes and broadleaf clumps in the valley wherever land cover
 * holds forest, keeping clear of the corridor, the river and `keepOut` discs `{ position, radius }`; the soft
 * versions of the ones far from the corridor are built coarser.
 */
export function addTrees(builder, course, env, cover, corridor, river, keepOut = []) {
  const random = makeRng(`trees:${course.seed}`);
  const { origin, cellSize, columns, rows } = course.terrain;
  const terrain = course.terrain;
  const x1 = origin[0] + (columns - 1) * cellSize,
    z1 = origin[1] + (rows - 1) * cellSize;
  let planted = 0;
  for (let z = origin[1] + SPACING; z < z1 - SPACING && planted < LIMIT; z += SPACING)
    for (let x = origin[0] + SPACING; x < x1 - SPACING && planted < LIMIT; x += SPACING) {
      const px = x + (random() - 0.5) * SPACING * 0.9,
        pz = z + (random() - 0.5) * SPACING * 0.9;
      const roll = random();
      const y = terrainHeight(terrain, px, pz);
      const dx = terrainHeight(terrain, px + 6, pz) - terrainHeight(terrain, px - 6, pz),
        dz = terrainHeight(terrain, px, pz + 6) - terrainHeight(terrain, px, pz - 6);
      const up = 12 / Math.hypot(dx, 12, dz);
      const land = cover(px, y, pz, up);
      if (roll > land.forest) continue;
      if (corridor.clearance(px, pz) < 10 || river?.clearance(px, pz) < 6) continue;
      if (keepOut.some((k) => Math.hypot(px - k.position[0], pz - k.position[2]) < k.radius)) continue;
      const phase = random() * 6;
      const sides = corridor.clearance(px, pz) < NEAR_TREES ? SIDES : FAR_SIDES;
      if (up < 0.93 || y > 380 || random() < 0.35) {
        const height = 16 + random() * 14;
        conifer(builder, px, y - 1, pz, height, height * (0.17 + random() * 0.05), random() < 0.5 ? env.conifer : env.coniferDark, phase, sides);
      } else {
        const height = 11 + random() * 8;
        broadleaf(builder, px, y, pz, height, height * (0.32 + random() * 0.1), random() < 0.5 ? env.broadleaf : env.broadleafLight, env.trunk, phase, sides);
      }
      planted++;
    }
  return planted;
}
