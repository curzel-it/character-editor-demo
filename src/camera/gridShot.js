import { add, cross, dot, normalize, scale, sub } from "../vec3.js";
import { creatureScale as C } from "../worldScale.js";
import { LEAD_IN } from "../race/countdown.js";
import { surfaceAt } from "../course/surfaceAt.js";
import { clamp, leftOf } from "./courseGeometry.js";

const WIDE = 16 / 9,
  EYE_HEIGHT = 1.4 * C,
  BESIDE = 7 * C,
  BEHIND = 20 * C,
  AHEAD = 30 * C,
  LOOK_UP = 2 * C,
  CREEP = 6 * C,
  CLEAR = 8 * C,
  MARGIN = 1.3;
const CLOSE_BESIDE = 6 * C,
  CLOSE_BEHIND = 22 * C,
  CLOSE_AHEAD = 14 * C,
  CLOSE_FOV = 0.9;

const centroid = (points) => scale(points.reduce((a, p) => add(a, p), [0, 0, 0]), 1 / Math.max(1, points.length));
const ease = (k) => 1 - (1 - k) ** 3;

/** The standing surface under (x, z), or `fallback` off the terrain. */
function floorAt(course, [x, , z], fallback) {
  const spot = surfaceAt(course, x, z);
  return Number.isFinite(spot.ground) ? Math.max(spot.ground, spot.level) : fallback;
}

/**
 * The starting grid seen from down low behind and beside a few of its racers, looking forward along
 * the course so their takeoff rises away from the lens. `group` are the indices of the racers to
 * frame (the owner's, say); without one it is the two front-row racers on the camera's side. Through
 * the lead-in (t < 0) the lens creeps forward and settles at the start; after Go it stays put and
 * turns and tilts up after the group. A canvas at least as wide as it is tall fits the whole group,
 * with `span`, the horizontal half-angle tangent it needs on canvases narrower than 16:9. An upright
 * one stands behind and beside the group's outermost racer and follows it. The rest of the field
 * falls where it may. `slots` are the racers' starting positions, `current` their positions now in
 * the same order, `side` (±1) the side of the field and `size` the largest racer's age size.
 */
export function gridShot(course, slots, forward, current, side, t, { size = 1, aspect = WIDE, group = [] } = {}) {
  const f = normalize([forward[0], 0, forward[2]]),
    l = scale(leftOf(f), side);
  const centre = centroid(slots);
  const along = slots.map((p) => dot(sub(p, centre), f)),
    across = slots.map((p) => dot(sub(p, centre), l));
  const chosen = group.filter((i) => slots[i]);
  if (!chosen.length) {
    const front = Math.max(...along);
    const row = slots.map((_, i) => i).filter((i) => along[i] > front - 10 * C * size);
    chosen.push(...row.sort((a, b) => across[b] - across[a]).slice(0, 2));
  }
  const creep = CREEP * size * (1 - ease(clamp((t + LEAD_IN) / LEAD_IN, 0, 1)));
  const lowest = Math.min(...slots.map((p) => p[1])) - 2 * C * size;
  const place = (point) => {
    // Step out from the field until no starting dragon stands on the lens.
    let p = point;
    for (let i = 0; i < 12 && slots.some((q) => Math.hypot(q[0] - p[0], q[2] - p[2]) < CLEAR * size); i++) p = add(p, scale(l, 2 * C * size));
    return [p[0], floorAt(course, p, lowest) + EYE_HEIGHT * size, p[2]];
  };
  const rear = Math.min(...chosen.map((i) => along[i])),
    outer = Math.max(...chosen.map((i) => across[i]));
  const base = add(centre, add(scale(f, rear), scale(l, outer)));

  if (aspect < 1) {
    const near = chosen.reduce((a, i) => (across[i] > across[a] ? i : a));
    const eye = place(add(add(slots[near], scale(l, CLOSE_BESIDE * size)), scale(f, -(CLOSE_BEHIND * size + creep))));
    const target = add(current[near], add(scale(f, CLOSE_AHEAD * size), [0, LOOK_UP * size, 0]));
    return { eye, target, fov: CLOSE_FOV };
  }

  const eye = place(add(base, add(scale(l, BESIDE * size), scale(f, -(BEHIND * size + creep)))));
  const home = centroid(chosen.map((i) => slots[i])),
    moved = sub(centroid(chosen.map((i) => current[i])), home);
  const aim = add(home, scale(f, Math.max(...chosen.map((i) => along[i])) - dot(sub(home, centre), f) + AHEAD * size));
  const target = add([aim[0], home[1] + LOOK_UP * size, aim[2]], moved);
  const view = normalize(sub(target, eye)),
    right = normalize([-view[2], 0, view[0]]),
    up = normalize(cross(right, view));
  let tall = 0,
    wide = 0;
  for (const i of chosen) {
    const r = sub(current[i], eye),
      depth = Math.max(C, dot(r, view));
    tall = Math.max(tall, (Math.abs(dot(r, up)) + 3 * C * size) / depth);
    wide = Math.max(wide, (Math.abs(dot(r, right)) + 7 * C * size) / depth);
  }
  const fov = clamp(2 * Math.atan(MARGIN * Math.max(tall, wide / WIDE)), 0.45, 1.2),
    span = MARGIN * wide;
  return { eye, target, fov, span };
}
