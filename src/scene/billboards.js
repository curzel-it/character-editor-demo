const FLOATS = 11;

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Two unit vectors square to `d` and each other. */
export function basis(d) {
  const u = norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  return [u, cross(d, u)];
}

/** Colour at `t` along a ramp of `[r, g, b, alpha, glow]` stops. */
export function ramp(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x)),
    f = x - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
}

/**
 * Camera-facing quads in the breath shader's vertex layout: position, (across, along), colour with
 * alpha, glow and kind. `quad(a, b, size, color, kind, spin)` stretches from `a` to `b`, or is a
 * point turned by `spin` when they meet. `ribbon(points, sizes, color, kind)` is one unbroken band through
 * `points`, `sizes[i]` wide either side of each. `result()` returns `{ data, count }` in vertices.
 * @param {number[]} eye
 */
export function createBillboards(eye) {
  let data = new Float32Array(6 * FLOATS * 256),
    n = 0;
  const put = (p, x, y, c, kind) => {
    if (n + FLOATS > data.length) {
      const grown = new Float32Array(data.length * 2);
      grown.set(data);
      data = grown;
    }
    data[n] = p[0];
    data[n + 1] = p[1];
    data[n + 2] = p[2];
    data[n + 3] = x;
    data[n + 4] = y;
    data[n + 5] = c[0];
    data[n + 6] = c[1];
    data[n + 7] = c[2];
    data[n + 8] = c[3];
    data[n + 9] = c[4];
    data[n + 10] = kind;
    n += FLOATS;
  };
  function quad(a, b, size, color, kind, spin = 0) {
    const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const view = norm([eye[0] - mid[0], eye[1] - mid[1], eye[2] - mid[2]]);
    const along = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const length = Math.hypot(along[0], along[1], along[2]);
    let x, y, ends;
    if (length < size * 0.5) {
      const [r0, u0] = basis(view);
      const c = Math.cos(spin),
        s = Math.sin(spin);
      x = r0.map((v, k) => (v * c + u0[k] * s) * size);
      y = r0.map((v, k) => (u0[k] * c - v * s) * size);
      ends = [mid, mid];
    } else {
      const dir = along.map((v) => v / length);
      x = norm(cross(dir, view)).map((v) => v * size);
      y = dir.map((v) => v * size);
      ends = [a, b];
    }
    const corner = (end, sx, sy) => ends[end].map((v, k) => v + x[k] * sx + y[k] * sy);
    const p00 = corner(0, -1, -1),
      p10 = corner(0, 1, -1),
      p01 = corner(1, -1, 1),
      p11 = corner(1, 1, 1);
    put(p00, -1, -1, color, kind);
    put(p10, 1, -1, color, kind);
    put(p11, 1, 1, color, kind);
    put(p00, -1, -1, color, kind);
    put(p11, 1, 1, color, kind);
    put(p01, -1, 1, color, kind);
  }
  function ribbon(points, sizes, color, kind) {
    const sides = points.map((p, i) => {
      const along = points[Math.min(i + 1, points.length - 1)].map((v, k) => v - points[Math.max(i - 1, 0)][k]);
      return norm(cross(along, [eye[0] - p[0], eye[1] - p[1], eye[2] - p[2]])).map((v) => v * sizes[i]);
    });
    const edge = (i, sx) => points[i].map((v, k) => v + sides[i][k] * sx);
    for (let i = 0; i + 1 < points.length; i++) {
      put(edge(i, -1), -1, 0, color, kind);
      put(edge(i, 1), 1, 0, color, kind);
      put(edge(i + 1, 1), 1, 0, color, kind);
      put(edge(i, -1), -1, 0, color, kind);
      put(edge(i + 1, 1), 1, 0, color, kind);
      put(edge(i + 1, -1), -1, 0, color, kind);
    }
  }
  return { quad, ribbon, result: () => ({ data: data.subarray(0, n), count: n / FLOATS }) };
}
