import { environments, palette, tint } from "../palette.js";
import { makeRng } from "../rng.js";
import { box, createBuilder, frame } from "./meshBuilder.js";

const TAU = Math.PI * 2;
const SINK = 0.35,
  STEPS = [
    { half: [2.35, 1.95], top: 0.26, cells: [4, 3] },
    { half: [1.8, 1.4], top: 0.5, cells: [3, 2] },
  ],
  PLINTH = { half: [1.05, 0.66], bottom: 0.45, top: 0.8 },
  SLAB = { half: [1.42, 0.98], bottom: 0.78, top: 1.2, chamfer: 0.08, inset: 0.07 },
  RING = { radius: 0.64, sides: 12 },
  GROOVE = { width: 0.055, rune: 0.034, height: 0.24, spread: 0.13 },
  CARVED = 0.008,
  LIT = 0.016,
  HALO = 0.012;

// Runic glyphs on a [-1, 1] box: each is a list of strokes [[u, v], [u, v]].
const GLYPHS = [
  [[[0, -1], [0, 1]], [[0, 0.25], [0.7, 0.8]], [[0, -0.3], [0.7, 0.25]]],
  [[[0, -1], [0, 1]], [[0, 0.2], [-0.7, 0.9]], [[0, 0.2], [0.7, 0.9]]],
  [[[0, -1], [0, 1]], [[0, 1], [-0.7, 0.35]], [[0, 1], [0.7, 0.35]]],
  [[[0, 1], [0.7, 0.2]], [[0.7, 0.2], [0, -0.55]], [[0, -0.55], [-0.7, 0.2]], [[-0.7, 0.2], [0, 1]], [[0, -0.55], [-0.6, -1]], [[0, -0.55], [0.6, -1]]],
  [[[-0.6, -1], [-0.6, 1]], [[0.6, -1], [0.6, 1]], [[-0.6, 1], [0.6, 0.15]], [[0.6, 1], [-0.6, 0.15]]],
  [[[-0.7, -1], [0.7, 1]], [[0.7, -1], [-0.7, 1]]],
  [[[-0.5, 1], [0.5, 0.35]], [[0.5, 0.35], [-0.5, -0.35]], [[-0.5, -0.35], [0.5, -1]]],
  [[[0, -1], [0, 1]], [[0, 1], [0.7, 0.55]], [[0.7, 0.55], [0, 0.1]], [[0, 0.1], [0.7, -1]]],
];

/** A rectangle with its four corners cut by `bevels` (a, b order around from +a +b), counter-clockwise. */
function bevelRect([ha, hb], bevels) {
  const [k0, k1, k2, k3] = bevels;
  return [
    [ha, hb - k0], [ha - k0, hb],
    [-ha + k1, hb], [-ha, hb - k1],
    [-ha, -hb + k2], [-ha + k2, -hb],
    [ha - k3, -hb], [ha, -hb + k3],
  ];
}

/**
 * A block standing on `footprint` from `bottom` to `top`: sides straight up to `top - chamfer`, then
 * sloping in to the top face drawn from `crown` (the footprint shrunk by the chamfer).
 */
function block(builder, to, footprint, crown, bottom, top, chamfer, color, shade) {
  const n = footprint.length,
    shoulder = top - chamfer;
  for (let i = 0; i < n; i++) {
    const [a0, b0] = footprint[i],
      [a1, b1] = footprint[(i + 1) % n];
    const face = shade * (0.93 + 0.05 * ((i * 5) % 3));
    builder.quad(to(a0, b0, bottom), to(a1, b1, bottom), to(a1, b1, shoulder), to(a0, b0, shoulder), color, 0, face);
    if (chamfer > 0) {
      const [c0, d0] = crown[i],
        [c1, d1] = crown[(i + 1) % n];
      builder.quad(to(a0, b0, shoulder), to(a1, b1, shoulder), to(c1, d1, top), to(c0, d0, top), color, 0, face * 1.03);
    }
  }
  const centre = to(0, 0, top);
  const ring = chamfer > 0 ? crown : footprint;
  for (let i = 0; i < n; i++) {
    const [a0, b0] = ring[i],
      [a1, b1] = ring[(i + 1) % n];
    builder.tri(to(a0, b0, top), to(a1, b1, top), centre, color, 0, shade * 1.02);
  }
}

const offsetFrame = (to, [ca, cb]) => (a, b, y) => to(ca + a, cb + b, y);

/** The laid stones of one step: a grid of weathered blocks over a darker core that fills the seams. */
function stepCourse(step, index, random) {
  const [ha, hb] = step.half;
  const [na, nb] = step.cells;
  const bottom = index === 0 ? -SINK : STEPS[index - 1].top - 0.08;
  const blocks = [];
  for (let i = 0; i < na; i++)
    for (let j = 0; j < nb; j++) {
      const cellA = (2 * ha) / na,
        cellB = (2 * hb) / nb;
      const centre = [-ha + cellA * (i + 0.5), -hb + cellB * (j + 0.5)];
      const half = [cellA / 2 - 0.02, cellB / 2 - 0.02];
      const bevels = Array.from({ length: 4 }, () => random() * 0.09);
      const edge = i === 0 || j === 0 || i === na - 1 || j === nb - 1;
      blocks.push({
        centre,
        half,
        bevels,
        bottom,
        top: step.top - random() * 0.025,
        chamfer: 0.03,
        dark: random() < 0.35,
        shade: 0.93 + random() * 0.11,
        moss: edge && random() < 0.3 ? { at: [(random() - 0.5) * half[0], (random() - 0.5) * half[1]], size: 0.18 + random() * 0.2, spin: random() * TAU } : null,
      });
    }
  return { half: step.half, bottom, top: step.top - 0.04, blocks };
}

/** A carved stroke from `from` to `to` (local [a, y, b]) on a face with outward `normal`. */
const stroke = (from, to, normal, width, centre) => ({ from, to, normal, width, centre });

function carvings(random) {
  const top = SLAB.top,
    [ha, hb] = SLAB.half,
    face = SLAB.top - SLAB.chamfer,
    edge = [ha - SLAB.inset, hb - SLAB.inset],
    slope = Math.hypot(SLAB.chamfer, SLAB.inset);
  const up = [0, 1, 0],
    w = GROOVE.width;
  const strokes = [];
  for (let k = 0; k < RING.sides; k++) {
    const a0 = (k / RING.sides) * TAU,
      a1 = ((k + 1) / RING.sides) * TAU;
    const p = (a) => [Math.cos(a) * RING.radius, top, Math.sin(a) * RING.radius];
    strokes.push(stroke(p(a0), p(a1), up, w));
  }
  const reach = RING.radius + w / 2;
  for (const sign of [1, -1]) {
    const endSlope = [(sign * SLAB.chamfer) / slope, SLAB.inset / slope, 0];
    const out = [sign, 0, 0];
    strokes.push(stroke([sign * reach, top, 0], [sign * edge[0], top, 0], up, w));
    strokes.push(stroke([sign * edge[0], top, 0], [sign * ha, face, 0], endSlope, w));
    strokes.push(stroke([sign * ha, face, 0], [sign * ha, SLAB.bottom + 0.02, 0], out, w));
    strokes.push(stroke([sign * PLINTH.half[0], PLINTH.top - 0.04, 0], [sign * PLINTH.half[0], PLINTH.bottom + 0.05, 0], out, w));
    let from = PLINTH.half[0];
    for (const step of [...STEPS].reverse()) {
      strokes.push(stroke([sign * from, step.top, 0], [sign * step.half[0], step.top, 0], up, w));
      const below = STEPS.indexOf(step) === 0 ? 0 : STEPS[STEPS.indexOf(step) - 1].top;
      strokes.push(stroke([sign * (step.half[0] - 0.02), step.top, 0], [sign * (step.half[0] - 0.02), below, 0], out, w));
      from = step.half[0];
    }
    const sideSlope = [0, SLAB.inset / slope, (sign * SLAB.chamfer) / slope];
    const side = [0, 0, sign];
    strokes.push(stroke([0, top, sign * reach], [0, top, sign * edge[1]], up, w));
    strokes.push(stroke([0, top, sign * edge[1]], [0, face, sign * hb], sideSlope, w));
    strokes.push(stroke([0, face, sign * hb], [0, SLAB.bottom + 0.14, sign * hb], side, w));
    const middle = (SLAB.bottom + face) / 2;
    const glyph = (centre, across, normal) => {
      for (const [[u0, v0], [u1, v1]] of GLYPHS[Math.floor(random() * GLYPHS.length)]) {
        const at = (u, v) => [centre[0] + across[0] * u * GROOVE.spread, middle + (v * GROOVE.height) / 2, centre[2] + across[2] * u * GROOVE.spread];
        strokes.push(stroke(at(u0, v0), at(u1, v1), normal, GROOVE.rune, centre));
      }
    };
    for (const a of [-0.95, -0.45, 0.45, 0.95]) glyph([a, 0, sign * hb], [1, 0, 0], side);
    for (const b of [-0.5, 0.5]) glyph([sign * ha, 0, b], [0, 0, 1], out);
  }
  return strokes;
}

/**
 * The altar stone at the heart of the Soul Altar, as plain seeded data: a heavy chamfered slab on a
 * plinth over two courses of laid stones, with channels carved in its top, faces and steps that can
 * glow. Metres, y up, standing on flat ground at `position`, its long side along `yaw`.
 * `eggPoint` is where an egg's lowest point rests, on the middle of the top inside the carved ring;
 * `top` the height of that surface above the ground, `radius` the reach of its lowest step.
 * @param {{ position?: number[], yaw?: number, seed?: string }} [options]
 */
export function createAltarStone({ position = [0, 0, 0], yaw = 0, seed = "altar" } = {}) {
  const random = makeRng(`altar:${seed}`);
  const to = frame([position[0], position[2]], yaw);
  const local = (a, b, y) => to(a, b, position[1] + y);
  const courses = STEPS.map((step, i) => stepCourse(step, i, random));
  const slabBevels = Array.from({ length: 4 }, () => 0.08 + random() * 0.18);
  const lichen = [0, 1, 2, 3]
    .filter(() => random() < 0.6)
    .map((k) => ({
      at: [(k % 2 ? -1 : 1) * (0.88 + random() * 0.1), (k < 2 ? 1 : -1) * (0.48 + random() * 0.1)],
      size: 0.08 + random() * 0.07,
      spin: random() * TAU,
    }));
  const c = Math.cos(yaw),
    s = Math.sin(yaw);
  const strokes = carvings(random).map((k) => {
    const mid = k.centre ? [k.centre[0], k.centre[2]] : [(k.from[0] + k.to[0]) / 2, (k.from[2] + k.to[2]) / 2];
    return {
      from: local(k.from[0], k.from[2], k.from[1]),
      to: local(k.to[0], k.to[2], k.to[1]),
      normal: [c * k.normal[0] - s * k.normal[2], k.normal[1], s * k.normal[0] + c * k.normal[2]],
      width: k.width,
      lane: (Math.atan2(mid[1], mid[0]) / TAU + 1.125) % 1,
    };
  });
  return {
    position: [...position],
    yaw,
    seed,
    top: SLAB.top,
    radius: Math.hypot(...STEPS[0].half),
    eggPoint: local(0, 0, SLAB.top),
    courses,
    slabBevels,
    lichen,
    strokes,
  };
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const lookOf = (env) => ({ ...environments.valley, ...env });

/** The flat quad of a carved stroke, lifted `lift` off its face and `grow` times as wide. */
function strokeQuad(builder, k, lift, grow, color, emissive) {
  const d = k.to.map((v, i) => v - k.from[i]);
  const length = Math.hypot(...d) || 1;
  const dir = d.map((v) => v / length);
  const n = k.normal;
  const side = [dir[1] * n[2] - dir[2] * n[1], dir[2] * n[0] - dir[0] * n[2], dir[0] * n[1] - dir[1] * n[0]];
  const half = (k.width * grow) / 2 / (Math.hypot(...side) || 1);
  const at = (p, along, across) => p.map((v, i) => v + dir[i] * along + side[i] * across * half + n[i] * lift);
  const ext = (k.width * grow) / 2;
  builder.quad(at(k.from, -ext, -1), at(k.to, ext, -1), at(k.to, ext, 1), at(k.from, -ext, 1), color, emissive);
}

/** A patch of moss or lichen lying on a flat top at height `y`. */
function moss(builder, at, patch, y, look) {
  const points = Array.from({ length: 5 }, (_, i) => {
    const a = patch.spin + (i / 5) * TAU,
      r = patch.size * (0.6 + 0.4 * ((i * 3) % 2));
    return at(patch.at[0] + Math.cos(a) * r, patch.at[1] + Math.sin(a) * r, y + 0.005);
  });
  const centre = at(patch.at[0], patch.at[1], y + 0.005);
  for (let i = 0; i < 5; i++) builder.tri(points[i], points[(i + 1) % 5], centre, i % 2 ? look.broadleafLight : look.meadow, 0, 0.85);
}

/** Draws the altar's stone and its carved (unlit) channels into a `createBuilder` builder. */
export function addAltarStone(builder, altar, env) {
  const look = lookOf(env);
  const weathered = mix(look.stone, look.rock, 0.3),
    slab = mix(look.stone, look.rock, 0.45);
  const to = frame([altar.position[0], altar.position[2]], altar.yaw);
  const local = (a, b, y) => to(a, b, altar.position[1] + y);
  for (const course of altar.courses) {
    box(builder, [altar.position[0], altar.position[2]], altar.yaw, course.half[0] - 0.05, course.half[1] - 0.05, altar.position[1] + course.bottom, altar.position[1] + course.top, look.stoneDark, { shade: 0.8 });
    for (const b of course.blocks) {
      const at = offsetFrame(local, b.centre);
      const foot = bevelRect(b.half, b.bevels);
      const crown = bevelRect([b.half[0] - b.chamfer, b.half[1] - b.chamfer], b.bevels);
      block(builder, at, foot, crown, b.bottom, b.top, b.chamfer, b.dark ? look.stoneDark : weathered, b.shade * 0.94);
      if (b.moss) moss(builder, at, b.moss, b.top, look);
    }
  }
  const plinth = bevelRect(PLINTH.half, [0.12, 0.12, 0.12, 0.12]);
  block(builder, local, plinth, plinth, PLINTH.bottom, PLINTH.top, 0, look.stoneDark, 0.9);
  const foot = bevelRect(SLAB.half, altar.slabBevels);
  const crown = bevelRect([SLAB.half[0] - SLAB.inset, SLAB.half[1] - SLAB.inset], altar.slabBevels.map((k) => Math.max(0.02, k - SLAB.inset * 0.4)));
  block(builder, local, foot, crown, SLAB.bottom, SLAB.top, SLAB.chamfer, slab, 1);
  for (const patch of altar.lichen) moss(builder, local, patch, SLAB.top, look);
  const groove = tint(look.stoneDark, 0.42);
  for (const k of altar.strokes) strokeQuad(builder, k, CARVED, 1, groove, 0);
}

/**
 * The altar's channels lit to `glow` (0..1) in `color`, an RGB or a list of them spread round the
 * altar, as a mesh for the scene frame's `props`; empty at no glow. `env` is the scene's colour set.
 * @param {ReturnType<typeof createAltarStone>} altar
 * @param {number} glow
 * @param {number[] | number[][]} [color]
 */
export function altarGlowMesh(altar, glow, color = palette.hatchGlow, env) {
  const builder = createBuilder();
  const amount = Math.max(0, Math.min(1, glow));
  if (amount <= 0) return builder.result();
  const look = lookOf(env);
  const colors = Array.isArray(color[0]) ? color : [color];
  const groove = tint(look.stoneDark, 0.42);
  for (const k of altar.strokes) {
    const hue = colors[Math.floor(k.lane * colors.length) % colors.length];
    strokeQuad(builder, k, HALO, 2, mix(look.stone, hue, 0.55), amount * 0.25);
    strokeQuad(builder, k, LIT, 1, mix(groove, hue, Math.min(1, amount * 1.6)), amount);
  }
  return builder.result();
}
