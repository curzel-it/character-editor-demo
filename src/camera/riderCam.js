import { add, cross, normalize, scale } from "../vec3.js";
import { clamp } from "./courseGeometry.js";

// Saddle in the body frame (+forward, +up from the root bone), in metres at adult size.
const SEAT = [0.9, 0.9];
// The rider is 1.75 m at every age, so the lens sits a fixed distance from the saddle:
// behind, above and off one shoulder, looking past the helmet along the neck.
const EYE = { back: 2.7, up: 1.55, out: 0.8 },
  LOOK = { ahead: 3.2, up: 0.1 };
export const RIDER_FOV = 0.8;
// Horizon roll follows the bank only partly, so the rider leans in frame instead of the world.
const ROLL_SHARE = 0.3,
  ROLL_LIMIT = 0.22;

/**
 * Onboard camera framed on the saddle, attached to the racer at `position` (its root bone) with
 * a smoothed `forward` and `bank`. `size` is the dragon's age scale and `side` picks the shoulder.
 */
export function riderCam({ position, forward, bank, size = 1, side = 1 }) {
  const f = normalize(forward);
  // The same body frame as `orientation` in math3d.js, so the lens stays on the drawn saddle.
  const level = normalize([-f[2], 0, f[0]]);
  const flatUp = cross(level, f);
  const c = Math.cos(bank),
    s = Math.sin(bank);
  const up = add(scale(flatUp, c), scale(level, s)),
    left = add(scale(level, c), scale(flatUp, -s));
  const at = (ahead, lift, out = 0) => add(add(add(position, scale(f, ahead)), scale(up, lift)), scale(left, out));
  const seat = [SEAT[0] * size, SEAT[1] * size];
  return {
    seat: at(seat[0], seat[1]),
    eye: at(seat[0] - EYE.back, seat[1] + EYE.up, side * EYE.out),
    target: at(seat[0] + LOOK.ahead, seat[1] + LOOK.up),
    fov: RIDER_FOV,
    roll: clamp(bank * ROLL_SHARE, -ROLL_LIMIT, ROLL_LIMIT),
  };
}
