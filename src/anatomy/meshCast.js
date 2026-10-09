import { cross, dot, sub } from "../vec3.js";
import { point, transform } from "../math3d.js";
import { primitive } from "../geometry.js";
import { roundMesh } from "../roundMesh.js";

/** Where a ray from `origin` along `direction` first meets a triangle of `mesh`, as a distance. */
export function cast({ vertices, indices }, origin, direction) {
  let nearest = Infinity;
  const at = (i) => [vertices[3 * i], vertices[3 * i + 1], vertices[3 * i + 2]];
  for (let t = 0; t < indices.length; t += 3) {
    const a = at(indices[t]),
      ab = sub(at(indices[t + 1]), a),
      ac = sub(at(indices[t + 2]), a),
      p = cross(direction, ac),
      det = dot(ab, p);
    if (Math.abs(det) < 1e-12) continue;
    const o = sub(origin, a),
      u = dot(o, p) / det,
      q = cross(o, ab),
      v = dot(direction, q) / det,
      d = dot(ac, q) / det;
    if (u >= 0 && v >= 0 && u + v <= 1 && d > 0) nearest = Math.min(nearest, d);
  }
  return nearest;
}

/** A part's triangles in its bone's space, whatever its shape. */
export function meshOf(part) {
  const { vertices, indices } = primitive(part);
  if (part.shape === "mesh") return { vertices, indices };
  const m = transform(part.position, part.rotation, part.scale),
    placed = [];
  for (let i = 0; i < vertices.length; i += 3) placed.push(...point(m, vertices.slice(i, i + 3)));
  return { vertices: placed, indices };
}

/** A mesh bulged into the curved patches the rounded styles draw it as, split `level`×`level` (see `roundMesh.js`). */
export function rounded({ vertices, indices }, level = 2) {
  const positions = [];
  for (let i = 0; i < vertices.length; i += 3) positions.push(vertices.slice(i, i + 3));
  const out = [];
  roundMesh({ positions, colors: positions.map(() => [0, 0, 0]), joints: positions.map(() => ["", ""]), weights: positions.map(() => 1), indices }, level, (p) => out.push(...p));
  return { vertices: out, indices: Array.from({ length: out.length / 3 }, (_, i) => i) };
}

/** The triangles of a mesh that come within `radius` of `centre`. */
export function near({ vertices, indices }, centre, radius) {
  const at = (i) => [vertices[3 * i], vertices[3 * i + 1], vertices[3 * i + 2]],
    kept = [];
  for (let t = 0; t < indices.length; t += 3) {
    const corners = [at(indices[t]), at(indices[t + 1]), at(indices[t + 2])],
      middle = corners.reduce((m, p) => m.map((v, i) => v + p[i] / 3), [0, 0, 0]),
      spread = Math.max(...corners.map((p) => Math.hypot(...sub(p, middle))));
    if (Math.hypot(...sub(middle, centre)) < radius + spread) kept.push(indices[t], indices[t + 1], indices[t + 2]);
  }
  return { vertices, indices: kept };
}
