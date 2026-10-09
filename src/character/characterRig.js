import { add, mix, sub } from "./surface.js";

/** @typedef {import("./characterSpec.js").CharacterSpec} CharacterSpec */

const SIDES = /** @type {const} */ ([["L", -1], ["R", 1]]);

/**
 * The body's measures in metres from the shape sliders: `s` scales the whole figure from its
 * height, `head` the head on its own, and the rest shape the torso and limbs. Facing +X, +Y up,
 * the character's right towards +Z.
 * @param {CharacterSpec} spec
 */
export function bodyMeasures(spec) {
  const n = (key) => Number(spec[key]);
  const s = mix(0.84, 1.14, n("height"));
  const build = n("build"),
    muscle = n("muscle");
  const girth = mix(0.84, 1.42, build) * mix(0.97, 1.07, muscle);
  const legs = mix(0.86, 1.12, n("legs"));
  const head = mix(0.95, 1.5, n("headSize")) * Math.pow(s, 0.4);
  return {
    s,
    build,
    muscle,
    girth,
    legs,
    head,
    shoulders: 0.17 * s * mix(0.84, 1.2, n("shoulders")) * mix(0.96, 1.12, build) * mix(0.97, 1.08, muscle),
    chest: n("chest"),
    waist: mix(0.84, 1.18, n("waist")) * mix(0.9, 1.25, build),
    hips: mix(0.86, 1.22, n("hips")),
    belly: Math.max(0, build - 0.45) * 1.8,
    arm: mix(0.92, 1.25, build) * mix(0.94, 1.16, muscle),
    thigh: mix(0.9, 1.3, build) * mix(0.96, 1.1, muscle) * mix(0.94, 1.1, n("hips")),
  };
}

/**
 * The rest skeleton's joints in model space, standing on the origin in a relaxed A pose, and the
 * body measures they came from.
 * @param {CharacterSpec} spec
 */
export function characterJoints(spec) {
  const m = bodyMeasures(spec);
  const { s, legs } = m;
  const ankleY = 0.075 * s,
    kneeY = ankleY + 0.39 * s * legs,
    hipY = kneeY + 0.39 * s * legs;
  const pelvisY = hipY + 0.035 * s;
  const spineY = pelvisY + 0.13 * s,
    chestY = spineY + 0.15 * s;
  const shoulderY = chestY + 0.125 * s;
  const neckY = chestY + 0.155 * s;
  const headPivotY = neckY + 0.05 * s;
  const headRise = 0.104 * m.head * mix(0.97, 1.12, Number(spec.faceLength));
  /** @type {Record<string, number[]>} */
  const j = {
    root: [0, 0, 0],
    hips: [0, pelvisY, 0],
    spine: [0.004, spineY, 0],
    chest: [0.0, chestY, 0],
    neck: [0.012 * s, neckY, 0],
    head: [0.024 * s, headPivotY, 0],
  };
  j.headCentre = add(j.head, [0.012, headRise, 0]);
  const hipOut = 0.088 * s * mix(0.92, 1.12, m.hips) * mix(0.96, 1.08, m.build);
  const upper = 0.275 * s,
    fore = 0.25 * s;
  const spread = 0.18;
  for (const [side, z] of SIDES) {
    const shoulder = [-0.012 * s, shoulderY, z * m.shoulders];
    j[`clavicle${side}`] = [0.01 * s, shoulderY - 0.015 * s, z * 0.03 * s];
    j[`upperArm${side}`] = shoulder;
    j[`forearm${side}`] = add(shoulder, [-0.012 * s, -upper * Math.cos(spread), z * upper * Math.sin(spread)]);
    j[`hand${side}`] = add(j[`forearm${side}`], [0.026 * s, -fore * Math.cos(spread * 0.85), z * fore * Math.sin(spread * 0.85)]);
    j[`thigh${side}`] = [0, hipY, z * hipOut];
    j[`shin${side}`] = [0.012 * s, kneeY, z * hipOut * 0.94];
    j[`foot${side}`] = [-0.012 * s, ankleY, z * hipOut * 0.92];
    j[`toe${side}`] = [0.11 * s, 0.022 * s, z * hipOut * 0.95];
  }
  return { joints: j, measures: m };
}

/** Bone hierarchy: every bone with its parent, parents first. Face, hair and cloth bones hang off the head and chest. */
export const boneParents = [
  ["root", null],
  ["hips", "root"],
  ["spine", "hips"],
  ["chest", "spine"],
  ["neck", "chest"],
  ["head", "neck"],
  ["jaw", "head"],
  ["eyeL", "head"],
  ["eyeR", "head"],
  ["lidL", "head"],
  ["lidR", "head"],
  ["lowLidL", "head"],
  ["lowLidR", "head"],
  ["browL", "head"],
  ["browR", "head"],
  ["mouthL", "head"],
  ["mouthR", "head"],
  ["mouthOpen", "head"],
  ["hairBack", "head"],
  ["hairTail", "hairBack"],
  ["hairTip", "hairTail"],
  ["hairSideL", "head"],
  ["hairSideR", "head"],
  ["clavicleL", "chest"],
  ["upperArmL", "clavicleL"],
  ["forearmL", "upperArmL"],
  ["handL", "forearmL"],
  ["clavicleR", "chest"],
  ["upperArmR", "clavicleR"],
  ["forearmR", "upperArmR"],
  ["handR", "forearmR"],
  ["thighL", "hips"],
  ["shinL", "thighL"],
  ["footL", "shinL"],
  ["toeL", "footL"],
  ["thighR", "hips"],
  ["shinR", "thighR"],
  ["footR", "shinR"],
  ["toeR", "footR"],
  ["cape", "chest"],
  ["capeLow", "cape"],
];

/**
 * The renderer's bones from model-space joints, with no rest rotation so bone and model axes agree.
 * @param {Record<string, number[]>} joints every bone's joint
 */
export function bonesFrom(joints) {
  return boneParents.map(([id, parent]) => ({
    id,
    parent,
    position: parent ? sub(joints[id], joints[parent]) : [...joints[id]],
    rotation: [0, 0, 0],
  }));
}

export const sides = SIDES;
