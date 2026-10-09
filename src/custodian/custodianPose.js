import { transform } from "../math3d.js";
import { apply, euler, rotationOf, times, transpose, turning } from "../mat3.js";
import { add, distance, dot, length, normalize, scale, sub } from "../vec3.js";
import { custodianBones, restJoint } from "./custodianSkeleton.js";
import { custodianStance, STAFF_GRIP } from "./custodianStances.js";

const rest = new Map(custodianBones().map((bone) => [bone.id, bone]));
const identity = [
  [1, 0, 0],
  [0, 1, 0],
  [0, 0, 1],
];
const rotation = (angles) => rotationOf(transform([0, 0, 0], angles));

/**
 * The custodian posed at `time` seconds as `{ bones }` for the renderer: `pose` is idle, ritual or
 * talking, eased `blend` of the way to `toward`. Hands reach their targets by two-bone IK, so the
 * staff stays planted and held while the body sways.
 */
export function custodianPose(time, options) {
  const stance = custodianStance(time, options);
  const world = new Map([[null, { rot: identity, pos: [0, 0, 0] }]]);
  const bones = {};
  const place = (id, local, shift) => {
    const bone = rest.get(id),
      parent = world.get(bone.parent);
    const offset = shift ? add(bone.position, shift) : bone.position;
    world.set(id, { rot: times(parent.rot, rotation(local)), pos: add(parent.pos, apply(parent.rot, offset)) });
    bones[id] = shift ? { rotation: local, position: shift } : { rotation: local };
  };
  const aim = (id, worldRot, shift) => place(id, euler(times(transpose(world.get(rest.get(id).parent).rot), worldRot)), shift);

  place("root", [0, 0, 0]);
  for (const id of ["pelvis", "spine", "chest", "neck", "head", "jaw"]) place(id, stance.torso[id]);
  for (const side of ["right", "left"]) {
    const { target, pole, wrist } = stance[side];
    const [upper, fore, hand] = [`upperArm-${side}`, `forearm-${side}`, `hand-${side}`];
    const chest = world.get("chest");
    const shoulder = add(chest.pos, apply(chest.rot, rest.get(upper).position));
    const [s0, e0, p0] = [restJoint(upper), restJoint(fore), restJoint(`palm-${side}`)];
    const upperLength = distance(s0, e0),
      foreLength = distance(e0, p0);
    const reach = sub(target, shoulder);
    const d = Math.min(Math.max(length(reach), 0.05), (upperLength + foreLength) * 0.999);
    const along = normalize(reach);
    const a = (upperLength ** 2 - foreLength ** 2 + d * d) / (2 * d);
    const bend = normalize(sub(pole, scale(along, dot(pole, along))));
    const elbow = add(add(shoulder, scale(along, a)), scale(bend, Math.sqrt(Math.max(0, upperLength ** 2 - a * a))));
    const palm = add(shoulder, scale(along, d));
    aim(upper, turning(normalize(sub(e0, s0)), normalize(sub(elbow, shoulder))));
    aim(fore, turning(normalize(sub(p0, e0)), normalize(sub(palm, elbow))));
    place(hand, wrist);
  }
  const hand = world.get("hand-right");
  const dir = normalize(stance.staff.dir);
  aim("staff", turning([0, 1, 0], dir), apply(transpose(hand.rot), scale(dir, STAFF_GRIP - stance.staff.grip)));
  return { bones };
}
