import { gridSurface, meshPart, tubeSurface, add, mix, scale, sub, unit, smooth } from "./surface.js";
import { wrapYaw } from "./headShape.js";
import { hairProfile } from "./characterHair.js";
import { rgbOf, shade, mixRgb } from "./characterColors.js";
import { aim } from "./characterEyes.js";

const TAU = Math.PI * 2;

/** A rim line round the head through its height at the front, the sides and the back. */
const rim = (front, side, back) => (yaw) => {
  const c = Math.cos(wrapYaw(yaw));
  return c >= 0 ? mix(side, front, c) : mix(side, back, -c);
};

/** Headwear that covers the crown: its rim and how thick the shell stands. Bands and crowns sit on the hair instead. */
const shells = {
  cap: { line: rim(0.36, 0.2, 0.02), thick: 0.006 },
  beanie: { line: rim(0.32, 0.04, -0.22), thick: 0.009 },
  helmet: { line: rim(0.3, 0.02, -0.24), thick: 0.013 },
  aviator: { line: rim(0.3, -0.62, -0.42), thick: 0.008 },
  sunHat: { line: rim(0.3, 0.16, -0.04), thick: 0.006 },
  wizard: { line: rim(0.3, 0.14, -0.04), thick: 0.006 },
  bandana: { line: rim(0.34, 0.08, -0.26), thick: 0.0035 },
  horns: { line: rim(0.3, 0.02, -0.24), thick: 0.012 },
};

/**
 * The line under which headwear presses the hair, and the room the hair keeps beneath it, or null
 * when nothing covers the crown.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {import("./headShape.js").HeadShape} head
 */
export function hatLine(spec, head) {
  const shell = shells[spec.hat];
  if (!shell) return null;
  const room = spec.hair === "bald" ? 0.001 : spec.hair === "buzz" || spec.hair === "mohawk" ? 0.004 * head.size : 0.012 * head.size;
  return { line: shell.line, room, thick: shell.thick };
}

/** A shell over the head from its crown down to `line(yaw)`, `out(yaw, pitch)` off the skin. */
function shellOver(head, line, out, color, { columns = 72, rows = 22 } = {}) {
  const grid = [];
  for (let r = 0; r <= rows; r++) {
    const row = [];
    for (let i = 0; i < columns; i++) {
      const yaw = (i / columns) * TAU;
      const pitch = mix(Math.PI / 2, line(yaw), (r / rows) ** 0.9);
      row.push(r === 0 ? head.offset(0, Math.PI / 2, out(0, Math.PI / 2)) : head.offset(yaw, pitch, out(yaw, pitch)));
    }
    grid.push(row);
  }
  return gridSurface(grid, { color: (r, i) => color(r / rows, ((i + 0.5) / columns) * TAU) });
}

/** A closed band round the head along `line(yaw)`, `out(yaw)` off the skin. */
function band(head, line, out, radii, color, count = 48) {
  const rings = Array.from({ length: count }, (_, k) => {
    const yaw = (k / count) * TAU;
    return { p: head.offset(yaw, line(yaw), out(yaw)), r: radii };
  });
  return tubeSurface(rings, { around: 6, closed: true, color: (ring, seg, angle) => color(ring / count, angle) });
}

/** A flat ring round the rim reaching `width` outwards, drooping `droop` at its edge. */
function brim(head, line, out, width, droop, color, columns = 64) {
  const inner = [],
    outer = [],
    under = [];
  for (let i = 0; i < columns; i++) {
    const yaw = (i / columns) * TAU;
    const p = head.offset(yaw, line(yaw), out(yaw));
    const dir = unit([Math.cos(yaw), 0, Math.sin(yaw)]);
    inner.push(p);
    outer.push(add(add(p, scale(dir, width)), [0, -droop, 0]));
    under.push(add(p, [0, -0.006, 0]));
  }
  const lip = outer.map((p) => add(p, [0, -0.006, 0]));
  return gridSurface([inner, outer, lip, under, inner], { color: (r) => (r >= 2 ? shade(color, 0.8) : color) });
}

/**
 * The headwear on the head bone in its colour: shells sitting on the hair with their brims, cuffs,
 * peaks and straps, or bands, flowers and a crown resting on top of it.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {import("./headShape.js").HeadShape} head
 * @param {ReturnType<typeof hatLine>} hat
 */
export function headwear(spec, head, hat) {
  if (spec.hat === "none") return [];
  const size = head.size;
  const rgb = rgbOf(spec.hatColor);
  const metal = rgbOf(spec.jewelColor);
  const dark = shade(rgb, 0.78);
  const parts = [];
  const free = hairProfile(spec, size, null);
  const onHair = (yaw, pitch, extra = 0) => Math.max(0, free.out(yaw, pitch)) + extra * size;
  const push = (id, mesh) => parts.push(meshPart(id, "head", mesh));
  const sphere = (id, at, radii, color, rotation = [0, 0, 0]) => parts.push({ id, bone: "head", shape: "ellipsoid", segments: 14, position: at, rotation, scale: radii.map((r) => r * size), color });
  if (hat) {
    const out = (yaw, pitch) => hat.room + hat.thick * size * (0.6 + 0.4 * smooth(hat.line(yaw), hat.line(yaw) + 0.3, pitch));
    const rimOut = (yaw) => out(yaw, hat.line(yaw));
    const kind = spec.hat;
    const panel = (t, yaw) => (kind === "helmet" || kind === "cap") && Math.abs(Math.sin(yaw * 3)) < 0.06 && t < 0.85 ? dark : rgb;
    push(`hat-${kind}`, shellOver(head, hat.line, kind === "sunHat" ? (y, p) => out(y, p) + 0.022 * size * smooth(0.6, 1.3, p) : out, (t, yaw) => (kind === "bandana" && t > 0.85 ? dark : panel(t, yaw))));
    if (kind === "cap" || kind === "helmet") {
      const front = head.offset(0, hat.line(0), rimOut(0));
      const n = unit(add(head.normal(0, hat.line(0)), [0.5, -0.4, 0]));
      sphere("hat-peak", add(front, scale(n, 0.04 * size)), [0.052, 0.007, kind === "cap" ? 0.085 : 0.07], kind === "cap" ? rgb : dark, aim(n));
      sphere("hat-button", head.offset(0, Math.PI / 2, out(0, Math.PI / 2)), [0.012, 0.008, 0.012], dark);
    }
    if (kind === "beanie") {
      push("hat-cuff", band(head, (y) => hat.line(y) + 0.06, (y) => rimOut(y) + 0.008 * size, [0.012 * size, 0.034 * size], (t) => (Math.floor(t * 48) % 2 ? dark : shade(rgb, 0.85))));
      sphere("hat-pompom", head.offset(-0.4, 1.45, out(0, Math.PI / 2) + 0.02 * size), [0.034, 0.032, 0.034], shade(rgb, 1.25));
    }
    if (kind === "helmet" || kind === "horns" || kind === "aviator") {
      if (kind !== "aviator") push("hat-strap", tubeSurface(strapPath(head, size), { around: 5, color: () => [0.16, 0.13, 0.12] }));
    }
    if (kind === "aviator") {
      push("hat-fleece", band(head, hat.line, (y) => rimOut(y) + 0.004 * size, [0.012 * size, 0.012 * size], () => [0.94, 0.89, 0.8]));
      parts.push(...goggles(head, out(0, 0.62) + 0.006 * size, 0.62, [0.32, 0.36, 0.4], rgbOf(spec.lensColor ?? "#e3a33c")));
    }
    if (kind === "sunHat") {
      push("hat-brim", brim(head, hat.line, (y) => rimOut(y), 0.11 * size, 0.025 * size, rgb));
      push("hat-ribbon", band(head, (y) => hat.line(y) + 0.06, (y) => out(y, hat.line(y) + 0.06) + 0.004 * size, [0.016 * size, 0.004 * size], () => rgbOf(spec.topAccent)));
    }
    if (kind === "wizard") {
      push("hat-brim", brim(head, hat.line, (y) => rimOut(y), 0.12 * size, 0.012 * size, rgb));
      const base = head.offset(0, Math.PI / 2, out(0, Math.PI / 2));
      const cone = [];
      for (let k = 0; k <= 10; k++) {
        const t = k / 10;
        cone.push({ p: add(base, [-0.11 * size * t * t, 0.3 * size * t - 0.06 * size, 0]), r: mix(0.105, 0.004, t ** 0.85) * size });
      }
      push("hat-cone", tubeSurface(cone, { around: 16, color: (ring) => (ring === 1 ? rgbOf(spec.topAccent) : rgb) }));
      sphere("hat-star", add(base, [-0.05 * size, 0.1 * size, 0.07 * size]), [0.012, 0.012, 0.004], [0.98, 0.85, 0.35], [0, 0, 0.4]);
    }
    if (kind === "bandana") {
      const knot = head.offset(Math.PI, hat.line(Math.PI) + 0.08, rimOut(Math.PI) + 0.01 * size);
      sphere("hat-knot", knot, [0.02, 0.022, 0.026], dark);
      for (const s of [-1, 1]) push(`hat-tail-${s}`, tubeSurface([{ p: knot, r: [0.004 * size, 0.022 * size] }, { p: add(knot, [-0.03 * size, -0.06 * size, s * 0.02 * size]), r: [0.003 * size, 0.018 * size] }, { p: add(knot, [-0.035 * size, -0.09 * size, s * 0.03 * size]), r: [0.002 * size, 0.004 * size] }], { around: 6, up: [1, 0, 0], color: () => rgb }));
    }
    if (kind === "horns") {
      push("hat-rim", band(head, hat.line, (y) => rimOut(y) + 0.003 * size, [0.01 * size, 0.012 * size], () => metal));
      for (const s of [-1, 1]) {
        const root = head.offset(s * 1.35, 0.65, out(s * 1.35, 0.65) - 0.004 * size);
        const path = [root, add(root, [0, 0.03 * size, s * 0.07 * size]), add(root, [0.02 * size, 0.1 * size, s * 0.11 * size]), add(root, [0.05 * size, 0.17 * size, s * 0.1 * size])];
        push(`hat-horn-${s}`, tubeSurface(path.map((p, k) => ({ p, r: mix(0.032, 0.004, k / 3) * size })), { around: 10, color: () => [0.95, 0.9, 0.78] }));
      }
    }
    return parts;
  }
  const kind = spec.hat;
  if (kind === "headband" || kind === "flowers" || kind === "catEars") {
    const line = rim(0.6, 0.15, -0.1);
    push("hat-band", band(head, line, (y) => onHair(y, line(y), 0.004), [0.006 * size, 0.012 * size], () => (kind === "flowers" ? [0.36, 0.55, 0.28] : rgb)));
    if (kind === "flowers") {
      const petals = [rgb, [0.98, 0.95, 0.9], shade(rgb, 1.3), [0.98, 0.82, 0.4]];
      for (let k = 0; k < 9; k++) {
        const yaw = mix(-1.9, 1.9, k / 8);
        const pitch = line(yaw);
        const at = head.offset(yaw, pitch, onHair(yaw, pitch, 0.012));
        const n = head.normal(yaw, pitch);
        const c = petals[k % petals.length];
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * TAU;
          const side = unit(sub([Math.cos(yaw + Math.PI / 2), 0, Math.sin(yaw + Math.PI / 2)], scale(n, 0)));
          const off = add(scale(side, Math.cos(a) * 0.011 * size), [0, Math.sin(a) * 0.011 * size, 0]);
          sphere(`hat-petal-${k}-${p}`, add(at, off), [0.004, 0.009, 0.009], c, aim(n));
        }
        sphere(`hat-heart-${k}`, add(at, scale(n, 0.003 * size)), [0.006, 0.006, 0.006], [0.98, 0.78, 0.3]);
      }
    }
    if (kind === "catEars")
      for (const s of [-1, 1]) {
        const yaw = s * 0.95,
          pitch = line(yaw) + 0.02;
        const root = head.offset(yaw, pitch, onHair(yaw, pitch, 0.002));
        const n = head.normal(yaw, pitch);
        const tip = add(root, add(scale(n, 0.075 * size), [0, 0.02 * size, 0]));
        push(`hat-ear-${s}`, tubeSurface([0, 0.35, 0.7, 1].map((t) => ({ p: add(root, scale(sub(tip, root), t)), r: [mix(0.012, 0.002, t) * size, mix(0.036, 0.003, t) * size] })), { around: 10, up: [1, 0, 0], color: (ring, seg, angle) => (Math.cos(angle) > 0.5 && ring < 2 ? [0.95, 0.66, 0.7] : rgb) }));
      }
  }
  if (kind === "beret") {
    const top = head.offset(0.5, 1.3, onHair(0.5, 1.3, 0.006));
    sphere("hat-beret", add(top, [-0.01 * size, -0.004 * size, 0.012 * size]), [0.11, 0.032, 0.105], rgb, [0.35, 0, -0.12]);
    sphere("hat-stem", add(top, [-0.005 * size, 0.026 * size, 0.024 * size]), [0.005, 0.012, 0.005], dark, [0.35, 0, 0]);
  }
  if (kind === "crown") {
    const line = () => 0.95;
    const out = (y) => onHair(y, 0.95, 0.002);
    push("hat-crown", band(head, line, out, [0.016 * size, 0.008 * size], () => metal, 40));
    for (let k = 0; k < 8; k++) {
      const yaw = (k / 8) * TAU;
      const base = head.offset(yaw, 0.95, out(yaw));
      const n = head.normal(yaw, 0.95);
      const tip = add(base, add(scale(n, 0.01 * size), [0, 0.045 * size, 0]));
      push(`hat-point-${k}`, tubeSurface([{ p: add(base, [0, -0.012 * size, 0]), r: 0.012 * size }, { p: tip, r: 0.002 * size }], { around: 6, color: () => metal }));
      sphere(`hat-jewel-${k}`, add(tip, [0, 0.003 * size, 0]), [0.006, 0.006, 0.006], k % 2 ? [0.85, 0.2, 0.3] : [0.3, 0.55, 0.95]);
    }
  }
  return parts;
}

/** A chin strap from one temple, under the chin, to the other. */
function strapPath(head, size) {
  const rings = [];
  for (let k = 0; k <= 14; k++) {
    const t = k / 14;
    const s = t < 0.5 ? -1 : 1;
    const u = Math.abs(t - 0.5) * 2;
    const yaw = s * mix(0.2, 1.5, u);
    const pitch = mix(-1.32, -0.05, u ** 1.4);
    rings.push({ p: head.offset(yaw, pitch, 0.004 * size), r: [0.0025 * size, 0.005 * size] });
  }
  return rings;
}

/** Goggles pushed up on the brow at `pitch`, `out` off the skin: two lenses in their frames on a strap. */
export function goggles(head, out, pitch, frame, lens) {
  const size = head.size;
  const parts = [];
  for (const s of [-1, 1]) {
    const yaw = s * 0.36;
    const at = head.offset(yaw, pitch, out + 0.006 * size);
    const n = head.normal(yaw, pitch);
    parts.push({ id: `goggle-frame-${s}`, bone: "head", shape: "ellipsoid", segments: 14, position: at, rotation: aim(n), scale: [0.012 * size, 0.026 * size, 0.03 * size], color: frame });
    parts.push({ id: `goggle-lens-${s}`, bone: "head", shape: "ellipsoid", segments: 14, position: add(at, scale(n, 0.006 * size)), rotation: aim(n), scale: [0.008 * size, 0.02 * size, 0.024 * size], color: lens });
  }
  parts.push(meshPart("goggle-strap", "head", band(head, () => pitch, () => out, [0.004 * size, 0.012 * size], () => [0.2, 0.18, 0.17])));
  return parts;
}

void mixRgb;
