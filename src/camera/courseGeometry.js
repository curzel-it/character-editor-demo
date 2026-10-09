import { add, cross, distance, dot, lerp, normalize, scale, sub } from "../vec3.js";
import { creatureScale, lengthScale as L } from "../worldScale.js";

const UP = [0, 1, 0];
/** Minimum eye height above the terrain envelope, in metres. */
export const CLEARANCE = 4 * L;
const SLOPE_RINGS = [8, 16, 24].map((r) => r * L);
const SIGHT_STEP = 2.5 * L,
  SIGHT_MARGIN = 1 * L,
  CEILING_LIFT = 30 * L,
  SEARCH_RADIUS = 120 * L;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Bilinear terrain height at world (x, z); edges clamp. */
export function terrainHeight(terrain, x, z) {
  if (!terrain?.heights?.length) return -Infinity;
  const { origin, cellSize, columns, rows, heights } = terrain;
  const u = clamp((x - origin[0]) / cellSize, 0, columns - 1),
    v = clamp((z - origin[1]) / cellSize, 0, rows - 1);
  const c = Math.min(columns - 2, Math.floor(u)),
    r = Math.min(rows - 2, Math.floor(v));
  const cu = Math.max(0, c),
    rv = Math.max(0, r);
  const fu = columns > 1 ? u - cu : 0,
    fv = rows > 1 ? v - rv : 0;
  const at = (i, j) =>
    heights[Math.min(rows - 1, j) * columns + Math.min(columns - 1, i)];
  const top = at(cu, rv) * (1 - fu) + at(cu + 1, rv) * fu,
    bottom = at(cu, rv + 1) * (1 - fu) + at(cu + 1, rv + 1) * fu;
  return top * (1 - fv) + bottom * fv;
}

const RING = Array.from({ length: 12 }, (_, i) => [
  Math.cos((i / 12) * Math.PI * 2),
  Math.sin((i / 12) * Math.PI * 2),
]);

/**
 * Terrain envelope with slope at most 1 within 24 m × lengthScale, so an eye resting on it
 * climbs early and gradually instead of popping over ridges.
 */
export function terrainClearance(terrain, x, z) {
  let h = terrainHeight(terrain, x, z);
  for (const r of SLOPE_RINGS)
    for (const [cx, cz] of RING)
      h = Math.max(h, terrainHeight(terrain, x + cx * r, z + cz * r) - r);
  return h;
}

/** Horizontal unit left vector for a forward direction (+Z is left of +X). */
export function leftOf(forward) {
  const flat = normalize([forward[0], 0, forward[2]]);
  return normalize(cross(flat, UP));
}

/** Corridor sample interpolated at arc length s, extrapolated beyond the ends. */
export function pathAt(course, s) {
  const path = course.path;
  if (s <= path[0].s) {
    const p = path[0];
    return { ...p, s, position: add(p.position, scale(p.forward, s - p.s)) };
  }
  const last = path.at(-1);
  if (s >= last.s)
    return {
      ...last,
      s,
      position: add(last.position, scale(last.forward, s - last.s)),
    };
  let lo = 0,
    hi = path.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path[mid].s <= s) lo = mid;
    else hi = mid;
  }
  const a = path[lo],
    b = path[hi],
    k = (s - a.s) / (b.s - a.s || 1);
  return {
    s,
    position: lerp(a.position, b.position, k),
    forward: normalize(lerp(a.forward, b.forward, k)),
    halfWidth: a.halfWidth + (b.halfWidth - a.halfWidth) * k,
    floor: a.floor + (b.floor - a.floor) * k,
    ceiling: a.ceiling + (b.ceiling - a.ceiling) * k,
  };
}

/** Arc length of the centreline point nearest to p (horizontal distance). */
export function nearestS(course, p, hint) {
  const path = course.path;
  let best = 0,
    bestD = Infinity;
  let from = 0,
    to = path.length - 1;
  if (Number.isFinite(hint)) {
    const step = path.length > 1 ? path[1].s - path[0].s || 10 : 10;
    const i = Math.round((hint - path[0].s) / step),
      reach = Math.ceil(SEARCH_RADIUS / step);
    from = clamp(i - reach, 0, path.length - 1);
    to = clamp(i + reach, 0, path.length - 1);
  }
  for (let i = from; i <= to; i++) {
    const q = path[i].position,
      d = (q[0] - p[0]) ** 2 + (q[2] - p[2]) ** 2;
    if (d < bestD) (bestD = d), (best = i);
  }
  let s = path[best].s;
  let bestSeg = Infinity;
  for (const j of [best - 1, best]) {
    if (j < 0 || j + 1 >= path.length) continue;
    const a = path[j].position,
      b = path[j + 1].position;
    const ab = [b[0] - a[0], 0, b[2] - a[2]],
      ap = [p[0] - a[0], 0, p[2] - a[2]];
    const k = clamp(dot(ap, ab) / (dot(ab, ab) || 1), 0, 1);
    const d = (ap[0] - ab[0] * k) ** 2 + (ap[2] - ab[2] * k) ** 2;
    if (d < bestSeg)
      (bestSeg = d), (s = path[j].s + (path[j + 1].s - path[j].s) * k);
  }
  return s;
}

const clear = (terrain, a, b, margin) => {
  const steps = clamp(Math.ceil(distance(a, b) / SIGHT_STEP), 8, 96);
  for (let i = 1; i < steps; i++) {
    const p = lerp(a, b, i / steps);
    if (p[1] < terrainHeight(terrain, p[0], p[2]) + margin) return false;
  }
  return true;
};

/**
 * Keeps an eye inside the flyable corridor, above the terrain and with a
 * clear line of sight to the target, pulling in towards the target if needed.
 * `ground: true` allows a camera standing on the terrain below the corridor floor, raised over a bank that blocks its view.
 */
export function legalEye(course, eye, target, options = {}) {
  const margin = options.margin ?? CLEARANCE,
    lift = options.lift ?? CEILING_LIFT;
  const s = nearestS(course, eye, options.hint);
  const c = pathAt(course, s),
    left = leftOf(c.forward);
  const offset = sub(eye, c.position);
  const lateral = dot(offset, left),
    limit = c.halfWidth * 0.92;
  let p = eye;
  if (Math.abs(lateral) > limit)
    p = add(p, scale(left, clamp(lateral, -limit, limit) - lateral));
  if (!options.ground) p = [p[0], clamp(p[1], c.floor + margin, c.ceiling + lift), p[2]];
  const ground = options.ground
    ? (q) => Math.max(q[1], terrainHeight(course.terrain, q[0], q[2]) + margin)
    : (q) => Math.max(q[1], terrainClearance(course.terrain, q[0], q[2]) + margin);
  p = [p[0], ground(p), p[2]];
  if (options.ground && !clear(course.terrain, p, target, SIGHT_MARGIN))
    for (let rise = 1; rise <= 8; rise++) {
      const q = [p[0], p[1] + rise * 1.5 * creatureScale, p[2]];
      if (clear(course.terrain, q, target, SIGHT_MARGIN)) {
        p = q;
        break;
      }
    }
  if (!clear(course.terrain, p, target, SIGHT_MARGIN)) {
    for (let k = 0.1; k < 0.95; k += 0.1) {
      const q = lerp(p, target, k);
      const r = [q[0], ground(q), q[2]];
      if (clear(course.terrain, r, target, SIGHT_MARGIN)) {
        p = r;
        break;
      }
    }
  }
  return p;
}
