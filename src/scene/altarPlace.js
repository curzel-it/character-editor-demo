import { environmentOf } from "../palette.js";
import { makeRng } from "../rng.js";
import { createNoise2, fbm, smoothstep } from "../course/noise.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { createBuilder } from "./meshBuilder.js";
import { createLandCover } from "./landCover.js";
import { addTrees, broadleaf, conifer } from "./treeMesh.js";
import { stoneRingLayout, ENTRANCE_ANGLE } from "./stoneRing.js";
import { addStoneRing } from "./standingStones.js";
import { addAltarStone, altarGlowMesh, createAltarStone } from "./altarStone.js";

// The course seed picks the land cover; this one lays meadow, not fields or forest, over the clearing.
const SEED = "soul-altar",
  COURSE_SEED = "soul-altar-17",
  CLEARING = 48,
  REACH = 6000,
  CELL = 60,
  WOODS = 900,
  RUNE_LIFT = 0.015;

/** Distance past the flat clearing around the ring, 0 within it. */
const outside = (x, z, margin = 0) => Math.max(0, Math.hypot(x, z) - CLEARING - margin);

function buildTerrain() {
  const noise = createNoise2(makeRng(`${SEED}:terrain`));
  const columns = Math.round((2 * REACH) / CELL) + 1;
  const heights = new Float32Array(columns * columns);
  for (let r = 0; r < columns; r++)
    for (let c = 0; c < columns; c++) {
      const x = -REACH + c * CELL,
        z = -REACH + r * CELL;
      const d = outside(x, z);
      const hills = smoothstep(0, 900, d) * (10 + 90 * fbm(noise, x / 480, z / 480, 3));
      const swell = smoothstep(0, 160, d) * 7 * fbm(noise, x / 110 + 7, z / 110, 2);
      heights[r * columns + c] = hills + swell;
    }
  return { origin: [-REACH, -REACH], cellSize: CELL, columns, rows: columns, heights };
}

/** A copse closing the clearing behind the ring (away from the entrance), thinning outwards. */
function addCopse(builder, terrain, env) {
  const random = makeRng(`${SEED}:copse`);
  for (let n = 0; n < 700; n++) {
    const a = ENTRANCE_ANGLE + Math.PI + (random() - 0.5) * 3.4,
      r = CLEARING + 6 + random() * 220;
    const x = Math.cos(a) * r,
      z = Math.sin(a) * r;
    if (random() > 1.25 - (r - CLEARING) / 260) continue;
    const y = terrainHeight(terrain, x, z);
    if (random() < 0.6) {
      const height = 14 + random() * 12;
      conifer(builder, x, y - 1, z, height, height * (0.18 + random() * 0.05), random() < 0.5 ? env.conifer : env.coniferDark, random() * 6);
    } else {
      const height = 10 + random() * 8;
      broadleaf(builder, x, y, z, height, height * (0.34 + random() * 0.1), random() < 0.5 ? env.broadleaf : env.broadleafLight, env.trunk, random() * 6);
    }
  }
}

/** The emissive triangles of a built mesh, nudged `lift` towards the ring's centre off the grooves they light. */
function glowingPart(mesh, centre, lift) {
  const keep = [];
  for (let t = 0; t < mesh.positions.length / 9; t++) if (mesh.colors[t * 12 + 3] > 0) keep.push(t);
  const positions = new Float32Array(keep.length * 9),
    colors = new Float32Array(keep.length * 12),
    surface = new Float32Array(keep.length * 6),
    normals = new Float32Array(keep.length * 9);
  keep.forEach((t, i) => {
    for (let v = 0; v < 3; v++) {
      const p = mesh.positions.subarray(t * 9 + v * 3, t * 9 + v * 3 + 3);
      const dx = centre[0] - p[0],
        dz = centre[2] - p[2],
        l = Math.hypot(dx, dz) || 1;
      positions.set([p[0] + (dx / l) * lift, p[1], p[2] + (dz / l) * lift], i * 9 + v * 3);
    }
    colors.set(mesh.colors.subarray(t * 12, t * 12 + 12), i * 12);
    surface.set(mesh.surface.subarray(t * 6, t * 6 + 6), i * 6);
    normals.set(mesh.normals.subarray(t * 9, t * 9 + 9), i * 9);
  });
  return { positions, colors, surface, normals };
}

/**
 * The Soul Altar as a scene course at dusk: a flat clearing at y = 0 with the ring of trilithons and
 * the altar stone at its centre, a copse behind and rolling hills under the valley's far ranges.
 * `custodian` stands just outside the entrance (+Z), `{ position, forward }` on the ground. `dressing` is prebuilt for the scene.
 */
export function createAltarPlace() {
  const course = { seed: COURSE_SEED, type: "valley", environment: "dusk", path: [], gates: [], thermals: [], features: [], terrain: buildTerrain() };
  const env = environmentOf(course);
  const ring = stoneRingLayout(SEED, { trilithons: 5 });
  const altar = createAltarStone({ position: [0, 0, 0], yaw: 0.35, seed: SEED });
  const builder = createBuilder();
  addStoneRing(builder, ring, { runes: 0 });
  addAltarStone(builder, altar, env);
  const clear = { clearance: (x, z) => (Math.hypot(x, z) > WOODS ? 0 : outside(x, z, 20)) };
  addTrees(builder, course, env, createLandCover(course, env), clear, null);
  addCopse(builder, course.terrain, env);
  const lit = createBuilder();
  addStoneRing(lit, ring, { runes: 1 });
  const runes = glowingPart(lit.result(), ring.centre, RUNE_LIFT);
  const e = ENTRANCE_ANGLE;
  const at = (angle, radius) => [Math.cos(angle) * radius, 0, Math.sin(angle) * radius];
  const facing = (from, to) => {
    const dx = to[0] - from[0],
      dz = to[2] - from[2],
      l = Math.hypot(dx, dz);
    return [dx / l, 0, dz / l];
  };
  const custodian = at(e - 0.36, 8.6);
  return {
    course: { ...course, dressing: builder.result() },
    env,
    ring,
    altar,
    runes,
    custodian: { position: custodian, forward: facing(custodian, [0, 0, 0]) },
  };
}

/**
 * The glowing props of the place for a frame: the altar's channels lit to `altarGlow` in `colors`
 * (an RGB or one per breath in the circle) and the ring's runes lit to `runeGlow` in `runeColor`.
 */
export function altarPlaceProps(place, { altarGlow = 0, runeGlow = 0, colors, runeColor }) {
  const props = [];
  if (altarGlow > 0) props.push(altarGlowMesh(place.altar, altarGlow, colors, place.env));
  if (runeGlow > 0) {
    const g = Math.min(1, runeGlow);
    const { positions, surface, normals } = place.runes;
    const colours = new Float32Array(place.runes.colors);
    for (let i = 0; i < colours.length; i += 4) {
      if (runeColor) for (let k = 0; k < 3; k++) colours[i + k] = colours[i + k] * 0.45 + runeColor[k] * 0.55;
      colours[i + 3] = g;
    }
    props.push({ positions, colors: colours, surface, normals });
  }
  return props;
}
