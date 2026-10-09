/**
 * @typedef {{ joints: [string, string], weight: number }} Skin
 * @typedef {{ vertices: number[], indices: number[], colors: number[], skin?: { joints: string[][], weights: number[] } }} SurfaceMesh
 */

/**
 * A mesh over a grid of points `rows[j][i]`, every quad with its own corners so `color(j, i, centre)`
 * paints crisp regions while the renderer's rounding still welds normals by position. `wrap` closes
 * each row into a loop; a row whose points all meet (a pole) is fanned instead of quadded.
 * `skin(j, i)` returns the corner's `{ joints, weight }` for a skinned surface; `keep(j, i)` may drop a quad.
 * @param {number[][][]} rows
 * @param {{ color: (j: number, i: number, centre: number[]) => number[], wrap?: boolean, skin?: (j: number, i: number) => Skin, flip?: boolean, keep?: (j: number, i: number) => boolean }} options
 * @returns {SurfaceMesh}
 */
export function gridSurface(rows, { color, wrap = true, skin, flip = false, keep }) {
  const vertices = [],
    colors = [],
    indices = [],
    joints = [],
    weights = [];
  const width = rows[0].length;
  const spans = wrap ? width : width - 1;
  const pole = rows.map((row) => row.every((p) => Math.abs(p[0] - row[0][0]) + Math.abs(p[1] - row[0][1]) + Math.abs(p[2] - row[0][2]) < 1e-9));
  const corner = (j, i, rgb) => {
    const p = rows[j][i % width];
    vertices.push(p[0], p[1], p[2]);
    colors.push(rgb[0], rgb[1], rgb[2]);
    if (skin) {
      const s = skin(j, i % width);
      joints.push(s.joints);
      weights.push(s.weight);
    }
    return vertices.length / 3 - 1;
  };
  const face = (a, b, c) => (flip ? indices.push(a, c, b) : indices.push(a, b, c));
  for (let j = 0; j < rows.length - 1; j++)
    for (let i = 0; i < spans; i++) {
      if (keep && !keep(j, i)) continue;
      const i2 = i + 1;
      const quad = [rows[j][i % width], rows[j][i2 % width], rows[j + 1][i2 % width], rows[j + 1][i % width]];
      const centre = [0, 1, 2].map((k) => (quad[0][k] + quad[1][k] + quad[2][k] + quad[3][k]) / 4);
      const rgb = color(j, i, centre);
      if (pole[j]) {
        const a = corner(j, i, rgb),
          b = corner(j + 1, i2, rgb),
          c = corner(j + 1, i, rgb);
        face(a, b, c);
      } else if (pole[j + 1]) {
        const a = corner(j, i, rgb),
          b = corner(j, i2, rgb),
          c = corner(j + 1, i, rgb);
        face(a, b, c);
      } else {
        const a = corner(j, i, rgb),
          b = corner(j, i2, rgb),
          c = corner(j + 1, i2, rgb),
          d = corner(j + 1, i, rgb);
        face(a, b, c);
        face(a, c, d);
      }
    }
  return { vertices, indices, colors, ...(skin ? { skin: { joints, weights } } : {}) };
}

/** Joins meshes into one, offsetting indices. */
export function mergeMeshes(meshes) {
  const out = { vertices: [], indices: [], colors: [] };
  const skinned = meshes.some((m) => m.skin);
  if (skinned) out.skin = { joints: [], weights: [] };
  for (const mesh of meshes) {
    const base = out.vertices.length / 3;
    out.vertices.push(...mesh.vertices);
    out.colors.push(...mesh.colors);
    for (const index of mesh.indices) out.indices.push(index + base);
    if (skinned) {
      const count = mesh.vertices.length / 3;
      for (let k = 0; k < count; k++) {
        out.skin.joints.push(mesh.skin ? mesh.skin.joints[k] : mesh.joints);
        out.skin.weights.push(mesh.skin ? mesh.skin.weights[k] : 1);
      }
    }
  }
  return out;
}

/**
 * A tube through `rings` of `{ p, r: number | [ru, rv], skin?, shape? }` around their axis, `around`
 * points per ring. Ring frames are carried along the tube from `up` so they never flip; `shape(angle)`
 * scales a ring's radius at an angle (0 along the carried up, a quarter turn towards its side).
 * `color(ring, segment, angle, centre)` paints each quad. Open ends are capped unless `caps` is false.
 * @param {{ p: number[], r: number | number[], skin?: Skin, shape?: (angle: number) => number }[]} rings
 * @param {{ around?: number, up?: number[], color: (ring: number, segment: number, angle: number, centre: number[]) => number[], caps?: boolean, closed?: boolean }} options
 */
export function tubeSurface(rings, { around = 12, up = [0, 1, 0], color, caps = true, closed = false }) {
  const n = rings.length;
  let carried = null;
  const grid = rings.map((ring, k) => {
    const prev = rings[closed ? (k - 1 + n) % n : Math.max(0, k - 1)].p;
    const next = rings[closed ? (k + 1) % n : Math.min(n - 1, k + 1)].p;
    const axis = unit(sub(next, prev));
    const reference = carried && Math.abs(dot(carried, axis)) < 0.95 ? carried : Math.abs(dot(up, axis)) > 0.95 ? [1, 0, 0] : up;
    const v = unit(cross(axis, reference));
    const u = cross(v, axis);
    if (!closed) carried = u;
    const [ru, rv] = Array.isArray(ring.r) ? ring.r : [ring.r, ring.r];
    return Array.from({ length: around }, (_, s) => {
      const angle = (s / around) * Math.PI * 2;
      const grow = ring.shape ? ring.shape(angle) : 1;
      return ring.p.map((c, d) => c + (u[d] * Math.cos(angle) * ru + v[d] * Math.sin(angle) * rv) * grow);
    });
  });
  const rows = closed ? [...grid, grid[0]] : grid;
  const ringOf = (j) => (closed ? j % n : j);
  const skinned = rings.some((r) => r.skin);
  const body = gridSurface(rows, {
    color: (j, i, centre) => color(ringOf(j), i, ((i + 0.5) / around) * Math.PI * 2, centre),
    skin: skinned ? (j) => rings[ringOf(j)].skin : undefined,
  });
  if (!caps || closed) return body;
  const capOf = (k, inward) => {
    const centre = rings[k].p;
    const rgb = color(Math.min(k, n - 2), 0, 0, centre);
    const fan = [centre, ...grid[k]];
    const mesh = { vertices: fan.flat(), colors: fan.flatMap(() => rgb), indices: [] };
    for (let s = 0; s < around; s++) {
      const a = 1 + s,
        b = 1 + ((s + 1) % around);
      if (inward) mesh.indices.push(0, b, a);
      else mesh.indices.push(0, a, b);
    }
    if (skinned) mesh.skin = { joints: fan.map(() => rings[k].skin.joints), weights: fan.map(() => rings[k].skin.weight) };
    return mesh;
  };
  return mergeMeshes([body, capOf(0, true), capOf(n - 1, false)]);
}

/** A model-space mesh as a renderer part on `bone`, skinned when the mesh carries skin. */
export function meshPart(id, bone, mesh, origin = [0, 0, 0]) {
  const vertices = origin.some((v) => v) && !mesh.skin ? mesh.vertices.map((v, k) => v - origin[k % 3]) : mesh.vertices;
  return { id, bone, shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: mesh.colors.slice(0, 3), ...mesh, vertices };
}

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const unit = (a) => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));
export const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const mix = (a, b, t) => a + (b - a) * t;
export const clamp01 = (t) => Math.max(0, Math.min(1, t));
export const smooth = (e0, e1, x) => {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
};
