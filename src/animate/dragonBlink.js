import { smoothstep } from "./flightMotion.js";
import { hash } from "./flightNoise.js";

/** Seconds in which an idle dragon blinks at most once (or twice, quickly). */
const SLOT = 3.4;
/** Share of slots that pass without a blink. */
const SKIP = 0.3;
/** Share of blinks that come as a quick double. */
const DOUBLE = 0.15;
/** Seconds the lids take to shut, the moment they stay shut and the seconds they take to open. */
const CLOSE = 0.07,
  HOLD = 0.02,
  OPEN = 0.13;

const once = (u) => (u < CLOSE ? smoothstep(0, CLOSE, u) : 1 - smoothstep(CLOSE + HOLD, CLOSE + HOLD + OPEN, u));

/**
 * How far an idle dragon's eyes are shut by blinking at `time` (seconds), 0 open to 1 shut: a
 * quick blink every few seconds at uneven intervals, now and then a double one. The same `seed`
 * and `time` always blink alike.
 * @param {number} time
 * @param {number} seed
 */
export function blinkOf(time, seed) {
  const at = time + 11.9 * hash(seed, 41),
    n = Math.floor(at / SLOT);
  if (hash(seed + 11, n) < SKIP) return 0;
  const u = at - (n + 0.1 + 0.6 * hash(seed + 13, n)) * SLOT;
  if (u < 0) return 0;
  const second = hash(seed + 17, n) < DOUBLE ? 0.32 : Infinity;
  return Math.max(u < CLOSE + HOLD + OPEN ? once(u) : 0, u >= second && u < second + CLOSE + HOLD + OPEN ? once(u - second) : 0);
}
