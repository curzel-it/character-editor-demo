import { normalizeSpec } from "./characterSpec.js";
import { characterJoints, bonesFrom } from "./characterRig.js";
import { headShape } from "./headShape.js";
import { headSkin, characterEars, faceMarks } from "./characterHead.js";
import { characterEyes } from "./characterEyes.js";
import { characterFace } from "./characterFace.js";
import { characterHair } from "./characterHair.js";
import { facialHair } from "./characterBeard.js";
import { outfitOf } from "./characterOutfit.js";
import { characterBody } from "./characterBody.js";
import { headwear, hatLine } from "./characterHeadwear.js";
import { accessories } from "./characterAccessories.js";
import { rgbOf } from "./characterColors.js";
import { add, sub } from "./surface.js";

/**
 * @typedef {{ id: "character", spec: import("./characterSpec.js").CharacterSpec, bones: object[], parts: object[],
 *   bounds: { center: number[], radius: number }, joints: Record<string, number[]>, rig: CharacterRig }} CharacterAnatomy
 * @typedef {{ lids: { open: number, low: number }, mouthOpen: number, height: number, headTop: number, eyeLine: number,
 *   focus: Record<string, { center: number[], radius: number }>, hairSway: boolean, sideSway: boolean, cape: boolean }} CharacterRig
 */

/**
 * The character a spec describes as an anatomy the engine's renderers draw: one skinned figure
 * about 1.5 to 1.9 m tall standing on the origin, facing +X, its right towards +Z. `rig` carries what
 * the pose needs (the lids' rest, the mouth) and framings for the editor's camera.
 * @param {Partial<import("./characterSpec.js").CharacterSpec>} input
 * @returns {CharacterAnatomy}
 */
export function createCharacter(input) {
  const spec = normalizeSpec(input);
  const { joints: j, measures: m } = characterJoints(spec);
  const head = headShape(spec, j.headCentre, m.head);
  const marks = {
    crotchY: j.thighL[1] - 0.06 * m.s,
    pelvisTopY: j.hips[1] + 0.05 * m.s,
    waistY: j.spine[1] + 0.02 * m.s,
    chestY: j.chest[1],
    hipY: j.thighL[1],
    neckBaseY: j.neck[1] + 0.005,
    s: m.s,
  };
  const outfit = outfitOf(spec, marks);
  const hat = hatLine(spec, head);
  const eyes = characterEyes(head, spec);
  const face = characterFace(head, spec, eyes.radius);
  const hair = characterHair(head, spec, j, hat);
  const beard = facialHair(head, spec);
  const skin = rgbOf(spec.skin);
  const parts = [
    headSkin(head, skin, beard.paint),
    ...characterEars(head, spec, hair.coversEars),
    ...faceMarks(head, spec),
    ...eyes.parts,
    ...face.parts,
    ...hair.parts,
    ...beard.parts,
    ...characterBody(j, m, outfit, spec, marks),
    ...headwear(spec, head, hat, hair),
  ];
  const extra = accessories(spec, j, m, head, outfit);
  parts.push(...extra.parts);
  const joints = {
    ...j,
    ...eyes.joints,
    ...face.joints,
    ...hair.joints,
    jaw: add(head.point(0, head.mouth.pitch - 0.2), [-0.04 * m.head, 0.0, 0]),
    cape: [j.chest[0] - 0.1 * m.s, j.upperArmL[1], 0],
    capeLow: [j.chest[0] - 0.14 * m.s, j.hips[1], 0],
    ...extra.joints,
  };
  const bones = bonesFrom(joints);
  const local = parts.map((part) => toBone(part, joints));
  const top = head.offset(0, Math.PI / 2, 0)[1];
  const headTop = Math.max(top + 0.03, ...local.filter((p) => p.id.startsWith("hat")).map(() => top + 0.06));
  const height = headTop;
  const focus = {
    full: { center: [0, height * 0.5, 0], radius: height * 0.56 },
    head: { center: add(j.headCentre, [0, 0.01, 0]), radius: 0.2 * m.head },
    face: { center: add(j.headCentre, [0.04 * m.head, -0.02 * m.head, 0]), radius: 0.14 * m.head },
    eyes: { center: add(head.point(0, head.eye.pitch), [-0.02, 0.005, 0]), radius: 0.095 * m.head },
    upper: { center: [0, (j.chest[1] + j.head[1]) / 2 - 0.04, 0], radius: 0.42 * m.s },
    lower: { center: [0, j.shinL[1], 0], radius: 0.56 * m.s * m.legs },
    feet: { center: [0.04, 0.12 * m.s, 0], radius: 0.26 * m.s },
  };
  return {
    id: "character",
    spec,
    bones,
    parts: local,
    bounds: { center: [0, height / 2, 0], radius: height * 0.58 },
    joints,
    rig: {
      lids: eyes.lids,
      mouthOpen: face.mouthOpen,
      height,
      headTop,
      eyeLine: head.point(0, head.eye.pitch)[1],
      focus,
      hairSway: ["ponytail", "braid"].includes(String(spec.hair)),
      sideSway: spec.hair === "pigtails",
      cape: spec.back === "cape",
    },
  };
}

/** A model-space part moved into its bone's frame; skinned meshes stay in model space, as the renderer expects. */
function toBone(part, joints) {
  if (part.skin) return part;
  const origin = joints[part.bone];
  if (!origin) throw new Error(`Part ${part.id} hangs on unknown bone ${part.bone}`);
  if (part.shape === "mesh") {
    const vertices = part.vertices.map((v, k) => v - origin[k % 3]);
    return { ...part, vertices };
  }
  return { ...part, position: sub(part.position, origin) };
}
