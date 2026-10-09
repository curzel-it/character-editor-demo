import { gridSurface, meshPart, tubeSurface, add, mix, scale, sub, unit } from "./surface.js";
import { headRows, rowAngles, wrapYaw } from "./headShape.js";
import { rgbOf, shade, mixRgb } from "./characterColors.js";
import { aim } from "./characterEyes.js";

const GRID = { columns: 64, rows: 40 };

/**
 * The skin of the head as one smooth surface on the head bone, shaded faintly darker under the jaw;
 * `paint(yaw, pitch)` may return a colour laid over the skin there (stubble, a scar).
 * @param {import("./headShape.js").HeadShape} head
 * @param {number[]} skin
 * @param {(yaw: number, pitch: number) => number[] | null} [paint]
 */
export function headSkin(head, skin, paint) {
  const rows = headRows(head, GRID);
  const under = shade(skin, 0.93);
  const mesh = gridSurface(rows, {
    color: (j, i) => {
      const [yaw, pitch] = rowAngles(j + 0.5, i + 0.5, GRID);
      const painted = paint?.(wrapYaw(yaw), pitch);
      if (painted) return painted;
      return pitch < -1.1 ? under : skin;
    },
  });
  return meshPart("head-skin", "head", mesh);
}

/**
 * The ears at the sides of the head, unless `hidden` (long hair over them): a round shell with a
 * darker hollow, small or big, or a pointed, elf or droopy blade swept back.
 * @param {import("./headShape.js").HeadShape} head
 * @param {import("./characterSpec.js").CharacterSpec} spec
 */
export function characterEars(head, spec, hidden = false) {
  if (hidden) return [];
  const skin = rgbOf(spec.skin);
  const inner = mixRgb(shade(skin, 0.82), [0.85, 0.45, 0.45], 0.18);
  const size = head.size;
  const parts = [];
  for (const s of [-1, 1]) {
    const yaw = s * head.ear.yaw,
      pitch = head.ear.pitch;
    const root = head.offset(yaw, pitch, -0.004 * size);
    const out = head.normal(yaw, pitch);
    const back = [-1, 0, 0];
    const style = spec.ears;
    if (style === "round" || style === "small" || style === "big") {
      const k = style === "small" ? 0.78 : style === "big" ? 1.32 : 1;
      const centre = add(root, add(scale(out, 0.008 * size * k), scale(back, 0.004 * size)));
      const turn = aim(unit(add(out, [0.35, 0, 0])), 0);
      parts.push({ id: `ear-${s}`, bone: "head", shape: "ellipsoid", segments: 14, position: centre, rotation: turn, scale: [0.008 * size * k, 0.026 * size * k, 0.019 * size * k], color: skin });
      parts.push({ id: `ear-hollow-${s}`, bone: "head", shape: "ellipsoid", segments: 12, position: add(centre, add(scale(out, 0.0045 * size * k), [0.002 * size, 0, 0])), rotation: turn, scale: [0.004 * size * k, 0.016 * size * k, 0.011 * size * k], color: inner });
      continue;
    }
    const reach = style === "elf" ? 2 : style === "droopy" ? 1.7 : 1.15;
    const rise = style === "droopy" ? -0.5 : style === "elf" ? 0.55 : 0.85;
    const tipDir = unit(add(add(scale(out, 1), scale(back, 0.7)), [0, rise, 0]));
    const rings = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const p = add(root, scale(tipDir, 0.05 * size * reach * t));
      const width = 0.019 * size * Math.sin(Math.PI * (0.25 + 0.75 * t)) ** 0.7 * (1 - t * 0.85) + 0.0015 * size;
      rings.push({ p: add(p, scale(out, 0.004 * size * Math.sin(t * Math.PI))), r: [0.0055 * size * (1 - t * 0.6), width] });
    }
    parts.push(meshPart(`ear-${s}`, "head", tubeSurface(rings, { around: 10, up: out, color: (ring, seg, angle) => (Math.cos(angle) > 0.6 && ring > 0 && ring < 5 ? inner : skin) })));
  }
  return parts;
}

/** The angles of the cheek's centre on side `s`. */
export const cheekAt = (head, s) => [s * (head.eye.yaw + 0.12), head.eye.pitch - 0.42];

/**
 * Marks laid on the face as thin decals: blush, freckles, a beauty mark, war paint, dots, a scar, a
 * star or a swirl. Each sits on the surface, turned to its normal.
 * @param {import("./headShape.js").HeadShape} head
 * @param {import("./characterSpec.js").CharacterSpec} spec
 */
export function faceMarks(head, spec) {
  const skin = rgbOf(spec.skin);
  const paint = rgbOf(spec.markColor);
  const size = head.size;
  const parts = [];
  const decal = (id, yaw, pitch, radii, color, roll = 0, lift = 0.0006) => {
    const n = head.normal(yaw, pitch);
    parts.push({ id, bone: "head", shape: "ellipsoid", segments: 12, position: head.offset(yaw, pitch, lift * size), rotation: aim(n, roll), scale: [0.0016 * size, radii[0] * size, radii[1] * size], color });
  };
  const cheeks = spec.cheekMarks;
  for (const s of [-1, 1]) {
    const [cy, cp] = cheekAt(head, s);
    if (cheeks === "blush" || cheeks === "both") decal(`blush-${s}`, cy, cp, [0.011, 0.019], mixRgb(skin, [0.95, 0.42, 0.45], 0.42), 0, 0.0002);
    if (cheeks === "freckles" || cheeks === "both")
      for (const [k, [dy, dp]] of [[-0.12, 0.06], [-0.04, 0.09], [0.05, 0.07], [0.12, 0.03], [-0.08, -0.01], [0.01, 0.0], [0.09, -0.04], [-0.02, -0.07]].entries())
        decal(`freckle-${s}-${k}`, cy + dy * s - 0.04 * s, cp + dp + 0.08, [0.0024, 0.0024], shade(skin, 0.7), 0, 0.0009);
  }
  const mark = spec.marking;
  if (mark === "mole") decal("mole", 0.22, head.mouth.pitch + 0.1, [0.0028, 0.0028], [0.22, 0.13, 0.1], 0, 0.001);
  if (mark === "stripes")
    for (const s of [-1, 1])
      for (const k of [0, 1]) {
        const [cy, cp] = cheekAt(head, s);
        decal(`paint-${s}-${k}`, cy + s * 0.07, cp + 0.05 - k * 0.11, [0.0045, 0.024], paint, Math.PI / 2 - s * 0.25, 0.0012);
      }
  if (mark === "dots")
    for (const s of [-1, 1])
      for (const k of [0, 1, 2]) decal(`dot-${s}-${k}`, s * (head.eye.yaw + 0.38), head.eye.pitch - 0.06 - k * 0.12 + k * k * 0.01, [0.0042, 0.0042], paint, 0, 0.0012);
  if (mark === "scar") {
    const [cy, cp] = [-(head.eye.yaw + 0.02), head.eye.pitch];
    decal("scar", cy, cp, [0.0022, 0.03], mixRgb(skin, [0.85, 0.5, 0.5], 0.55), 0.35, 0.0012);
    for (const k of [-1, 0, 1]) decal(`scar-stitch-${k}`, cy + k * 0.02 * Math.cos(0.35) - 0.0, cp + k * 0.06, [0.009, 0.0016], mixRgb(skin, [0.85, 0.5, 0.5], 0.45), 0.35, 0.0016);
  }
  if (mark === "star") {
    const [cy, cp] = cheekAt(head, 1);
    for (const k of [0, 1, 2, 3, 4]) decal(`star-${k}`, cy + 0.03, cp + 0.12, [0.0028, 0.012], paint, (k / 5) * Math.PI, 0.0012);
  }
  if (mark === "tattoo") {
    const [cy, cp] = cheekAt(head, -1);
    for (let k = 0; k < 7; k++) {
      const a = k * 0.85;
      const r = 0.012 + k * 0.012;
      decal(`swirl-${k}`, cy - 0.12 + Math.cos(a) * r, cp + 0.16 + Math.sin(a) * r, [0.0024, 0.0085], paint, a + Math.PI / 2, 0.0012);
    }
  }
  return parts;
}

void sub;
void mix;
