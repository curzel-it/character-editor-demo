import { boneMatrices } from "../math3d.js";
import { apply, euler, frame, originOf, rotationOf, times, transpose, turning } from "../mat3.js";
import { add, cross, normalize, scale, sub } from "../vec3.js";
import { aimFingers } from "./dragonHandStance.js";
import { sparTip } from "./dragonSparTip.js";

/**
 * Wing-arm rotations that fold the wing flat against the flank the way a bat folds: the humerus
 * along `upper` and the forearm along `lower` (directions in the body's frame, mirrored per side)
 * with the elbow kept a hinge and the wrist unbent, so the trailing spar stays swept back along
 * the forearm's line; the other spars close onto it, each `spread` radians further towards the
 * leading edge, all turned `sweep` radians more (negative sweeps them back), and `lift` tilted out of the wing plane; the free fingers aim along `fingers` when
 * given. `shift` moves the membrane's rear root (`wing-anchor-*`) in the body's frame, and the root
 * turns to keep facing the wrist and the shoulder, or with `roll` its shoulder side rolled down into
 * the flank and `roll` out. `bones` already holds the body's standing rotations.
 */
export function foldStance(anatomy, bones, { upper, lower, spread, sweep = 0, lift = 0, shift, roll, fingers }) {
  const matrices = boneMatrices(anatomy, { bones }),
    rest = boneMatrices(anatomy);
  const at = (id) => anatomy.bones.findIndex((bone) => bone.id === id);
  const rootRotation = rotationOf(matrices[at("root")]),
    rootAt = originOf(matrices[at("root")]),
    rootRest = originOf(rest[at("root")]);
  const out = {};
  for (const side of [-1, 1]) {
    const inBody = ([x, y, z]) => apply(rootRotation, normalize([x, y, side * z]));
    const shoulder = at(`wing-${side}`);
    const humerus = anatomy.bones[at(`wing-elbow-${side}`)].position,
      forearm = anatomy.bones[at(`wing-wrist-${side}`)].position;
    const parent = rotationOf(matrices[at(anatomy.bones[shoulder].parent)]);
    const u = inBody(upper),
      f = inBody(lower);
    const bindNormal = normalize(cross(humerus, forearm));
    const upperWorld = times(frame(u, f), transpose(frame(humerus, forearm)));
    const elbowLocal = turning(normalize(forearm), apply(transpose(upperWorld), f));
    const wristWorld = times(upperWorld, elbowLocal);
    const tips = [0, 1, 2].map((n) => normalize(sparTip(anatomy, `wing-spar-${side}-${n}`)));
    const normal = apply(wristWorld, bindNormal),
      trailing = apply(wristWorld, tips[2]);
    const aims = tips.map((_, n) => {
      const a = spread * (2 - n) + sweep,
        swung = add(scale(trailing, Math.cos(a)), scale(cross(normal, trailing), Math.sin(a)));
      return normalize(add(swung, scale(normal, side * lift)));
    });
    const spars = tips.map((tip, n) => euler(times(transpose(wristWorld), times(frame(aims[n], normal), transpose(frame(tip, bindNormal))))));
    const start = originOf(matrices[shoulder]);
    const elbow = add(start, scale(u, Math.hypot(...humerus))),
      wrist = add(elbow, scale(f, Math.hypot(...forearm)));
    const anchorRest = anatomy.bones[at(`wing-anchor-${side}`)].position,
      anchor = [shift[0], shift[1], side * shift[2]];
    const local = (p) => apply(transpose(rootRotation), sub(p, rootAt));
    const restLocal = (id) => sub(originOf(rest[at(id)]), rootRest);
    const toward = (p, root) => normalize(sub(p, root));
    const anchorAt = add(anchorRest, anchor);
    const anchorTurn = euler(
      times(
        frame(toward(local(wrist), anchorAt), roll === undefined ? toward(local(start), anchorAt) : [0, -1, side * roll]),
        transpose(frame(toward(restLocal(`wing-wrist-${side}`), anchorRest), toward(restLocal(`wing-${side}`), anchorRest))),
      ),
    );
    out[side] = {
      anchor,
      anchorTurn,
      shoulder: euler(times(transpose(parent), upperWorld)),
      elbow: euler(elbowLocal),
      wrist: [0, 0, 0],
      fingers: fingers && aimFingers(wristWorld, rootRotation, fingers, side),
      spars,
    };
  }
  return out;
}
