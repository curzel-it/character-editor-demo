import { boneMatrices, point, transform } from "../math3d.js";
import { apply, euler, frame, originOf, rotationOf, times, transpose } from "../mat3.js";
import { standHeight } from "../race/landing.js";
import { racerFrame } from "../scene/racerFrame.js";
import { mouthPoint } from "../breath/mouthPoint.js";
import { add, normalize, scale, sub } from "../vec3.js";
import { smoothstep } from "./flightMotion.js";
import { handLows, plantHands } from "./dragonHandPlant.js";
import { foldStance } from "./dragonWingFold.js";
import { plantFeet } from "./dragonFootPlant.js";
import { clearTail, rests } from "./dragonLanding.js";

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, k) => a + (b - a) * k;
const UP = [0, 1, 0];
const NECK = ["neck-0", "neck-1", "neck-2", "head"];

// Shares of the standing root height the body sinks by crouching and by the thrust of the breath.
// Wings folded to the flanks would sink through the ground, so younger dragons crouch less deep.
const DEPTH = { teen: 0.45, kid: 0.6 };
const DROP = 0.24,
  LUNGE = 0.08;
// The adult braces on the wing hands set wider and further forward, the spars swept a little lower.
const BRACE = {
  reach: [0.5, 0.01, 0.75],
  bend: 0.9,
  pole: [-1, 0, 1],
  hand: [-0.2, -0.2, 0.6],
  fingers: [0.8, -0.5, 0.3],
  spars: [
    [-1, 0.2, 0.15],
    [-1, 0.4, 0],
    [-1, 0.6, -0.2],
  ],
  tuck: [0.15, 0.5],
};
// Neck S while coiled, radians of elevation per segment on top of the strike line.
const COIL = [0.7, 0.05, -0.9];
const SLOPE = 0.45,
  MAX_COIL = 1.6;
// The toe pads below the toe joints, and the head's least height over them, in snout lengths.
const PAD = 0.08,
  CLEAR = 0.9;


/**
 * A world point in the model frame of a dragon whose root stands at `position` facing `forward`
 * (the frame the scene draws it in), for `breathTarget`.
 */
export function modelTarget(anatomy, position, forward, world) {
  const { forward: f, up, left } = racerFrame(forward, 0);
  const d = sub(world, position);
  const at = (axis) => axis[0] * d[0] + axis[1] * d[1] + axis[2] * d[2];
  return add(anatomy.bones[0].position, [at(f), at(up), at(left)]);
}

/** Seconds the whole move takes: stand, crouch, breathe, recover. */
export const groundBreathLength = 7;

/**
 * How far ahead of its root (metres, level) a ground target sits for a full strike: the neck
 * straight out and the mouth a little short of it. Nearer targets keep the neck coiled.
 */
export function strikeDistance(anatomy) {
  const bone = (id) => anatomy.bones.find((b) => b.id === id);
  const neck = ["neck-1", "neck-2", "head"].reduce((sum, id) => sum + Math.hypot(...bone(id).position), 0);
  const jaw = bone("jaw");
  const mouth = point(transform(jaw.position, jaw.rotation), mouthPoint(anatomy));
  return bone("chest").position[0] + bone("neck-0").position[0] + neck + 1.5 * Math.hypot(mouth[0], mouth[1]);
}

/**
 * Motion for the ground breath `age` seconds in: down into the crouch, a coiled beat, the head
 * driven forward with the breath held, then back up to standing. Spread it into `pose`'s motion
 * with a `breathTarget`; `breath` is also the plume's strength.
 */
export function groundBreathCue(age) {
  const crouch = smoothstep(0.5, 1.6, age) * (1 - smoothstep(5.4, 6.6, age));
  const breath = smoothstep(2.0, 2.45, age) * (1 - smoothstep(4.9, 5.4, age));
  return { stand: 1, crouch, breath };
}

/** Thigh and shin pitches that bring each toe base back to `anchors` (model x and y), by Newton steps. */
function keepFeet(bones, anatomy, anchors) {
  const at = (id) => anatomy.bones.findIndex((bone) => bone.id === id);
  const toes = { 1: at("toes-hind-1"), [-1]: at("toes-hind--1") };
  const h = 1e-3;
  const nudge = (joint, delta) => {
    for (const side of [-1, 1]) bones[`${joint}-hind-${side}`].rotation[2] += delta;
  };
  const feet = () => {
    const m = boneMatrices(anatomy, { bones });
    return { 1: originOf(m[toes[1]]), [-1]: originOf(m[toes[-1]]) };
  };
  for (let pass = 0; pass < 6; pass++) {
    const now = feet();
    if ([-1, 1].every((side) => Math.hypot(now[side][0] - anchors[side][0], now[side][1] - anchors[side][1]) < 1e-3)) return;
    nudge("leg", h);
    const byThigh = feet();
    nudge("leg", -h);
    nudge("shin", h);
    const byShin = feet();
    nudge("shin", -h);
    for (const side of [-1, 1]) {
      const ax = (byThigh[side][0] - now[side][0]) / h,
        ay = (byThigh[side][1] - now[side][1]) / h;
      const bx = (byShin[side][0] - now[side][0]) / h,
        by = (byShin[side][1] - now[side][1]) / h;
      const ex = anchors[side][0] - now[side][0],
        ey = anchors[side][1] - now[side][1];
      const det = ax * by - bx * ay;
      if (Math.abs(det) < 1e-9) continue;
      const dThigh = clamp((ex * by - bx * ey) / det, -0.4, 0.4),
        dShin = clamp((ax * ey - ex * ay) / det, -0.4, 0.4);
      bones[`leg-hind-${side}`].rotation[2] += dThigh;
      bones[`shin-hind-${side}`].rotation[2] += dShin;
    }
  }
}

const turn = (bones, id) => (bones[id] ??= {}).rotation ??= [0, 0, 0];

/**
 * Neck and head rotations that aim the breath at `target`: the neck along a strike line towards it,
 * bent into an S by `coil`, and the head turned so the plume (split between the head and the open
 * jaw, as the scene emits it) leaves the mouth straight at the target.
 */
function aimNeck(bones, anatomy, target, coil, ground) {
  const ids = anatomy.bones.map((bone) => bone.id);
  const bone = (id) => anatomy.bones[ids.indexOf(id)];
  const m = boneMatrices(anatomy, { bones });
  const parent = rotationOf(m[ids.indexOf(bone("neck-0").parent)]);
  const base = originOf(m[ids.indexOf("neck-0")]);
  const offsets = NECK.slice(1).map((id) => bone(id).position);
  const reach = offsets.reduce((sum, c) => sum + Math.hypot(...c), 0);
  const toward = sub(target, base);
  const level = Math.hypot(toward[0], toward[2]);
  const yaw = Math.atan2(toward[2], toward[0]);
  const jawBone = bone("jaw");
  const jaw = transform(jawBone.position, jawBone.rotation.map((v, i) => v + (bones.jaw?.rotation?.[i] ?? 0)));
  const mouth = point(jaw, mouthPoint(anatomy));
  const snout = Math.hypot(...offsets[2]) + Math.hypot(mouth[0], mouth[1]);
  const room = level - 1.2 * snout;
  let elevation = SLOPE * Math.atan2(toward[1], level);
  const floor = Math.asin(clamp((ground + CLEAR * snout - base[1]) / reach, -1, 1));
  elevation = Math.max(elevation, floor);
  const lengths = offsets.map((c) => Math.hypot(...c));
  const span = (bent) => lengths.reduce((sum, l, i) => sum + l * Math.cos(elevation + bent * COIL[i]), 0);
  if (span(coil) > room) {
    let lo = coil,
      hi = MAX_COIL;
    for (let n = 0; n < 16; n++) (span((lo + hi) / 2) > room ? (lo = (lo + hi) / 2) : (hi = (lo + hi) / 2));
    coil = hi;
    if (span(coil) > room) elevation = Math.acos(clamp(room / reach, -1, 1));
  }
  const along = (e) => [Math.cos(e) * Math.cos(yaw), Math.sin(e), Math.cos(e) * Math.sin(yaw)];
  let world = parent,
    at = base;
  const out = {};
  NECK.slice(0, 3).forEach((id, i) => {
    const next = times(frame(along(elevation + coil * COIL[i]), UP), transpose(frame(offsets[i], UP)));
    out[id] = euler(times(transpose(world), next));
    at = add(at, apply(next, offsets[i]));
    world = next;
  });
  const jawTurn = rotationOf(jaw);
  const plume = normalize(add([5, 0, 0], apply(jawTurn, [1, 0, 0])));
  let head = times(frame(sub(target, at), UP), transpose(frame(plume, UP)));
  for (let pass = 0; pass < 3; pass++) {
    const from = add(at, apply(head, mouth));
    head = times(frame(sub(target, from), UP), transpose(frame(plume, UP)));
  }
  out.head = euler(times(transpose(world), head));
  return out;
}

/**
 * Adults brace on the wing hands, set wider and further forward as `k` grows and kept on the ground
 * they stood on (`before` are the standing bone matrices); teens keep the wings folded to the
 * sunken body. Blended in by `stand`.
 */
function braceWings(bones, anatomy, k, stand, before) {
  const rest = rests[anatomy.age];
  if (!rest) return;
  const body = { root: bones.root, chest: bones.chest };
  let hands;
  if ("reach" in rest) {
    const params = {
      reach: rest.reach.map((v, i) => mix(v, BRACE.reach[i], k)),
      bend: mix(rest.bend, BRACE.bend, k),
      straighten: rest.straighten,
      pole: rest.pole.map((v, i) => mix(v, BRACE.pole[i], k)),
      hand: rest.hand.map((v, i) => mix(v, BRACE.hand[i], k)),
      fingers: rest.fingers.map((v, i) => mix(v, BRACE.fingers[i], k)),
      spars: rest.spars.map((f, n) => f.map((v, i) => mix(v, BRACE.spars[n][i], k))),
      tuck: rest.tuck.map((v, i) => mix(v, BRACE.tuck[i], k)),
    };
    hands = plantHands(anatomy, bones, params, handLows(anatomy, before));
  } else hands = foldStance(anatomy, body, rest);
  const settle = (id, rotation) => {
    const r = turn(bones, id);
    rotation.forEach((v, i) => (r[i] = mix(r[i], v, stand)));
  };
  for (const side of [-1, 1]) {
    const hand = hands[side];
    settle(`wing-${side}`, hand.shoulder);
    settle(`wing-elbow-${side}`, hand.elbow);
    settle(`wing-wrist-${side}`, hand.wrist);
    settle(`wing-hand-${side}`, hand.fingers);
    settle(`wing-anchor-${side}`, hand.anchorTurn ?? [0, 0, 0]);
    bones[`wing-anchor-${side}`].position = hand.anchor.map((v) => v * stand);
    hand.spars.forEach((spar, n) => settle(`spar-${side}-${n}`, spar));
  }
}

/**
 * Crouch and ground breath layered over a standing pose (`stand`). `crouch` (0..1) sinks the body
 * onto flexed hind legs with the feet kept planted, drops the chest and braces the wings (adults on
 * wider planted hands, teens folded), and aims the neck and head at `breathTarget` (model frame; a
 * point on the ground ahead without one), coiled; `breath` (0..1) drives the head forward along
 * the strike line and lunges the body into it.
 */
export function groundBreathPose(bones, anatomy, motion, { time, theta }) {
  const number = (v) => (Number.isFinite(v) ? v : 0);
  const stand = clamp(number(motion.stand), 0, 1);
  const k = clamp(number(motion.crouch), 0, 1) * stand;
  if (k <= 0) return;
  const breath = clamp(number(motion.breath), 0, 1);
  const low = k * (DEPTH[anatomy.age] ?? 1),
    drive = breath * low;
  const height = standHeight(anatomy.genome, anatomy.age);
  const at = (id) => anatomy.bones.findIndex((bone) => bone.id === id);
  const before = boneMatrices(anatomy, { bones });
  const anchors = { 1: originOf(before[at("toes-hind-1")]), [-1]: originOf(before[at("toes-hind--1")]) };
  const ground = Math.min(anchors[1][1], anchors[-1][1]) - PAD * (anatomy.scale ?? 1);

  const push = time === null ? Math.sin(3 * theta) : Math.sin(TAU * 1.7 * time);
  const root = (bones.root ??= {});
  root.position = add(root.position ?? [0, 0, 0], [LUNGE * drive * height, -(DROP * low + LUNGE * drive) * height, 0]);
  turn(bones, "root")[2] += -0.34 * low - 0.08 * drive;
  turn(bones, "chest")[2] += -0.1 * low - 0.06 * drive + 0.015 * drive * push;
  for (const side of [-1, 1]) {
    turn(bones, `leg-hind-${side}`)[0] += -side * 0.08 * k;
    turn(bones, `foot-hind-${side}`)[2] += -0.35 * low;
  }
  keepFeet(bones, anatomy, anchors);
  plantFeet(bones, anatomy, 1);

  braceWings(bones, anatomy, k, stand, before);

  for (let i = 0; i < 7; i++) turn(bones, `tail-${i}`)[2] += (i < 2 ? 0.1 : 0.03) * k - 0.02 * drive;
  clearTail(bones, anatomy);

  const target = Array.isArray(motion.breathTarget) && motion.breathTarget.length === 3 && motion.breathTarget.every(Number.isFinite)
    ? motion.breathTarget
    : [anatomy.bones[0].position[0] + 2.4 * height, ground, 0];
  const aim = aimNeck(bones, anatomy, target, 1 - breath, ground);
  for (const id of NECK) {
    const r = turn(bones, id);
    aim[id].forEach((v, i) => (r[i] = mix(r[i], v, k)));
  }
}
