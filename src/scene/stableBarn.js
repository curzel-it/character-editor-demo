import { column, frame, softBox } from "./meshBuilder.js";

const EAVES = 7.2,
  RIDGE = 11.6,
  FOOTING = 1.2,
  PLANK = 0.62,
  POST_GAP = 5.5,
  TILE = 0.95,
  TILE_ROW = 0.8,
  DOOR = { width: 6.4, height: 5.6, arch: 0.9 },
  WINDOW = [3, 5.2];

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * A timber barn on a stone footing: vertical planks between posts, a tiled gable roof, a big
 * braced double door with a hanging banner and a lantern beside it, a window with a flower box,
 * a canvas awning over the front and a loft door in each gable. The front faces the local +b side.
 * The roof and what stands out from the front (door, window, banner, lantern, awning) go to `overhang`, which
 * casts no baked shadow: the bake is a height field, which would fill the space under it to the ground. Returns the footprint `{ centre, yaw, halfA, halfB, top }`
 * for whatever must stay outside it, with the walls' own half sizes as `wall`.
 * @param {ReturnType<import("./meshBuilder.js").createBuilder>} builder
 * @param {ReturnType<import("./meshBuilder.js").createBuilder>} overhang
 * @param {{ centre: number[], yaw: number, length: number, depth: number, door: number, window: number }} layout
 * @param {Record<string, any>} env
 * @param {() => number} random
 */
export function addStableBarn(builder, overhang, { centre, yaw, length, depth, door, window }, env, random) {
  const to = frame(centre, yaw);
  const halfA = length / 2,
    halfB = depth / 2;

  /** A quad on the plane b = `b`, spanning `a0..a1` along the barn and `y0..y1` up. */
  const face = (b, a0, a1, y0, y1, color, emissive = 0, shade = 1) =>
    builder.quad(to(a0, b, y0), to(a1, b, y0), to(a1, b, y1), to(a0, b, y1), color, emissive, shade);
  /** A quad on the plane a = `a`, spanning `b0..b1` across and `y0..y1` up. */
  const side = (a, b0, b1, y0, y1, color, shade = 1) => builder.quad(to(a, b0, y0), to(a, b1, y0), to(a, b1, y1), to(a, b0, y1), color, 0, shade);
  const plankColor = () => lerp(env.plankDark, env.plankPale, random() ** 1.3);
  const at = (a, b) => {
    const [x, , z] = to(a, b, 0);
    return [x, z];
  };

  /** Planks along a wall from `s0` to `s1`, `wall(s, e, y0, y1, …)` placing them, around the `gaps` [s0, s1, y0, y1]. */
  function planks(s0, s1, top, wall, gaps = []) {
    for (let s = s0; s < s1 - 1e-3; s += PLANK) {
      const e = Math.min(s1, s + PLANK);
      const gap = gaps.find(([g0, g1]) => s < g1 && e > g0);
      const color = plankColor(),
        shade = 0.92 + random() * 0.12,
        out = random() * 0.04;
      const peak = typeof top === "function" ? Math.min(top(s), top(e)) : top;
      if (!gap) wall(s, e, FOOTING, peak, color, shade, out);
      else {
        if (gap[2] > FOOTING) wall(s, e, FOOTING, gap[2], color, shade, out);
        if (gap[3] < peak) wall(s, e, gap[3], peak, color, shade, out);
      }
    }
  }

  /** Irregular dressed stones in courses around the footing. */
  function footing() {
    const rows = 2,
      h = FOOTING / rows;
    const run = (s0, s1, place) => {
      for (let r = 0; r < rows; r++) {
        let s = s0 + (r % 2 ? -0.5 : 0) + random() * 0.4;
        while (s < s1) {
          const w = 0.9 + random() * 1.1,
            a = Math.max(s0, s),
            e = Math.min(s1, s + w);
          if (e - a > 0.15) place(a + 0.04, e - 0.04, r * h + 0.04, (r + 1) * h - 0.03, lerp(env.footingDark, env.footing, random()), 0.18 + random() * 0.08);
          s += w;
        }
      }
    };
    builder.quad(to(-halfA, halfB, 0), to(halfA, halfB, 0), to(halfA, halfB, FOOTING), to(-halfA, halfB, FOOTING), env.footingDark, 0, 0.7);
    run(-halfA, halfA, (a0, a1, y0, y1, color, out) => softBox(builder, at((a0 + a1) / 2, halfB + out / 2), yaw, (a1 - a0) / 2, out / 2 + 0.05, y0, y1, color));
    run(-halfA, halfA, (a0, a1, y0, y1, color, out) => softBox(builder, at((a0 + a1) / 2, -halfB - out / 2), yaw, (a1 - a0) / 2, out / 2 + 0.05, y0, y1, color));
    for (const a of [-halfA, halfA])
      run(-halfB, halfB, (b0, b1, y0, y1, color, out) => softBox(builder, at(a + Math.sign(a) * out / 2, (b0 + b1) / 2), yaw, out / 2 + 0.05, (b1 - b0) / 2, y0, y1, color));
  }

  const gable = (b) => EAVES + (RIDGE - EAVES) * (1 - Math.abs(b) / halfB);
  const doorGap = [door - DOOR.width / 2 - 0.5, door + DOOR.width / 2 + 0.5, FOOTING, DOOR.height + DOOR.arch + 0.4];
  const windowGap = [window - 1.1, window + 1.1, WINDOW[0], WINDOW[1]];

  footing();
  builder.quad(to(-halfA, -halfB, FOOTING), to(halfA, -halfB, FOOTING), to(halfA, halfB, FOOTING), to(-halfA, halfB, FOOTING), env.beam, 0, 0.5);
  planks(-halfA, halfA, EAVES, (s, e, y0, y1, color, shade, out) => face(halfB + out, s, e, y0, y1, color, 0, shade), [doorGap, windowGap]);
  planks(-halfA, halfA, EAVES, (s, e, y0, y1, color, shade, out) => face(-halfB - out, s, e, y0, y1, color, 0, shade));
  for (const a of [-halfA, halfA])
    planks(-halfB, halfB, gable, (s, e, y0, y1, color, shade, out) => {
      side(a + Math.sign(a) * out, s, e, y0, y1, color, shade);
      const ys = gable(s),
        ye = gable(e);
      if (Math.abs(ys - ye) > 1e-3) builder.tri(to(a + Math.sign(a) * out, s, Math.min(ys, ye)), to(a + Math.sign(a) * out, e, Math.min(ys, ye)), to(a + Math.sign(a) * out, ys > ye ? s : e, Math.max(ys, ye)), color, 0, shade);
    });

  for (const a of [-halfA, halfA]) {
    const s = Math.sign(a);
    for (const b of [-halfB, halfB]) softBox(builder, at(a - s * 0.2, b - Math.sign(b) * 0.2), yaw, 0.32, 0.32, 0, EAVES + 0.2, env.beam);
    const loft = 0.8 * (RIDGE - EAVES);
    side(a + s * 0.12, -1.2, 1.2, EAVES - 1.4, EAVES - 1.4 + loft + 1.2, env.plankDark, 0.62);
    softBox(builder, at(a + s * 0.16, 0), yaw, 0.12, 1.45, EAVES - 1.6, EAVES - 1.35, env.beam);
    softBox(builder, at(a + s * 0.16, 0), yaw, 0.12, 1.45, EAVES + loft - 0.15, EAVES + loft + 0.1, env.beam);
    for (const b of [-1.35, 1.35]) softBox(builder, at(a + s * 0.16, b), yaw, 0.12, 0.13, EAVES - 1.6, EAVES + loft + 0.1, env.beam);
  }
  for (const b of [-halfB, halfB]) {
    const s = Math.sign(b);
    for (let a = -halfA + POST_GAP; a < halfA - 1; a += POST_GAP)
      if (Math.abs(a - door) > DOOR.width / 2 + 0.6 && Math.abs(a - window) > 1.6) softBox(builder, at(a, b + s * 0.14), yaw, 0.26, 0.14, FOOTING, EAVES, env.beam);
    softBox(builder, at(0, b + s * 0.16), yaw, halfA + 0.1, 0.16, EAVES - 0.45, EAVES + 0.05, env.beam);
    softBox(builder, at(0, b + s * 0.14), yaw, halfA, 0.12, FOOTING, FOOTING + 0.28, env.beam);
  }

  roof(overhang, to, halfA, halfB, env, random);
  const onFace = (b, a0, a1, y0, y1, color, emissive = 0, shade = 1) =>
    overhang.quad(to(a0, b, y0), to(a1, b, y0), to(a1, b, y1), to(a0, b, y1), color, emissive, shade);
  barnDoor(overhang, to, onFace, at, yaw, door, halfB, env);
  barnWindow(overhang, at, onFace, yaw, window, halfB, env, random);
  banner(overhang, to, at, yaw, door - DOOR.width / 2 - 2.75, halfB, env);
  lantern(overhang, at, yaw, door + DOOR.width / 2 + 1.2, halfB, env);
  awning(overhang, to, at, yaw, door, halfB, env);
  return { centre, yaw, halfA: halfA + 1, halfB: halfB + 3, top: RIDGE + 1, wall: [halfA, halfB] };
}

/** Rows of overlapping tiles down both slopes and a capped ridge. */
function roof(builder, to, halfA, halfB, env, random) {
  const over = 0.9,
    a0 = -halfA - over,
    a1 = halfA + over;
  const b = halfB + over,
    drop = ((RIDGE - EAVES) / halfB) * over;
  const run = Math.hypot(b, RIDGE - EAVES + drop);
  for (const s of [-1, 1]) {
    const rows = Math.ceil(run / TILE_ROW);
    const point = (a, u, lift) => to(a, s * b * (1 - u), EAVES - drop + (RIDGE - EAVES + drop) * u + lift);
    builder.quad(point(a0, 0, -0.06), point(a1, 0, -0.06), point(a1, 1, -0.06), point(a0, 1, -0.06), env.tileDark, 0, 0.7);
    for (let r = 0; r < rows; r++) {
      const u0 = r / rows,
        u1 = Math.min(1, (r + 1.25) / rows);
      let a = a0 - (r % 2 ? TILE / 2 : 0);
      while (a < a1) {
        const e = Math.min(a1, a + TILE),
          s0 = Math.max(a0, a);
        const color = lerp(env.tileDark, env.tile, 0.35 + 0.65 * random());
        builder.quad(point(s0, u0, 0.14), point(e - 0.04, u0, 0.14), point(e - 0.04, u1, 0), point(s0, u1, 0), color, 0, 0.94 + random() * 0.12);
        a += TILE;
      }
    }
  }
  const [x0, , z0] = to(a0, 0, 0),
    [x1, , z1] = to(a1, 0, 0);
  const mid = [(x0 + x1) / 2, (z0 + z1) / 2],
    yaw = Math.atan2(z1 - z0, x1 - x0);
  softBox(builder, mid, yaw, halfA + over + 0.1, 0.32, RIDGE + 0.05, RIDGE + 0.45, env.tileDark);
}

/** A braced double door under a timber arch, its leaves closed on the dark stall behind. */
function barnDoor(builder, to, face, at, yaw, a, halfB, env) {
  const w = DOOR.width / 2,
    h = DOOR.height,
    b = halfB + 0.02;
  face(b - 0.3, a - w, a + w, 0, h + DOOR.arch, env.doorway);
  for (const s of [-1, 1]) {
    const inner = a + s * 0.04,
      outer = a + s * (w - 0.05);
    const [lo, hi] = s < 0 ? [outer, inner] : [inner, outer];
    for (let x = lo; x < hi - 1e-3; x += PLANK * 0.85) face(b + 0.02, x + 0.03, Math.min(hi, x + PLANK * 0.85) - 0.03, 0.15, h, lerp(env.plankDark, env.plank, ((x * 7.3) % 1 + 1) % 1), 0, 0.96);
    for (const y of [0.9, h / 2, h - 0.7]) softBox(builder, at((lo + hi) / 2, b + 0.1), yaw, (hi - lo) / 2, 0.08, y - 0.18, y + 0.18, env.beam);
    const p = (u, y) => to(u, b + 0.12, y);
    const t = 0.22;
    builder.quad(p(outer, 0.9 + t), p(outer, 0.9 - t), p(inner, h / 2 - t), p(inner, h / 2 + t), env.beam, 0, 0.9);
    builder.quad(p(outer, h / 2 + t), p(outer, h / 2 - t), p(inner, h - 0.7 - t), p(inner, h - 0.7 + t), env.beam, 0, 0.9);
    softBox(builder, at(a + s * (w * 0.55), b + 0.2), yaw, 0.08, 0.06, h / 2 - 0.5, h / 2 + 0.5, env.iron);
  }
  for (const s of [-1, 1]) softBox(builder, at(a + s * (w + 0.25), b + 0.18), yaw, 0.3, 0.2, 0, h + 0.1, env.beam);
  const steps = 8;
  for (let k = 0; k < steps; k++) {
    const t0 = k / steps,
      t1 = (k + 1) / steps;
    const arc = (t) => [a - (w + 0.5) + 2 * (w + 0.5) * t, h + DOOR.arch * Math.sin(Math.PI * t)];
    const [u0, y0] = arc(t0),
      [u1, y1] = arc(t1);
    builder.quad(to(u0, b + 0.2, y0), to(u1, b + 0.2, y1), to(u1, b + 0.2, y1 + 0.5), to(u0, b + 0.2, y0 + 0.5), env.beam, 0, 0.95);
    face(b + 0.01, u0, u1, h, Math.min(y0, y1), env.doorway);
  }
}

/** A four-pane window with its frame, sill and a box of flowers. */
function barnWindow(builder, at, face, yaw, a, halfB, env, random) {
  const b = halfB + 0.02,
    [y0, y1] = WINDOW,
    w = 1.1;
  face(b - 0.08, a - w, a + w, y0, y1, env.glass, 0, 0.9);
  for (const [u, half] of [[a - w, 0.14], [a + w, 0.14], [a, 0.07]]) softBox(builder, at(u, b + 0.08), yaw, half, 0.1, y0 - 0.1, y1 + 0.1, env.beam);
  for (const [y, half] of [[y0, 0.14], [y1, 0.14], [(y0 + y1) / 2, 0.07]]) softBox(builder, at(a, b + 0.08), yaw, w + 0.12, 0.1, y - half, y + half, env.beam);
  softBox(builder, at(a, b + 0.4), yaw, w + 0.3, 0.35, y0 - 0.85, y0 - 0.2, env.plankDark);
  for (let k = 0; k < 14; k++) {
    const u = a - w + random() * 2 * w,
      d = b + 0.2 + random() * 0.4,
      y = y0 - 0.2 + random() * 0.35;
    const [x, z] = at(u, d);
    const leaf = lerp(env.bush, env.bushLight, random());
    builder.tri([x - 0.2, y - 0.25, z], [x + 0.2, y - 0.25, z], [x, y + 0.25, z + 0.05], leaf);
    if (random() < 0.6) {
      const c = env.blooms[Math.floor(random() * env.blooms.length)];
      builder.tri([x - 0.13, y + 0.2, z + 0.1], [x + 0.13, y + 0.2, z + 0.1], [x, y + 0.42, z + 0.12], c);
      builder.tri([x - 0.1, y + 0.36, z + 0.1], [x + 0.1, y + 0.36, z + 0.1], [x, y + 0.18, z + 0.14], c);
    }
  }
}

const DRAGON = [
  [[0.05, 0.15], [0.3, 0.72], [0.85, 0.98], [0.72, 0.7], [0.95, 0.55], [0.68, 0.38], [0.78, 0.16], [0.45, 0.12], [0.3, 0]],
  [[-0.05, 0.3], [0.2, 0.2], [0.28, -0.1], [0.15, -0.38], [-0.1, -0.32], [-0.2, -0.05]],
  [[-0.08, 0.15], [0.12, 0.25], [-0.12, 0.62], [-0.3, 0.52]],
  [[-0.1, 0.7], [-0.06, 0.56], [-0.3, 0.46], [-0.6, 0.5], [-0.5, 0.62], [-0.28, 0.7]],
  [[-0.14, 0.68], [-0.26, 0.7], [0.08, 0.92]],
  [[-0.12, -0.1], [0.15, -0.2], [0.02, -0.5], [-0.18, -0.38]],
  [[-0.18, -0.38], [0.02, -0.5], [-0.08, -0.76], [-0.22, -0.74]],
  [[-0.36, -0.88], [-0.02, -0.88], [-0.08, -0.72], [-0.24, -0.72]],
  [[0.15, -0.2], [0.3, -0.12], [0.33, -0.62], [0.2, -0.62]],
  [[0.12, -0.88], [0.44, -0.88], [0.36, -0.6], [0.2, -0.6]],
  [[0.2, -0.3], [0.28, -0.12], [0.62, -0.42], [0.55, -0.55]],
  [[0.55, -0.55], [0.62, -0.42], [0.82, -0.6], [0.78, -0.7]],
  [[0.8, -0.64], [0.95, -0.56], [0.98, -0.8], [0.74, -0.78]],
];

/** A swallowtailed banner with a gold border and the stable's rampant dragon, on a rod off an iron bracket. */
function banner(builder, to, at, yaw, a, halfB, env) {
  const b = halfB + 0.35,
    top = EAVES - 0.9,
    width = 2.3,
    drop = 4.4,
    tail = 0.8,
    rim = 0.13;
  softBox(builder, at(a, halfB + 0.2), yaw, 0.06, 0.25, top + 0.05, top + 0.2, env.iron);
  softBox(builder, at(a, b), yaw, width / 2 + 0.2, 0.06, top - 0.06, top + 0.06, env.beam);
  for (const s of [-1, 1]) softBox(builder, at(a + s * (width / 2 + 0.26), b), yaw, 0.1, 0.1, top - 0.1, top + 0.1, env.emblem);
  const p = (u, y, lift = 0) => to(a + u, b + lift, y);
  /** A fan from the first point, each triangle wound to face out. */
  const fill = (points, color, lift) => {
    for (let i = 1; i < points.length - 1; i++) {
      const [o, m, n] = [points[0], points[i], points[i + 1]];
      const out = (m[0] - o[0]) * (n[1] - o[1]) - (m[1] - o[1]) * (n[0] - o[0]) < 0;
      const [q, r] = out ? [m, n] : [n, m];
      builder.tri(p(...o, lift), p(...q, lift), p(...r, lift), color, 0, 1);
    }
  };
  const bottom = top - drop;
  const cloth = (inset, from) => {
    const w = width / 2 - inset,
      foot = bottom + inset * 1.8;
    return [[0, bottom + tail + inset * 1.6], [w, foot], [w, from], [-w, from], [-w, foot]];
  };
  fill(cloth(0, top + 0.06), env.emblem, 0);
  fill(cloth(rim, top - 0.3), env.banner, 0.04);
  const s = 1.05,
    cu = -0.19 * s,
    cy = top - 2.05;
  for (const part of DRAGON) fill(part.map(([u, v]) => [cu + u * s, cy + v * s]), env.emblem, 0.08);
  fill([[-0.24, 0.6], [-0.17, 0.6], [-0.21, 0.55]].map(([u, v]) => [cu + u * s, cy + v * s]), env.banner, 0.11);
}

/** An iron wall lantern on a bracket, lit. */
function lantern(builder, at, yaw, a, halfB, env) {
  const y = 4.3,
    b = halfB + 0.75;
  softBox(builder, at(a, halfB + 0.38), yaw, 0.05, 0.4, y + 0.55, y + 0.65, env.iron);
  softBox(builder, at(a, b), yaw, 0.04, 0.04, y + 0.4, y + 0.6, env.iron);
  softBox(builder, at(a, b), yaw, 0.26, 0.26, y + 0.32, y + 0.42, env.iron);
  softBox(builder, at(a, b), yaw, 0.26, 0.26, y - 0.42, y - 0.32, env.iron);
  const [x, z] = at(a, b);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) column(builder, [x + dx * 0.22, z + dz * 0.22], 0.03, y - 0.32, y + 0.32, 4, env.iron);
  softBox(builder, at(a, b), yaw, 0.18, 0.18, y - 0.3, y + 0.3, env.lantern);
  builder.tri([x - 0.14, y - 0.25, z], [x + 0.14, y - 0.25, z], [x, y + 0.2, z], env.lantern, 1);
  builder.tri([x, y - 0.25, z - 0.14], [x, y - 0.25, z + 0.14], [x, y + 0.2, z], env.lantern, 1);
}

/** A canvas awning over the door on raked timber brackets, its front edge scalloped. */
function awning(builder, to, at, yaw, a, halfB, env) {
  const half = DOOR.width / 2 + 1.6,
    reach = 2.6,
    high = EAVES - 0.3,
    low = high - 1.1;
  const p = (u, out, y) => to(a + u, halfB + out, y);
  const stripes = 12;
  for (let k = 0; k < stripes; k++) {
    const u0 = -half + (2 * half * k) / stripes,
      u1 = -half + (2 * half * (k + 1)) / stripes;
    const color = k % 2 ? env.awning : env.awningDark;
    builder.quad(p(u0, 0.1, high), p(u1, 0.1, high), p(u1, reach, low), p(u0, reach, low), color, 0, 1);
    builder.tri(p(u0, reach, low), p(u1, reach, low), p((u0 + u1) / 2, reach + 0.02, low - 0.28), color, 0, 0.95);
  }
  for (const u of [-half + 0.3, half - 0.3]) {
    const t = 0.11;
    builder.quad(p(u - t, 0.1, high - 2.2), p(u + t, 0.1, high - 2.2), p(u + t, reach - 0.2, low - 0.08), p(u - t, reach - 0.2, low - 0.08), env.beam, 0, 0.9);
    softBox(builder, at(a + u, halfB + 0.12), yaw, 0.14, 0.12, high - 2.4, high + 0.1, env.beam);
  }
}
