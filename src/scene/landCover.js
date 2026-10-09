import { makeRng } from "../rng.js";
import { createNoise2, fbm, smoothstep } from "../course/noise.js";
import { lengthScale } from "../worldScale.js";

const m = (v) => v * lengthScale;
/** Reference height the snow starts at, give or take its noise. */
export const SNOWLINE = 560;
const hash = (a, b) => {
  const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return h - Math.floor(h);
};

/**
 * Valley land cover at a world point from its height and surface normal: water, fields, meadow,
 * forest, rock, alpine grass and snow. `forest` is a 0–1 tree density shared with the tree scatter.
 */
export function createLandCover(course, env) {
  const noise = createNoise2(makeRng(`cover:${course.seed}`));
  const lake = course.features?.find((f) => f.type === "lake");
  const fieldYaw = makeRng(`fields:${course.seed}`)() * Math.PI;
  const fc = Math.cos(fieldYaw),
    fs = Math.sin(fieldYaw);
  const treeline = m(env.treeline ?? 360),
    snowline = m(env.snowline ?? SNOWLINE);
  const mixColor = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const lakeReach = (x, z) => {
    const dx = x - lake.position[0],
      dz = z - lake.position[2];
    const a = (dx * lake.forward[0] + dz * lake.forward[2]) / lake.halfLength,
      b = (-dx * lake.forward[2] + dz * lake.forward[0]) / lake.halfWidth;
    return Math.hypot(a, b);
  };

  function sample(x, y, z, up) {
    const patch = fbm(noise, x / m(260), z / m(260), 3);
    const tree = treeline + (patch - 0.5) * m(120);
    const snow = snowline + (fbm(noise, x / m(500) + 9, z / m(500), 2) - 0.5) * m(200);
    const inLake = lake && y < lake.level - 0.3 && lakeReach(x, z) < 1.16;
    // The lake bed only shows where its shore triangles rise through the water: a pale bank.
    if (inLake) return { color: env.bank, flat: 1, forest: 0, kind: "water" };
    if (y > snow && up > 0.5) return { color: env.snow, flat: 1, forest: 0, kind: "snow" };
    if (up < 0.72) {
      const tone = fbm(noise, x / m(70) + 5, z / m(70), 2);
      return { color: mixColor(env.rock, y > tree ? env.scree : env.capRock, smoothstep(0.35, 0.7, tone)), flat: 0.65, forest: 0, kind: "rock" };
    }
    if (y > tree) {
      const t = smoothstep(0.8, 0.95, up) * (1 - smoothstep(tree, snow, y));
      return { color: mixColor(env.scree, env.meadow, t * 0.7), flat: 0.7, forest: 0, kind: "alpine" };
    }
    const woods = smoothstep(0.46, 0.56, patch + (1 - up) * 1.6 - (up > 0.985 ? 0.3 : 0));
    const edge = 1 - smoothstep(tree - m(60), tree, y);
    const forest = woods * edge;
    if (forest > 0.5) return { color: env.forestFloor, flat: 1, forest, kind: "forest" };
    if (up > 0.985) {
      const u = (x * fc + z * fs) / m(34),
        v = (-x * fs + z * fc) / m(22);
      const cu = Math.floor(u),
        cv = Math.floor(v);
      const pick = hash(cu, cv);
      if (patch < 0.52 && pick < 0.8) return { color: env.fields[Math.floor(hash(cv, cu) * env.fields.length)], flat: 1, forest: 0, kind: "field" };
    }
    const lush = smoothstep(0.35, 0.65, fbm(noise, x / m(90) - 4, z / m(90), 2));
    return { color: mixColor(env.grass, env.meadow, lush), flat: 1, forest: forest * 0.4, kind: "meadow" };
  }
  return sample;
}
