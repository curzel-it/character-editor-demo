import { multiply, point, transform } from "../math3d.js";
import { makeSkinMesh } from "../skinMesh.js";
import { standHeight } from "../race/landing.js";
import { smoothstep } from "./flightMotion.js";
import { hash } from "./flightNoise.js";
import { foldStance } from "./dragonWingFold.js";
import { plantFeet } from "./dragonFootPlant.js";
import { mouthProfile } from "./dragonMouth.js";
import { sparTip } from "./dragonSparTip.js";
import { apply, euler, rotationOf, times, transpose, turning } from "../mat3.js";
import { normalize } from "../vec3.js";

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const mix = (a, b, k) => a + (b - a) * k;

/** Seconds per breath asleep; the loop is `BREATHS` of them, two of which carry a twitch. */
const BREATH = { kid: 2.6, teen: 3.2, adult: 3.8 };
const BREATHS = 6;
/** Tail tip flick, wing hand flick, toe curl and head nuzzle. */
const TWITCHES = 4;

const LIE = {
  roll: 0.07,
  pitch: -0.08,
  chest: -0.1,
  leg: { thigh: [-0.25, 0.05, 1.7], shin: [0.12, 0, -1.65], foot: 2.4 },
  neck: { yaw: [0.6, 1.4, 2.1, 2.6], pitch: [1, 0.35, 0.1] },
  tail: [0.3, 0.42, 0.5, 0.55, 0.55, 0.5, 0.45],
};
/** How far the neck curls round, per age: a kid's short neck only turns the head aside. */
const NECK_CURL = { kid: 0.5, teen: 0.9, adult: 1 };
const BLANKET = {
  upper: [-0.9, -0.1, 0.25],
  lower: [0.85, -0.3, 0.05],
  spread: 0,
  shift: [0, 0, 0],
  spars: [
    [-0.9, 0.3, -0.3],
    [-1, 0.05, -0.12],
    [-1, -0.2, -0.02],
  ],
};

/** Sleep amount in `motion`, 0 awake to 1 curled up asleep. */
export const sleepOf = (motion) => (Number.isFinite(motion?.sleep) ? clamp(motion.sleep, 0, 1) : 0);

/** The side the neck and tail curl towards: +1 (the default) towards +Z, -1 towards -Z. */
/** How far the eyes are shut (0..1) by `motion.sleep`, closing late in the fall asleep. */
export const sleepShut = (motion) => smoothstep(0.65, 0.95, sleepOf(motion));
const sideOf = (motion) => (motion?.sleepSide < 0 ? -1 : 1);

/** Seconds after which the sleeping pose repeats exactly, twitches included. */
export const slumberLoop = (anatomy) => BREATHS * (BREATH[anatomy.age] ?? BREATH.adult);

const contacts = new WeakMap();

/**
 * Per bone, the hide points it mostly carries, foot claws aside, each as its two joints, the first
 * joint's weight and the point in both joints' frames, so it can be skinned as the renderer does.
 */
function contactPoints(anatomy) {
  if (contacts.has(anatomy)) return contacts.get(anatomy);
  const { vertices, inverseBind } = makeSkinMesh({ ...anatomy, parts: anatomy.parts.filter(({ id }) => !id.startsWith("talon-")) });
  const all = anatomy.bones.map(() => []);
  for (let v = 0; v < vertices.length; v += 12) {
    const p = [vertices[v], vertices[v + 1], vertices[v + 2]],
      a = vertices[v + 9],
      b = vertices[v + 10],
      w = vertices[v + 11];
    all[w >= 0.5 ? a : b].push({ a, b, w, pa: point(inverseBind[a], p), pb: point(inverseBind[b], p) });
  }
  contacts.set(anatomy, all);
  return all;
}

const chains = new WeakMap();

/** World matrix of bone `id` under `bones`, composed along its ancestors only. */
function worldOf(anatomy, bones, id) {
  if (!chains.has(anatomy)) chains.set(anatomy, new Map());
  const cache = chains.get(anatomy);
  if (!cache.has(id)) {
    const chain = [];
    for (let bone = anatomy.bones.find((b) => b.id === id); bone; bone = anatomy.bones.find((b) => b.id === bone.parent)) chain.unshift(bone);
    cache.set(id, chain);
  }
  let world = null;
  for (const bone of cache.get(id)) {
    const delta = bones[bone.id] ?? {};
    const local = transform(
      bone.position.map((v, i) => v + (delta.position?.[i] ?? 0)),
      (bone.rotation ?? [0, 0, 0]).map((v, i) => v + (delta.rotation?.[i] ?? 0)),
      delta.scale ? [delta.scale, delta.scale, delta.scale] : undefined,
    );
    world = world ? multiply(world, local) : local;
  }
  return world;
}

function toward(bones, id, rotation, k, position) {
  const bone = (bones[id] ??= {});
  const r = bone.rotation ?? [0, 0, 0];
  bone.rotation = r.map((v, i) => mix(v, rotation[i], k));
  const p = bone.position ?? [0, 0, 0];
  const to = position ?? [0, 0, 0];
  if (bone.position || position) bone.position = p.map((v, i) => mix(v, to[i], k));
}

const quaternion = (rotation) => {
  const R = rotationOf(transform([0, 0, 0], rotation));
  const w = Math.sqrt(Math.max(0, 1 + R[0][0] + R[1][1] + R[2][2])) / 2,
    x = Math.sqrt(Math.max(0, 1 + R[0][0] - R[1][1] - R[2][2])) / 2,
    y = Math.sqrt(Math.max(0, 1 - R[0][0] + R[1][1] - R[2][2])) / 2,
    z = Math.sqrt(Math.max(0, 1 - R[0][0] - R[1][1] + R[2][2])) / 2;
  return [w, x * Math.sign(R[2][1] - R[1][2] || 1), y * Math.sign(R[0][2] - R[2][0] || 1), z * Math.sign(R[1][0] - R[0][1] || 1)];
};

/** Like `toward`, along the shortest turn between the two orientations rather than angle by angle. */
function swing(bones, id, rotation, k, position) {
  const from = bones[id]?.rotation ?? [0, 0, 0];
  toward(bones, id, rotation, k, position);
  if (k <= 0 || k >= 1) return;
  const a = quaternion(from);
  let b = quaternion(rotation);
  if (a.reduce((sum, v, i) => sum + v * b[i], 0) < 0) b = b.map((v) => -v);
  const q = a.map((v, i) => v + (b[i] - v) * k),
    n = Math.hypot(...q);
  const [w, x, y, z] = q.map((v) => v / n);
  bones[id].rotation = euler([
    [1 - 2 * (y * y + z * z), 2 * (x * y - w * z), 2 * (x * z + w * y)],
    [2 * (x * y + w * z), 1 - 2 * (x * x + z * z), 2 * (y * z - w * x)],
    [2 * (x * z - w * y), 2 * (y * z + w * x), 1 - 2 * (x * x + y * y)],
  ]);
}

const nudge = (bones, id, delta) => {
  const bone = (bones[id] ??= {});
  bone.rotation = (bone.rotation ?? [0, 0, 0]).map((v, i) => v + delta[i]);
};

/** The root of `gap` in [lo, hi] by bisection, or the end nearer to one. */
function solve(gap, lo, hi) {
  let a = lo,
    b = hi,
    ga = gap(a);
  const gb = gap(b);
  if (Math.sign(ga) === Math.sign(gb)) return Math.abs(ga) < Math.abs(gb) ? a : b;
  for (let n = 0; n < 18; n++) {
    const m = (a + b) / 2,
      gm = gap(m);
    if (Math.sign(gm) === Math.sign(ga)) [a, ga] = [m, gm];
    else b = m;
  }
  return (a + b) / 2;
}

/** Adds to the pitch of `id` the turn in [lo, hi] that brings `gap` to zero. */
function settle(bones, id, gap, lo = -1.4, hi = 1.4) {
  const bone = (bones[id] ??= {});
  const base = bone.rotation ?? [0, 0, 0];
  const at = (p) => {
    bone.rotation = [base[0], base[1], base[2] + p];
    return gap();
  };
  at(solve(at, lo, hi));
}

const laidPoses = new WeakMap();

/**
 * The full sleeping pose of one dragon, solved once: the body lowered until its belly and haunches
 * meet the ground its feet stood on, the shins and feet folded down onto it, the tail laid along it
 * and the head resting on it, the wings folded over the back with no spar below it.
 */
function laidPose(anatomy, side) {
  if (!laidPoses.has(anatomy)) laidPoses.set(anatomy, new Map());
  const cache = laidPoses.get(anatomy);
  if (cache.has(side)) return cache.get(side);
  const at = (id) => anatomy.bones.findIndex((bone) => bone.id === id);
  const points = contactPoints(anatomy);
  const laid = { root: { rotation: [side * LIE.roll, 0, LIE.pitch] }, chest: { rotation: [0, 0, LIE.chest] } };
  const low = (id) => {
    const worlds = new Map();
    const height = (joint, [x, y, z]) => {
      if (!worlds.has(joint)) worlds.set(joint, worldOf(anatomy, laid, anatomy.bones[joint].id));
      const m = worlds.get(joint);
      return m[1] * x + m[5] * y + m[9] * z + m[13];
    };
    let y = Infinity;
    for (const { a, b, w, pa, pb } of points[at(id)]) y = Math.min(y, w * height(a, pa) + (1 - w) * height(b, pb));
    return y;
  };
  const ground = anatomy.bones[at("root")].position[1] - standHeight(anatomy.genome, anatomy.age);
  for (const s of [-1, 1]) laid[`leg-hind-${s}`] = { rotation: [s * LIE.leg.thigh[0], s * LIE.leg.thigh[1], LIE.leg.thigh[2]] };
  laid.root.position = [0, ground - Math.min(...["root", "chest", "leg-hind-1", "leg-hind--1"].map(low)), 0];

  for (const s of [-1, 1]) {
    laid[`shin-hind-${s}`] = { rotation: [s * LIE.leg.shin[0], s * LIE.leg.shin[1], LIE.leg.shin[2]] };
    laid[`foot-hind-${s}`] = { rotation: [0, 0, LIE.leg.foot] };
    settle(laid, `shin-hind-${s}`, () => low(`foot-hind-${s}`) - ground, -0.6, 0.6);
    settle(laid, `foot-hind-${s}`, () => low(`toes-hind-${s}`) - ground, -0.8, 0.8);
  }
  plantFeet(laid, anatomy, 1);
  for (const s of [-1, 1]) settle(laid, `foot-hind-${s}`, () => Math.min(low(`toes-hind-${s}`), low(`hallux-hind-${s}`)) - ground, -0.4, 0.4);

  for (let i = 0; i < 7; i++) laid[`tail-${i}`] = { rotation: [0, side * LIE.tail[i], 0] };
  for (let i = 0; i < 6; i++) settle(laid, `tail-${i}`, () => low(`tail-${i + 1}`) - ground);

  const folded = foldStance(anatomy, laid, BLANKET);
  const bodyTurn = rotationOf(worldOf(anatomy, laid, "root"));
  for (const s of [-1, 1]) {
    const wing = folded[s];
    laid[`wing-${s}`] = { rotation: wing.shoulder };
    laid[`wing-elbow-${s}`] = { rotation: wing.elbow };
    laid[`wing-wrist-${s}`] = { rotation: wing.wrist };
    laid[`wing-hand-${s}`] = { rotation: [0, 0, 0] };
    laid[`wing-anchor-${s}`] = { rotation: wing.anchorTurn, position: wing.anchor };
    const hand = rotationOf(worldOf(anatomy, laid, `wing-wrist-${s}`));
    BLANKET.spars.forEach(([x, y, z], n) => {
      const id = `spar-${s}-${n}`;
      const end = sparTip(anatomy, `wing-${id}`),
        tip = normalize(end);
      const aimed = (lift) => {
        laid[id] = { rotation: euler(turning(tip, apply(transpose(hand), apply(bodyTurn, normalize([x, y + lift, s * z]))))) };
        return point(worldOf(anatomy, laid, id), end)[1] - ground - 0.1 * anatomy.scale;
      };
      if (aimed(0) < 0) aimed(solve(aimed, 0, 1));
    });
    for (const [name, next, along] of [["hindwing", "hindwing-elbow", "tail-3"], ["hindwing-elbow", "hindwing-tip", "tail-5"]]) {
      const id = `${name}-${s}`;
      const tail = worldOf(anatomy, laid, along);
      const target = [0, 1, 2].map((k) => tail[12 + k] + s * 0.35 * anatomy.scale * tail[8 + k] + (k === 1 ? 0.25 * anatomy.scale : 0));
      const bone = anatomy.bones[at(id)];
      const parent = worldOf(anatomy, laid, bone.parent);
      const origin = point(parent, bone.position);
      const aim = apply(transpose(rotationOf(parent)), normalize(target.map((v, k) => v - origin[k])));
      laid[id] = { rotation: euler(turning(normalize(anatomy.bones[at(`${next}-${s}`)].position), aim)) };
    }
    laid[`hindwing-tip-${s}`] = { rotation: [0, 0, 0] };
  }

  laid.jaw = { rotation: [0, 0, mouthProfile(anatomy).closed + 0.05] };
  const tilt = -(LIE.pitch + LIE.chest) - 0.08,
    curled = NECK_CURL[anatomy.age] ?? 1;
  const reach = (q) => {
    let parent = rotationOf(transform());
    const pitch = [q, LIE.neck.pitch[1] * q, LIE.neck.pitch[2] * q, tilt];
    ["neck-0", "neck-1", "neck-2", "head"].forEach((id, i) => {
      const roll = id === "head" ? side * 0.12 : 0;
      const orient = times(
        times(rotationOf(transform([0, 0, 0], [0, -side * curled * LIE.neck.yaw[i], 0])), rotationOf(transform([0, 0, 0], [0, 0, pitch[i]]))),
        rotationOf(transform([0, 0, 0], [roll, 0, 0])),
      );
      laid[id] = { rotation: euler(times(transpose(parent), orient)) };
      parent = orient;
    });
    return Math.min(low("head"), low("jaw")) - ground;
  };
  reach(solve(reach, -1.4, 0.4));
  cache.set(side, laid);
  return laid;
}

const FOLDS = /^(wing|spar)/;
const CURLS = /^(tail|neck|head)/;

/**
 * The slumber layered over a standing pose: the dragon lies down on its belly with the legs folded
 * under it, folds the wings over its back like a blanket, curls its neck and tail round to one side
 * with the head resting on the ground, shuts its eyes (`sleepShut`) and breathes slowly and deeply, with a rare
 * twitch. `motion.sleep` (0..1) runs the transition from standing, waking runs it back, and
 * `motion.sleepSide` picks the side it curls towards. Breathing follows `time` and loops every
 * `slumberLoop(anatomy)` seconds; without `time` one breath fills the loop of `theta`.
 */
export function slumberPose(bones, anatomy, motion, { theta, time, seed }) {
  const sleep = sleepOf(motion),
    side = sideOf(motion);
  const laid = laidPose(anatomy, side);
  const lie = smoothstep(0, 0.55, sleep),
    curl = smoothstep(0.25, 0.85, sleep),
    deep = smoothstep(0.8, 1, sleep);
  for (const [id, { rotation, position }] of Object.entries(laid)) {
    const share = CURLS.test(id) ? curl : lie;
    if (FOLDS.test(id)) swing(bones, id, rotation, share, position);
    else toward(bones, id, rotation, share, position);
  }
  for (const id of ["tongue", "tongue-tip"]) if (bones[id]) toward(bones, id, [0, 0, 0], lie);

  const period = BREATH[anatomy.age] ?? BREATH.adult;
  const cycle = time === null ? theta / TAU : time / period;
  const phase = cycle - Math.floor(cycle);
  const breath = deep * (0.5 - 0.5 * Math.cos(TAU * phase + 0.6 * Math.sin(TAU * phase)));
  nudge(bones, "chest", [0, 0, 0.045 * breath]);
  nudge(bones, "neck-0", [0, 0, -0.035 * breath]);
  for (const s of [-1, 1]) {
    nudge(bones, `wing-${s}`, [-s * 0.05 * breath, 0, 0]);
    if (bones[`nostril-${s}`]) toward(bones, `nostril-${s}`, [s * 0.12 * breath, 0, 0], lie);
  }

  const count = ((Math.floor(cycle) % BREATHS) + BREATHS) % BREATHS;
  const first = Math.floor(hash(seed, 1) * BREATHS),
    second = (first + BREATHS / 2) % BREATHS,
    pick = Math.floor(hash(seed, 2) * TWITCHES);
  const kind = time === null ? -1 : count === first ? pick : count === second ? (pick + 1) % TWITCHES : -1;
  const u = clamp((phase - 0.15 - 0.4 * hash(seed + 1, count)) / 0.28, 0, 1);
  const twitch = deep * Math.sin(Math.PI * u) ** 2,
    flick = twitch * Math.sin(3 * Math.PI * u);
  if (kind === 0) for (const i of [5, 6]) nudge(bones, `tail-${i}`, [0, side * 0.25 * flick, 0.05 * twitch]);
  if (kind === 1) nudge(bones, `wing-wrist-${side}`, [side * 0.08 * flick, 0, 0.05 * flick]);
  if (kind === 2) nudge(bones, `toes-hind-${side}`, [0, 0, 0.35 * twitch]);
  if (kind === 3) nudge(bones, "head", [side * 0.08 * twitch, -side * 0.06 * twitch, 0.04 * twitch]);

}
