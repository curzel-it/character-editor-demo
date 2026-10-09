import { terrainHeight } from "../course/terrainHeight.js";
import { lengthScale } from "../worldScale.js";

const m = (v) => v * lengthScale;
const MAX_SIZE = 2048,
  MAX_TEXELS = 2048 * 1024,
  FLOOR = -1e4,
  REACH = m(40),
  TALLEST = m(24);

/**
 * Bakes the static world's sun shadows and ambient occlusion into a texel grid over the course
 * terrain, or over its `lightBounds` `{ origin, size }` when it names a smaller area, once per course. `props` is the dressing mesh; emissive (gameplay) triangles cast nothing.
 * Each texel holds `[shadow, ground, ao, 1]`: `ground` the terrain height, `shadow` how far above it
 * a point must sit to see the sun (swept along `sun` over terrain and props, sinking toward the
 * ground over `REACH` and never standing more than `TALLEST` above it, so only nearby relief casts, soft from the sweep's interpolation plus a blur), and `ao` a two-scale cavity term (creases, valley floors,
 * forest floors and the ground at the foot of walls).
 * `nudge` is how far out along a surface's normal a fine bake is read.
 * @returns {{ data: Float32Array, columns: number, rows: number, origin: number[], texel: number, drop: number, nudge: number }}
 */
export function bakeLighting(course, props, sun) {
  const { cellSize } = course.terrain;
  const origin = course.lightBounds?.origin ?? course.terrain.origin;
  const [width, depth] = course.lightBounds?.size ?? [(course.terrain.columns - 1) * cellSize, (course.terrain.rows - 1) * cellSize];
  const texel = Math.max(Math.max(width, depth) / (MAX_SIZE - 1), Math.sqrt((width * depth) / MAX_TEXELS));
  const columns = Math.ceil(width / texel) + 1,
    rows = Math.ceil(depth / texel) + 1,
    count = columns * rows;
  const ground = new Float32Array(count);
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < columns; c++) ground[r * columns + c] = terrainHeight(course.terrain, origin[0] + c * texel, origin[1] + r * texel);
  const surface = ground.slice();
  raise(surface, columns, rows, origin, texel, props);

  const flat = Math.hypot(sun[0], sun[2]),
    ux = sun[0] / flat,
    uz = sun[2] / flat;
  const zMajor = Math.abs(uz) >= Math.abs(ux);
  const [major, minor, majorStride, minorStride] = zMajor ? [rows, columns, columns, 1] : [columns, rows, 1, columns];
  const along = zMajor ? uz : ux,
    step = Math.sign(along),
    shift = (zMajor ? ux : uz) / Math.abs(along),
    run = texel * Math.hypot(1, shift),
    drop = run * (sun[1] / flat),
    decay = Math.exp(-run / REACH);
  const lit = new Float32Array(count),
    top = new Float32Array(count);
  for (let k = 0; k < major; k++) {
    const i = step > 0 ? major - 1 - k : k,
      upstream = (i + step) * majorStride;
    for (let j = 0; j < minor; j++) {
      let h = FLOOR;
      const f = j + shift,
        j0 = Math.floor(f);
      if (k > 0 && j0 >= 0 && j0 + 1 < minor) {
        const a = top[upstream + j0 * minorStride],
          b = top[upstream + (j0 + 1) * minorStride];
        h = a + (b - a) * (f - j0) - drop;
      }
      const index = i * majorStride + j * minorStride;
      // Shadows sink toward the ground with distance, so cliffs and ridges cast a bounded reach.
      if (h > ground[index]) h = ground[index] + Math.min(h - ground[index], TALLEST) * decay;
      lit[index] = h;
      top[index] = Math.max(surface[index], h);
    }
  }
  const shadow = new Float32Array(count);
  for (let i = 0; i < count; i++) shadow[i] = Math.max(lit[i] - ground[i], -2 * drop);
  for (let pass = 0; pass < 2; pass++) blur(shadow, columns, rows);

  const near = cavity(surface, columns, rows, Math.max(1, Math.round(m(10) / texel)));
  const wide = cavity(surface, columns, rows, Math.max(2, Math.round(m(60) / texel)));
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const occlusion = 0.3 * Math.min(1, near[i] / m(5)) + 0.3 * Math.min(1, wide[i] / m(16));
    data[i * 4] = shadow[i];
    data[i * 4 + 1] = ground[i];
    data[i * 4 + 2] = 1 - occlusion;
    data[i * 4 + 3] = 1;
  }
  return { data, columns, rows, origin: [origin[0], origin[1]], texel, drop, nudge: course.lightBounds ? 6 * texel : 0 };
}

/** Lifts `surface` to the top of every non-emissive prop triangle over each texel centre. */
function raise(surface, columns, rows, origin, texel, { positions, colors }) {
  const set = (c, r, y) => {
    if (c < 0 || r < 0 || c >= columns || r >= rows) return;
    const i = r * columns + c;
    if (y > surface[i]) surface[i] = y;
  };
  for (let t = 0; t < positions.length / 9; t++) {
    if (colors[t * 12 + 3] > 0) continue;
    const p = positions.subarray(t * 9, t * 9 + 9);
    const ax = (p[0] - origin[0]) / texel,
      az = (p[2] - origin[1]) / texel,
      bx = (p[3] - origin[0]) / texel,
      bz = (p[5] - origin[1]) / texel,
      cx = (p[6] - origin[0]) / texel,
      cz = (p[8] - origin[1]) / texel;
    if (Math.max(ax, bx, cx) < -1 || Math.min(ax, bx, cx) > columns || Math.max(az, bz, cz) < -1 || Math.min(az, bz, cz) > rows) continue;
    const area = (bx - ax) * (cz - az) - (cx - ax) * (bz - az);
    const c0 = Math.max(0, Math.ceil(Math.min(ax, bx, cx))),
      c1 = Math.min(columns - 1, Math.floor(Math.max(ax, bx, cx))),
      r0 = Math.max(0, Math.ceil(Math.min(az, bz, cz))),
      r1 = Math.min(rows - 1, Math.floor(Math.max(az, bz, cz)));
    const highest = Math.max(p[1], p[4], p[7]);
    if (Math.abs(area) < 0.05) {
      // Walls seen from above: mark the texels along each edge.
      for (const [x0, z0, x1, z1] of [[ax, az, bx, bz], [bx, bz, cx, cz], [cx, cz, ax, az]]) {
        const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2) + 1;
        for (let k = 0; k <= n; k++) set(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(z0 + ((z1 - z0) * k) / n), highest);
      }
      continue;
    }
    if (c0 > c1 || r0 > r1) {
      set(Math.round((ax + bx + cx) / 3), Math.round((az + bz + cz) / 3), highest);
      continue;
    }
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++) {
        const u = ((bx - c) * (cz - r) - (cx - c) * (bz - r)) / area,
          v = ((cx - c) * (az - r) - (ax - c) * (cz - r)) / area,
          w = 1 - u - v;
        if (u < -1e-4 || v < -1e-4 || w < -1e-4) continue;
        set(c, r, u * p[1] + v * p[4] + w * p[7]);
      }
  }
}

/** In-place separable 3-tap box blur. */
function blur(values, columns, rows) {
  const line = new Float32Array(Math.max(columns, rows));
  const run = (n, stride, start) => {
    for (let i = 0; i < n; i++) line[i] = values[start + i * stride];
    for (let i = 0; i < n; i++) values[start + i * stride] = (line[i > 0 ? i - 1 : 0] + line[i] + line[i < n - 1 ? i + 1 : i]) / 3;
  };
  for (let r = 0; r < rows; r++) run(columns, 1, r * columns);
  for (let c = 0; c < columns; c++) run(rows, columns, c);
}

/** How far each texel sits below the mean height within `k` texels (0 on crests). */
function cavity(heights, columns, rows, k) {
  const area = new Float64Array((columns + 1) * (rows + 1));
  for (let r = 0; r < rows; r++) {
    let sum = 0;
    for (let c = 0; c < columns; c++) {
      sum += heights[r * columns + c];
      area[(r + 1) * (columns + 1) + c + 1] = area[r * (columns + 1) + c + 1] + sum;
    }
  }
  const out = new Float32Array(columns * rows);
  for (let r = 0; r < rows; r++) {
    const r0 = Math.max(0, r - k),
      r1 = Math.min(rows, r + k + 1);
    for (let c = 0; c < columns; c++) {
      const c0 = Math.max(0, c - k),
        c1 = Math.min(columns, c + k + 1);
      const sum = area[r1 * (columns + 1) + c1] - area[r0 * (columns + 1) + c1] - area[r1 * (columns + 1) + c0] + area[r0 * (columns + 1) + c0];
      out[r * columns + c] = Math.max(0, sum / ((r1 - r0) * (c1 - c0)) - heights[r * columns + c]);
    }
  }
  return out;
}
