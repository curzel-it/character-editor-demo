import { throwArc } from "./throwArc.js";

const MIN_DRAG = 24,
  FULL = 0.42,
  WIDE = 0.35,
  LOFT = 0.42,
  SLOW = 4,
  FAST = 40,
  GRAVITY = 12;

/**
 * The throw a finger aims by dragging from `start` to `now` (canvas pixels) on a canvas `height` pixels
 * tall: null while the drag is too short or not up the screen, else its `speed` in metres per second,
 * the throw's reach growing evenly with the drag's length up to about 100 metres at `FULL` of the height, and its `angle`, radians off straight
 * ahead, positive to the right.
 * @param {{ x: number, y: number }} start
 * @param {{ x: number, y: number }} now
 * @param {number} height
 */
export function aimOf(start, now, height) {
  const across = now.x - start.x,
    up = start.y - now.y;
  const length = Math.hypot(across, up);
  if (length < MIN_DRAG || up < 0.4 * length) return null;
  const power = Math.min(1, (length - MIN_DRAG) / (FULL * height - MIN_DRAG));
  return { speed: Math.sqrt(SLOW * SLOW + (FAST * FAST - SLOW * SLOW) * power), angle: Math.max(-WIDE, Math.min(WIDE, Math.atan2(across, up))) };
}

/**
 * The flight of a stick thrown from `from` at `speed` along the flat unit heading `dir`, lofted
 * about 24 degrees, down to height `ground` (`throwArc`'s `at`, `landAt` and `land`).
 * @param {number[]} from
 * @param {number[]} dir
 * @param {number} speed
 * @param {number} ground
 */
export function throwFlight(from, dir, speed, ground) {
  const v = [dir[0] * speed * Math.cos(LOFT), speed * Math.sin(LOFT), dir[2] * speed * Math.cos(LOFT)];
  return throwArc(from, [from[0] + v[0], from[1] + v[1] - GRAVITY / 2, from[2] + v[2]], 1, GRAVITY, ground);
}
