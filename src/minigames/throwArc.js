/**
 * A piece thrown from `from` to pass `aim` after `flight` seconds, falling at `gravity` (metres per
 * second squared): `at(t)` is where it is `t` seconds in, `landAt` when it comes down to height
 * `ground` and `land` where.
 * @param {number[]} from
 * @param {number[]} aim
 * @param {number} flight
 * @param {number} gravity
 * @param {number} ground
 */
export function throwArc(from, aim, flight, gravity, ground) {
  const v = [0, 1, 2].map((k) => (aim[k] - from[k]) / flight + (k === 1 ? 0.5 * gravity * flight : 0));
  const at = (t) => [0, 1, 2].map((k) => from[k] + v[k] * t - (k === 1 ? 0.5 * gravity * t * t : 0));
  const c = from[1] - ground;
  const landAt = (v[1] + Math.sqrt(Math.max(0, v[1] * v[1] + 2 * gravity * c))) / gravity;
  return { at, landAt, land: at(landAt) };
}
