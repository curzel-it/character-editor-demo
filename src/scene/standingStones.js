import { standingStonePalette as colors } from "../palette.js";
import { makeRng } from "../rng.js";

const SIDES = 8;

const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/** Orthonormal frame with `w` along the stone, `u` across its width and `v` through its depth. */
function axes(w, towardU) {
  const along = unit(w);
  const u = unit(add(towardU, along, -dot(towardU, along)));
  return { w: along, u, v: cross(along, u) };
}

/**
 * How a stone's faces are coloured: its own sarsen tone darkening towards damp ground, moss creeping
 * up from the grass and over upward faces, and lichen blotches seeded over its surface.
 */
function painter(random, ground, spots) {
  const base = mix(colors.sarsen, colors.sarsenWarm, random() * 0.7);
  const damp = 0.6 + random() * 0.8;
  const mossLine = 0.15 + random() * 0.55;
  const mossy = 0.2 + random() * 0.5;
  return (centroid, normal) => {
    const h = centroid[1] - ground;
    let color = mix(base, colors.sarsenDark, random() * 0.3 + Math.max(0, 1 - h / damp) * 0.35);
    for (const spot of spots) {
      const d = Math.hypot(centroid[0] - spot.at[0], centroid[1] - spot.at[1], centroid[2] - spot.at[2]);
      if (d < spot.radius) color = mix(color, spot.color, spot.strength * (1 - (d / spot.radius) ** 2));
    }
    const creep = mossLine + (random() - 0.3) * 0.9 - h;
    const moss = Math.max(creep > 0 ? Math.min(0.85, 0.35 + creep) : 0, normal[1] > 0.5 && random() < mossy ? 0.6 * normal[1] : 0);
    if (moss > 0) color = mix(color, random() < 0.5 ? colors.moss : colors.mossDark, moss);
    return { color, shade: 0.9 + random() * 0.16 };
  };
}

/** Lichen blotches at random points on a stone running from `start` along `w` for `length`. */
function lichen(random, start, frame, length, halfU, halfV, count) {
  return Array.from({ length: count }, () => {
    const side = random() < 0.5 ? -1 : 1;
    const onU = random() < 0.5;
    const at = add(add(add(start, frame.w, length * (0.15 + random() * 0.85)), frame.u, onU ? side * halfU : (random() * 2 - 1) * halfU), frame.v, onU ? (random() * 2 - 1) * halfV : side * halfV);
    return { at, radius: 0.4 + random() * 0.6, color: random() < 0.45 ? colors.lichenGold : colors.lichen, strength: 0.6 + random() * 0.3 };
  });
}

/**
 * A weathered block from `start` along `frame.w`: chamfered rings that taper, jitter and chip, closed
 * by bevelled caps. `profile` lists [t along the length, scale] rings; `broken` leaves a jagged top.
 */
function block(builder, start, frame, length, halfU, halfV, profile, random, paint, { startCap = false, broken = false } = {}) {
  const chips = Array.from({ length: 2 + Math.floor(random() * 3) }, () => ({ level: 1 + Math.floor(random() * (profile.length - 1)), corner: Math.floor(random() * 4) }));
  const rings = profile.map(([t, scale], level) => {
    const top = level === profile.length - 1;
    const swell = scale * (0.93 + random() * 0.12);
    const drift = [(random() - 0.5) * 0.12 * halfU, (random() - 0.5) * 0.12 * halfV];
    return corners(halfU * swell, halfV * swell, 0.3 + random() * 0.25).map(([x, y], k) => {
      let jitter = 0.88 + random() * 0.18;
      if (chips.some((c) => c.level === level && ((k + 1) % SIDES) >> 1 === c.corner)) jitter *= 0.68;
      const rise = broken && top ? -random() * 0.5 : (random() - 0.5) * 0.1;
      return add(add(add(start, frame.w, t * length + rise), frame.u, x * jitter + drift[0]), frame.v, y * jitter + drift[1]);
    });
  });
  const face = (a, b, c) => {
    const centroid = [0, 1, 2].map((i) => (a[i] + b[i] + c[i]) / 3);
    const normal = unit(cross(add(b, a, -1), add(c, a, -1)));
    const { color, shade } = paint(centroid, normal);
    builder.tri(a, b, c, color, 0, shade);
  };
  for (let r = 0; r < rings.length - 1; r++)
    for (let k = 0; k < SIDES; k++) {
      const a = rings[r][k],
        b = rings[r][(k + 1) % SIDES],
        c = rings[r + 1][(k + 1) % SIDES],
        d = rings[r + 1][k];
      face(a, b, c);
      face(a, c, d);
    }
  const cap = (ring, t, flip) => {
    const bulge = broken && !flip ? -0.15 - random() * 0.2 : 0.08 + random() * 0.14;
    const centre = add(start, frame.w, t * length + (flip ? -bulge : bulge));
    for (let k = 0; k < SIDES; k++) {
      const a = ring[k],
        b = ring[(k + 1) % SIDES];
      if (flip) face(b, a, centre);
      else face(a, b, centre);
    }
  };
  cap(rings.at(-1), profile.at(-1)[0], false);
  if (startCap) cap(rings[0], profile[0][0], true);
}

/** The eight corners of a chamfered rectangle, counter-clockwise, in pairs per corner. */
function corners(hu, hv, chamfer) {
  const c = Math.min(hu, hv) * chamfer;
  return [
    [hu, -hv + c],
    [hu, hv - c],
    [hu - c, hv],
    [-hu + c, hv],
    [-hu, hv - c],
    [-hu, -hv + c],
    [-hu + c, -hv],
    [hu - c, -hv],
  ];
}

const UPRIGHT = [
  [-0.08, 1.04],
  [0.05, 1.02],
  [0.2, 1],
  [0.42, 0.97],
  [0.66, 0.93],
  [0.86, 0.9],
  [0.96, 0.78],
];
const STUMP = [
  [-0.2, 1.04],
  [0.12, 1.02],
  [0.4, 0.98],
  [0.7, 0.95],
  [1, 0.93],
];
const LYING = [
  [0, 0.78],
  [0.05, 1],
  [0.35, 1.02],
  [0.65, 0.98],
  [0.95, 1],
  [1, 0.8],
];

/** Carved runes up an upright's inner face, the side that faces the altar; `glow` above 0 lights them. */
function runes(builder, top, frame, halfV, height, random, glow) {
  const color = glow > 0 ? colors.rune : colors.sarsenDark.map((v) => v * 0.55);
  const inner = add(top, frame.v, -(halfV * 1.1 + 0.02));
  const size = 0.24;
  const stroke = (a, b) => {
    const along = unit(add(b, a, -1));
    const side = unit(cross(frame.v, along));
    const half = 0.045;
    builder.quad(add(a, side, -half), add(a, side, half), add(b, side, half), add(b, side, -half), color, glow);
  };
  const glyphs = 2 + Math.floor(random() * 3);
  for (let g = 0; g < glyphs; g++) {
    const y = height * (0.66 - g * 0.14);
    const at = (du, dy) => add(add(inner, frame.w, y + dy * size - height), frame.u, du * size);
    stroke(at(0, -1), at(0, 1));
    const shape = Math.floor(random() * 4);
    if (shape === 0) (stroke(at(0, 0.5), at(0.7, 1)), stroke(at(0, 0), at(0.7, 0.5)));
    else if (shape === 1) (stroke(at(0, 0.1), at(-0.7, 0.9)), stroke(at(0, 0.1), at(0.7, 0.9)));
    else if (shape === 2) (stroke(at(0, 1), at(0.7, 0.35)), stroke(at(0.7, 0.35), at(0, -0.2)));
    else stroke(at(-0.7, -0.4), at(0.7, 0.4));
  }
}

function upright(builder, base, yaw, stone, random, ground, { glow = 0, carve = false } = {}) {
  const tangent = [Math.cos(yaw), 0, Math.sin(yaw)],
    outward = [Math.sin(yaw), 0, -Math.cos(yaw)];
  const lean = add(add([0, 1, 0], tangent, Math.tan(stone.lean[0])), outward, Math.tan(stone.lean[1]));
  const frame = axes(lean, tangent);
  const halfU = stone.width / 2,
    halfV = stone.depth / 2;
  const start = add(base, frame.w, 0);
  const spots = lichen(random, start, frame, stone.height, halfU, halfV, 2 + Math.floor(random() * 4));
  block(builder, start, frame, stone.height, halfU, halfV, stone.broken ? STUMP : UPRIGHT, random, painter(random, ground, spots), { broken: stone.broken });
  const top = add(start, frame.w, stone.height);
  if (carve && !stone.broken) runes(builder, top, frame, halfV, stone.height, random, glow);
  return top;
}

function trilithon(builder, stone, options) {
  const random = makeRng(stone.seed);
  const [x, y, z] = stone.position;
  const tangent = [Math.cos(stone.yaw), 0, Math.sin(stone.yaw)];
  const tops = stone.uprights.map((u) =>
    upright(builder, add([x, y, z], tangent, u.offset), stone.yaw, u, random, y, { ...options, carve: !stone.ruined }),
  );
  if (!stone.lintel) return;
  const { width, depth, length, sag } = stone.lintel;
  const along = unit([tops[1][0] - tops[0][0], 0, tops[1][2] - tops[0][2]]);
  const seat = Math.max(tops[0][1], tops[1][1]) - 0.1;
  const mid = [(tops[0][0] + tops[1][0]) / 2, seat + width / 2, (tops[0][2] + tops[1][2]) / 2];
  const frame = axes(add(along, [0, 1, 0], sag), [0, 1, 0]);
  const start = add(mid, frame.w, -length / 2);
  const spots = lichen(random, start, frame, length, width / 2, depth / 2, 2 + Math.floor(random() * 3));
  block(builder, start, frame, length, width / 2, depth / 2, LYING, random, painter(random, y, spots), { startCap: true });
}

function standing(builder, stone, options) {
  const random = makeRng(stone.seed);
  upright(builder, stone.position, stone.yaw, stone, random, stone.position[1], { ...options, carve: !!stone.heel });
}

function fallen(builder, stone) {
  const random = makeRng(stone.seed);
  const along = [Math.cos(stone.yaw), (random() - 0.5) * 0.12, Math.sin(stone.yaw)];
  const flat = [-Math.sin(stone.yaw), Math.sin(stone.tilt), Math.cos(stone.yaw)];
  const frame = axes(along, flat);
  const [x, y, z] = stone.position;
  const mid = [x, y + stone.depth / 2 - stone.sink, z];
  const start = add(mid, frame.w, -stone.length / 2);
  const spots = lichen(random, start, frame, stone.length, stone.width / 2, stone.depth / 2, 1 + Math.floor(random() * 3));
  block(builder, start, frame, stone.length, stone.width / 2, stone.depth / 2, LYING, random, painter(random, y, spots), { startCap: true });
}

/** A few chips and pebbles of broken stone in the grass around a stone's foot. */
function rubble(builder, stone) {
  const random = makeRng(`${stone.seed}:rubble`);
  const count = Math.floor(random() * 4);
  for (let i = 0; i < count; i++) {
    const a = random() * Math.PI * 2,
      r = 0.9 + random() * 1.4,
      s = 0.12 + random() * 0.2;
    const c = [stone.position[0] + Math.cos(a) * r, stone.position[1] - s * 0.3, stone.position[2] + Math.sin(a) * r];
    const top = [c[0], c[1] + s * 1.1, c[2]];
    const ring = [0, 1, 2, 3, 4].map((k) => {
      const b = a + (k / 5) * Math.PI * 2;
      const q = s * (0.8 + random() * 0.5);
      return [c[0] + Math.cos(b) * q, c[1], c[2] + Math.sin(b) * q];
    });
    const color = mix(colors.sarsen, colors.sarsenDark, random());
    for (let k = 0; k < 5; k++) builder.tri(ring[(k + 1) % 5], ring[k], top, color, 0, 0.9 + random() * 0.15);
  }
}

/**
 * One trilithon, lone standing stone or fallen stone of a `stoneRingLayout` into `builder`.
 * `runes` (0..1) lights the runes carved on some uprights; 0 leaves them dark grooves.
 * @param {ReturnType<typeof import("./meshBuilder.js").createBuilder>} builder
 * @param {import("./stoneRing.js").RingStone} stone
 * @param {{ runes?: number }} [options]
 */
export function addStone(builder, stone, { runes: glow = 0 } = {}) {
  if (stone.kind === "trilithon") trilithon(builder, stone, { glow });
  else if (stone.kind === "standing") standing(builder, stone, { glow });
  else fallen(builder, stone);
  rubble(builder, stone);
}

/**
 * Every stone of a `stoneRingLayout` into `builder`, on flat ground at the ring's centre height.
 * @param {ReturnType<typeof import("./meshBuilder.js").createBuilder>} builder
 * @param {import("./stoneRing.js").StoneRing} ring
 * @param {{ runes?: number }} [options]
 */
export function addStoneRing(builder, ring, options = {}) {
  for (const stone of ring.stones) addStone(builder, stone, options);
}
