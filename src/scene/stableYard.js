import { environmentOf } from "../palette.js";
import { makeRng } from "../rng.js";
import { createNoise2, fbm, smoothstep } from "../course/noise.js";
import { createBuilder, mergeMeshes } from "./meshBuilder.js";
import { createLandCover } from "./landCover.js";
import { addTrees, broadleaf, conifer } from "./treeMesh.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { addYardSet } from "./yardSet.js";
import { addClouds } from "./cloudMesh.js";
import { addCastle } from "./castleMesh.js";
import { castleLayout } from "../course/castleLayout.js";

const SEED = "stable-yard",
  SPACING = 30,
  BACK = -55,
  FRONT = 30,
  REACH = 3400,
  CELL = 30,
  WOODS = 1600,
  SCREENED_GROVE = 30,
  MOUNTAINS = [
    { from: 1700, to: 2400, count: 90, height: [150, 270], radius: [240, 360] },
    { from: 2600, to: 3200, count: 70, height: [240, 380], radius: [320, 460] },
  ],
  SET = { x0: -50, x1: 55, z0: -45, z1: 35 },
  CASTLE = [190, -1050],
  VISTA = [0.02, 0.62],
  NEAR = 150,
  LIT = { x0: -70, x1: 70, z0: -70, z1: 50 };

/** The flat ground: a strip along the row of spots, or the set's square. */
const strip = (halfWidth) => ({ x0: -halfWidth, x1: halfWidth, z0: BACK - 20, z1: FRONT });

/** Distance outside the flat ground `flat`, grown by `margin`; 0 within it. */
function outside(x, z, flat, margin) {
  const dx = Math.max(0, flat.x0 - margin - x, x - flat.x1 - margin),
    dz = Math.max(0, flat.z0 - margin - z, z - flat.z1 - margin);
  return Math.hypot(dx, dz);
}

/**
 * A ring of pointed peaks (one row of the yard's range) `from`..`to` metres out, each `height` × `radius` (ranges of metres), ribbed by
 * a ridged noise so their flanks break into spurs and gullies.
 */
function placePeaks({ from, to, count, height, radius }, row) {
  const random = makeRng(`${SEED}:peaks:${row}`);
  return Array.from({ length: count }, (_, i) => {
    const angle = ((i + random() * 0.8) / count) * Math.PI * 2,
      out = from + (to - from) * random(),
      far = (out - from) / (to - from);
    return {
      x: Math.sin(angle) * out,
      z: -Math.cos(angle) * out,
      height: height[0] + (height[1] - height[0]) * (0.4 * far + 0.6 * random()),
      radius: radius[0] + (radius[1] - radius[0]) * random(),
    };
  });
}

/** Crest lines of `noise` at `scale` metres: 1 along a ridge, falling off steeply to either side. */
function ridged(noise, x, z, scale, seed) {
  return (1 - Math.abs(2 * fbm(noise, x / scale + seed, z / scale - seed, 2) - 1)) ** 2;
}

function peakHeight(noise, peaks, x, z) {
  let top = 0;
  for (const p of peaks) {
    const d = Math.hypot(x - p.x, z - p.z) / p.radius;
    if (d < 1) top = Math.max(top, p.height * (1 - d) ** 1.15);
  }
  if (top === 0) return 0;
  const wx = x + (fbm(noise, x / 300 + 5, z / 300, 2) - 0.5) * 220,
    wz = z + (fbm(noise, x / 300, z / 300 + 5, 2) - 0.5) * 220;
  const spurs = ridged(noise, wx, wz, 260, 17),
    ribs = ridged(noise, wx, wz, 110, 41),
    gullies = ridged(noise, wx, wz, 55, 73);
  return top * (0.55 + 0.35 * spurs + 0.18 * ribs + 0.08 * gullies);
}

function buildTerrain(flat, { height = 70, rise = 0.8, mountains } = {}) {
  const noise = createNoise2(makeRng(`${SEED}:terrain`));
  const peaks = (mountains ?? []).flatMap(placePeaks);
  const columns = Math.round((2 * REACH) / CELL) + 1;
  const heights = new Float32Array(columns * columns);
  for (let r = 0; r < columns; r++)
    for (let c = 0; c < columns; c++) {
      const x = -REACH + c * CELL,
        z = -REACH + r * CELL;
      const d = outside(x, z, flat, 80);
      const behind = 1 + rise * smoothstep(300, 1300, -z);
      const hills = smoothstep(0, 1200, d) * (8 + height * fbm(noise, x / 520, z / 520, 3)) * behind;
      const bumps = smoothstep(0, 80, d) * 6 * fbm(noise, x / 70 + 11, z / 70, 2);
      heights[r * columns + c] = Math.max(hills, peakHeight(noise, peaks, x, z)) + bumps;
    }
  return { origin: [-REACH, -REACH], cellSize: CELL, columns, rows: columns, heights };
}

/** The box `{ centre, yaw, halfA, halfB, top, wall }` around everything `mesh` draws, in either style. */
function footprintOf(mesh) {
  const low = [Infinity, Infinity, Infinity],
    high = [-Infinity, -Infinity, -Infinity];
  for (const { positions } of [mesh, mesh.styled?.flat, mesh.styled?.soft].filter(Boolean))
    for (let i = 0; i < positions.length; i += 3)
      for (let k = 0; k < 3; k++) {
        low[k] = Math.min(low[k], positions[i + k]);
        high[k] = Math.max(high[k], positions[i + k]);
      }
  const halfA = (high[0] - low[0]) / 2,
    halfB = (high[2] - low[2]) / 2;
  return { centre: [(low[0] + high[0]) / 2, (low[2] + high[2]) / 2], yaw: 0, halfA, halfB, top: high[1], wall: [halfA, halfB] };
}

/** Woods behind the stable block and around the yard's ends, thinning with distance. */
function addGrove(builder, terrain, flat, env, skip, screen) {
  const random = makeRng(`${SEED}:grove`);
  for (let n = 0; n < 900; n++) {
    const x = (random() * 2 - 1) * (flat.x1 + 260),
      z = flat.z0 - 10 - random() * 260 + (Math.abs(x) > flat.x1 + 20 ? random() * 200 : 0);
    const gap = outside(x, z, flat, 0);
    if (skip(x, z)) continue;
    if (gap < 4 || random() > 1.1 - gap / 300) continue;
    const y = terrainHeight(terrain, x, z);
    const tree = gap < SCREENED_GROVE ? screen() : builder;
    if (random() < 0.7) {
      const height = 15 + random() * 13;
      conifer(tree, x, y - 1, z, height, height * (0.18 + random() * 0.05), random() < 0.5 ? env.conifer : env.coniferDark, random() * 6);
    } else {
      const height = 12 + random() * 8;
      broadleaf(tree, x, y, z, height, height * (0.34 + random() * 0.1), random() < 0.5 ? env.broadleaf : env.broadleafLight, env.trunk, random() * 6);
    }
  }
}

/** Whether `[x, z]` lies in the view opening to the right of the barn: open near by, thinning to copses further out. */
function inVista(x, z) {
  const bearing = Math.atan2(x, -z),
    d = Math.hypot(x, z);
  if (z > -20 || bearing < VISTA[0] || bearing > VISTA[1] || d > 2400) return false;
  const copse = Math.sin(x * 0.011 + 1.3) * Math.sin(z * 0.013 - 0.4);
  return d < 260 || copse < 0.45;
}

/** A castle on the far hills, where the view opens out to the right of the barn. */
function addFarCastle(builder, terrain, env) {
  const [x, z] = CASTLE;
  const toward = Math.hypot(x, z);
  const near = [-x / toward, 0, -z / toward];
  const castle = castleLayout(makeRng(`${SEED}:castle`), { position: [x, terrainHeight(terrain, x, z), z], along: [-near[2], 0, near[0]], near });
  addCastle(builder, castle, terrain, env);
}

/**
 * The stable yard as a scene course on flat ground at y = 0. With `buildings` it is the stable set:
 * one spot at the origin, facing three-quarters towards +Z where the camera stands, the barn behind it
 * to the left, the view opening to the right onto hills, a castle and the far ranges under fair-weather
 * clouds, the barn as the course's `building` and the props, bushes and nearest trees as its `screens`, each `{ mesh, footprint }`,
 * which the stable fades while they stand in the camera's way; `blockers` are the barn's footprint and `beds` the places at the barn's
 * left end where sleeping dragons lie, `{ position, turn }`, the front spot carried round by `turnedBy`
 * (`yardSet.js`), and `vista` the unit heading from the spot out over the open grassland. `casters` is the part of `dressing`
 * that casts baked shadows. Without, it is an open meadow with
 * `slots` spots in a row along +X, `spacing` apart. `dressing` is prebuilt for the scene.
 * @param {number} slots
 * @param {{ spacing?: number, buildings?: boolean }} [options]
 */
export function createStableYard(slots, { spacing = SPACING, buildings = true } = {}) {
  const count = buildings ? 1 : slots;
  const spots = Array.from({ length: count }, (_, i) => ({
    position: [(i - (count - 1) / 2) * spacing, 0, 0],
    forward: [0.6, 0, 0.8],
  }));
  const flat = buildings ? SET : strip(((count - 1) / 2) * spacing + spacing / 2 + 16);
  const course = { seed: SEED, type: "valley", environment: buildings ? "yard" : undefined, path: [], gates: [], thermals: [], features: [], terrain: buildTerrain(flat, buildings ? { height: 38, rise: 0.3, mountains: MOUNTAINS } : undefined) };
  const env = environmentOf(course);
  const builder = createBuilder(),
    overhang = createBuilder(),
    barn = { builder: createBuilder(), overhang: createBuilder() },
    screenParts = [];
  const screen = () => {
    const part = createBuilder();
    screenParts.push(part);
    return part;
  };
  const { blockers, beds } = buildings ? addYardSet(builder, overhang, SEED, env, barn, screen) : { blockers: [], beds: [] };
  if (buildings) {
    addFarCastle(builder, course.terrain, env);
    addClouds(builder, [0, 0], env, makeRng(`${SEED}:clouds`));
  }
  const view = (x, z) => buildings && inVista(x, z);
  const clear = { clearance: (x, z) => (view(x, z) ? 0 : Math.hypot(x, z) > WOODS ? 0 : outside(x, z, flat, 30)) };
  addTrees(builder, course, env, createLandCover(course, env), clear, null, buildings ? [{ position: [CASTLE[0], 0, CASTLE[1]], radius: 140 }] : []);
  addGrove(builder, course.terrain, flat, env, view, screen);
  const lightBounds = buildings ? { origin: [LIT.x0, LIT.z0], size: [LIT.x1 - LIT.x0, LIT.z1 - LIT.z0] } : undefined;
  const ground = builder.result(),
    walls = barn.builder.result();
  const building = buildings ? mergeMeshes(walls, barn.overhang.result()) : undefined;
  const screens = screenParts.map((part) => part.result()).map((mesh) => ({ mesh, footprint: footprintOf(mesh) }));
  const bearing = (VISTA[0] + VISTA[1]) / 2;
  const vista = [Math.sin(bearing), 0, -Math.cos(bearing)];
  const near = { centre: [0, 0], radius: NEAR + spacing * (count - 1) / 2 };
  return { course: { ...course, lightBounds, near, casters: screens.reduce((all, { mesh }) => mergeMeshes(all, mesh), mergeMeshes(ground, walls)), dressing: mergeMeshes(ground, overhang.result()), building, screens }, spots, spacing, blockers, beds, vista };
}
