import { makeSkinMesh } from "../skinMesh.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";

const STRIDE = 12;

/**
 * World positions of a sample of a posed racer's skinned vertices, every `every`th one, placed
 * like the scene places it: the outline its mesh actually draws, head, wings and tack included.
 */
export function poseOutline(anatomy, pose, position, forward, every = 7) {
  const { vertices, inverseBind } = makeSkinMesh(anatomy);
  const model = multiply(orientation(position, forward), transform(anatomy.bones[0].position.map((v) => -v)));
  const skins = boneMatrices(anatomy, pose).map((m, i) => multiply(model, multiply(m, inverseBind[i])));
  const outline = [];
  for (let v = 0; v < vertices.length; v += STRIDE * every) {
    const p = [vertices[v], vertices[v + 1], vertices[v + 2]];
    const a = point(skins[vertices[v + 9]], p),
      b = point(skins[vertices[v + 10]], p),
      w = vertices[v + 11];
    outline.push(a.map((x, k) => x * w + b[k] * (1 - w)));
  }
  return outline;
}
