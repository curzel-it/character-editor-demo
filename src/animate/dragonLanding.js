import { plantHands } from "./dragonHandPlant.js";
import { foldStance } from "./dragonWingFold.js";
import { boneMatrices } from "../math3d.js";
import { plantFeet } from "./dragonFootPlant.js";

const mix = (a, b, k) => a + (b - a) * k;

// Standing legs, neck and tail shared by every age, like a big bird or a theropod: digitigrade legs,
// the neck in an S with the head level, and the tail arcing down from the hips to trail just off the ground.
const STAND = {
  leg: { thigh: 0.49, splay: 0.06, shin: 0.04, foot: 0.7, toes: 0.96, hallux: 0.8 },
  neck: [0.3, -0.1, -0.3],
  tail: { curl: 0.07, pitch: [0.1, 0.12, 0.03, -0.09, -0.25, -0.11, -0.11] },
};
// Radians the standing tail arcs to the dragon's right per metre of tail segment, so a long adult
// tail sweeps round behind it, away from the yard's barn and crates on its left.
const TAIL_BEND = 0.3;
// The wing a folding age opens towards as it leaves the ground, so the fold unfolds up and out.
const OPEN = { upper: [-0.1, 0.35, 1], lower: [0.25, 0.05, 1], spread: 0.35, sweep: 0 };
// Adults rest like a gorilla on the wing hands, the heaviest forward, on hind legs bent like a
// theropod's: the thigh down and forward, the shin raked back and the foot up to a raised heel. The
// humerus runs out to an elbow level with the shoulder, the forearm down and forward to a hand under
// the elbow and well ahead of the feet, the spars sweep back, up and out over the thigh and the
// membrane's rear root slides a little towards the forearm and up and out off the hip, so the
// membrane spans outside the leg; short wings `straighten` the elbow so the hand lands wide of the
// legs and move the root out to `wide` over the bulkier leg shapes.
const KNUCKLE = {
  body: 0.2,
  chest: 0.05,
  reach: [0.35, 0.1, 0.55],
  bend: 1,
  straighten: 0.45,
  pole: [-1, 0, 1],
  hand: [-0.2, -0.2, 0.6],
  fingers: [0.8, -0.5, 0.3],
  spars: [
    [-1, 0.6, 0.55],
    [-1, 0.78, 0.4],
    [-1, 1.05, 0.2],
  ],
  tuck: [0.2, 0.3],
  shift: [0, 0.15, 0.35],
  wide: { armoured: [0, 0.15, 0.6] },
  neck: [0.2, -0.1, -0.35],
  leg: { thigh: 0.2, splay: 0.35, shin: 0.2, foot: 0.95 },
};
// Teens stand half upright, between the proud kid and the adult on its hands, with the wings in a
// looser Z than a kid's: the humerus back, down and out over the thigh, the forearm forward across the
// chest with the hands just under it, the spars closed, swept back and tilted out to clear the leg, and
// the membrane's rear root moved back, down and out to the side of the thigh so the membrane hangs under the arm.
const FOLD = {
  body: 0.18,
  chest: 0,
  upper: [-0.8, -0.35, 0.45],
  lower: [1, 0.05, 0.15],
  spread: 0.2,
  sweep: -0.45,
  fingers: [1, -0.15, 0.25],
  lift: 0.15,
  shift: [-0.3, -0.3, 0.3],
  neck: [0.45, -0.05, -0.35],
  tail: 0.2,
  open: OPEN,
};
// Kids tuck the wings in a tight Z on the flank: the humerus back and a little up to an elbow raised
// beside the spine, the forearm forward and down along the chest with the free fingers ahead of it,
// the spars closed and swept back and down along the flank, tilted in to lie on it, and the
// membrane's rear root kept low on the hip so no part of the wing crosses over the back.
const TUCK = {
  body: 0.46,
  chest: 0.04,
  upper: [-0.9, 0.1, 0.4],
  lower: [1, -0.4, 0.1],
  spread: 0.1,
  sweep: -0.4,
  fingers: [1, -0.4, 0.2],
  lift: -0.15,
  shift: [0.25, -0.1, 0.12],
  roll: 0.6,
  neck: STAND.neck,
  tail: -0.3,
  open: OPEN,
};
export const rests = { adult: KNUCKLE, teen: FOLD, kid: TUCK };
// Kids stand proud, the chest raised over the same legs and tail.
const rearing = { kid: 0.3 };
const GRIP = 0.35;
const TOES = ["toes-hind-1", "toes-hind--1"];

/** The rest's fold opened a share `k` of the way towards its `open` wing, so leaving the ground unfolds the wing up and out. */
function unfold(rest, k) {
  if (!rest.open || k <= 0) return rest;
  const { upper, lower, spread, sweep, lift = 0 } = rest.open;
  const along = (a, b) => a.map((v, i) => mix(v, b[i], k));
  return { ...rest, upper: along(rest.upper, upper), lower: along(rest.lower, lower), spread: mix(rest.spread, spread, k), sweep: mix(rest.sweep, sweep, k), lift: mix(rest.lift, lift, k) };
}

/**
 * How far a folding wing has left the flight pose for its solved fold at `stand`: all the way early,
 * while the fold is still near the open wing, so the elbow then follows the solver's own hinge
 * instead of blending angle by angle into a fold that turns it nearly round.
 */
function grip(stand) {
  const k = Math.min(1, stand / GRIP);
  return k * k * (3 - 2 * k);
}

/**
 * Raises the whole tail from its root just enough that no tail joint hangs below the toes; with
 * `settle` (0..1) it also lowers a tail held off the ground that far towards its lowest joint resting
 * on the floor, so a standing tail that arcs round to the side still trails on the ground.
 */
export function clearTail(bones, anatomy, settle = 0) {
  const at = (id) => anatomy.bones.findIndex((bone) => bone.id === id);
  const tail = anatomy.bones.flatMap((bone, i) => (bone.id.startsWith("tail-") ? [i] : []));
  const root = at("tail-0");
  if (root < 0) return;
  for (let pass = 0; pass < 5; pass++) {
    const matrices = boneMatrices(anatomy, { bones });
    const y = (i) => matrices[i][13];
    const floor = Math.min(...TOES.map((id) => y(at(id))));
    let raise = -Infinity;
    for (const i of tail) {
      const reach = Math.hypot(matrices[i][12] - matrices[root][12], matrices[i][14] - matrices[root][14]);
      if (reach > 1e-3) raise = Math.max(raise, (floor - y(i)) / reach);
    }
    if (raise <= 1e-3 && settle * raise >= -1e-3) return;
    if (raise > 0) add(bones, "tail-0", [0, 0, -raise]);
    // Lowered along its first three joints, so the hip skin doesn't fold at one sharp bend.
    else for (let i = 0; i < 3; i++) add(bones, `tail-${i}`, [0, 0, (-settle * raise) / 3]);
  }
}

function blend(bones, id, target, k) {
  if (k <= 0) return;
  const bone = (bones[id] ??= {});
  const rotation = bone.rotation ?? [0, 0, 0];
  bone.rotation = rotation.map((v, i) => mix(v, target[i], k));
  if (bone.position) bone.position = bone.position.map((v) => v * (1 - k));
}

const add = (bones, id, delta) => {
  const bone = (bones[id] ??= {});
  const rotation = bone.rotation ?? [0, 0, 0];
  bone.rotation = rotation.map((v, i) => v + delta[i]);
};

/**
 * Landing layered over the flight pose. `flare` (0..1) pitches the body up, cups the wings forward
 * and swings the legs down to reach for the ground; `stand` (0..1) blends to rest: adults on the
 * hind legs and tipped forward onto the planted wing hands, teens half upright with the wings in a
 * loose Z, kids proud on digitigrade legs with the wings tucked in a Z (`rest` stands in for the age's
 * stance when given); `impact`
 * (0..1) crouches the legs and dips the neck.
 */
export function landingPose(bones, anatomy, state) {
  const { flare, stand, impact, theta, slow, hindWings } = state;
  const rest = state.rest ?? rests[anatomy.age];
  if (flare > 0) {
    const air = flare * (1 - stand);
    add(bones, "root", [0, 0, 0.25 * air]);
    add(bones, "chest", [0, 0, 0.1 * air]);
    for (const side of [-1, 1]) {
      add(bones, `wing-${side}`, [side * 0.05 * air, side * 0.05 * air, 0.15 * air]);
      add(bones, `wing-wrist-${side}`, [side * 0.05 * air, side * 0.1 * air, 0]);
      add(bones, `leg-hind-${side}`, [-side * 0.06 * air, 0, 0.55 * air]);
      add(bones, `shin-hind-${side}`, [0, 0, 0.2 * air]);
      add(bones, `foot-hind-${side}`, [0, 0, 0.35 * air]);
      add(bones, `toes-hind-${side}`, [0, 0, 1.3 * air]);
      add(bones, `hallux-hind-${side}`, [0, 0, 1.3 * air]);
    }
    add(bones, "neck-0", [0, 0, 0.1 * air]);
    add(bones, "head", [0, 0, -0.5 * air]);
    for (let i = 0; i < 7; i++) add(bones, `tail-${i}`, [0, 0, -0.05 * air]);
  }
  if (stand > 0) {
    const breathe = 0.01 * (1 - Math.cos(theta)) + 0.015 * slow(0.25, 23);
    const look = 0.35 * slow(0.12, 29);
    const rear = rearing[anatomy.age] ?? 0;
    const body = rest.body + breathe,
      chest = rest.chest + breathe;
    const leg = { ...STAND.leg, ...rest.leg };
    const standing = { root: { rotation: [0, 0, body] }, chest: { rotation: [0, 0, chest] } };
    for (const side of [-1, 1]) {
      standing[`leg-hind-${side}`] = { rotation: [-side * leg.splay, 0, leg.thigh - rear] };
      standing[`shin-hind-${side}`] = { rotation: [side * (leg.splay - STAND.leg.splay), 0, leg.shin] };
      standing[`foot-hind-${side}`] = { rotation: [0, 0, leg.foot] };
      standing[`toes-hind-${side}`] = { rotation: [0, 0, leg.toes] };
      standing[`hallux-hind-${side}`] = { rotation: [0, 0, leg.hallux] };
    }
    const sole = rest.reach && plantFeet(structuredClone(standing), anatomy, 1);
    const hands = rest.reach
      ? plantHands(anatomy, standing, { ...rest, ground: sole }, { 1: sole, [-1]: sole })
      : foldStance(anatomy, standing, unfold(rest, 1 - stand));
    const arm = rest.open ? grip(stand) : stand;
    for (const [id, { rotation }] of Object.entries(standing)) blend(bones, id, rotation, stand);
    for (const side of [-1, 1]) {
      blend(bones, `wing-${side}`, hands[side].shoulder, arm);
      blend(bones, `wing-elbow-${side}`, hands[side].elbow, arm);
      blend(bones, `wing-wrist-${side}`, hands[side].wrist, arm);
      blend(bones, `wing-hand-${side}`, hands[side].fingers, arm);
      blend(bones, `wing-anchor-${side}`, hands[side].anchorTurn ?? [0, 0, 0], arm);
      bones[`wing-anchor-${side}`].position = hands[side].anchor.map((v) => v * arm);
      hands[side].spars.forEach((spar, n) => blend(bones, `spar-${side}-${n}`, spar, arm));
      if (hindWings) {
        blend(bones, `hindwing-${side}`, [0, side * -0.5, 0], stand);
        blend(bones, `hindwing-elbow-${side}`, [0, side * 0.5, 0], stand);
        blend(bones, `hindwing-tip-${side}`, [0, side * -0.4, 0], stand);
      }
    }
    const neck = rest.neck;
    neck.forEach((pitch, i) => blend(bones, `neck-${i}`, [0, look * (0.4 + 0.2 * i), pitch], stand));
    blend(bones, "head", [0, look * 0.6, -(body + chest - 2 * breathe + neck[0] + neck[1] + neck[2]) - 0.08], stand);
    const segment = -(anatomy.bones.find((bone) => bone.id === "tail-1")?.position[0] ?? 0);
    for (let i = 0; i < 7; i++)
      blend(bones, `tail-${i}`, [0, STAND.tail.curl - TAIL_BEND * segment + 0.03 * Math.sin(theta + i), STAND.tail.pitch[i] + (i ? 0 : (rest.tail ?? 0))], stand);
    plantFeet(bones, anatomy, stand);
    clearTail(bones, anatomy, stand);
  }
  if (impact > 0) {
    add(bones, "root", [0, 0, -0.08 * impact]);
    for (const side of [-1, 1]) {
      add(bones, `leg-hind-${side}`, [0, 0, 0.15 * impact]);
      add(bones, `shin-hind-${side}`, [0, 0, 0.1 * impact]);
      add(bones, `foot-hind-${side}`, [0, 0, -0.1 * impact]);
      add(bones, `wing-${side}`, [side * 0.08 * impact, 0, 0]);
    }
    add(bones, "neck-0", [0, 0, -0.1 * impact]);
    add(bones, "neck-1", [0, 0, -0.1 * impact]);
    add(bones, "head", [0, 0, 0.25 * impact]);
    add(bones, "tail-0", [0, 0, 0.1 * impact]);
  }
}
