import { makeSkinMesh } from "../skinMesh.js";
import { makeRng } from "../rng.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";

const STRIDE = 12;
/** The regions whose skin takes mud, in the order they are muddied; wings, feet and small parts stay clean. */
const REGIONS = [/^(root|chest)$/, /^tail-[0-4]$/, /^neck-/, /^(leg|shin)-hind/, /^head$/];

/**
 * `count` mud spots on the dragon's `side` (1 its left, -1 its right), seeded by `seed` and spread
 * apart: each `{ at, radius, bone, local, side, mud, foam }`, `at` a point of its skin in the rest pose,
 * `radius` its reach and `local` the point on `bone` for `spotPoints`.
 */
export function coatSpots(anatomy, { count, side, seed }) {
  const { vertices, inverseBind } = makeSkinMesh(anatomy);
  const radius = 0.1 * anatomy.bounds.radius;
  const regions = REGIONS.map(() => []);
  for (let i = 0; i < vertices.length; i += STRIDE) {
    const bone = vertices[i + (vertices[i + 11] >= 0.5 ? 9 : 10)];
    const region = REGIONS.findIndex((r) => r.test(anatomy.bones[bone].id));
    if (vertices[i + 5] * side >= 0.45 && vertices[i + 2] * side > 0 && region >= 0) regions[region].push({ at: [vertices[i], vertices[i + 1], vertices[i + 2]], bone });
  }
  const filled = regions.filter((r) => r.length);
  const random = makeRng(seed);
  const spots = [];
  for (let tries = 0; spots.length < count && tries < 400 && filled.length; tries++) {
    const candidates = filled[(spots.length + Math.floor(tries / 20)) % filled.length];
    const c = candidates[Math.floor(random() * candidates.length)];
    if (spots.some((s) => Math.hypot(...s.at.map((v, k) => v - c.at[k])) < 1.7 * radius)) continue;
    spots.push({ ...c, radius: radius * (0.85 + 0.3 * random()), local: point(inverseBind[c.bone], c.at), side, mud: 1, foam: 0 });
  }
  return spots;
}

/** Where each of `spots` is in the world on the posed `racer` (`{ anatomy, pose, position, forward, bank }`). */
export function spotPoints(spots, racer) {
  const model = multiply(orientation(racer.position, racer.forward, racer.bank ?? 0), transform(racer.anatomy.bones[0].position.map((v) => -v)));
  const bones = boneMatrices(racer.anatomy, racer.pose);
  return spots.map((s) => point(multiply(model, bones[s.bone]), s.local));
}
