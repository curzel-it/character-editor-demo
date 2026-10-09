import { add, normalize, scale } from "../vec3.js";

export const custodianPoses = ["idle", "ritual", "talking"];

/** Rest distance from the staff's foot to the palm that holds it. */
export const STAFF_GRIP = 1.02;

const wave = (time, period, phase = 0) => Math.sin(((time / period) * 2 + phase) * Math.PI);
const zero = [0, 0, 0];

/** The staff planted ahead and to his right, its head leaning back towards him. */
const planted = {
  foot: [0.5, 0, 0.13],
  dir: normalize([-0.1, 1, 0.02]),
};
const plantedGrip = add(planted.foot, scale(planted.dir, STAFF_GRIP));

/** Stooped over the staff, both hands on it, breathing and swaying a little as he waits. */
function idle(time) {
  const sway = wave(time, 6.4),
    breath = wave(time, 4.2);
  return {
    torso: {
      pelvis: [0.018 * sway, 0, 0],
      spine: [-0.01 * sway, 0, 0.012 * breath],
      chest: [-0.008 * sway, 0.02 * wave(time, 9.1), 0.018 * breath],
      neck: [0, 0.04 * wave(time, 8.3, 0.4), -0.01 * breath],
      head: [0.03 * wave(time, 7.7, 1.1), 0.08 * wave(time, 11.3, 0.2), -0.02 * wave(time, 5.3, 0.6)],
      jaw: zero,
    },
    staff: { dir: planted.dir, grip: STAFF_GRIP },
    right: { target: plantedGrip, pole: [-0.2, -0.6, 1], wrist: zero },
    left: { target: add(plantedGrip, add(scale(planted.dir, 0.1), [-0.02, 0, -0.035])), pole: [-0.3, -0.7, -1], wrist: [0, 0.4, 0] },
  };
}

/** Straightened as far as his back allows, staff held high overhead, the free hand raised open. */
function ritual(time) {
  const lift = wave(time, 3.2),
    tremble = wave(time, 0.37);
  const dir = normalize([0.1 + 0.03 * wave(time, 5.1), 1, 0.02 * wave(time, 4.3)]);
  return {
    torso: {
      pelvis: [0, 0, 0.02],
      spine: [0, 0, 0.05 + 0.01 * lift],
      chest: [0.004 * tremble, 0, 0.12 + 0.015 * lift],
      neck: [0, 0, 0.03],
      head: [0, 0, 0.05 + 0.02 * lift],
      jaw: [0, 0, -0.05],
    },
    staff: { dir, grip: 0.62 },
    right: { target: [0.2, 1.96 + 0.03 * lift, 0.19], pole: [-0.4, -0.3, 1], wrist: zero },
    left: { target: [0.26, 1.74 + 0.02 * lift + 0.004 * tremble, -0.44], pole: [-0.4, -1, -0.4], wrist: [0, -1.2, 0.3] },
  };
}

/** Leaning on the staff with the right hand, talking with the left: an open palm that turns and weighs his words. */
function talking(time) {
  const beat = wave(time, 2.4),
    offBeat = wave(time, 1.2, 0.3),
    words = Math.max(0, wave(time, 0.3)) * (0.6 + 0.4 * Math.max(0, wave(time, 1.7, 0.2)));
  return {
    torso: {
      pelvis: [0.01 * wave(time, 6.4), -0.03, 0],
      spine: [0, -0.02, 0.03],
      chest: [0, -0.05 + 0.03 * beat, 0.05 + 0.012 * wave(time, 4.2)],
      neck: [0, -0.02, 0.04],
      head: [0.04 * beat, -0.08 + 0.06 * wave(time, 3.1), 0.12 + 0.05 * offBeat],
      jaw: [0, 0, -0.16 * words],
    },
    staff: { dir: planted.dir, grip: STAFF_GRIP },
    right: { target: plantedGrip, pole: [-0.2, -0.6, 1], wrist: zero },
    left: {
      target: [0.44 + 0.04 * beat, 1.27 + 0.08 * Math.max(0, offBeat) + 0.04 * beat, -0.3 - 0.07 * beat],
      pole: [-0.4, -1, -0.5],
      wrist: [0, -1.1 + 0.35 * beat, 0.35 + 0.2 * offBeat],
    },
  };
}

const stances = { idle, ritual, talking };

const mix = (a, b, t) =>
  Array.isArray(a) ? a.map((v, i) => v + (b[i] - v) * t) : typeof a === "number" ? a + (b - a) * t : Object.fromEntries(Object.keys(a).map((k) => [k, mix(a[k], b[k], t)]));

/**
 * What the custodian's body aims for at `time` seconds in `pose`, eased `blend` of the way to `toward`:
 * torso rotations, the staff's direction and where along it he grips it, and a target, elbow pole and
 * wrist turn for each hand.
 */
export function custodianStance(time, { pose = "idle", toward, blend = 0 } = {}) {
  const from = (stances[pose] ?? idle)(time);
  if (!toward || blend <= 0) return from;
  const t = Math.min(1, blend);
  const to = (stances[toward] ?? idle)(time);
  const eased = t * t * (3 - 2 * t);
  const out = mix(from, to, eased);
  out.staff.dir = normalize(out.staff.dir);
  return out;
}
