import { froude } from "./froude.js";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
/** Curvature is averaged over this distance either side, whatever the path spacing. */
const smoothing = 20 * froude.length;

/** Path-relative frame of a course: arc length `s`, lateral offset `u` (positive left) and absolute Y. */
export function createCorridor(course) {
  const path = course.path;
  const n = path.length;
  const fwd = path.map(({ forward: [x, , z] }) => {
    const k = Math.hypot(x, z) || 1;
    return [x / k, 0, z / k];
  });
  const heading = [];
  for (let i = 0; i < n; i++) {
    let h = Math.atan2(fwd[i][2], fwd[i][0]);
    if (i) while (h - heading[i - 1] > Math.PI) h -= 2 * Math.PI;
    if (i) while (h - heading[i - 1] < -Math.PI) h += 2 * Math.PI;
    heading.push(h);
  }
  const raw = path.map((_, i) => {
    const a = Math.max(0, i - 1),
      b = Math.min(n - 1, i + 1);
    const ds = path[b].s - path[a].s;
    return ds > 0 ? (heading[b] - heading[a]) / ds : 0;
  });
  const kappa = raw.map((_, i) => {
    let sum = 0,
      count = 0;
    for (let j = i; j >= 0 && path[i].s - path[j].s <= smoothing; j--, count++) sum += raw[j];
    for (let j = i + 1; j < n && path[j].s - path[i].s <= smoothing; j++, count++) sum += raw[j];
    return sum / count;
  });
  const ratio = path.map((p, i) => {
    const q = path[Math.min(n - 1, i + 1)],
      o = path[Math.max(0, i - 1)];
    const h = Math.hypot(q.position[0] - o.position[0], q.position[2] - o.position[2]);
    return h > 1e-6 ? (q.s - o.s) / h : 1;
  });
  const start = path[0].s,
    end = path[n - 1].s;

  function index(s) {
    let lo = 0,
      hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (path[mid].s <= s) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  function at(s) {
    if (n < 2 || s <= start || s >= end) {
      const i = n < 2 || s <= start ? 0 : n - 1,
        p = path[i],
        f = fwd[i],
        d = s - p.s;
      return {
        s,
        position: [p.position[0] + f[0] * d, p.position[1], p.position[2] + f[2] * d],
        forward: f,
        left: [-f[2], 0, f[0]],
        halfWidth: p.halfWidth,
        floor: p.floor,
        ceiling: p.ceiling,
        kappa: 0,
        ratio: 1,
        inside: false,
      };
    }
    const i = index(s),
      a = path[i],
      b = path[i + 1],
      k = (s - a.s) / (b.s - a.s || 1),
      mix = (x, y) => x + (y - x) * k;
    const h = mix(heading[i], heading[i + 1]),
      f = [Math.cos(h), 0, Math.sin(h)];
    return {
      s,
      position: a.position.map((v, j) => mix(v, b.position[j])),
      forward: f,
      left: [-f[2], 0, f[0]],
      halfWidth: mix(a.halfWidth, b.halfWidth),
      floor: mix(a.floor, b.floor),
      ceiling: mix(a.ceiling, b.ceiling),
      kappa: mix(kappa[i], kappa[i + 1]),
      ratio: mix(ratio[i], ratio[i + 1]),
      inside: true,
    };
  }

  const { terrain } = course;
  function terrainHeight(x, z) {
    if (!terrain?.heights?.length) return -Infinity;
    const { origin, cellSize, columns, rows, heights } = terrain;
    const gx = clamp((x - origin[0]) / cellSize, 0, columns - 1),
      gz = clamp((z - origin[1]) / cellSize, 0, rows - 1);
    const c = Math.min(columns - 2, Math.floor(gx)),
      r = Math.min(rows - 2, Math.floor(gz));
    if (c < 0 || r < 0) return heights[0];
    const fx = gx - c,
      fz = gz - r,
      h = (cc, rr) => heights[rr * columns + cc];
    return (
      (h(c, r) * (1 - fx) + h(c + 1, r) * fx) * (1 - fz) +
      (h(c, r + 1) * (1 - fx) + h(c + 1, r + 1) * fx) * fz
    );
  }

  function world(s, u, y, frame = at(s)) {
    return [frame.position[0] + frame.left[0] * u, y, frame.position[2] + frame.left[2] * u];
  }

  function project(point) {
    let best = 0,
      bestD = Infinity;
    for (let i = 0; i < n; i++) {
      const d = Math.hypot(point[0] - path[i].position[0], point[2] - path[i].position[2]);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    let s = path[best].s;
    for (let iter = 0; iter < 4; iter++) {
      const f = at(s);
      s += (point[0] - f.position[0]) * f.forward[0] + (point[2] - f.position[2]) * f.forward[2];
    }
    const f = at(s);
    const u = (point[0] - f.position[0]) * f.left[0] + (point[2] - f.position[2]) * f.left[2];
    return { s, u, y: point[1] };
  }

  /** Flyable altitude band at a lateral position, respecting floor, ceiling and terrain. */
  function band(s, u, frame = at(s), margin = 0) {
    const [x, , z] = world(s, u, 0, frame);
    const ground = terrainHeight(x, z);
    const lo = Math.max(frame.floor, ground) + margin,
      hi = frame.ceiling - margin;
    return { lo, hi: Math.max(lo, hi), ground };
  }

  return { at, world, project, band, terrainHeight, start, end };
}
