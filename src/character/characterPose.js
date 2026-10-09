import { hashSeed } from "../rng.js";

/**
 * @typedef {{ still?: boolean, look?: number[] | null, expression?: string, expressionAt?: number, previousExpression?: string,
 *   gesture?: string | null, gestureAt?: number, turn?: number, energy?: number }} PoseState
 * @typedef {{ brows: number, inner: number, lids: number, low: number, smile: number, open: number, wide: number, wink?: number, squint?: number }} Face
 */

/** Face targets per expression: brow raise and inner tilt, lid and lower-lid shifts (radians), mouth corners, openness and width. */
export const expressions = /** @type {Record<string, Face>} */ ({
  neutral: { brows: 0, inner: 0, lids: 0, low: 0, smile: 0, open: 0, wide: 0 },
  happy: { brows: 0.25, inner: 0.05, lids: -0.05, low: 0.38, smile: 1, open: 0.45, wide: 0.15 },
  laugh: { brows: 0.45, inner: 0.15, lids: -0.4, low: 0.62, smile: 1.2, open: 1.2, wide: 0.25 },
  surprised: { brows: 1, inner: 0.25, lids: 0.35, low: -0.15, smile: -0.1, open: 1, wide: -0.35 },
  angry: { brows: -0.55, inner: -0.85, lids: -0.18, low: 0.12, smile: -0.7, open: 0.15, wide: 0.05 },
  sad: { brows: 0.1, inner: 0.95, lids: -0.12, low: 0, smile: -0.8, open: 0, wide: -0.1 },
  sleepy: { brows: -0.1, inner: 0.2, lids: -0.55, low: 0.1, smile: 0.1, open: 0, wide: -0.15 },
  wink: { brows: 0.15, inner: 0, lids: 0, low: 0.2, smile: 0.9, open: 0.25, wide: 0.1, wink: 1 },
  smug: { brows: 0.2, inner: -0.2, lids: -0.25, low: 0.18, smile: 0.7, open: 0, wide: 0.05, squint: 1 },
});

export const gestures = ["wave", "cheer", "think", "bow", "shrug", "hero", "dance", "jump"];

const BLEND = 0.22;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (t) => {
  const c = clamp(t, 0, 1);
  return c * c * (3 - 2 * c);
};
const wave = (t, period, phase = 0) => Math.sin((t / period + phase) * Math.PI * 2);

/** Whether the character is mid-blink at `time`: a blink every 2.5 to 5.5 s, sometimes doubled. */
function blinkAt(time) {
  const slot = Math.floor(time / 4);
  const r = hashSeed(`blink:${slot}`) / 4294967296;
  const at = slot * 4 + r * 3.2;
  const d = time - at;
  const one = (x) => (x > 0 && x < 0.16 ? Math.sin((x / 0.16) * Math.PI) : 0);
  return Math.max(one(d), r > 0.8 ? one(d - 0.24) : 0);
}

/** The face an expression shows, eased in from the previous one. */
function faceAt(state, time) {
  const to = expressions[state.expression ?? "neutral"] ?? expressions.neutral;
  const from = expressions[state.previousExpression ?? "neutral"] ?? expressions.neutral;
  const t = ease((time - (state.expressionAt ?? -9)) / BLEND);
  return Object.fromEntries(Object.keys(expressions.neutral).concat("wink", "squint").map((k) => [k, (from[k] ?? 0) + ((to[k] ?? 0) - (from[k] ?? 0)) * t]));
}

/**
 * Arm, spine and head rotations a gesture adds at `t` seconds into it, with its envelope `w` (0..1).
 * Arms: `x` swings the arm out (outward positive for both sides), `z` forward, `fx`/`fz` the forearm.
 */
function gestureAt(id, t) {
  const length = { wave: 2.4, cheer: 1.8, think: 2.8, bow: 2.2, shrug: 1.6, hero: 2.6, dance: 3.2, jump: 1.1 }[id] ?? 2;
  if (t < 0 || t > length) return null;
  const w = ease(t / 0.35) * ease((length - t) / 0.4);
  const g = { length, w, armL: { x: 0, z: 0, fx: 0, fz: 0, hand: 0 }, armR: { x: 0, z: 0, fx: 0, fz: 0, hand: 0 }, spine: [0, 0, 0], chest: [0, 0, 0], head: [0, 0, 0], hips: [0, 0, 0], lift: 0, face: null };
  switch (id) {
    case "wave":
      g.armR = { x: 2.3, z: 0.25, fx: 0, fz: 1.3 + 0.35 * wave(t, 0.5), hand: 0.3 * wave(t, 0.5, 0.25) };
      g.head = [0.12, -0.1, 0.06];
      g.chest = [0.05, 0, 0];
      g.face = "happy";
      break;
    case "cheer": {
      const pump = Math.abs(Math.sin(t * Math.PI * 2.2));
      g.armL = { x: 2.5 + 0.2 * pump, z: 0.2, fx: 0, fz: 0.4 - 0.3 * pump, hand: 0 };
      g.armR = { x: 2.5 + 0.2 * pump, z: 0.2, fx: 0, fz: 0.4 - 0.3 * pump, hand: 0 };
      g.lift = 0.05 * pump;
      g.head = [0, 0, 0.18];
      g.face = "laugh";
      break;
    }
    case "think":
      g.armR = { x: 0.25, z: 0.9, fx: -0.2, fz: 2.25, hand: -0.6 };
      g.armL = { x: 0.15, z: 0.55, fx: 0.3, fz: 1.55, hand: 0 };
      g.head = [-0.12, 0.12 * wave(t, 2.6), 0.14];
      g.face = "smug";
      break;
    case "bow":
      g.spine = [0, 0, -0.35 * ease(Math.sin(Math.min(1, t / (length * 0.8)) * Math.PI))];
      g.chest = [0, 0, -0.2 * ease(Math.sin(Math.min(1, t / (length * 0.8)) * Math.PI))];
      g.armR = { x: -0.05, z: 0.7, fx: 0, fz: 1.4, hand: 0 };
      g.armL = { x: 0.1, z: -0.4, fx: 0, fz: 0.3, hand: 0 };
      g.face = "happy";
      break;
    case "shrug": {
      const up = Math.sin(Math.min(1, t / length) * Math.PI);
      g.armL = { x: 0.55, z: 0.15, fx: 0.4, fz: 1.4 * up, hand: 0.4 };
      g.armR = { x: 0.55, z: 0.15, fx: -0.4, fz: 1.4 * up, hand: 0.4 };
      g.chest = [0, 0, 0.04 * up];
      g.head = [0.18 * up, 0, -0.05];
      g.lift = 0;
      g.face = "sad";
      break;
    }
    case "hero":
      g.armL = { x: 0.65, z: -0.15, fx: -0.6, fz: 1.6, hand: 0 };
      g.armR = { x: 0.65, z: -0.15, fx: 0.6, fz: 1.6, hand: 0 };
      g.chest = [0, 0, 0.1];
      g.head = [0, -0.25, 0.12];
      g.face = "smug";
      break;
    case "dance": {
      const beat = wave(t, 0.8);
      g.hips = [0.08 * beat, 0.15 * beat, 0];
      g.chest = [-0.1 * beat, -0.15 * beat, 0];
      g.armL = { x: 0.9 + 0.6 * Math.max(0, beat), z: 0.4, fx: 0, fz: 1.2, hand: 0 };
      g.armR = { x: 0.9 + 0.6 * Math.max(0, -beat), z: 0.4, fx: 0, fz: 1.2, hand: 0 };
      g.head = [0.15 * beat, 0, 0];
      g.lift = 0.02 * Math.abs(wave(t, 0.4));
      g.face = "happy";
      break;
    }
    case "jump": {
      const air = Math.max(0, Math.sin(clamp((t - 0.2) / 0.7, 0, 1) * Math.PI));
      const crouch = Math.max(0, Math.sin(clamp(t / 0.25, 0, 1) * Math.PI)) + Math.max(0, Math.sin(clamp((t - 0.88) / 0.22, 0, 1) * Math.PI));
      g.lift = 0.22 * air - 0.05 * crouch;
      g.crouch = crouch;
      g.armL = { x: 1.2 * air + 0.2, z: 0.3 * air, fx: 0, fz: 0.5, hand: 0 };
      g.armR = { x: 1.2 * air + 0.2, z: 0.3 * air, fx: 0, fz: 0.5, hand: 0 };
      g.face = "laugh";
      break;
    }
  }
  return g;
}

/**
 * The character's pose at `time` seconds for the renderer (`{ bones }` of rotation and position offsets):
 * breathing, a slow weight shift and arms swaying at ease, blinking, the head and eyes turned towards
 * `look` (a model-space point), the face easing into `expression`, and a `gesture` played from `gestureAt`.
 * `still` holds the rest pose with the eyes open, for thumbnails.
 * @param {import("./characterAnatomy.js").CharacterAnatomy} anatomy
 * @param {number} time
 * @param {PoseState} [state]
 */
export function characterPose(anatomy, time, state = {}) {
  const { rig, joints } = anatomy;
  const bones = {};
  const set = (id, rotation, position) => (bones[id] = position ? { rotation, position } : { rotation });
  const still = Boolean(state.still);
  const t = still ? 0 : time;
  const energy = state.energy ?? 1;
  const g = !still && state.gesture ? gestureAt(state.gesture, time - (state.gestureAt ?? 0)) : null;
  const gw = g?.w ?? 0;
  const face = faceAt(g?.face && gw > 0.3 ? { ...state, expression: g.face, expressionAt: (state.gestureAt ?? 0) + 0.1, previousExpression: state.expression } : state, still ? 99 : time);

  const breath = wave(t, 3.6) * energy;
  const shift = wave(t, 7.3) * energy;
  const sway = wave(t, 5.1, 0.3) * energy;
  set("hips", [0.018 * shift + (g?.hips[0] ?? 0) * gw, (g?.hips[1] ?? 0) * gw, 0], [0, (g?.lift ?? 0) * gw - 0.004 * Math.abs(shift), 0.006 * shift]);
  set("spine", [-0.012 * shift + (g?.spine[0] ?? 0) * gw, 0.01 * sway + (g?.spine[1] ?? 0) * gw, 0.008 * breath + (g?.spine[2] ?? 0) * gw]);
  set("chest", [-0.006 * shift + (g?.chest[0] ?? 0) * gw, 0.008 * sway + (g?.chest[1] ?? 0) * gw, 0.016 * breath + (g?.chest[2] ?? 0) * gw]);

  let yaw = 0,
    pitch = 0;
  if (state.look && !still) {
    const c = joints.headCentre;
    const d = [state.look[0] - c[0], state.look[1] - c[1], state.look[2] - c[2]];
    const flat = Math.hypot(d[0], d[2]);
    yaw = clamp(-Math.atan2(d[2], Math.max(0.05, d[0])), -1.1, 1.1);
    pitch = clamp(Math.atan2(d[1], Math.max(0.05, flat)), -0.6, 0.6);
  }
  const idleHead = still ? [0, 0, 0] : [0.02 * wave(t, 6.2, 0.2), 0.04 * wave(t, 9.4, 0.6), 0.015 * wave(t, 4.4, 0.1)];
  const headYaw = yaw * 0.62,
    headPitch = pitch * 0.55;
  set("neck", [idleHead[0] * 0.5, headYaw * 0.4 + idleHead[1] * 0.5, headPitch * 0.4 - 0.005 * breath]);
  set("head", [idleHead[0] + (g?.head[0] ?? 0) * gw, headYaw * 0.6 + idleHead[1] + (g?.head[1] ?? 0) * gw, headPitch * 0.6 + idleHead[2] + (g?.head[2] ?? 0) * gw]);
  const eyeYaw = clamp(yaw - headYaw, -0.38, 0.38),
    eyePitch = clamp(pitch - headPitch, -0.3, 0.3);
  const glance = still ? 0 : 0.06 * Math.sign(wave(t, 5.3, 0.1)) * (Math.abs(wave(t, 5.3, 0.1)) > 0.92 ? 1 : 0);
  set("eyeL", [0, eyeYaw + glance, eyePitch]);
  set("eyeR", [0, eyeYaw + glance, eyePitch]);

  const blink = still ? 0 : blinkAt(time);
  const open = rig.lids.open,
    low = rig.lids.low;
  const shut = -0.12;
  const lidOf = (side) => {
    const wink = side === "R" ? face.wink ?? 0 : 0;
    const squint = (face.squint ?? 0) * (side === "L" ? 0.5 : 0.25);
    const target = Math.min(open + 0.45, open + face.lids - squint);
    const closed = Math.max(blink, wink);
    return target + (shut - target) * closed;
  };
  const lowOf = (side) => {
    const wink = side === "R" ? face.wink ?? 0 : 0;
    const target = Math.min(-0.05, low + face.low);
    return target + (Math.min(-0.15, target + 0.25) - target) * Math.max(blink * 0.4, wink * 0.8);
  };
  for (const side of ["L", "R"]) {
    set(`lid${side}`, [0, 0, lidOf(side)]);
    set(`lowLid${side}`, [0, 0, lowOf(side)]);
    const s = side === "L" ? -1 : 1;
    const size = rig.height / 1.7;
    set(`brow${side}`, [face.inner * 0.42 * s, 0, 0], [0, (face.brows * 0.011 + face.inner * 0.002) * size, 0]);
    set(`mouth${side}`, [0, 0, 0], [0, face.smile * 0.011 * size, s * face.wide * 0.007 * size]);
  }
  const size = rig.height / 1.7;
  const opened = Math.max(rig.mouthOpen, face.open);
  set("mouthOpen", [0, 0, 0], [(-0.004 + opened * 0.011) * size, -opened * 0.002 * size, 0]);

  for (const [side, s] of [["L", -1], ["R", 1]]) {
    const arm = g?.[`arm${side}`];
    const relax = 0.08;
    const swing = 0.03 * wave(t, 5.1, side === "L" ? 0 : 0.5) * energy;
    const out = -relax + (arm?.x ?? 0) * gw;
    set(`upperArm${side}`, [-s * out, 0, swing + (arm?.z ?? 0) * gw]);
    set(`forearm${side}`, [(arm?.fx ?? 0) * gw * -s, 0, 0.14 + 0.03 * breath + (arm?.fz ?? 0) * gw]);
    set(`hand${side}`, [s * 0.1 + (arm?.hand ?? 0) * gw * s, 0, 0.05]);
    const crouch = g?.crouch ?? 0;
    set(`thigh${side}`, [0, 0, crouch * 0.5 * gw]);
    set(`shin${side}`, [0, 0, -crouch * 0.9 * gw]);
    set(`foot${side}`, [0, 0, crouch * 0.4 * gw]);
  }

  const lag = still ? 0 : 1;
  const hairSwing = (wave(t, 2.7) * 0.04 + headYaw * 0.3) * lag;
  set("hairBack", [hairSwing * 0.5, 0, 0.02 * wave(t, 3.1) * lag]);
  set("hairTail", [hairSwing, 0, 0.05 * wave(t, 3.1, 0.15) * lag + (g?.lift ?? 0) * gw * 1.5]);
  set("hairTip", [hairSwing * 1.4, 0, 0.07 * wave(t, 3.1, 0.3) * lag]);
  set("hairSideL", [0.06 * wave(t, 2.9) * lag, 0, 0.04 * wave(t, 3.3) * lag]);
  set("hairSideR", [0.06 * wave(t, 2.9, 0.3) * lag, 0, 0.04 * wave(t, 3.3, 0.2) * lag]);
  set("cape", [0.02 * wave(t, 3.4) * lag, 0, -0.01 - 0.015 * wave(t, 2.8) * lag - (g?.lift ?? 0) * gw * 0.8]);
  set("capeLow", [0.03 * wave(t, 3.4, 0.2) * lag, 0, -0.03 * wave(t, 2.8, 0.25) * lag]);
  return { bones };
}

/** How long a gesture plays, in seconds. */
export const gestureLength = (id) => gestureAt(id, 0)?.length ?? 0;
