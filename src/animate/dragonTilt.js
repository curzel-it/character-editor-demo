import { smoothstep } from "./flightMotion.js";
import { hash } from "./flightNoise.js";
import { sleepOf } from "./dragonSlumber.js";

/** Seconds in which an idle dragon tilts its head at most once. */
const SLOT = 6.5;
/** Share of slots that pass without a tilt. */
const SKIP = 0.55;
/** Share of tilts that swing over to the other side once before coming back. */
const BOTH = 0.35;
/** Where the pupils look while the head is tilted, as `[forward, up]`. */
const CURIOUS = [0.35, 0.45];
/** Each age's roll at full tilt in radians and how long a tilt lasts in seconds. */
const ages = {
  kid: { roll: 0.55, length: 1.6 },
  teen: { roll: 0.42, length: 2 },
  adult: { roll: 0.3, length: 2.4 },
};

/**
 * The puppy-like curious tilt of a dragon standing idle at `time` (seconds): now and then the head
 * rolls quickly to one side, holds a beat leaning a little forward, sometimes swings over to the
 * other side, and comes back. `roll` is -1..1 of the age's full tilt and `lean` 0..1; kids tilt
 * further and quicker. `motion.idle` (0..1) sets how much of it plays on the ground (`stand`), faded
 * by take-off, sleep and a glum or weary mood; null when nothing plays. The same `seed` and `time`
 * always tilt alike.
 * @param {{ age?: string }} anatomy
 * @param {{ idle?: number, stand?: number, wings?: number, glum?: number, weary?: number, sleep?: number } | undefined} motion
 * @param {number | null} time
 * @param {number} seed
 * @returns {{ roll: number, lean: number, full: number } | null}
 */
export function tiltOf(anatomy, motion, time, seed) {
  const share = (v) => Math.max(0, Math.min(1, v ?? 0));
  const k = share(motion?.idle) * share(motion?.stand) * (1 - share(motion?.wings)) * (1 - sleepOf(motion)) * (1 - share(Math.max(motion?.glum ?? 0, motion?.weary ?? 0)));
  if (k <= 0 || time === null) return null;
  const { roll: full, length } = ages[anatomy.age] ?? ages.adult;
  const at = time + 17.3 * hash(seed, 53),
    n = Math.floor(at / SLOT);
  if (hash(seed + 19, n) < SKIP) return null;
  const both = hash(seed + 23, n) < BOTH,
    span = both ? 1.6 * length : length,
    u = at - n * SLOT - hash(seed + 29, n) * (SLOT - span);
  if (u <= 0 || u >= span) return null;
  const side = hash(seed + 31, n) < 0.5 ? -1 : 1,
    rise = 0.22 * length,
    fall = 0.3 * length,
    swap = both ? smoothstep(0.55 * span - 0.2 * length, 0.55 * span + 0.2 * length, u) : 0,
    held = smoothstep(0, rise, u) * (1 - smoothstep(span - fall, span, u));
  return { roll: k * side * held * (1 - 2 * swap), lean: k * held, full };
}

const nudge = (bones, id, delta) => {
  const r = bones[id]?.rotation ?? [0, 0, 0];
  bones[id] = { ...bones[id], rotation: r.map((v, i) => v + delta[i]) };
};

/**
 * Rolls the head round its snout by `tilt.roll` of its full tilt and leans the neck a little
 * forward with the head kept level, on top of the pose.
 * @param {Record<string, { rotation?: number[] }>} bones
 * @param {{ roll: number, lean: number, full: number }} tilt
 */
export function tiltPose(bones, { roll, lean, full }) {
  nudge(bones, "neck-1", [0, 0, -0.06 * lean]);
  nudge(bones, "head", [full * roll, 0, 0.06 * lean]);
}

/**
 * The pupils' `gaze` eased towards a curious look up and forwards as the head tilts.
 * @param {[number, number] | null} gaze
 * @param {{ lean: number } | null} tilt
 * @returns {[number, number] | null}
 */
export function curiousGaze(gaze, tilt) {
  if (!tilt) return gaze;
  const [forward, up] = gaze ?? [0, 0];
  return [forward + (CURIOUS[0] - forward) * tilt.lean, up + (CURIOUS[1] - up) * tilt.lean];
}
