import { part } from "./parts.js";
import { tint } from "../palette.js";

const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const CRISP_EDGE = 0.4;
export const normalize = (p) => {
  const length = Math.hypot(...p) || 1;
  return p.map((v) => v / length);
};
export const add = (a, b) => a.map((v, i) => v + b[i]);
export const mix = (a, b, t) => a.map((v, i) => v * (1 - t) + b[i] * t);

export function surface(parts, id, bone, vertices, indices, color, extra = {}) {
  part(parts, id, bone, "mesh", [0, 0, 0], [1, 1, 1], color, [0, 0, 0], {
    vertices,
    indices,
    ...extra,
  });
}

/**
 * Tube through `rings`; `across` sets the direction each ring's `rz` faces, `ry` lying across it.
 * `under` shades the underside towards that colour; with `crisp` it fills the lower columns whole instead.
 * `marks` holds each vertex's share of the tube's own colour, where markings may show (`cornerMarks` when crisp).
 */
export function sweep(parts, id, bone, rings, color, options = {}) {
  const segments = options.segments || 10;
  const vertices = [],
    indices = [],
    colors = [],
    marks = [],
    joints = [],
    weights = [];
  for (let r = 0; r < rings.length; r++) {
    const ring = rings[r],
      previous = rings[Math.max(0, r - 1)].p,
      next = rings[Math.min(rings.length - 1, r + 1)].p;
    const axis = normalize(next.map((v, i) => v - previous[i]));
    const u = normalize(
      cross(options.across || (Math.abs(axis[2]) > 0.9 ? [1, 0, 0] : [0, 0, 1]), axis),
    );
    const v = normalize(cross(axis, u));
    for (let j = 0; j < segments; j++) {
      const angle = (j / segments) * Math.PI * 2;
      const top = Math.cos(angle),
        side = Math.sin(angle);
      vertices.push(
        ...ring.p.map(
          (p, i) => p + u[i] * top * ring.ry + v[i] * side * ring.rz,
        ),
      );
      const base = ring.color || color;
      const under = options.under && !options.crisp
        ? Math.max(0, Math.min(1, (-top - 0.08) * 1.4))
        : 0;
      colors.push(
        ...mix(
          tint(base, 0.96 + (j % 3) * 0.025),
          options.under || base,
          under,
        ),
      );
      marks.push(ring.color ? 0 : 1 - under);
      joints.push(ring.joints || [bone, bone]);
      weights.push(ring.weight ?? 1);
    }
  }
  for (let r = 0; r < rings.length - 1; r++)
    for (let j = 0; j < segments; j++) {
      const a = r * segments + j,
        b = r * segments + ((j + 1) % segments),
        c = a + segments,
        d = b + segments;
      if ((r + j) % 2) indices.push(a, b, d, a, d, c);
      else indices.push(a, b, c, b, d, c);
    }
  for (let j = 1; j < segments - 1; j++) {
    indices.push(0, j + 1, j);
    const last = (rings.length - 1) * segments;
    indices.push(last, last + j, last + j + 1);
  }
  surface(parts, id, bone, vertices, indices, color, {
    colors,
    marks,
    ...(options.crisp && options.under ? crispUnder(indices, colors, marks, segments, options.under) : {}),
    segments,
    ...(options.skinned ? { skin: { joints, weights } } : {}),
  });
}

/** One colour and mark per triangle corner, painting the lower columns of the tube wholly `under` except on rings with their own colour. */
function crispUnder(indices, colors, marks, segments, under) {
  const below = (j) => -Math.cos(((j + 0.5) / segments) * Math.PI * 2) > CRISP_EDGE;
  const cornerColors = [],
    cornerMarks = [];
  for (let t = 0; t < indices.length; t += 3) {
    const corners = indices.slice(t, t + 3).map((index) => index % segments);
    const column = corners.find((j) => corners.includes((j + 1) % segments) && !corners.includes((j + segments - 1) % segments)) ?? corners[0];
    for (let k = 0; k < 3; k++) {
      const index = indices[t + k], bare = below(column) && marks[index] > 0;
      cornerColors.push(...(bare ? under : colors.slice(index * 3, index * 3 + 3)));
      cornerMarks.push(bare ? 0 : marks[index]);
    }
  }
  return { cornerColors, cornerMarks };
}

export function blade(
  parts,
  id,
  bone,
  base,
  reach,
  height,
  width,
  color,
  side = 0,
) {
  const vertices = [
    ...add(base, [reach * 0.21, 0, -width]),
    ...add(base, [reach * 0.21, 0, width]),
    ...add(base, [-reach * 0.28, 0, -width * 0.8]),
    ...add(base, [-reach * 0.28, 0, width * 0.8]),
    ...add(base, [-reach, height, side]),
    ...add(base, [-reach * 0.15, height * 0.28, 0]),
  ];
  surface(
    parts,
    id,
    bone,
    vertices,
    [0, 1, 5, 0, 5, 4, 0, 4, 2, 1, 3, 4, 1, 4, 5, 2, 4, 3, 0, 2, 3, 0, 3, 1],
    color,
  );
}

/**
 * Tapered horn from `base` to `tip`, bowed towards `bend` (an offset added to the midpoint).
 * `radius` is the base radius; `flat` squashes the cross-section; `blunt` keeps a rounded tip.
 */
export function spike(parts, id, bone, base, tip, radius, color, options = {}) {
  const { bend = [0, 0, 0], flat = 1, blunt = 0, segments = 6, steps = 4 } = options;
  const rings = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      curve = 4 * t * (1 - t);
    const r = radius * Math.max(blunt, 1 - t) + 0.002;
    rings.push({ p: add(mix(base, tip, t), bend.map((v) => v * curve)), ry: r, rz: r * flat });
  }
  sweep(parts, id, bone, rings, color, { segments });
}
