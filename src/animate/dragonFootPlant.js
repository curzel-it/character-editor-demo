import { primitive } from "../geometry.js";
import { boneMatrices, multiply, point, transform } from "../math3d.js";

const REACH = 0.35,
  SWING = 1.6,
  STEPS = 16;
const cache = new WeakMap();

/**
 * Rigid foot points per side in their bone's frame: the toe pads split into the stretch nearest the
 * toe base (`heel`) and nearest the tips (`tips`), and the hallux with its claw. Toe claws
 * (`talon-*` parts) are left out.
 */
function footPoints(anatomy) {
  if (cache.has(anatomy)) return cache.get(anatomy);
  const sides = {};
  for (const side of [-1, 1]) {
    const pad = [],
      hallux = [];
    for (const part of anatomy.parts) {
      const onToes = part.bone === `toes-hind-${side}`;
      if (part.skin || (!onToes && part.bone !== `hallux-hind-${side}`)) continue;
      if (onToes && part.id.startsWith("talon")) continue;
      const { vertices } = primitive(part);
      const local = transform(part.position, part.rotation, part.scale);
      for (let v = 0; v < vertices.length; v += 3) {
        (onToes ? pad : hallux).push(point(local, [vertices[v], vertices[v + 1], vertices[v + 2]]));
      }
    }
    const xs = pad.map((p) => p[0]);
    const front = Math.max(...xs),
      back = Math.min(...xs),
      span = front - back;
    sides[side] = {
      heel: pad.filter((p) => p[0] >= front - REACH * span),
      tips: pad.filter((p) => p[0] <= back + REACH * span),
      pad,
      hallux,
    };
  }
  cache.set(anatomy, sides);
  return sides;
}

/** Lowest height of `points` on a bone whose parent sits at `parent`, turned to `pitch` about its own Z. */
function lowest(points, parent, bone, rotation, pitch) {
  const m = multiply(parent, transform(bone.position, [rotation[0], rotation[1], pitch]));
  let low = Infinity;
  for (const [x, y, z] of points) low = Math.min(low, m[1] * x + m[5] * y + m[9] * z + m[13]);
  return low;
}

/** The pitch nearest `start` where `gap(pitch)` crosses zero, or `start` when it never does. */
function solve(gap, start) {
  let best = null;
  for (const dir of [1, -1]) {
    let a = start,
      ga = gap(a);
    for (let i = 1; i <= STEPS; i++) {
      const b = start + (dir * SWING * i) / STEPS,
        gb = gap(b);
      if (Math.sign(ga) !== Math.sign(gb)) {
        let lo = a,
          hi = b;
        for (let n = 0; n < 20; n++) {
          const mid = (lo + hi) / 2;
          if (Math.sign(gap(mid)) === Math.sign(ga)) lo = mid;
          else hi = mid;
        }
        const found = (lo + hi) / 2;
        if (best === null || Math.abs(found - start) < Math.abs(best - start)) best = found;
        break;
      }
      a = b;
      ga = gb;
    }
  }
  return best ?? start;
}

/**
 * Lays the toes flat, their pads level from base to tip with the claws dug into the ground, and
 * turns the hallux back and down onto the same ground, blended in by `k`.
 * `bones` already holds the standing legs. Returns the height of the lowest flattened pad.
 * @returns {number}
 */
export function plantFeet(bones, anatomy, k) {
  let sole = Infinity;
  const sides = footPoints(anatomy);
  const at = (id) => anatomy.bones.findIndex((bone) => bone.id === id);
  const matrices = boneMatrices(anatomy, { bones });
  const turn = (id) => (anatomy.bones[at(id)].rotation ?? [0, 0, 0]).map((v, i) => v + (bones[id]?.rotation?.[i] ?? 0));
  for (const side of [-1, 1]) {
    const { heel, tips, pad, hallux } = sides[side];
    if (!heel.length || !tips.length) continue;
    const foot = matrices[at(`foot-hind-${side}`)];
    const toes = anatomy.bones[at(`toes-hind-${side}`)];
    const toeTurn = turn(`toes-hind-${side}`);
    const pitch = solve((p) => lowest(heel, foot, toes, toeTurn, p) - lowest(tips, foot, toes, toeTurn, p), toeTurn[2]);
    set(bones, `toes-hind-${side}`, pitch - toeTurn[2], k);
    const ground = lowest(pad, foot, toes, toeTurn, pitch);
    sole = Math.min(sole, ground);
    if (!hallux.length) continue;
    const bone = anatomy.bones[at(`hallux-hind-${side}`)];
    const halluxTurn = turn(`hallux-hind-${side}`);
    const reach = solve((p) => lowest(hallux, foot, bone, halluxTurn, p) - ground, halluxTurn[2]);
    set(bones, `hallux-hind-${side}`, reach - halluxTurn[2], k);
  }
  return sole;
}

function set(bones, id, delta, k) {
  const bone = (bones[id] ??= {});
  const rotation = bone.rotation ?? [0, 0, 0];
  bone.rotation = [rotation[0], rotation[1], rotation[2] + delta * k];
}
