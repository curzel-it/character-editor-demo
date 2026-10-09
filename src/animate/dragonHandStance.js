import { boneMatrices, transform } from "../math3d.js";
import { apply, euler, frame, originOf, rotationOf, times, transpose, turning } from "../mat3.js";
import { standHeight } from "../race/landing.js";
import { add, cross, dot, length, normalize, scale, sub } from "../vec3.js";
import { sparTip } from "./dragonSparTip.js";

const SOFT = 0.3;

/**
 * Wing-arm rotations that plant the wing hand (`wing-wrist-*`) on the ground at rest: shoulder and
 * elbow by two-bone reach with the elbow bowed towards `pole`, the hand turned by `hand` (Euler,
 * against the forearm, mirrored per side) and its free fingers (`wing-hand-*`) aimed along `fingers`
 * (a direction in the body's frame) with their backs up. `bones` already holds the body's standing
 * rotations. `reach` places the hand ahead of, outside and above the `ground` (a height in the posed
 * model, the stand height under the root by default), in arm lengths; given a `bend` (radians), the hand
 * keeps reach's heading but slides in or out until the elbow closes that far, easing in under the
 * shoulder when the ground is out of reach at that bend. `spars` aims each wing spar along a direction in
 * the body's frame;
 * `tuck` slides the membrane's rear root (`wing-anchor-*`) a share `tuck[0]` of the way to a point
 * `tuck[1]` down the forearm and then `shift` (in the body's frame, mirrored per side), and the root
 * turns to keep facing the wrist and shoulder.
 */
export function handStance(anatomy, bones, { reach, hand, fingers, pole, spars, tuck, shift = [0, 0, 0], bend, ground }) {
  const matrices = boneMatrices(anatomy, { bones }),
    rest = boneMatrices(anatomy);
  const at = (id) => anatomy.bones.findIndex((bone) => bone.id === id);
  const floor = ground ?? anatomy.bones[at("root")].position[1] - standHeight(anatomy.genome, anatomy.age);
  const rootRotation = rotationOf(matrices[at("root")]),
    rootAt = originOf(matrices[at("root")]),
    rootRest = originOf(rest[at("root")]);
  const local = (p) => apply(transpose(rootRotation), sub(p, rootAt));
  const restLocal = (id) => sub(originOf(rest[at(id)]), rootRest);
  const toward = (p, from) => normalize(sub(p, from));
  const out = {};
  for (const side of [-1, 1]) {
    const shoulder = at(`wing-${side}`);
    const upper = anatomy.bones[at(`wing-elbow-${side}`)].position,
      lower = anatomy.bones[at(`wing-wrist-${side}`)].position;
    const a = length(upper),
      b = length(lower);
    const parent = rotationOf(matrices[at(anatomy.bones[shoulder].parent)]);
    const start = originOf(matrices[shoulder]);
    const arm = a + b;
    const height = floor + reach[1] * arm,
      spare = a * a + b * b + 2 * a * b * Math.cos(bend ?? 0) - (start[1] - height) ** 2,
      soft = (SOFT * arm) ** 2,
      flat = bend === undefined ? arm : Math.sqrt((spare + Math.hypot(spare, soft)) / 2) / Math.hypot(reach[0], reach[2]);
    const target = [start[0] + reach[0] * flat, height, start[2] + side * reach[2] * flat];
    const toTarget = sub(target, start);
    const d = Math.min(length(toTarget), arm * 0.999);
    const axis = normalize(toTarget);
    const bow = [pole[0], pole[1], side * pole[2]];
    const off = normalize(sub(bow, scale(axis, dot(bow, axis))));
    const along = (a * a - b * b + d * d) / (2 * d);
    const elbow = add(start, add(scale(axis, along), scale(off, Math.sqrt(Math.max(0, a * a - along * along)))));
    const wrist = add(start, scale(axis, d));
    const bindPlane = cross(upper, lower);
    const upperWorld = times(frame(sub(elbow, start), sub(wrist, elbow)), transpose(frame(upper, lower)));
    const shoulderLocal = times(transpose(parent), upperWorld);
    const forearm = apply(transpose(upperWorld), sub(wrist, elbow));
    const turn = Math.atan2(dot(cross(lower, forearm), normalize(bindPlane)), dot(lower, forearm));
    const n = normalize(bindPlane),
      c = Math.cos(turn),
      s = Math.sin(turn);
    const elbowLocal = [0, 1, 2].map((r) =>
      [0, 1, 2].map((k) => c * (r === k) + s * [[0, -n[2], n[1]], [n[2], 0, -n[0]], [-n[1], n[0], 0]][r][k] + (1 - c) * n[r] * n[k]),
    );
    const wristLocal = rotationOf(transform([0, 0, 0], [side * hand[0], side * hand[1], hand[2]]));
    const handWorld = times(times(upperWorld, elbowLocal), wristLocal);
    const aims = spars.map((direction, n) => {
      const mirrored = normalize([direction[0], direction[1], side * direction[2]]);
      const toward = apply(transpose(handWorld), apply(rootRotation, mirrored));
      return euler(turning(normalize(sparTip(anatomy, `wing-spar-${side}-${n}`)), normalize(toward)));
    });
    const anchorRest = anatomy.bones[at(`wing-anchor-${side}`)].position;
    const anchor = add(scale(sub(local(add(elbow, scale(sub(wrist, elbow), tuck[1]))), anchorRest), tuck[0]), [shift[0], shift[1], side * shift[2]]),
      anchorAt = add(anchorRest, anchor);
    const anchorTurn = euler(
      times(
        frame(toward(local(wrist), anchorAt), toward(local(start), anchorAt)),
        transpose(frame(toward(restLocal(`wing-wrist-${side}`), anchorRest), toward(restLocal(`wing-${side}`), anchorRest))),
      ),
    );
    out[side] = { anchor, anchorTurn, shoulder: euler(shoulderLocal), elbow: euler(elbowLocal), wrist: euler(wristLocal), fingers: aimFingers(handWorld, rootRotation, fingers, side), spars: aims };
  }
  return out;
}

/**
 * Rotation of `wing-hand-*` against the wrist (world rotation `wrist`) that aims the free fingers
 * along `direction` in the body's frame (world rotation `body`), mirrored per side, backs up.
 */
export function aimFingers(wrist, body, direction, side) {
  const along = apply(body, normalize([direction[0], direction[1], side * direction[2]]));
  return euler(times(transpose(wrist), frame(along, apply(body, [0, 1, 0]))));
}
