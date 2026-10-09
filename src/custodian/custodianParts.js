import { palette, pigment, tint } from "../palette.js";
import { tube, loop } from "../jockey/riderMesh.js";
import { add, lerp, sub } from "../vec3.js";
import { custodianSides, restJoint } from "./custodianSkeleton.js";
import { STAFF_GRIP } from "./custodianStances.js";

export const custodianColors = {
  robe: pigment(0.63, 0.32, 0.3),
  mantle: pigment(0.74, 0.24, 0.29),
  stole: pigment(0.1, 0.58, 0.5),
  skin: pigment(0.05, 0.36, 0.6),
  hair: pigment(0.12, 0.12, 0.9),
  staff: pigment(0.07, 0.34, 0.28),
  shoes: pigment(0.06, 0.28, 0.17),
  stone: palette.gold,
  eyes: palette.ink,
};

const STAFF_LENGTH = 1.95;
const plain = (rgb) => () => rgb;
const pleats = (rgb) => (_, segment) => (segment % 2 ? tint(rgb, 0.86) : rgb);

/** A skinned mesh part: `rings` carry `joints` and the `weight` of the first joint. */
function skinned(id, rings, options) {
  const mesh = tube(rings, { ...options, skin: (ring) => ({ joints: rings[ring].joints, weight: rings[ring].weight ?? 1 }) });
  return { id, bone: rings[0].joints[0], shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: mesh.colors.slice(0, 3), ...mesh };
}

/** A rigid mesh on `bone`, from model-space rest rings. */
function rigid(id, bone, rings, options) {
  const origin = restJoint(bone);
  const mesh = tube(rings.map((ring) => ({ ...ring, p: sub(ring.p, origin) })), options);
  return { id, bone, shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: mesh.colors.slice(0, 3), ...mesh };
}

/** A primitive on `bone` at a model-space rest position. */
const shape = (id, bone, kind, at, size, color, rotation = [0, 0, 0]) => ({ id, bone, shape: kind, position: sub(at, restJoint(bone)), rotation, scale: size, color });

const upright = { up: [1, 0, 0] };

/**
 * The custodian's clothes, body and staff as renderer parts: a pleated robe to the ground, a mantle
 * and a hood with a drooping point, a long white beard, bell sleeves, an ochre stole and rope belt,
 * and a gnarled staff with an amber stone caught in its crook.
 */
export function custodianParts() {
  const c = custodianColors;
  const parts = [];

  parts.push(
    skinned("custodian-robe", [
      { p: [0.03, 0.015, 0], r: [0.27, 0.3], joints: ["root", "pelvis"], weight: 1 },
      { p: [0.02, 0.3, 0], r: [0.23, 0.26], joints: ["root", "pelvis"], weight: 0.75 },
      { p: [0.01, 0.62, 0], r: [0.19, 0.225], joints: ["root", "pelvis"], weight: 0.4 },
      { p: [-0.01, 0.9, 0], r: [0.155, 0.205], joints: ["pelvis", "spine"], weight: 1 },
      { p: [-0.005, 1.1, 0], r: [0.145, 0.19], joints: ["spine", "pelvis"], weight: 1 },
      { p: [0.015, 1.27, 0], r: [0.175, 0.2], joints: ["chest", "spine"], weight: 0.8 },
      { p: [0.06, 1.37, 0], r: [0.15, 0.185], joints: ["chest", "spine"], weight: 1 },
      { p: [0.16, 1.43, 0], r: [0.065, 0.075], joints: ["neck", "chest"], weight: 0.6 },
    ], { segments: 12, color: pleats(c.robe), ...upright }),
  );

  parts.push(
    skinned("custodian-mantle", [
      { p: [0.17, 1.45, 0], r: [0.075, 0.085], joints: ["neck", "chest"], weight: 0.5 },
      { p: [0.1, 1.4, 0], r: [0.16, 0.19], joints: ["chest", "neck"], weight: 1 },
      { p: [0.05, 1.31, 0], r: [0.205, 0.245], joints: ["chest", "spine"], weight: 1 },
      { p: [0.04, 1.28, 0], r: [0.203, 0.243], joints: ["chest", "spine"], weight: 1 },
    ], { segments: 12, color: plain(c.mantle), ...upright }),
  );

  for (const [side, s] of Object.entries(custodianSides)) {
    const [shoulder, elbow, wrist] = [`upperArm-${side}`, `forearm-${side}`, `hand-${side}`].map(restJoint);
    parts.push(
      skinned(`custodian-sleeve-${side}`, [
        { p: add(shoulder, [0, 0.04, -0.03 * s]), r: 0.075, joints: [`upperArm-${side}`, "chest"], weight: 0.6 },
        { p: lerp(shoulder, elbow, 0.5), r: 0.075, joints: [`upperArm-${side}`, "chest"], weight: 1 },
        { p: elbow, r: 0.08, joints: [`forearm-${side}`, `upperArm-${side}`], weight: 0.5 },
        { p: lerp(elbow, wrist, 0.55), r: 0.095, joints: [`forearm-${side}`, `upperArm-${side}`], weight: 1 },
        { p: lerp(elbow, wrist, 1.02), r: 0.125, joints: [`forearm-${side}`, `upperArm-${side}`], weight: 1 },
      ], { segments: 8, color: pleats(c.robe) }),
    );
    const palm = restJoint(`palm-${side}`);
    parts.push(shape(`custodian-hand-${side}`, `hand-${side}`, "ellipsoid", add(palm, [0.004, 0.005, 0]), [0.045, 0.078, 0.028], c.skin));
    parts.push(shape(`custodian-thumb-${side}`, `hand-${side}`, "ellipsoid", add(palm, [0.035, 0.02, -0.012 * s]), [0.017, 0.035, 0.016], c.skin, [0, 0, 0.5]));
    parts.push(shape(`custodian-shoe-${side}`, "root", "ellipsoid", [0.2, 0.035, 0.1 * s], [0.1, 0.04, 0.055], c.shoes));
  }

  const waist = [-0.005, 1.04, 0];
  parts.push(
    skinned(
      "custodian-belt",
      loop(waist, [1, 0, 0], [0, 0, 1], 0.155, 0.2, 16).map((p) => ({ p, r: 0.016, joints: ["pelvis", "spine"], weight: 0.5 })),
      { segments: 5, closed: true, color: plain(c.stole) },
    ),
  );
  const knot = [0.145, 1.03, -0.07];
  for (const [i, dz] of [-0.02, 0.025].entries())
    parts.push(
      rigid(`custodian-cord-${i}`, "pelvis", [
        { p: knot, r: 0.014 },
        { p: add(knot, [0.02, -0.18, dz]), r: 0.012 },
        { p: add(knot, [0.03, -0.36 - 0.06 * i, dz * 1.5]), r: 0.011 },
        { p: add(knot, [0.032, -0.38 - 0.06 * i, dz * 1.5]), r: 0.028 },
        { p: add(knot, [0.034, -0.46 - 0.06 * i, dz * 1.5]), r: 0.004 },
      ], { segments: 5, color: plain(c.stole) }),
    );
  parts.push(shape("custodian-knot", "pelvis", "ellipsoid", knot, [0.03, 0.03, 0.035], c.stole));

  for (const [side, s] of Object.entries(custodianSides))
    parts.push(
      skinned(`custodian-stole-${side}`, [
        { p: [0.17, 1.44, 0.07 * s], r: [0.012, 0.035], joints: ["chest", "neck"], weight: 1 },
        { p: [0.2, 1.32, 0.085 * s], r: [0.012, 0.038], joints: ["chest", "spine"], weight: 1 },
        { p: [0.17, 1.14, 0.085 * s], r: [0.012, 0.04], joints: ["spine", "chest"], weight: 0.7 },
        { p: [0.16, 0.9, 0.085 * s], r: [0.012, 0.042], joints: ["pelvis", "spine"], weight: 1 },
        { p: [0.2, 0.52, 0.09 * s], r: [0.012, 0.045], joints: ["pelvis", "root"], weight: 0.6 },
      ], { segments: 4, color: (band) => (band === 3 ? palette.gold : c.stole), ...upright }),
    );

  const head = restJoint("head");
  const at = (d) => add(head, d);
  parts.push(shape("custodian-face", "head", "ellipsoid", at([0.035, 0.02, 0]), [0.09, 0.11, 0.085], c.skin));
  parts.push(shape("custodian-nose", "head", "ellipsoid", at([0.125, 0.005, 0]), [0.03, 0.045, 0.022], tint(c.skin, 0.94), [0, 0, 0.35]));
  for (const s of [-1, 1]) {
    parts.push(shape(`custodian-eye-${s}`, "head", "ellipsoid", at([0.108, 0.04, 0.035 * s]), [0.009, 0.007, 0.012], c.eyes));
    parts.push(shape(`custodian-brow-${s}`, "head", "box", at([0.115, 0.058, 0.04 * s]), [0.018, 0.012, 0.032], c.hair, [0.25 * s, 0, 0.2]));
    parts.push(
      rigid(`custodian-moustache-${s}`, "jaw", [
        { p: at([0.13, -0.035, 0.005 * s]), r: 0.014 },
        { p: at([0.125, -0.045, 0.04 * s]), r: 0.017 },
        { p: at([0.1, -0.09, 0.06 * s]), r: 0.008 },
      ], { segments: 5, color: plain(c.hair) }),
    );
  }
  parts.push(
    skinned("custodian-beard", [
      { p: at([0.07, -0.03, 0]), r: [0.055, 0.085], joints: ["jaw", "head"], weight: 0.5 },
      { p: at([0.095, -0.08, 0]), r: [0.06, 0.092], joints: ["jaw", "head"], weight: 1 },
      { p: at([0.1, -0.17, 0]), r: [0.05, 0.078], joints: ["jaw", "head"], weight: 1 },
      { p: at([0.09, -0.29, 0]), r: [0.04, 0.058], joints: ["jaw", "head"], weight: 1 },
      { p: at([0.065, -0.41, 0]), r: [0.024, 0.034], joints: ["jaw", "chest"], weight: 0.9 },
      { p: at([0.045, -0.51, 0]), r: [0.004, 0.006], joints: ["jaw", "chest"], weight: 0.8 },
    ], { segments: 8, color: (band, segment) => (segment % 3 ? c.hair : tint(c.hair, 0.9)), ...upright }),
  );
  parts.push(shape("custodian-hood", "head", "ellipsoid", at([-0.035, 0.035, 0]), [0.125, 0.14, 0.12], c.mantle, [0, 0, -0.15]));
  parts.push(
    rigid(
      "custodian-hood-rim",
      "head",
      loop(at([0.075, 0.02, 0]), [0.25, 0.97, 0], [0, 0, 1], 0.125, 0.105, 14).map((p) => ({ p, r: 0.02 })),
      { segments: 5, closed: true, color: plain(tint(c.mantle, 1.25)) },
    ),
  );
  parts.push(
    skinned("custodian-hood-point", [
      { p: at([-0.06, 0.1, 0]), r: 0.085, joints: ["head", "neck"], weight: 1 },
      { p: at([-0.15, 0.08, 0]), r: 0.055, joints: ["head", "neck"], weight: 1 },
      { p: at([-0.22, 0.0, 0]), r: 0.032, joints: ["head", "neck"], weight: 0.6 },
      { p: at([-0.26, -0.12, 0]), r: 0.014, joints: ["neck", "chest"], weight: 0.6 },
      { p: at([-0.265, -0.2, 0]), r: 0.003, joints: ["neck", "chest"], weight: 0.3 },
    ], { segments: 7, color: plain(c.mantle) }),
  );

  const grip = restJoint("staff");
  const foot = add(grip, [0, -STAFF_GRIP, 0]);
  const knots = [0, 0.12, 0.3, 0.46, 0.6, 0.72, 0.84, 0.93, 1];
  const wander = [0, 0.012, -0.01, 0.014, -0.006, 0.01, -0.012, 0.008, 0];
  parts.push(
    rigid(
      "custodian-staff",
      "staff",
      knots.map((t, i) => ({ p: add(foot, [wander[i], t * (STAFF_LENGTH - 0.12), -wander[(i + 3) % knots.length]]), r: 0.018 + 0.012 * t + (i % 3 === 1 ? 0.004 : 0) })),
      { segments: 6, color: (band) => (band % 3 === 2 ? tint(c.staff, 0.85) : c.staff), ...upright },
    ),
  );
  const crown = add(foot, [0, STAFF_LENGTH - 0.12, 0]);
  parts.push(
    rigid(
      "custodian-crook",
      "staff",
      [
        { p: crown, r: 0.03 },
        { p: add(crown, [-0.04, 0.09, 0]), r: 0.026 },
        { p: add(crown, [0.02, 0.17, 0]), r: 0.022 },
        { p: add(crown, [0.1, 0.14, 0]), r: 0.018 },
        { p: add(crown, [0.12, 0.06, 0]), r: 0.013 },
        { p: add(crown, [0.09, 0.02, 0]), r: 0.006 },
      ],
      { segments: 6, color: plain(c.staff) },
    ),
  );
  parts.push(shape("custodian-stone", "staff", "ellipsoid", add(crown, [0.035, 0.085, 0]), [0.045, 0.055, 0.045], c.stone));
  parts.push(
    rigid(
      "custodian-root-twist",
      "staff",
      [
        { p: add(crown, [0.01, -0.06, 0.03]), r: 0.009 },
        { p: add(crown, [0.07, 0.03, 0.035]), r: 0.009 },
        { p: add(crown, [0.05, 0.13, 0.03]), r: 0.007 },
        { p: add(crown, [0.0, 0.14, 0.02]), r: 0.004 },
      ],
      { segments: 4, color: plain(c.staff) },
    ),
  );

  return parts;
}
