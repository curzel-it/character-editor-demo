import { smoothstep } from "./flightMotion.js";
import { hash } from "./flightNoise.js";

/** Seconds each idle slot lasts; some slots carry one wag, the rest are still. */
const SLOT = 8;
/** Share of slots with a wag in them. */
const CHANCE = 0.45;
/** Shortest and longest wag, in seconds. */
const LENGTH = [2.2, 3.2];
/** Seconds a wag takes to build up and to die down. */
const EASE = [0.35, 0.6];
/** Radians each tail joint trails the one before it, so the sweep travels down the tail. */
const LAG = 0.5;
/** Wags a second and how far each joint swings at the tip, by age: kids wag fast and wide. */
const STYLE = {
  kid: { rate: 2.6, swing: 0.19 },
  teen: { rate: 2.1, swing: 0.15 },
  adult: { rate: 1.6, swing: 0.11 },
};

/**
 * How hard an idle dragon wags its tail at `time` (seconds), 0..1: now and then it wags for a couple
 * of seconds, building up and dying down, then rests a while. The same `seed` and `time` always
 * wag the same way.
 * @param {number} time
 * @param {number} seed
 * @returns {number}
 */
export function wagOf(time, seed) {
  const at = time + SLOT * hash(seed, 47),
    n = Math.floor(at / SLOT);
  if (hash(seed + 11, n) >= CHANCE) return 0;
  const length = LENGTH[0] + (LENGTH[1] - LENGTH[0]) * hash(seed + 13, n),
    since = at - n * SLOT - (SLOT - length) * hash(seed + 17, n);
  return smoothstep(0, EASE[0], since) * (1 - smoothstep(length - EASE[1], length, since));
}

/**
 * Sweeps the tail side to side on top of a standing pose, the swing growing towards the tip and
 * trailing down the joints in a wave, the tail lifted a touch and the chest swaying against it.
 * `weight` (0..1) scales the whole wag.
 * @param {Record<string, { rotation?: number[] }>} bones
 * @param {{ age?: string }} anatomy
 * @param {{ time: number, seed: number, weight: number }} wag
 */
export function wagPose(bones, anatomy, { time, seed, weight }) {
  const k = weight * wagOf(time, seed);
  if (k <= 0) return;
  const { rate, swing } = STYLE[anatomy.age] ?? STYLE.adult;
  const phase = 2 * Math.PI * rate * time;
  for (let i = 0; i < 7; i++) {
    const loose = (i + 1) / 7;
    turn(bones, `tail-${i}`, [0, k * swing * (0.35 + 0.65 * loose) * Math.sin(phase - i * LAG), i < 2 ? -0.1 * k : 0]);
  }
  turn(bones, "chest", [0, -0.2 * k * swing * Math.sin(phase + 0.4), 0]);
}

function turn(bones, id, delta) {
  const bone = (bones[id] ??= {});
  const [x = 0, y = 0, z = 0] = bone.rotation ?? [];
  bone.rotation = [x + delta[0], y + delta[1], z + delta[2]];
}
