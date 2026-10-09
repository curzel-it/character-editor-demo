import { palette, tint } from "../palette.js";
import { silksRgb } from "./jockeySilks.js";
import { createRiderLook, riderLookParts } from "./riderLook.js";
import { tube, loop } from "./riderMesh.js";
import { jacketPaint } from "./silksPattern.js";
import { headFrame } from "./riderHeadFrame.js";
import { riderHead } from "./riderHead.js";
import { riderHair } from "./riderHair.js";
import { coveringHats, riderHeadwear } from "./riderHeadwear.js";

const add = (a, b) => a.map((v, i) => v + b[i]);
const sub = (a, b) => a.map((v, i) => v - b[i]);
const scale = (a, k) => a.map((v) => v * k);
const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const unit = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const mirror = (p, side) => [p[0], p[1], p[2] * side];
const luminance = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;
const HEAD = 1.12;

/**
 * A rider's pose in metres (+X forward, +Y up, +Z to one side; limbs mirrored to the other):
 * the joints, `pelvis` and `nape` along the spine, `tilt` the head's forward tip in radians,
 * `trail` the way loose hair and scarves fall or stream, and `goggles` up on the brow or down over the eyes.
 * @typedef {{ hip: number[], knee: number[], ankle: number[], toe: number[], shoulder: number[], elbow: number[],
 *   wrist: number[], head: number[], pelvis: number[], nape: number[], tilt: number, trail: number[], goggles?: "up" | "down" }} RiderPose
 */

/** Rings along a polyline, subdivided so patterns have enough bands. */
function rings(keys, steps) {
  const out = [];
  for (let k = 0; k < keys.length - 1; k++)
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const [a, b] = [keys[k], keys[k + 1]];
      out.push({ p: lerp(a.p, b.p, t), r: lerp(a.r, b.r, t) });
    }
  out.push(keys.at(-1));
  return out;
}

/** A gloved hand from the wrist along the forearm's line: cuff, palm, closed fingers and a thumb. */
function glove(id, wrist, elbow, rgb, { rigid, shape }) {
  const dir = unit(sub(wrist, elbow));
  const along = (d) => add(wrist, scale(dir, d));
  const up = Math.abs(dir[1]) > 0.7 ? [0, 0, 1] : [0, 1, 0];
  rigid(id, tube([
    { p: along(-0.05), r: 0.026 },
    { p: along(0.004), r: [0.03, 0.036] },
    { p: along(0.05), r: [0.033, 0.044] },
    { p: along(0.09), r: [0.03, 0.04] },
    { p: along(0.115), r: [0.016, 0.022] },
  ], { segments: 8, up, color: () => rgb }));
  const thumbSide = Math.abs(dir[1]) > 0.7 ? [0.03, 0, 0] : [0, 0.026, 0];
  shape(`${id}-thumb`, "ellipsoid", add(along(0.045), thumbSide), [0.018, 0.018, 0.018], rgb);
}

/** A scarf in the silks' accent round the neck, knotted in front, its tails short or streaming along `trail`. */
function scarf(style, at, trail, rgb, girth, { rigid, shape }) {
  if (style === "none") return;
  rigid("scarf", tube(loop(at, [1, 0, 0], [0, 0, 1], 0.078 * girth, 0.08 * girth, 12).map((p) => ({ p, r: [0.026, 0.03] })), { segments: 6, closed: true, color: () => rgb }));
  const knot = add(at, [0.07 * girth, -0.02, 0.03]);
  shape("scarf-knot", "ellipsoid", knot, [0.03, 0.032, 0.03], rgb);
  const length = style === "long" ? 0.55 : 0.16;
  const fall = style === "long" ? unit(trail) : [0.15, -1, 0];
  for (const [k, spread] of [[0, 0.04], [1, -0.03]]) {
    const wave = (d) => [0, Math.sin(d * 9 + k) * 0.02, spread + Math.sin(d * 7 + k * 2) * 0.03];
    const keys = [0, 0.25, 0.5, 0.75, 1].map((s) => ({ p: add(add(knot, scale(fall, s * length)), wave(s * length)), r: [0.008, 0.035 - s * 0.008] }));
    rigid(`scarf-tail-${k}`, tube(keys, { segments: 4, up: [1, 0, 0], color: () => rgb }));
  }
}

/**
 * The rider's body in its silks and look, posed by `pose`: breeches shaped round the seat with the
 * jacket tucked in under a belt, boots, sleeves and gloves, the jacket's collar, the neck and scarf, then the head with its face,
 * hair, headwear and goggles. `rigid(id, mesh)` and `shape(id, kind, position, scale, color, rotation)` place parts in the pose's frame.
 * @param {RiderPose} pose
 * @param {import("./createJockey.js").Rider} jockey
 */
export function riderBody(pose, jockey, { rigid, shape }) {
  const colors = silksRgb(jockey.silks);
  const look = riderLookParts(jockey.look ?? createRiderLook(jockey.seed), colors.accent);
  const b = look.build;
  const g = b.girth;
  const plain = (rgb) => () => rgb;
  const { pelvis, nape } = pose;
  const spine = unit(sub(nape, pelvis));
  const back = [-spine[1], spine[0], 0];
  const along = (t, lift = 0) => add(lerp(pelvis, nape, t), scale(back, lift));
  const cuff = luminance(look.boots) < 0.3 ? tint(look.boots, 2.6) : tint(look.boots, 0.72);

  const front = scale(back, -1);
  const toward = (dir, to) => Math.max(0, dir[0] * to[0] + dir[1] * to[1] + dir[2] * to[2]);
  const hipWidth = (1 + (g - 1) * 0.7) * Math.max(b.hips, b.waist);
  const hipDepth = g * Math.max(1, 1 + (b.waist - 1) * 0.5);
  const curve = b.hips * (1 + (g - 1) * 0.6);
  rigid("breeches", tube([
    [0.3, 0.104, 0.142],
    [0.18, 0.106, 0.146],
    [0.1, 0.098, 0.136],
    [0.04, 0.08, 0.11],
    [-0.02, 0.045, 0.06],
  ].map(([t, depth, width]) => ({ p: along(t), r: [depth * hipDepth, width * hipWidth] })), { segments: 16, color: plain(look.breeches) }));
  const waist = along(0.29);
  rigid("belt", tube(loop(waist, back, [0, 0, 1], 0.104 * hipDepth + 0.008, 0.142 * hipWidth + 0.008, 16).map((p) => ({ p, r: [0.022, 0.008] })), { segments: 4, closed: true, color: plain(palette.dark) }));
  shape("buckle", "box", add(waist, scale(front, 0.104 * hipDepth + 0.016)), [0.008, 0.022, 0.028], palette.gold, [0, 0, Math.atan2(spine[0], spine[1]) * -1]);

  for (const side of [-1, 1]) {
    const m = (p) => mirror(p, side);
    const shin = unit(sub(pose.ankle, pose.knee));
    const thigh = unit(sub(pose.knee, pose.hip));
    const cheek = unit(add(back, [0, 0, -0.25 * side]));
    /** The glute pushing the leg out behind, `amount` how far, and `flat` how much the front gives way. */
    const glute = (amount, flat = 0) => (dir) => 1 + amount * curve * toward(dir, cheek) ** 1.6 - flat * toward(dir, front) ** 2;
    const top = add(pelvis, add(scale(spine, 0.1), [0, 0, 0.05 * hipWidth]));
    const seat = add(lerp(top, add(pose.hip, [0, 0, -0.015]), 0.7), scale(spine, -0.05));
    const legWidth = (1 + (b.thighs - 1) * 0.7) * g;
    const upper = Math.max(legWidth, hipWidth * 0.97);
    rigid(`thigh-${side}`, tube([
      { p: m(top), r: 0.074 * upper, swell: glute(0.04, 0.1) },
      { p: m(lerp(top, seat, 0.5)), r: 0.088 * upper, swell: glute(0.24, 0.08) },
      { p: m(seat), r: 0.094 * upper, swell: glute(0.38, 0.05) },
      { p: m(lerp(pose.hip, pose.knee, 0.2)), r: 0.087 * (upper + legWidth) / 2, swell: glute(0.16) },
      { p: m(lerp(pose.hip, pose.knee, 0.34)), r: 0.08 * legWidth, swell: glute(0.04) },
      { p: m(lerp(pose.hip, pose.knee, 0.6)), r: 0.071 * g * (1 + (b.thighs - 1) * 0.5) },
      { p: m(lerp(pose.hip, pose.knee, 0.84)), r: 0.06 * g },
      { p: m(pose.knee), r: 0.056 * g },
      { p: m(add(pose.knee, scale(shin, 0.12))), r: 0.052 * g },
    ], { segments: 16, color: plain(look.breeches) }));
    shape(`knee-${side}`, "ellipsoid", m(add(pose.knee, scale(unit(sub(thigh, shin)), 0.006))), scale([0.058, 0.058, 0.056], g), look.breeches);
    rigid(`boot-${side}`, tube([
      { p: m(add(pose.knee, scale(shin, 0.07))), r: 0.068 * g },
      { p: m(add(pose.knee, scale(shin, 0.15))), r: 0.066 * g },
      { p: m(add(pose.knee, scale(shin, 0.155))), r: 0.058 * g },
      { p: m(lerp(pose.knee, pose.ankle, 0.55)), r: 0.054 * g },
      { p: m(pose.ankle), r: 0.046 },
    ], { segments: 10, color: (band) => (band === 0 ? cuff : look.boots) }));
    const toeward = unit(sub(pose.toe, pose.ankle));
    rigid(`foot-${side}`, tube([
      { p: m(add(pose.ankle, scale(toeward, -0.05))), r: [0.04, 0.042] },
      { p: m(add(pose.ankle, scale(toeward, 0.02))), r: [0.05, 0.046] },
      { p: m(lerp(pose.ankle, pose.toe, 0.75)), r: [0.036, 0.046] },
      { p: m(add(pose.toe, scale(toeward, 0.03))), r: [0.026, 0.036] },
      { p: m(add(pose.toe, scale(toeward, 0.055))), r: [0.01, 0.018] },
    ], { segments: 8, color: plain(look.boots) }));
    const shoulder = m(add(pose.shoulder, [-0.01, 0.0, -0.02 + 0.1 * (b.shoulders - 1)]));
    shape(`shoulder-${side}`, "ellipsoid", shoulder, scale([0.06, 0.054, 0.058], g * b.arms), colors.sleeves);
    rigid(`sleeve-${side}`, tube([
      { p: shoulder, r: 0.054 * g * b.arms },
      { p: m(lerp(pose.shoulder, pose.elbow, 0.55)), r: 0.05 * g * b.arms },
      { p: m(pose.elbow), r: 0.045 * g * b.arms },
      { p: m(lerp(pose.elbow, pose.wrist, 0.6)), r: 0.041 * g },
      { p: m(lerp(pose.elbow, pose.wrist, 0.86)), r: 0.039 * g },
      { p: m(lerp(pose.elbow, pose.wrist, 0.96)), r: 0.041 * g },
    ], { segments: 8, color: (band) => (band === 4 ? colors.accent : colors.sleeves) }));
    glove(`hand-${side}`, m(pose.wrist), m(pose.elbow), look.gloves, { rigid, shape });
  }

  const widths = [b.waist, b.waist, b.waist, b.chest, b.shoulders, b.shoulders, b.neck];
  const depths = [1, 1, 1 + (b.waist - 1) * 0.5, b.bust, b.bust * 0.9 + 0.1, 1, b.neck];
  const torsoKeys = [
    { p: along(0.18), r: [0.098, 0.134] },
    { p: along(0.28), r: [0.102, 0.138] },
    { p: along(0.4), r: [0.11, 0.142] },
    { p: along(0.62), r: [0.128, 0.162] },
    { p: along(0.8), r: [0.132, 0.186] },
    { p: along(0.93), r: [0.104, 0.19] },
    { p: along(1), r: [0.052, 0.076] },
  ].map((k, i) => ({ ...k, r: [k.r[0] * g * depths[i], k.r[1] * (1 + (g - 1) * 0.7) * widths[i]] }));
  const torso = rings(torsoKeys, 3);
  const bands = torso.length - 1;
  const jacket = jacketPaint(jockey.silks.pattern, colors);
  rigid("jacket", tube(torso, { segments: 12, color: (band, _, angle) => jacket(band / (bands - 1), angle) }));
  const neckWidth = 0.05 * g * b.neck;
  rigid("jacket-collar", tube(loop(along(0.985), back, [0, 0, 1], neckWidth + 0.012, neckWidth + 0.018, 12).map((p) => ({ p, r: [0.012, 0.008] })), { segments: 4, closed: true, color: plain(colors.third) }));

  const head = headFrame(pose.head, pose.tilt, { rigid, shape }, tube, HEAD);
  rigid("neck", tube([{ p: along(0.9), r: neckWidth * 1.05 }, { p: head.at([-0.03, -0.09, 0]), r: neckWidth }], { segments: 8, color: plain(look.skin) }));
  scarf(look.scarf, along(1), pose.trail, colors.accent, g * b.neck, { rigid, shape });
  riderHead(head, look, colors.accent);
  riderHair(head, look.hair, look.hairRgb, pose.trail, coveringHats.has(look.hat));
  riderHeadwear(head, look, colors, jockey.silks.pattern, pose.trail, pose.goggles !== "up");
  return { along, back };
}
