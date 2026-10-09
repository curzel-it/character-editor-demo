const sides = { right: 1, left: -1 };
const GRIP = 0.08;

/** A point `reach` metres past `b` along the line from `a`. */
const beyond = (a, b, reach) => {
  const d = b.map((v, i) => v - a[i]);
  const n = Math.hypot(...d);
  return b.map((v, i) => v + (d[i] / n) * reach);
};

/**
 * The custodian's joints in metres at rest, facing +X with the feet on the ground at the origin: a
 * stooped old man about 1.6 m tall to the crown, arms hanging. Each arm runs shoulder, elbow, wrist,
 * with the palm (the grip) 8 cm past the wrist along the forearm.
 */
export const custodianJoints = {
  root: [0, 0, 0],
  pelvis: [-0.02, 0.9, 0],
  spine: [-0.01, 1.1, 0],
  chest: [0.03, 1.29, 0],
  neck: [0.16, 1.41, 0],
  head: [0.26, 1.47, 0],
  jaw: [0.32, 1.45, 0],
  ...Object.fromEntries(
    Object.entries(sides).flatMap(([side, s]) => {
      const elbow = [0.07, 1.13, 0.215 * s],
        wrist = [0.08, 0.88, 0.225 * s];
      return [
        [`upperArm-${side}`, [0.07, 1.4, 0.2 * s]],
        [`forearm-${side}`, elbow],
        [`hand-${side}`, wrist],
        [`palm-${side}`, beyond(elbow, wrist, GRIP)],
      ];
    }),
  ),
};

const parents = {
  root: null,
  pelvis: "root",
  spine: "pelvis",
  chest: "spine",
  neck: "chest",
  head: "neck",
  jaw: "head",
  "upperArm-right": "chest",
  "forearm-right": "upperArm-right",
  "hand-right": "forearm-right",
  staff: "hand-right",
  "upperArm-left": "chest",
  "forearm-left": "upperArm-left",
  "hand-left": "forearm-left",
};

/** Where the staff bone sits at rest: in the right palm. */
const jointOf = (id) => (id === "staff" ? custodianJoints["palm-right"] : custodianJoints[id]);

/** The rest skeleton: bones in parent-before-child order with no rest rotation, so model and bone axes agree. */
export const custodianBones = () =>
  Object.entries(parents).map(([id, parent]) => ({
    id,
    parent,
    position: parent ? jointOf(id).map((v, i) => v - jointOf(parent)[i]) : [...jointOf(id)],
    rotation: [0, 0, 0],
  }));

/** Model-space rest position of a bone. */
export const restJoint = jointOf;

export const custodianSides = sides;
