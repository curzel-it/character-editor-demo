import { gridSurface, meshPart, tubeSurface, add, lerp, mix, scale, sub, unit, smooth, clamp01 } from "./surface.js";
import { wrapYaw } from "./headShape.js";
import { rgbOf, shade, mixRgb } from "./characterColors.js";

/**
 * @typedef {{ line: (yaw: number) => number, thick: (yaw: number, pitch: number) => number, soft?: number, coversEars?: boolean,
 *   bumps?: { amount: number, frequency: number }, tint?: number, extras?: string[], tight?: boolean, sheen?: boolean }} HairShape
 */

const TAU = Math.PI * 2;
/** A periodic blend through hairline heights at the front, temple, above the ear, behind the ear and the nape. */
function hairline(front, temple, ear, behind, nape) {
  const keys = [[0, front], [0.75, temple], [1.55, ear], [2.25, behind], [Math.PI, nape]];
  return (yaw) => {
    const a = Math.abs(wrapYaw(yaw));
    let k = 0;
    while (k < keys.length - 2 && keys[k + 1][0] < a) k++;
    const [a0, v0] = keys[k],
      [a1, v1] = keys[k + 1];
    const t = clamp01((a - a0) / (a1 - a0));
    return mix(v0, v1, t * t * (3 - 2 * t));
  };
}

/** Pointed locks along an edge: `count` per full turn, cutting `depth` radians lower at their tips, only where `where(yaw)`. */
const locks = (count, depth, where = () => 1, phase = 0) => (yaw) => {
  const f = (((yaw + phase) / TAU) * count) % 1;
  const tri = 1 - Math.abs((f < 0 ? f + 1 : f) * 2 - 1);
  return depth * tri ** 1.6 * where(yaw);
};

const near = (centre, width) => (yaw) => Math.max(0, 1 - Math.abs(wrapYaw(yaw - centre)) / width);
const front = (width) => near(0, width);

const base = hairline(0.5, 0.3, 0.06, -0.3, -0.72);

/** Thickness rising from `sides` above the ears to `crown` over the top. */
const dome = (crown, sides, back = crown) => (yaw, pitch) => {
  const top = smooth(-0.3, 0.9, pitch);
  const b = Math.max(0, -Math.cos(yaw));
  return mix(sides, mix(crown, back, b), top);
};

/** The shell and extras of each hair style. */
export const hairShapes = /** @type {Record<string, HairShape>} */ ({
  bald: { line: () => 9, thick: () => 0 },
  buzz: { line: base, thick: () => 0.0028, soft: 0.05, tint: 0.35, tight: true },
  crop: { line: (y) => base(y) + 0.06, thick: dome(0.015, 0.006), soft: 0.04, sheen: true, fringe: [{ from: -1, to: 1, count: 8, lift: 0.16, drop: 0.24, sweep: 0.1, width: 1.1 }] },
  sidePart: { line: (y) => hairline(0.5, 0.26, 0.04, -0.3, -0.7)(y), thick: (yaw, pitch) => dome(0.02, 0.007)(yaw, pitch) + 0.01 * Math.max(0, 1 - Math.abs(wrapYaw(yaw - 0.35)) / 0.9) * smooth(-0.1, 0.5, pitch), soft: 0.04, sheen: true, fringe: [{ from: -0.25, to: 1.25, count: 6, lift: 0.3, drop: 0.5, sweep: 0.55, width: 1.25 }] },
  quiff: { line: (y) => hairline(0.55, 0.32, 0.08, -0.3, -0.7)(y), thick: (yaw, pitch) => dome(0.013, 0.004)(yaw, pitch) + 0.04 * Math.max(0, Math.cos(yaw)) ** 2 * smooth(0.25, 0.75, pitch) * (1 - smooth(1.15, 1.5, pitch)), soft: 0.07, sheen: true },
  spiky: { line: (y) => base(y) + 0.04, thick: dome(0.016, 0.006), soft: 0.04, extras: ["spikes"], fringe: [{ from: -1.1, to: 1.1, count: 8, lift: 0.14, drop: 0.24, sweep: 0.05, width: 0.9, sharp: true }] },
  mohawk: { line: base, thick: (yaw, pitch) => 0.0025 + 0.004 * smooth(0.5, 1.1, pitch) * Math.max(0, 1 - Math.abs(Math.sin(yaw)) * 3), soft: 0.04, tint: 0.3, extras: ["crest"], tight: true },
  curls: { line: (y) => base(y) + 0.03, thick: dome(0.024, 0.014, 0.026), soft: 0.08, bumps: { amount: 0.011, frequency: 13 } },
  afro: { line: hairline(0.46, 0.16, -0.32, -0.6, -0.85), coversEars: true, thick: (yaw, pitch) => mix(0.042, 0.068, smooth(-0.3, 0.5, pitch)) * (1 + 0.12 * Math.max(0, -Math.cos(yaw))) * (1 + 0.15 * Math.abs(Math.sin(yaw)) * smooth(-0.2, 0.4, pitch)), soft: 0.42, bumps: { amount: 0.014, frequency: 8 } },
  bob: { line: hairline(0.5, 0.1, -0.95, -0.98, -0.92), thick: (yaw, pitch) => dome(0.02, 0.026)(yaw, pitch) + 0.012 * smooth(-0.2, -0.9, pitch), soft: 0.035, coversEars: true, sheen: true, fringe: [{ from: -0.95, to: 0.95, count: 6, lift: 0.22, drop: 0.42, sweep: 0, width: 1.6, blunt: true }] },
  shag: { line: hairline(0.5, 0.05, -0.55, -0.75, -0.85), thick: dome(0.024, 0.02), soft: 0.035, coversEars: true, sheen: true, fringe: [{ from: -1, to: 1, count: 7, lift: 0.2, drop: 0.44, sweep: 0.12, width: 1.2 }, { from: 1.25, to: 5.03, count: 13, lift: 0.3, drop: 0.36, sweep: 0.1, width: 1.2 }] },
  wavy: { line: hairline(0.5, 0.0, -0.8, -1.0, -1.1), thick: (yaw, pitch) => dome(0.02, 0.022)(yaw, pitch) + 0.008 * smooth(-0.3, -1, pitch), soft: 0.04, coversEars: true, extras: ["curtain", "sideLocks"], sheen: true, bumps: { amount: 0.003, frequency: 10 }, fringe: [{ from: -0.3, to: 1.2, count: 5, lift: 0.3, drop: 0.48, sweep: 0.5, width: 1.3 }] },
  long: { line: hairline(0.56, 0.1, -0.9, -1.1, -1.2), thick: dome(0.016, 0.014), soft: 0.035, coversEars: true, extras: ["longCurtain", "longLocks"], sheen: true, fringe: [{ from: 0.06, to: 0.95, count: 4, lift: 0.22, drop: 0.5, sweep: 0.42, width: 1.3 }, { from: -0.95, to: -0.06, count: 4, lift: 0.22, drop: 0.5, sweep: -0.42, width: 1.3 }] },
  ponytail: { line: base, thick: dome(0.011, 0.006, 0.013), soft: 0.05, extras: ["ponytail"], sheen: true },
  bun: { line: base, thick: dome(0.01, 0.005), soft: 0.05, extras: ["bun"], sheen: true },
  spaceBuns: { line: (y) => base(y) + 0.04, thick: dome(0.01, 0.005), soft: 0.04, extras: ["spaceBuns"], sheen: true, fringe: [{ from: -0.75, to: 0.75, count: 7, lift: 0.16, drop: 0.3, sweep: 0, width: 1.1 }] },
  pigtails: { line: (y) => base(y) + 0.04, thick: dome(0.01, 0.006), soft: 0.04, extras: ["pigtails"], sheen: true, fringe: [{ from: -0.8, to: 0.8, count: 7, lift: 0.16, drop: 0.34, sweep: 0, width: 1.1 }] },
  braid: { line: base, thick: dome(0.011, 0.006), soft: 0.05, extras: ["braid"], sheen: true },
});

/** Deterministic bumps over the head for curls: positive lumps at a lattice of sines. */
function bumps(yaw, pitch, frequency) {
  const c = Math.cos(pitch);
  const d = [c * Math.cos(yaw), Math.sin(pitch), c * Math.sin(yaw)];
  const v = Math.sin(frequency * d[0] + 1.3) * Math.sin(frequency * d[1] + 0.7) * Math.sin(frequency * d[2] + 2.1);
  return Math.max(0, v) ** 0.7;
}

/**
 * How far the hair stands off the head at each angle, for the hair itself and for headwear sitting
 * on it: `hat` limits what fits under headwear above the hat's line.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {{ line: (yaw: number) => number, room: number } | null} hat
 */
export function hairProfile(spec, size, hat = null) {
  const shape = hairShapes[spec.hair] ?? hairShapes.crop;
  const volume = mix(0.6, 1.45, Number(spec.hairVolume));
  const soft = shape.soft ?? 0.05;
  const k = size / 1.1;
  const amount = (yaw, pitch) => {
    const line = shape.line(yaw);
    const m = smooth(line - soft * 0.25, line + soft, pitch);
    let t = shape.thick(yaw, pitch) * k * (shape.tight ? 1 : volume);
    if (shape.bumps) t += shape.bumps.amount * k * bumps(yaw, pitch, shape.bumps.frequency) * m;
    if (hat && pitch > hat.line(yaw) - 0.12) t = Math.min(t, hat.room * smooth(hat.line(yaw) - 0.25, hat.line(yaw), pitch) + t * (1 - smooth(hat.line(yaw) - 0.25, hat.line(yaw), pitch)));
    return { m, t };
  };
  return {
    shape,
    /** Offset of the hair's surface from the skin: negative where it tucks under. */
    out: (yaw, pitch) => {
      const { m, t } = amount(yaw, pitch);
      return m * t - (1 - m) * 0.003 * k;
    },
    lowest: () => {
      let low = 9;
      for (let a = 0; a < TAU; a += 0.1) low = Math.min(low, shape.line(a));
      return low;
    },
  };
}

/**
 * The hair: the shell laid over the skull, plus the tails, buns, braids, spikes and curtains of its
 * style, swinging on the hair bones; and what the head needs to know (ears covered, the bones' joints).
 * @param {import("./headShape.js").HeadShape} head
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {Record<string, number[]>} j the body's joints
 * @param {{ line: (yaw: number) => number, room: number } | null} hat
 */
export function characterHair(head, spec, j, hat) {
  const size = head.size;
  const profile = hairProfile(spec, size, hat);
  const shape = profile.shape;
  const rgb = rgbOf(spec.hairColor);
  const skin = rgbOf(spec.skin);
  const hair = shape.tint ? mixRgb(rgb, skin, shape.tint) : rgb;
  const tips = spec.hairTips && spec.hairTips !== "none" ? rgbOf(spec.hairTips) : null;
  const sheen = shade(hair, 1.1);
  const deep = shade(hair, 0.86);
  const parts = [];
  const joints = {
    hairBack: head.point(Math.PI, 0.35),
    hairTail: add(head.point(Math.PI, -0.2), [-0.06 * size, 0, 0]),
    hairTip: add(head.point(Math.PI, -0.9), [-0.1 * size, -0.12 * size, 0]),
    hairSideL: head.point(-Math.PI / 2 - 0.4, 0.2),
    hairSideR: head.point(Math.PI / 2 + 0.4, 0.2),
  };
  if (spec.hair === "bald") return { parts, joints, coversEars: false };
  const columns = 96,
    rows = 38;
  const lineOf = shape.line;
  const floor = 0.0007 * (size / 1.1);
  const angles = (r, i) => {
    const yaw = (i / columns) * TAU;
    const edge = lineOf(yaw) - 0.012;
    return [yaw, mix(Math.PI / 2, edge, (r / rows) ** 0.85)];
  };
  const grid = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let i = 0; i < columns; i++) {
      const [yaw, pitch] = r === 0 ? [0, Math.PI / 2] : angles(r, i);
      row.push(head.offset(yaw, pitch, Math.max(profile.out(yaw, pitch), 0) + floor));
    }
    grid.push(row);
  }
  const color = (r, i) => {
    const [yaw, pitch] = angles(r + 0.5, i + 0.5);
    const edge = pitch - lineOf(yaw);
    return tips && edge < 0.24 ? mixRgb(hair, tips, 1 - smooth(0.02, 0.24, edge)) : hair;
  };
  parts.push(meshPart("hair-shell", "head", gridSurface(grid, { color })));
  const ctx = { head, size, hair, deep, tips, sheen, j, covered: Boolean(hat), profile };
  for (const [k, group] of (shape.fringe ?? []).entries()) parts.push(...fringe(ctx, group, `hair-fringe-${k}`, hat));
  for (const extra of shape.extras ?? []) parts.push(...(extras[extra]?.(ctx) ?? []));
  return { parts, joints, coversEars: Boolean(shape.coversEars) };
}

/** A lock of hair through `path` points with `width` and `depth` radii along it (t 0..1), coloured towards the tips, its rings skinned by `skin(t)`. */
function lock(id, bone, path, { width, depth, hair, tips, deep, skin, up = [0, 1, 0], around = 10 }) {
  const n = path.length - 1;
  const rings = path.map((p, k) => {
    const t = k / n;
    return { p, r: [depth(t), width(t)], ...(skin ? { skin: skin(t) } : {}) };
  });
  const color = (ring, seg, angle) => {
    const t = ring / n;
    let c = Math.cos(angle) < -0.5 ? deep : hair;
    if (tips) c = mixRgb(c, tips, smooth(0.45, 0.95, t));
    return c;
  };
  return meshPart(id, bone, tubeSurface(rings, { around, up, color }));
}

/**
 * Locks laid over the skin from inside the hair down past its edge: `count` across `from`..`to` (yaw),
 * each rooted `lift` above the hairline and falling `drop` below its root, swept `sweep` sideways at
 * the tip; blunt locks keep their width, sharp ones taper to points. Under headwear they shorten.
 */
function fringe({ head, size, hair, deep, tips, profile }, group, id, hat) {
  const out = [];
  const spacing = (group.to - group.from) / group.count;
  const k = size / 1.1;
  for (let n = 0; n < group.count; n++) {
    const centre = group.from + spacing * (n + 0.5);
    const line = profile.shape.line(centre);
    const rootPitch = hat ? Math.min(line + group.lift, hat.line(centre) - 0.06) : line + group.lift;
    if (hat && rootPitch < line - 0.02) continue;
    const drop = group.drop * (hat ? 0.75 : 1) * (0.9 + 0.2 * (((n * 37) % 7) / 7));
    const path = [],
      count = 8;
    const depth = (t) => 0.0062 * k * (1 - 0.55 * t);
    for (let q = 0; q <= count; q++) {
      const t = q / count;
      const yaw = centre + group.sweep * t * t;
      const pitch = rootPitch - drop * t;
      const shell = profile.out(yaw, pitch);
      const emerge = smooth(0, 0.35, t);
      path.push(head.offset(yaw, pitch, Math.max(shell - depth(t) * mix(1.1, 0.2, emerge), 0.0015 * k) + depth(t) * 0.5));
    }
    const half = (spacing / 2) * head.size * 0.1 * (group.width ?? 1);
    const width = (t) => {
      if (group.blunt) return half * (1 - 0.18 * smooth(0.75, 1, t)) + 0.0015;
      const taper = group.sharp ? t : t ** 1.6;
      return half * (1 - 0.92 * taper) * (1 + 0.15 * Math.sin(t * Math.PI)) + 0.001;
    };
    const n0 = head.normal(centre, rootPitch);
    out.push(lock(`${id}-${n}`, "head", path, { width, depth, hair, tips, deep: hair, up: n0, around: 10 }));
  }
  return out;
}

/** Points along a quadratic curve from `a` through control `b` to `c`. */
const curve = (a, b, c, count = 10) =>
  Array.from({ length: count + 1 }, (_, k) => {
    const t = k / count;
    return add(add(scale(a, (1 - t) ** 2), scale(b, 2 * t * (1 - t))), scale(c, t * t));
  });

const chain = (bones) => (t) => {
  if (t < 0.33) return { joints: [bones[0], bones[1]], weight: 1 - t / 0.66 };
  if (t < 0.66) return { joints: [bones[1], bones[2]], weight: 1 - (t - 0.33) / 0.66 };
  return { joints: [bones[2], bones[1]], weight: 0.5 + (t - 0.66) * 1.4 };
};

/** Bands that tie a tail or a bun. */
const tie = (id, bone, at, radius, dir) =>
  meshPart(id, bone, tubeSurface([{ p: sub(at, scale(dir, radius * 0.25)), r: radius }, { p: add(at, scale(dir, radius * 0.25)), r: radius }], { around: 12, color: () => [0.85, 0.3, 0.38] }));

const extras = {
  /** Spikes standing out of the crown. */
  spikes({ head, size, hair, deep, tips, covered, profile }) {
    if (covered) return [];
    const out = [];
    const spots = [[0, 1.2], [0.5, 0.85], [-0.5, 0.85], [1.2, 0.7], [-1.2, 0.7], [2.0, 0.65], [-2.0, 0.65], [2.7, 0.55], [-2.7, 0.55], [Math.PI, 0.9], [0.9, 1.15], [-0.9, 1.15], [2.2, 1.05], [-2.2, 1.05], [0.15, 0.6]];
    spots.forEach(([yaw, pitch], k) => {
      const root = head.offset(yaw, pitch, profile.out(yaw, pitch) - 0.006 * size);
      const n = head.normal(yaw, pitch);
      const dir = unit(add(add(n, [-0.35, 0.45, 0]), [0.2 * Math.cos(yaw), 0, 0]));
      const length = (0.05 + 0.02 * ((k * 7) % 3)) * size;
      out.push(lock(`hair-spike-${k}`, "head", curve(root, add(root, scale(dir, length * 0.6)), add(add(root, scale(dir, length)), [-0.01 * size, -0.006 * size, 0]), 5), { width: (t) => 0.022 * size * (1 - t) + 0.001, depth: (t) => 0.014 * size * (1 - t) + 0.001, hair, tips, deep, up: n }));
    });
    return out;
  },
  /** A crest of blades along the middle from brow to nape. */
  crest({ head, size, hair, deep, tips, covered }) {
    if (covered) return [];
    const out = [];
    const count = 7;
    for (let k = 0; k < count; k++) {
      const pitch = mix(0.55, 2.55, k / (count - 1));
      const yaw = pitch > Math.PI / 2 ? Math.PI : 0;
      const p = pitch > Math.PI / 2 ? Math.PI - pitch : pitch;
      const root = head.offset(yaw, p, -0.004 * size);
      const n = head.normal(yaw, p);
      const height = (0.05 + 0.035 * Math.sin((k / (count - 1)) * Math.PI)) * size;
      const tip = add(add(root, scale(n, height)), [-0.03 * size, 0, 0]);
      out.push(lock(`hair-crest-${k}`, "head", curve(root, add(root, scale(n, height * 0.6)), tip, 5), { width: (t) => 0.005 * size * (1 - t) + 0.001, depth: (t) => 0.034 * size * (1 - t * 0.9), hair, tips, deep, up: [1, 0, 0] }));
    }
    return out;
  },
  /** A tail from the back of the crown, tied, swinging on the hair chain. */
  ponytail({ head, size, hair, deep, tips, covered, j }) {
    const root = covered ? head.point(Math.PI, 0.05) : head.point(Math.PI, 0.45);
    const back = [-1, 0, 0];
    const tieAt = add(root, scale(back, 0.012 * size));
    const path = curve(tieAt, add(tieAt, [-0.09 * size, 0.02 * size, 0]), [j.neck[0] - 0.14 * size, j.neck[1] - 0.06 * size, 0], 10);
    return [
      tie("hair-tie", "hairBack", tieAt, 0.02 * size, back),
      lock("hair-tail", "hairBack", path, { width: (t) => 0.036 * size * Math.sin(Math.PI * (0.18 + 0.72 * t)) ** 0.8 + 0.002, depth: (t) => 0.032 * size * Math.sin(Math.PI * (0.18 + 0.72 * t)) ** 0.8 + 0.002, hair, tips, deep, skin: chain(["hairBack", "hairTail", "hairTip"]), up: [0, 0, 1] }),
    ];
  },
  bun({ head, size, hair, deep, covered }) {
    const at = covered ? head.offset(Math.PI, 0.1, 0.035 * size) : head.offset(Math.PI, 0.85, 0.035 * size);
    return [
      { id: "hair-bun", bone: "head", shape: "ellipsoid", segments: 16, position: at, rotation: [0, 0, 0.4], scale: [0.046, 0.042, 0.048].map((v) => v * size), color: hair },
      { id: "hair-bun-wrap", bone: "head", shape: "ellipsoid", segments: 14, position: add(at, [0.008 * size, -0.006 * size, 0]), rotation: [0, 0, 0.4], scale: [0.03, 0.05, 0.034].map((v) => v * size), color: deep },
    ];
  },
  spaceBuns({ head, size, hair, deep, covered }) {
    if (covered) return [];
    return [-1, 1].flatMap((s) => {
      const at = head.offset(s * 1.25, 0.82, 0.03 * size);
      return [
        { id: `hair-bun-${s}`, bone: "head", shape: "ellipsoid", segments: 16, position: at, rotation: [0, 0, 0], scale: [0.038, 0.036, 0.038].map((v) => v * size), color: hair },
        { id: `hair-bun-band-${s}`, bone: "head", shape: "ellipsoid", segments: 12, position: head.offset(s * 1.25, 0.82, 0.006 * size), rotation: [s * 0.6, 0, 0], scale: [0.026, 0.014, 0.026].map((v) => v * size), color: deep },
      ];
    });
  },
  /** Two tails tied at the sides, swinging on the side bones. */
  pigtails({ head, size, hair, deep, tips }) {
    return [-1, 1].flatMap((s) => {
      const name = s < 0 ? "L" : "R";
      const root = head.offset(s * 1.75, 0.15, 0.012 * size);
      const out = [0, 0, s];
      const path = curve(root, add(root, [-0.02 * size, -0.02 * size, s * 0.07 * size]), add(root, [-0.04 * size, -0.2 * size, s * 0.07 * size]), 9);
      return [
        tie(`hair-tie-${s}`, `hairSide${name}`, add(root, scale(out, 0.008 * size)), 0.018 * size, out),
        lock(`hair-pigtail-${s}`, `hairSide${name}`, path, { width: (t) => 0.026 * size * Math.sin(Math.PI * (0.15 + 0.75 * t)) ** 0.7 + 0.002, depth: (t) => 0.022 * size * Math.sin(Math.PI * (0.15 + 0.75 * t)) ** 0.7 + 0.002, hair, tips, deep, skin: () => ({ joints: [`hairSide${name}`, "head"], weight: 1 }), up: [1, 0, 0] }),
      ];
    });
  },
  /** A braid of beads down the back. */
  braid({ head, size, hair, deep, tips, j }) {
    const out = [];
    const start = head.offset(Math.PI, -0.35, 0.006 * size);
    const end = [j.chest[0] - 0.13 * size, j.chest[1] + 0.02, 0];
    const count = 9;
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      const p = add(lerp(start, end, t), [-0.03 * size * Math.sin(t * Math.PI), 0, 0]);
      const r = 0.024 * size * (1 - t * 0.35);
      const skin = chain(["hairBack", "hairTail", "hairTip"])(t);
      const c = tips ? mixRgb(k % 2 ? hair : deep, tips, smooth(0.5, 1, t)) : k % 2 ? hair : deep;
      out.push({ id: `hair-braid-${k}`, bone: skin.weight > 0.5 ? skin.joints[0] : skin.joints[1], shape: "ellipsoid", segments: 12, position: p, rotation: [0, 0, (k % 2 ? 0.3 : -0.3) - 0.2], scale: [r * 0.85, r * 1.2, r], color: c });
    }
    out.push(tie("hair-braid-tie", "hairTip", add(end, [-0.002, -0.03 * size, 0]), 0.016 * size, [0, -1, 0]));
    out.push(lock("hair-braid-end", "hairTip", curve(add(end, [0, -0.035 * size, 0]), add(end, [-0.005, -0.06 * size, 0]), add(end, [0, -0.09 * size, 0]), 4), { width: (t) => 0.018 * size * (1 - t * 0.7), depth: (t) => 0.014 * size * (1 - t * 0.7), hair, tips, deep }));
    return out;
  },
  curtain: (ctx) => curtain(ctx, 0.2, true),
  longCurtain: (ctx) => curtain(ctx, 0.38, false),
  sideLocks: (ctx) => sideLocks(ctx, 0.1),
  longLocks: (ctx) => sideLocks(ctx, 0.2),
};

/** The hair hanging down the back as a fan of tapering locks from under the crown, their feet following the chest. */
function curtain({ head, size, hair, deep, tips, j }, length, wavy) {
  const backX = j.chest[0] - 0.125 * Math.max(1, size * 0.95);
  const shoulderY = j.upperArmL[1];
  const count = 6;
  const out = [];
  for (let n = 0; n < count; n++) {
    const u = (n + 0.5) / count * 2 - 1;
    const yaw = Math.PI - u * 1.05;
    const root = head.offset(yaw, -0.05, -0.012 * size);
    const reach = length * (1 - 0.18 * Math.abs(u) ** 1.5) * (0.92 + 0.12 * (((n * 5) % 3) / 3));
    const spread = u * 0.11 * size;
    const path = [];
    for (let k = 0; k <= 10; k++) {
      const t = k / 10;
      const y = mix(root[1], shoulderY - reach, t);
      const x = mix(root[0], backX - 0.012 * (1 - u * u), smooth(0, 0.45, t)) - (wavy ? 0.008 * Math.sin(t * 10 + n) : 0);
      const z = mix(root[2], spread * 1.25, smooth(0, 0.5, t)) + (wavy ? 0.006 * Math.sin(t * 8 + n * 2) : 0);
      path.push([x, y, z]);
    }
    out.push(
      lock(`hair-curtain-${n}`, "head", path, {
        width: (t) => 0.036 * size * (1 - 0.85 * smooth(0.55, 1, t)) * (1 + 0.25 * Math.sin(Math.PI * t)) + 0.002,
        depth: (t) => mix(0.034 * size, 0.016, smooth(0, 0.5, t)) * (1 - 0.6 * smooth(0.7, 1, t)) + 0.002,
        hair: n % 2 ? hair : shade(hair, 0.94),
        tips,
        deep,
        skin: (t) => ({ joints: ["head", "chest"], weight: 1 - smooth(0.1, 0.55, t) }),
        up: [-1, 0, 0],
        around: 10,
      }),
    );
  }
  return out;
}

/** Locks falling from under the hair at the sides of the face, over the front of the shoulders. */
function sideLocks({ head, size, hair, deep, tips, j }, length) {
  const out = [];
  for (const s of [-1, 1]) {
    const shoulder = j[s < 0 ? "upperArmL" : "upperArmR"];
    for (const [k, [yawAt, reach, lean]] of [[1.22, 1, 0], [1.6, 0.85, -0.03]].entries()) {
      const root = head.offset(s * yawAt, -0.15, -0.01 * size);
      const chin = head.offset(s * (yawAt + 0.05), -0.9, 0.022 * size);
      const end = [j.chest[0] + 0.06 * size + lean, shoulder[1] - length * reach, s * (Math.abs(shoulder[2]) * 0.62 + k * 0.03)];
      const mid = [chin[0] + 0.005 + lean, mix(chin[1], end[1], 0.35), s * Math.max(Math.abs(chin[2]) + 0.01, Math.abs(end[2]) * 0.9)];
      out.push(
        lock(`hair-lock-${s}-${k}`, "head", [...curve(root, chin, mid, 6), ...curve(mid, add(mid, [0.012, -0.04, 0]), end, 6).slice(1)], {
          width: (t) => 0.03 * size * (1 - 0.85 * smooth(0.5, 1, t)) * (1 + 0.2 * Math.sin(Math.PI * t)) + 0.002,
          depth: (t) => 0.02 * size * (1 - 0.6 * t) + 0.002,
          hair: k ? shade(hair, 0.94) : hair,
          tips,
          deep,
          skin: (t) => ({ joints: ["head", "chest"], weight: 1 - smooth(0.25, 0.7, t) }),
          up: [0, 0, s],
        }),
      );
    }
  }
  return out;
}
