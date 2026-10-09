import { breathCue } from "../breath/breathCue.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { breathEmitter } from "./breathPlume.js";
import { lowestPoint } from "./groundContact.js";
import { poseOutline } from "./poseOutline.js";

const PEAK = 1.2,
  HEAD = 1.1,
  REACH = 1.6,
  SPREAD = 0.5;

/**
 * Ground-level points a close-up on a breathing dragon keeps in view: its head as it pours out the
 * plume `PEAK` seconds into the breath, and the first stretch of the plume leaving its mouth, measured
 * in its last neck segment, all stood at the origin facing `forward` with its soles at `sole`.
 * @param {{ pose: Function }} module
 * @param {any} anatomy
 * @param {number[]} forward
 * @param {number} sole
 * @param {object} resting
 */
export function breathCloseUp(module, anatomy, forward, sole, resting) {
  const pose = module.pose(anatomy, 0, { ...resting, time: 0, ...breathCue(PEAK) });
  const position = [0, sole - lowestPoint(anatomy, pose, [0, 0, 0], forward), 0];
  const model = multiply(orientation(position, forward), transform(anatomy.bones[0].position.map((v) => -v)));
  const bones = boneMatrices(anatomy, pose);
  const at = (id) => point(multiply(model, bones[anatomy.bones.findIndex((b) => b.id === id)]), [0, 0, 0]);
  const head = at("head"),
    neck = at("neck-2");
  const { origin, direction } = breathEmitter({ anatomy, breath: {} }, bones, model);
  const size = Math.hypot(...head.map((v, k) => v - neck[k]));
  const near = poseOutline(anatomy, pose, position, forward).filter((p) => Math.hypot(p[0] - head[0], p[1] - head[1], p[2] - head[2]) < HEAD * size);
  const tip = origin.map((v, k) => v + direction[k] * REACH * size);
  return [...near, head, tip, [tip[0], tip[1] + SPREAD * size, tip[2]], [tip[0], Math.max(0, tip[1] - SPREAD * size), tip[2]]];
}
