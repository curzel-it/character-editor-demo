const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (p) => {
  const n = Math.hypot(...p) || 1;
  return p.map((v) => v / n);
};

/**
 * A low-poly tube through `rings` ({ p, r: [ry, rz] | r, swell? }) with flat-coloured faces, `swell(direction)`
 * scaling a ring's radius by the unit direction out from its centre: every quad has
 * its own vertices, so `color(band, segment, angle)` draws crisp silks patterns. Angle 0 points
 * along `up` (projected off the axis) on the first ring and is carried along an open tube ring to ring, so it
 * never flips, a quarter turn towards +Z for a forward axis. Ends are capped
 * unless `closed` (a loop). `skin(ring)` may return `{ joints, weight }` for skinned tubes.
 */
export function tube(rings, { segments = 8, color, closed = false, up = [0, 1, 0], skin } = {}) {
  let carried = null;
  const frames = rings.map((ring, i) => {
    const n = rings.length;
    const prev = rings[closed ? (i - 1 + n) % n : Math.max(0, i - 1)].p;
    const next = rings[closed ? (i + 1) % n : Math.min(n - 1, i + 1)].p;
    const axis = unit(next.map((v, k) => v - prev[k]));
    const along = (a) => a.reduce((s, v, k) => s + v * axis[k], 0);
    const reference = carried && Math.abs(along(carried)) < 0.95 ? carried : Math.abs(along(up)) > 0.95 ? [-1, 0, 0] : up;
    const v = unit(cross(axis, reference));
    const u = cross(v, axis);
    if (!closed) carried = u;
    const [ry, rz] = Array.isArray(ring.r) ? ring.r : [ring.r, ring.r];
    return Array.from({ length: segments }, (_, j) => {
      const angle = (j / segments) * Math.PI * 2;
      const grow = ring.swell ? ring.swell(u.map((x, k) => x * Math.cos(angle) + v[k] * Math.sin(angle))) : 1;
      return ring.p.map((p, k) => p + (u[k] * Math.cos(angle) * ry + v[k] * Math.sin(angle) * rz) * grow);
    });
  });
  const vertices = [],
    colors = [],
    indices = [],
    joints = [],
    weights = [];
  const emit = (points, rgb, ringOf) => {
    const base = vertices.length / 3;
    points.forEach((p, k) => {
      vertices.push(...p);
      colors.push(...rgb);
      if (skin) {
        const s = skin(ringOf[k]);
        joints.push(s.joints);
        weights.push(s.weight);
      }
    });
    return base;
  };
  const bands = closed ? rings.length : rings.length - 1;
  for (let r = 0; r < bands; r++) {
    const r2 = (r + 1) % rings.length;
    for (let j = 0; j < segments; j++) {
      const j2 = (j + 1) % segments;
      const rgb = color(r, j, ((j + 0.5) / segments) * Math.PI * 2);
      const b = emit([frames[r][j], frames[r][j2], frames[r2][j2], frames[r2][j]], rgb, [r, r, r2, r2]);
      indices.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
  }
  if (!closed)
    for (const [r, band] of [[0, 0], [rings.length - 1, rings.length - 2]]) {
      const rgb = color(band, 0, 0);
      const b = emit(frames[r], rgb, frames[r].map(() => r));
      for (let j = 1; j < segments - 1; j++) indices.push(b, b + j, b + j + 1);
    }
  return { vertices, indices, colors, ...(skin ? { skin: { joints, weights } } : {}) };
}

/** Points on an ellipse loop (for straps and collars) around `center` in the plane of `a` and `b`. */
export function loop(center, a, b, ra, rb, count = 14) {
  return Array.from({ length: count }, (_, i) => {
    const t = (i / count) * Math.PI * 2;
    return center.map((c, k) => c + a[k] * Math.cos(t) * ra + b[k] * Math.sin(t) * rb);
  });
}
