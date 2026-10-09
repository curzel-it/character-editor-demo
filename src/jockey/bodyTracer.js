import { hideCentre, hideOut, hideSkin } from "./hideProbe.js";
import { tube } from "./riderMesh.js";

const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

/**
 * Builders for tack that lies on the hide, in body coordinates: x along the body and an angle round
 * it from the top (+Z side positive). Meshes are traced over the rest-pose hide in model space and
 * skinned, by default like the hide beneath them; `blend` hands the seat's bone over to another bone along x.
 */
export function bodyTracer({ anatomy, triangles, mount }) {
  /** A point on the hide at body x and angle `a` from the top, lifted clear by `lift`. */
  const surface = (x, a, lift) => {
    const centre = hideCentre(triangles, x);
    if (!centre) return null;
    return hideOut(triangles, centre, [0, Math.cos(a), Math.sin(a)], lift);
  };
  const onHide = hideSkin(anatomy);
  /** Joint weights that hand the seat's bone over to `other` between x0 and x1. */
  const blend = (other, x0, x1) => (p) => {
    const t = Math.max(0, Math.min(1, (p[0] - x0) / (x1 - x0)));
    return { joints: [mount.bone, other], weight: 1 - t };
  };
  const skinned = (id, mesh, weigh) => {
    const joints = [],
      weights = [];
    for (let i = 0; i < mesh.vertices.length; i += 3) {
      const s = weigh(mesh.vertices.slice(i, i + 3));
      joints.push(s.joints);
      weights.push(s.weight);
    }
    return {
      id,
      bone: mount.bone,
      shape: "mesh",
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: mesh.colors.slice(0, 3),
      ...mesh,
      skin: { joints, weights },
    };
  };
  /** A strap through waypoints [x, angle], resampled so it hugs the hide; null if off the body. */
  const strap = (id, waypoints, { width = 0.05, thick = 0.018, lift = 0.03, rgb, weigh = onHide, steps = 5, closed = false }) => {
    const rings = [];
    const n = closed ? waypoints.length : waypoints.length - 1;
    for (let k = 0; k < n; k++) {
      const [a, b] = [waypoints[k], waypoints[(k + 1) % waypoints.length]];
      for (let s = 0; s < steps; s++) rings.push(lerp(a, b, s / steps));
    }
    if (!closed) rings.push(waypoints.at(-1));
    const points = rings.map(([x, a]) => surface(x, a, lift)).filter(Boolean);
    if (points.length < (closed ? 6 : 2)) return null;
    const mesh = tube(points.map((p) => ({ p, r: [width, thick] })), { segments: 4, closed, up: [1, 0, 0], color: () => rgb });
    return skinned(id, mesh, weigh);
  };
  /** A patch of hide over x0..x1 and angles a0..a1, coloured per cell by `color(i, j, cols, rows)`. */
  const panel = (id, [x0, x1], [a0, a1], [cols, rows], lift, color, weigh = onHide) => {
    const mesh = { vertices: [], indices: [], colors: [] };
    const grid = Array.from({ length: cols + 1 }, (_, i) =>
      Array.from({ length: rows + 1 }, (_, j) => surface(x0 + ((x1 - x0) * i) / cols, a0 + ((a1 - a0) * j) / rows, lift)),
    );
    for (let i = 0; i < cols; i++)
      for (let j = 0; j < rows; j++) {
        const corners = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]];
        if (corners.some((c) => !c)) continue;
        const b = mesh.vertices.length / 3;
        const rgb = color(i, j, cols, rows);
        for (const c of corners) mesh.vertices.push(...c), mesh.colors.push(...rgb);
        mesh.indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    return mesh.indices.length ? skinned(id, mesh, weigh) : null;
  };
  return { surface, blend, strap, panel };
}
