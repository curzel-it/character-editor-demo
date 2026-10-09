const WINDOW = 0.1,
  IDEAL = 1.7,
  SOFTEST = 0.35,
  POWER = [0.3, 2.6],
  LATERAL = 0.7,
  HEIGHT = 0.6,
  FUMBLE = 0.04,
  TIRING = 0.012,
  WILD = 0.7;

/** How far a dragon of each age reaches for a ball, in its own sizes. */
export const volleyReach = { kid: 0.45, teen: 0.6, adult: 0.75 };

/**
 * The velocity, in pixels a second, of a finger whose last positions are `samples`
 * (`{ x, y, time }`, oldest first), measured over the last tenth of a second before `now`.
 * @param {{ x: number, y: number, time: number }[]} samples
 * @param {number} now
 */
export function flickOf(samples, now) {
  const recent = samples.filter((s) => now - s.time <= WINDOW);
  if (recent.length < 2) return { vx: 0, vy: 0 };
  const a = recent[0],
    b = recent[recent.length - 1];
  const dt = Math.max(1 / 120, b.time - a.time);
  return { vx: (b.x - a.x) / dt, vy: (b.y - a.y) / dt };
}

/**
 * The throw a flick of `vx`, `vy` pixels a second makes on a canvas `height` pixels tall, or null
 * when it barely goes up: `power` is 1 for a throw that just reaches the dragon's head, less for
 * one that falls short and more for one that sails over, `lateral` how far it veers sideways.
 * @param {{ vx: number, vy: number }} flick
 * @param {number} height
 */
export function throwAim({ vx, vy }, height) {
  const up = -vy / height;
  if (up < SOFTEST) return null;
  const power = Math.max(POWER[0], Math.min(POWER[1], up / IDEAL));
  return { power, lateral: Math.max(-1, Math.min(1, vx / height / Math.max(up, 0.8))) };
}

/** Where a throw arrives off the dragon's head, in its sizes: `across` the view and `up`. */
export const throwMiss = ({ power, lateral }) => ({ across: LATERAL * lateral, up: HEIGHT * (power - 1) });

/**
 * Whether a dragon with `reach` sends back a throw that arrives `wild` (in its sizes) off its head,
 * `rally` touches into the game, for a `roll` in 0..1: out of reach it always misses, within it
 * fumbles now and then, more the wilder the throw and the longer the rally.
 */
export function dragonReturns({ wild, reach, rally, roll }) {
  if (wild > reach) return false;
  return roll >= FUMBLE + TIRING * rally + WILD * (wild / reach) ** 2;
}
