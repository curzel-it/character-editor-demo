import { makeSkinMesh } from "../skinMesh.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";

const STRIDE = 12;
const skins = new WeakMap();

/** The skinned mesh's distinct vertices as `{ position, joints, weight }`, foot and hand claws aside, built once per anatomy. */
function skinPoints(anatomy) {
  if (skins.has(anatomy)) return skins.get(anatomy);
  const { vertices, inverseBind } = makeSkinMesh({ ...anatomy, parts: anatomy.parts.filter((part) => !/^(talon|wing-claw)-/.test(part.id)) });
  const seen = new Set(),
    points = [];
  for (let v = 0; v < vertices.length; v += STRIDE) {
    const key = `${vertices[v]}:${vertices[v + 1]}:${vertices[v + 2]}:${vertices[v + 9]}:${vertices[v + 10]}:${vertices[v + 11]}`;
    if (seen.has(key)) continue;
    seen.add(key);
    points.push({ position: [vertices[v], vertices[v + 1], vertices[v + 2]], joints: [vertices[v + 9], vertices[v + 10]], weight: vertices[v + 11] });
  }
  const result = { points, inverseBind };
  skins.set(anatomy, result);
  return result;
}

/** World height of the lowest point of a posed racer's mesh (feet, tail, wings, tack) placed like the scene places it; foot and hand claws may dig in below it. */
export function lowestPoint(anatomy, pose, position, forward, bank = 0) {
  const { points, inverseBind } = skinPoints(anatomy);
  const model = multiply(orientation(position, forward, bank), transform(anatomy.bones[0].position.map((v) => -v)));
  const bones = boneMatrices(anatomy, pose).map((m, i) => multiply(model, multiply(m, inverseBind[i])));
  let low = Infinity;
  for (const { position: p, joints, weight } of points) {
    const y = point(bones[joints[0]], p)[1] * weight + point(bones[joints[1]], p)[1] * (1 - weight);
    if (y < low) low = y;
  }
  return low;
}
