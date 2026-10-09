import { gridSurface, meshPart, tubeSurface, add, lerp, mix, scale, sub, unit, smooth } from "./surface.js";
import { rgbOf, shade, luminance } from "./characterColors.js";
import { aim } from "./characterEyes.js";
import { goggles } from "./characterHeadwear.js";

const TAU = Math.PI * 2;

/** A closed loop of `count` points from `at(t)`, t in 0..1. */
const loopRings = (count, at, r) => Array.from({ length: count }, (_, k) => ({ p: at(k / count), r: typeof r === "function" ? r(k / count) : r }));

/** Glasses in front of the eyes: rims of their shape, a bridge and temples back to the ears. */
function eyewear(spec, head) {
  const kind = spec.glasses;
  if (kind === "none") return [];
  const size = head.size;
  const frame = rgbOf(spec.glassesColor);
  const lensHex = spec.lensColor;
  const parts = [];
  if (kind === "goggles") {
    const out = 0.016 * size;
    parts.push(...goggles(head, out, head.eye.pitch, frame, rgbOf(lensHex === "#d9eef2" ? "#8cc4ea" : lensHex)));
    return parts.map((p) => (p.id.startsWith("goggle-frame") ? { ...p, scale: p.scale.map((v, k) => (k === 0 ? v : v * 1.25)) } : p));
  }
  const tinted = kind === "shades" || lensHex !== "#d9eef2";
  const radius = head.eye.radius * (kind === "monocle" ? 1.55 : 1.62);
  const sides = kind === "monocle" ? [1] : [-1, 1];
  const thickness = kind === "shades" ? 0.0042 : 0.0032;
  for (const s of sides) {
    const yaw = s * head.eye.yaw,
      pitch = head.eye.pitch;
    const n = head.normal(yaw, pitch);
    const f = unit(add(n, [1.6, 0, 0]));
    const centre = head.offset(yaw, pitch, 0.017 * size);
    const up = unit(sub([0, 1, 0], scale(f, f[1])));
    const side = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
    const shapeAt = (t) => {
      const a = t * TAU;
      let x = Math.cos(a),
        y = Math.sin(a);
      if (kind === "square" || kind === "shades") {
        const k = 4;
        x = Math.sign(x) * Math.abs(x) ** (2 / k);
        y = Math.sign(y) * Math.abs(y) ** (2 / k) * 0.82;
      }
      if (kind === "cateye") {
        const outer = x * s;
        y = y * 0.78 + (y > 0 ? 0.32 * Math.max(0, outer) ** 2 : 0);
        x *= 1.08;
      }
      return add(centre, add(scale(side, x * radius), scale(up, y * radius)));
    };
    parts.push(meshPart(`glasses-rim-${s}`, "head", tubeSurface(loopRings(40, shapeAt, thickness * size), { around: 6, closed: true, color: () => frame })));
    if (tinted) {
      const rows = [];
      for (let r = 0; r <= 4; r++) rows.push(Array.from({ length: 40 }, (_, k) => lerp(centre, shapeAt(k / 40), r / 4)));
      const lens = rgbOf(kind === "shades" && lensHex === "#d9eef2" ? "#3a4650" : lensHex);
      parts.push(meshPart(`glasses-lens-${s}`, "head", gridSurface(rows, { color: (r, i) => (r === 2 && i > 4 && i < 9 ? shade(lens, 1.6) : lens) })));
    }
    const hinge = shapeAt(s > 0 ? 0 : 0.5);
    const ear = head.offset(s * (Math.PI / 2 - 0.05), pitch + 0.02, 0.008 * size);
    parts.push(meshPart(`glasses-temple-${s}`, "head", tubeSurface([{ p: hinge, r: thickness * size }, { p: add(head.offset(s * 1.0, pitch + 0.02, 0.012 * size), [0, 0, 0]), r: thickness * size * 0.9 }, { p: ear, r: thickness * size * 0.8 }], { around: 5, color: () => frame })));
    if (kind === "monocle") {
      const chain = [shapeAt(0.75), add(shapeAt(0.75), [-0.01 * size, -0.05 * size, 0.01 * size]), add(head.offset(s * 1.2, -0.9, 0.01), [0, -0.04 * size, 0])];
      parts.push(meshPart("monocle-chain", "head", tubeSurface(chain.map((p) => ({ p, r: 0.0012 * size })), { around: 4, color: () => frame })));
    }
  }
  if (sides.length === 2) {
    const a = head.offset(-head.eye.yaw * 0.42, head.eye.pitch + 0.03, 0.016 * size);
    const b = head.offset(head.eye.yaw * 0.42, head.eye.pitch + 0.03, 0.016 * size);
    parts.push(meshPart("glasses-bridge", "head", tubeSurface([{ p: a, r: 0.0028 * size }, { p: add(lerp(a, b, 0.5), [0.004 * size, 0.006 * size, 0]), r: 0.0028 * size }, { p: b, r: 0.0028 * size }], { around: 5, color: () => frame })));
  }
  return parts;
}

/** Neckwear round the neck's base: scarves, a bandana, a necklace, a bow tie or a ruff. */
function neckwear(spec, j, m) {
  const kind = spec.neck;
  if (kind === "none") return [];
  const { s } = m;
  const rgb = rgbOf(spec.neckColor);
  const metal = rgbOf(spec.jewelColor);
  const g = mix(1, m.girth, 0.45);
  const y = j.neck[1] + 0.012 * s;
  const cx = j.neck[0] * 0.7;
  const rx = 0.058 * g,
    rz = 0.064 * g;
  const around = (t, lift = 0, grow = 0) => [cx + Math.cos(t * TAU) * (rx + grow), y + lift, Math.sin(t * TAU) * (rz + grow)];
  const parts = [];
  const push = (id, mesh, bone = "chest") => parts.push(meshPart(id, bone, mesh));
  const stripes = (t) => (Math.floor(t * 10) % 2 ? shade(rgb, 0.85) : rgb);
  if (kind === "scarf" || kind === "longScarf") {
    push("scarf", tubeSurface(loopRings(28, (t) => around(t, 0.006 * s * Math.cos(t * TAU)), [0.03 * s, 0.024 * s]), { around: 10, closed: true, color: (ring) => stripes(ring / 28) }));
    const knot = [cx + rx + 0.012 * s, y - 0.025 * s, 0.03 * s];
    parts.push({ id: "scarf-knot", bone: "chest", shape: "ellipsoid", segments: 12, position: knot, rotation: [0, 0, 0], scale: [0.026 * s, 0.03 * s, 0.03 * s], color: rgb });
    const length = kind === "longScarf" ? 0.42 * s : 0.14 * s;
    for (const [k, dz] of [[0, 0.01], [1, -0.03]]) {
      const path = [0, 0.33, 0.66, 1].map((t) => add(knot, [0.026 * s * Math.sin(t * 2) + 0.012 * s * t, -length * t, dz * s + 0.012 * s * Math.sin(t * 5 + k)]));
      push(`scarf-tail-${k}`, tubeSurface(path.map((p, i) => ({ p, r: [0.008 * s, 0.03 * s] })), { around: 8, up: [1, 0, 0], color: (ring) => (ring >= 2 ? shade(rgb, 0.85) : rgb) }));
    }
  }
  if (kind === "bandana") {
    push("neck-bandana", tubeSurface(loopRings(24, (t) => around(t, -0.006 * s), [0.012 * s, 0.01 * s]), { around: 6, closed: true, color: () => rgb }));
    const top = [cx + rx + 0.008 * s, y - 0.012 * s, 0];
    push("neck-bandana-flap", tubeSurface([{ p: top, r: [0.008 * s, 0.07 * s * g] }, { p: add(top, [0.022 * s, -0.06 * s, 0]), r: [0.006 * s, 0.035 * s] }, { p: add(top, [0.03 * s, -0.1 * s, 0]), r: [0.004 * s, 0.004 * s] }], { around: 8, up: [1, 0, 0], color: () => rgb }));
  }
  if (kind === "necklace") {
    push("necklace", tubeSurface(loopRings(32, (t) => around(t, -0.022 * s * Math.max(0, Math.cos(t * TAU)) ** 2 - 0.008 * s, 0.006 * s), 0.0022 * s), { around: 5, closed: true, color: () => metal }));
    parts.push({ id: "necklace-pendant", bone: "chest", shape: "ellipsoid", segments: 12, position: [cx + rx + 0.022 * s * g, y - 0.042 * s, 0], rotation: [0, 0, 0], scale: [0.006 * s, 0.014 * s, 0.011 * s], color: rgbOf(spec.topAccent) });
  }
  if (kind === "bowtie") {
    const at = [cx + rx + 0.006 * s, y - 0.01 * s, 0];
    for (const z of [-1, 1]) parts.push({ id: `bowtie-${z}`, bone: "chest", shape: "ellipsoid", segments: 12, position: add(at, [0, 0, z * 0.024 * s]), rotation: [z * 0.2, 0, 0], scale: [0.01 * s, 0.018 * s, 0.024 * s], color: rgb });
    parts.push({ id: "bowtie-knot", bone: "chest", shape: "ellipsoid", segments: 10, position: add(at, [0.004 * s, 0, 0]), rotation: [0, 0, 0], scale: [0.01 * s, 0.011 * s, 0.01 * s], color: shade(rgb, 0.85) });
  }
  if (kind === "collar") {
    push("ruff", tubeSurface(loopRings(48, (t) => around(t, 0, 0.01 * s), (t) => [0.02 * s * (0.75 + 0.25 * Math.cos(t * TAU * 12)), 0.032 * s]), { around: 8, closed: true, color: (ring) => (ring % 2 ? shade(rgb, 0.92) : rgb) }));
  }
  return parts;
}

/** What hangs on the back: a cape, a backpack, a satchel, little wings or a quiver. */
function backwear(spec, j, m) {
  const kind = spec.back;
  if (kind === "none") return { parts: [], joints: {} };
  const { s } = m;
  const rgb = rgbOf(spec.backColor);
  const dark = shade(rgb, 0.72);
  const leather = rgbOf("#6e4a2f");
  const parts = [];
  const g = Math.pow(m.girth, 0.8);
  const backX = -0.105 * g * s - 0.015;
  const shoulderY = j.upperArmL[1];
  const push = (id, mesh, bone = "chest") => parts.push(meshPart(id, bone, mesh));
  if (kind === "cape") {
    const columns = 22,
      rows = 14;
    const bottom = j.shinL[1] + 0.02;
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const t = r / rows;
      const y = mix(shoulderY + 0.035 * s, bottom, t);
      const half = mix(m.shoulders * 0.95, m.shoulders * 1.35 + 0.05, smooth(0, 1, t));
      const row = [];
      for (let i = 0; i <= columns; i++) {
        const u = i / columns * 2 - 1;
        const wrap = mix(0.85, 0.35, smooth(0, 0.3, t));
        const a = u * Math.PI * wrap * 0.5;
        const x = backX - 0.02 - Math.cos(a) * 0.05 * s * (1 + t) + Math.sin(a * 3) * 0.004 + (1 - t) * 0.03 * Math.abs(u) ** 2;
        const fold = 0.012 * s * Math.sin(u * 9) * smooth(0.2, 1, t);
        row.push([x + fold - 0.07 * s * t * t, y, Math.sin(a) * half]);
      }
      grid.push(row);
    }
    const skin = (r) => {
      const t = r / rows;
      return t < 0.5 ? { joints: ["cape", "chest"], weight: 0.35 + t * 1.3 } : { joints: ["capeLow", "cape"], weight: (t - 0.5) * 2 };
    };
    const outside = gridSurface(grid, { wrap: false, color: () => rgb, skin: (r) => skin(r) });
    const inside = gridSurface(grid.map((row) => row.map((p) => add(p, [0.004, 0, 0]))), { wrap: false, color: () => dark, skin: (r) => skin(r), flip: true });
    push("cape-out", outside, "cape");
    push("cape-in", inside, "cape");
    for (const z of [-1, 1]) parts.push({ id: `cape-clasp-${z}`, bone: "chest", shape: "ellipsoid", segments: 12, position: [0.07 * g * s, shoulderY + 0.005, z * 0.06 * s], rotation: [0, 0, 0], scale: [0.012 * s, 0.016 * s, 0.016 * s], color: rgbOf(spec.jewelColor) });
    return { parts, joints: {} };
  }
  if (kind === "backpack") {
    const at = [backX - 0.06 * s, j.chest[1] + 0.02 * s, 0];
    parts.push({ id: "pack", bone: "chest", shape: "ellipsoid", segments: 18, position: at, rotation: [0, 0, 0], scale: [0.07 * s, 0.14 * s, 0.12 * s], color: rgb });
    parts.push({ id: "pack-pocket", bone: "chest", shape: "ellipsoid", segments: 14, position: add(at, [-0.055 * s, -0.05 * s, 0]), rotation: [0, 0, 0], scale: [0.035 * s, 0.06 * s, 0.085 * s], color: dark });
    parts.push({ id: "pack-flap", bone: "chest", shape: "ellipsoid", segments: 14, position: add(at, [-0.01 * s, 0.1 * s, 0]), rotation: [0, 0, 0.2], scale: [0.07 * s, 0.04 * s, 0.11 * s], color: dark });
    for (const z of [-1, 1]) {
      const strap = [[0.02, shoulderY + 0.04 * s], [0.085 * g * s, shoulderY - 0.02 * s], [0.1 * g * s, j.chest[1] - 0.08 * s], [backX, j.spine[1] + 0.02 * s]].map(([x, y]) => ({ p: [x, y, z * 0.085 * s * g], r: [0.006 * s, 0.018 * s] }));
      push(`pack-strap-${z}`, tubeSurface(strap, { around: 6, up: [1, 0, 0], color: () => dark }));
    }
  }
  if (kind === "satchel") {
    const at = [0.03 * s, j.hips[1] - 0.04 * s, 0.17 * s * g];
    parts.push({ id: "satchel", bone: "hips", shape: "ellipsoid", segments: 16, position: at, rotation: [0, 0, 0], scale: [0.09 * s, 0.075 * s, 0.035 * s], color: rgb });
    parts.push({ id: "satchel-flap", bone: "hips", shape: "ellipsoid", segments: 14, position: add(at, [0, 0.025 * s, 0.012 * s]), rotation: [0, 0, 0], scale: [0.088 * s, 0.05 * s, 0.03 * s], color: dark });
    const strap = [];
    for (let k = 0; k <= 16; k++) {
      const t = k / 16;
      const a = t * TAU;
      strap.push({ p: [Math.cos(a) * 0.11 * g * s, mix(shoulderY + 0.02 * s, j.hips[1] - 0.02 * s, (1 - Math.cos(a)) / 2) , -Math.sin(a) * 0.0 + mix(-0.09, 0.17, (1 - Math.cos(a)) / 2) * s * g], r: [0.005 * s, 0.014 * s] });
    }
    push("satchel-strap", tubeSurface(strap, { around: 6, closed: true, up: [0, 0, 1], color: () => leather }));
  }
  if (kind === "wings") {
    for (const z of [-1, 1]) {
      const root = [backX - 0.01, j.chest[1] + 0.06 * s, z * 0.05 * s];
      for (const [k, [len, rise, w]] of [[0.24, 0.14, 0.08], [0.17, -0.06, 0.055]].entries()) {
        const tip = add(root, [-0.06 * s, rise * s, z * len * s]);
        const mid = lerp(root, tip, 0.5);
        parts.push({ id: `wing-${z}-${k}`, bone: "chest", shape: "ellipsoid", segments: 16, position: mid, rotation: aim(unit(sub(tip, root)), Math.PI / 2), scale: [Math.hypot(...sub(tip, root)) * 0.55, w * s, 0.006 * s], color: k ? shade(rgb, 1.2) : rgb });
      }
    }
  }
  if (kind === "quiver") {
    const from = [backX - 0.04 * s, j.spine[1], -0.1 * s],
      to = [backX - 0.06 * s, shoulderY + 0.08 * s, 0.1 * s];
    push("quiver", tubeSurface([{ p: from, r: 0.04 * s }, { p: lerp(from, to, 0.5), r: 0.044 * s }, { p: to, r: 0.046 * s }], { around: 12, color: (ring) => (ring === 1 ? dark : rgb) }));
    for (let k = 0; k < 4; k++) {
      const base = add(to, [0, 0.0, (k - 1.5) * 0.018 * s]);
      const tip = add(base, scale(unit(sub(to, from)), 0.09 * s));
      push(`arrow-${k}`, tubeSurface([{ p: base, r: 0.004 * s }, { p: tip, r: 0.004 * s }], { around: 5, color: () => rgbOf("#b08a5c") }));
      parts.push({ id: `fletch-${k}`, bone: "chest", shape: "ellipsoid", segments: 8, position: tip, rotation: aim(unit(sub(to, from))), scale: [0.03 * s, 0.012 * s, 0.003 * s], color: k % 2 ? [0.95, 0.92, 0.85] : rgbOf(spec.topAccent) });
    }
    push("quiver-strap", tubeSurface([from, [0.1 * s * g, j.chest[1], 0.0], [0.04, shoulderY + 0.03 * s, -0.08 * s], to].map((p) => ({ p, r: [0.005 * s, 0.012 * s] })), { around: 6, up: [1, 0, 0], color: () => leather }));
  }
  return { parts, joints: {} };
}

/** Earrings hanging from the lobes, in the jewellery metal. */
function earrings(spec, head) {
  const kind = spec.earrings;
  if (kind === "none") return [];
  const size = head.size;
  const metal = rgbOf(spec.jewelColor);
  const parts = [];
  for (const s of [-1, 1]) {
    const lobe = head.offset(s * (head.ear.yaw - 0.06), head.ear.pitch - 0.3, 0.008 * size);
    if (kind === "studs") parts.push({ id: `earring-${s}`, bone: "head", shape: "ellipsoid", segments: 10, position: lobe, rotation: [0, 0, 0], scale: [0.005 * size, 0.005 * size, 0.005 * size], color: metal });
    if (kind === "hoops") parts.push(meshPart(`earring-${s}`, "head", tubeSurface(loopRings(18, (t) => add(lobe, [Math.sin(t * TAU) * 0.014 * size, -0.014 * size + Math.cos(t * TAU) * 0.014 * size, s * 0.003 * size]), 0.0018 * size), { around: 5, closed: true, color: () => metal })));
    if (kind === "drops") {
      parts.push({ id: `earring-${s}`, bone: "head", shape: "ellipsoid", segments: 10, position: lobe, rotation: [0, 0, 0], scale: [0.003 * size, 0.003 * size, 0.003 * size], color: metal });
      parts.push({ id: `earring-drop-${s}`, bone: "head", shape: "ellipsoid", segments: 12, position: add(lobe, [0, -0.02 * size, s * 0.002 * size]), rotation: [0, 0, 0], scale: [0.006 * size, 0.011 * size, 0.006 * size], color: rgbOf(spec.topAccent) });
    }
  }
  return parts;
}

/**
 * Everything worn that is not clothing: eyewear, neckwear, what hangs on the back, and earrings.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 */
export function accessories(spec, j, m, head) {
  const back = backwear(spec, j, m);
  return { parts: [...eyewear(spec, head), ...neckwear(spec, j, m), ...back.parts, ...earrings(spec, head)], joints: back.joints };
}

void luminance;
