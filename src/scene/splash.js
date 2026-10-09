import { makeRng } from "../rng.js";
import { creatureScale as C } from "../worldScale.js";
import { createBuilder } from "./meshBuilder.js";

const GRAVITY = 9.81;
/** Seconds a touchdown's debris stays in the scene, including splats settling on the ground. */
export const splashLife = 9;
// Wing downwash kicks up dust and spray this long before the feet touch, and for a while after a launch.
const DOWNWASH = 1.1,
  LIFTOFF = 0.4;

const kinds = {
  water: { chunks: 110, spray: 13, reach: 5, size: [0.12, 0.34], drag: 0.6, stick: false, puffs: 4, rings: 3 },
  mud: { chunks: 70, spray: 7, reach: 5, size: [0.22, 0.6], drag: 0.2, stick: true, puffs: 2, rings: 0 },
  sand: { chunks: 90, spray: 8, reach: 6, size: [0.1, 0.28], drag: 1.2, stick: false, puffs: 9, rings: 0 },
  dirt: { chunks: 60, spray: 8, reach: 5, size: [0.16, 0.45], drag: 0.4, stick: true, puffs: 6, rings: 0 },
};

const OCTA = [
  [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const FACES = [
  [0, 2, 4], [2, 1, 4], [1, 3, 4], [3, 0, 4], [2, 0, 5], [1, 2, 5], [3, 1, 5], [0, 3, 5],
];

// Icosahedron for rounder dust and spray clumps.
const PHI = (1 + Math.sqrt(5)) / 2;
const ICOSA = [
  [-1, PHI, 0], [1, PHI, 0], [-1, -PHI, 0], [1, -PHI, 0], [0, -1, PHI], [0, 1, PHI],
  [0, -1, -PHI], [0, 1, -PHI], [PHI, 0, -1], [PHI, 0, 1], [-PHI, 0, -1], [-PHI, 0, 1],
].map((v) => v.map((x) => x / Math.hypot(1, PHI)));
const ICOSA_FACES = [
  [0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8],
  [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1],
];

function blob(builder, centre, size, spin, color, emissive = 0, round = false) {
  const c = Math.cos(spin),
    s = Math.sin(spin);
  const shape = round ? ICOSA : OCTA;
  const v = shape.map(([x, y, z]) => [
    centre[0] + (x * c - z * s) * size[0],
    centre[1] + y * size[1],
    centre[2] + (x * s + z * c) * size[2],
  ]);
  for (const [a, b, d] of round ? ICOSA_FACES : FACES) builder.tri(v[a], v[b], v[d], color, emissive);
}

function ring(builder, centre, radius, width, color) {
  const n = 28;
  const at = (k, r) => {
    const a = (k / n) * Math.PI * 2;
    return [centre[0] + Math.cos(a) * r, centre[1], centre[2] + Math.sin(a) * r];
  };
  for (let k = 0; k < n; k++)
    builder.quad(at(k, radius - width), at(k + 1, radius - width), at(k + 1, radius), at(k, radius), color, 0.35);
}

/**
 * Debris thrown up by touchdowns, as world-shader geometry at race time `t`: droplets or clods on
 * ballistic arcs (mud and dirt stay where they land as splats), dust or spray puffs from the wing
 * downwash, and ripples on water. `landings` are recording `land` and `launch` events (a launch kicks its
 * debris back, a lighter `heft` throws up less of it); pure and seeded per racer.
 * @returns {ReturnType<ReturnType<typeof createBuilder>["result"]> | null}
 */
export function buildSplash(landings, t, env) {
  const builder = createBuilder();
  for (const land of landings) {
    const age = t - land.t;
    if (age < -DOWNWASH || age > splashLife) continue;
    const kind = kinds[land.surface] ?? kinds.dirt;
    const [light, dark] = env.splash[land.surface] ?? env.splash.dirt;
    const random = makeRng(`splash:${land.racer}:${land.t}`);
    const [ox, oy, oz] = land.position;
    const f = land.forward ?? [1, 0, 0];
    const fl = Math.hypot(f[0], f[2]) || 1;
    const launch = land.type === "launch";
    const fx = ((launch ? -1 : 1) * f[0]) / fl,
      fz = ((launch ? -1 : 1) * f[2]) / fl;
    const surge = Math.min(1.5, (land.speed ?? 8) / 8);
    const heft = land.heft ?? 1;

    for (let i = 0; i < Math.round(kind.chunks * heft); i++) {
      const skid = random() < 0.35;
      const delay = skid ? random() * 0.9 : random() * 0.08;
      const along = skid ? (random() * 6 + 1) * C : (random() - 0.3) * 2 * C;
      const side = (random() - 0.5) * 3 * C;
      const angle = random() * Math.PI * 2;
      const out = (1 + random() * kind.reach) * (skid ? 0.6 : 1);
      const vx = Math.cos(angle) * out + fx * surge * (2 + random() * 5),
        vz = Math.sin(angle) * out + fz * surge * (2 + random() * 5),
        vy = (0.4 + random()) * kind.spray * (skid ? 0.6 : 1) * (0.7 + 0.3 * surge);
      const size = (kind.size[0] + random() * (kind.size[1] - kind.size[0])) * C;
      const spin = random() * 6.3,
        tone = random() < 0.55 ? light : dark,
        stickLife = 5 + random() * 3;
      const local = age - delay;
      if (local < 0) continue;
      const k = kind.drag,
        reach = k > 0 ? (1 - Math.exp(-k * local)) / k : local;
      const flight = (2 * vy) / GRAVITY;
      const x0 = ox + fx * along - fz * side,
        z0 = oz + fz * along + fx * side;
      if (local < flight) {
        const y = oy + vy * local - 0.5 * GRAVITY * local * local;
        const shrink = kind.stick ? 1 : 1 - 0.6 * (local / flight);
        blob(builder, [x0 + vx * reach, Math.max(oy, y) + size * 0.5, z0 + vz * reach], [size * shrink, size * shrink, size * shrink * 0.8], spin + local * 5, tone, land.surface === "water" ? 0.4 : 0);
      } else if (kind.stick && local < flight + stickLife) {
        const fade = 1 - Math.max(0, (local - flight - stickLife + 1.5) / 1.5);
        const landed = k > 0 ? (1 - Math.exp(-k * flight)) / k : flight;
        blob(builder, [x0 + vx * landed, oy + 0.04 * C, z0 + vz * landed], [size * 1.6 * fade, size * 0.18, size * 1.3 * fade], spin, dark);
      }
    }

    const dust = land.surface === "water" ? light : env.splash.dust;
    for (let i = 0; i < Math.round(kind.puffs * 5 * heft); i++) {
      const start = (launch ? LIFTOFF : -DOWNWASH) * random() * 0.9 + (i % 2 ? 0.05 : 0);
      const local = age - start;
      const life = 2.5 + random() * 3;
      const angle = random() * Math.PI * 2,
        speed = (2 + random() * 6) * C,
        size = (0.35 + random() * 0.8) * C;
      if (local < 0 || local > life) continue;
      const k = 1 - Math.exp(-1.4 * local);
      const grow = Math.sin(Math.PI * Math.min(1, local / life) ** 0.7) ** 0.8;
      const r = size * (0.4 + 0.8 * k) * grow;
      blob(
        builder,
        [ox + Math.cos(angle) * speed * k, oy + r * 0.5 + local * 0.35 * C, oz + Math.sin(angle) * speed * k],
        [r, r * 0.75, r],
        angle,
        dust,
        land.surface === "water" ? 0.55 : 0.45,
        true,
      );
    }

    for (let i = 0; i < Math.round(kind.rings * heft); i++) {
      const local = age - i * 0.35;
      if (local < 0 || local > 4) continue;
      const radius = (1 + local * 3.2) * C;
      ring(builder, [ox, oy + 0.06, oz], radius, 0.35 * C * (1 - local / 4), light);
    }
  }
  return builder.triangles ? builder.result() : null;
}
