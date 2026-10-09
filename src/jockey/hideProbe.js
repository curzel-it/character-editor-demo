import { primitive } from "../geometry.js";
import { point, multiply, transform } from "../math3d.js";

const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Rest-pose triangles of the body hide (skinned meshes are already in model space). */
export function hideTriangles(anatomy) {
  const skinned = anatomy.parts.filter((part) => part.skin && part.vertices);
  const body = skinned.filter((part) => /hide|body/.test(part.id) && !/wing|limb|leg|arm/.test(part.id));
  const triangles = [];
  for (const part of body.length ? body : skinned) {
    const v = (i) => part.vertices.slice(i * 3, i * 3 + 3);
    for (let i = 0; i < part.indices.length; i += 3)
      triangles.push([v(part.indices[i]), v(part.indices[i + 1]), v(part.indices[i + 2])]);
  }
  return triangles;
}

/** The skin of the hide vertex nearest a rest-pose point, so tack laid on the hide moves with it. */
export function hideSkin(anatomy) {
  const skinned = anatomy.parts.filter((part) => part.skin && part.vertices && /hide|body/.test(part.id) && !/wing|limb|leg|arm/.test(part.id));
  return (p) => {
    let best = null,
      distance = Infinity;
    for (const part of skinned)
      for (let i = 0; i < part.vertices.length; i += 3) {
        const d = (part.vertices[i] - p[0]) ** 2 + (part.vertices[i + 1] - p[1]) ** 2 + (part.vertices[i + 2] - p[2]) ** 2;
        if (d < distance) [distance, best] = [d, { joints: part.skin.joints[i / 3], weight: part.skin.weights[i / 3] }];
      }
    return best;
  };
}

/** Distances along `direction` from `origin` at which the line crosses the hide. */
export function hits(triangles, origin, direction) {
  const out = [];
  for (const [a, b, c] of triangles) {
    const e1 = sub(b, a),
      e2 = sub(c, a);
    const p = cross(direction, e2);
    const det = dot(e1, p);
    if (Math.abs(det) < 1e-12) continue;
    const t0 = sub(origin, a);
    const u = dot(t0, p) / det;
    if (u < 0 || u > 1) continue;
    const q = cross(t0, e1);
    const w = dot(direction, q) / det;
    if (w < 0 || u + w > 1) continue;
    out.push(dot(e2, q) / det);
  }
  return out;
}

/** Height of the top of the hide at world (x, z), or null off the body. */
export function hideTop(triangles, x, z) {
  const found = hits(triangles, [x, 1000, z], [0, -1, 0]);
  return found.length ? 1000 - Math.min(...found) : null;
}

/** The outermost hide point from `centre` along unit `direction`, lifted by `lift`, or null. */
export function hideOut(triangles, centre, direction, lift = 0) {
  const out = hits(triangles, centre, direction).filter((t) => t > 0);
  if (!out.length) return null;
  const t = Math.max(...out) + lift;
  return centre.map((c, i) => c + direction[i] * t);
}

/** The middle of the body's cross-section at world x (between hide top and belly), or null. */
export function hideCentre(triangles, x, z = 0) {
  const top = hideTop(triangles, x, z);
  const under = hits(triangles, [x, -1000, z], [0, 1, 0]);
  if (top === null || !under.length) return null;
  return [x, (top + Math.min(...under) - 1000) / 2, z];
}

/** Whether a rigid or skinned part has any vertex inside the box `test(worldPoint)`, in `frame`. */
export function partTouches(part, bind, index, frame, test) {
  const geometry = primitive(part);
  const matrix = part.skin
    ? frame
    : multiply(frame, multiply(bind[index.get(part.bone)], transform(part.position, part.rotation, part.scale)));
  for (let i = 0; i < geometry.vertices.length; i += 3) if (test(point(matrix, geometry.vertices.slice(i, i + 3)))) return true;
  return false;
}
