import { primitive } from "../geometry.js";
import { apply, frame, rotationOf, times } from "../mat3.js";
import { boneMatrices, point, transform } from "../math3d.js";
import { handStance } from "./dragonHandStance.js";

const ROOTS = 0.3;
// Wingspans in metres over which a short-winged adult straightens its elbow by `params.straighten` and
// moves the membrane's rear root to `params.wide`, none at the first and all of it at the second, so its
// short arm and membrane reach out past the legs.
const SHORT = [15, 13.5];
const cache = new WeakMap();
const roots = new WeakMap();

/** The wing hands' finger points (claws aside) per side, in the `wing-hand-*` bone's frame. */
function handPoints(anatomy) {
  if (cache.has(anatomy)) return cache.get(anatomy);
  const sides = {};
  for (const side of [-1, 1])
    sides[side] = anatomy.parts
      .filter((part) => part.bone === `wing-hand-${side}` && !/claw/.test(part.id))
      .flatMap((part) => {
        const local = transform(part.position, part.rotation, part.scale);
        const { vertices } = primitive(part);
        return Array.from({ length: vertices.length / 3 }, (_, v) => point(local, vertices.slice(3 * v, 3 * v + 3)));
      });
  cache.set(anatomy, sides);
  return sides;
}

/** The finger points nearest the wrist (`palm`) and nearest the tips (`tips`), in the hand's frame. */
function palmAndTips(anatomy) {
  if (roots.has(anatomy)) return roots.get(anatomy);
  const points = handPoints(anatomy)[1];
  const xs = points.map((p) => p[0]);
  const back = Math.min(...xs),
    front = Math.max(...xs),
    span = front - back;
  const split = { palm: points.filter((p) => p[0] <= back + ROOTS * span), tips: points.filter((p) => p[0] >= front - ROOTS * span) };
  roots.set(anatomy, split);
  return split;
}

/** The finger aim `fingers` (in the body's frame) pitched so the palm and fingertips lie level under the body's world rotation `body`. */
function levelFingers(anatomy, body, fingers) {
  const { palm, tips } = palmAndTips(anatomy);
  if (!palm.length || !tips.length) return fingers;
  const flat = Math.hypot(fingers[0], fingers[2]);
  const aim = (pitch) => [fingers[0], flat * Math.tan(pitch), fingers[2]];
  const low = (points, hand) => Math.min(...points.map((p) => apply(hand, p)[1]));
  const gap = (pitch) => {
    const hand = times(body, frame(aim(pitch), [0, 1, 0]));
    return low(palm, hand) - low(tips, hand);
  };
  let lo = -1.2,
    hi = 1.2;
  if (Math.sign(gap(lo)) === Math.sign(gap(hi))) return fingers;
  for (let n = 0; n < 24; n++) {
    const mid = (lo + hi) / 2;
    if (Math.sign(gap(mid)) === Math.sign(gap(lo))) lo = mid;
    else hi = mid;
  }
  return aim((lo + hi) / 2);
}

/** Lowest height of each wing hand under the bone matrices `m`. */
export function handLows(anatomy, m) {
  const points = handPoints(anatomy);
  const low = {};
  for (const side of [-1, 1]) {
    const hand = m[anatomy.bones.findIndex((bone) => bone.id === `wing-hand-${side}`)];
    low[side] = Math.min(...points[side].map((p) => point(hand, p)[1]));
  }
  return low;
}

/**
 * The hand stance for `params` with the fingers pitched to lie flat, palm and tips level, and the reach
 * raised or lowered until the lowest finger of each hand meets `floor` (a height per side in the posed model). `bones` already holds the body's standing rotations;
 * Short wings move `params.shift` towards `params.wide` for the anatomy's leg shape and open the elbow from `params.bend` by up to `params.straighten`.
 * @param {Record<number, number>} floor
 */
export function plantHands(anatomy, bones, params, floor) {
  const arm = ["wing-elbow-1", "wing-wrist-1"].reduce((sum, id) => sum + Math.hypot(...anatomy.bones.find((bone) => bone.id === id).position), 0);
  const body = rotationOf(boneMatrices(anatomy, { bones })[anatomy.bones.findIndex((bone) => bone.id === "root")]);
  const fingers = levelFingers(anatomy, body, params.fingers);
  const short = Math.min(1, Math.max(0, (SHORT[0] - anatomy.genome.wingspan) / (SHORT[0] - SHORT[1]))),
    base = params.shift ?? [0, 0, 0],
    wide = params.wide?.[anatomy.legs] ?? base,
    shift = base.map((v, i) => v + (wide[i] - v) * short),
    bend = params.bend - (params.straighten ?? 0) * short;
  let reach = params.reach,
    hands;
  for (let pass = 0; pass < 4; pass++) {
    hands = handStance(anatomy, bones, { ...params, shift, bend, fingers, reach });
    const trial = { ...bones };
    for (const side of [-1, 1]) {
      trial[`wing-${side}`] = { rotation: hands[side].shoulder };
      trial[`wing-elbow-${side}`] = { rotation: hands[side].elbow };
      trial[`wing-wrist-${side}`] = { rotation: hands[side].wrist };
      trial[`wing-hand-${side}`] = { rotation: hands[side].fingers };
    }
    const low = handLows(anatomy, boneMatrices(anatomy, { bones: trial }));
    const gap = Math.max(floor[1] - low[1], floor[-1] - low[-1]);
    if (Math.abs(gap) < 0.01 * arm) break;
    reach = [reach[0], reach[1] + gap / arm, reach[2]];
  }
  return hands;
}
