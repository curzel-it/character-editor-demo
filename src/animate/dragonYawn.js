import { smoothstep } from "./flightMotion.js";
import { hash } from "./flightNoise.js";
import { sleepOf } from "./dragonSlumber.js";
import { mouthProfile } from "./dragonMouth.js";
import { creatureScale } from "../worldScale.js";

/** Seconds in which a bored dragon yawns at most one bout. */
const SLOT = 36;
/** Share of slots with a bout in them, a little bored and fully bored. */
const CHANCE = [0.4, 0.85];
/** Share of bouts with a second yawn, a little bored and fully bored. */
const TWICE = [0.15, 0.45];
/** Seconds at least between two bouts. */
const REST = 20;
/** Seconds between the two yawns of a bout. */
const PAUSE = 0.7;
/**
 * Each age's yawn: its length in seconds, the radians the head tips back, the share of the widest
 * gape the jaw opens to (a kid's soft young jaw opens past it) and the radians the wings shrug.
 * Kids yawn quick and big, adults slow and deep.
 */
const ages = {
  kid: { length: 2, rise: 0.5, gape: 1.3, shrug: 0.22 },
  teen: { length: 2.3, rise: 0.4, gape: 0.95, shrug: 0.16 },
  adult: { length: 2.6, rise: 0.32, gape: 0.9, shrug: 0.1 },
};

const share = (v) => Math.max(0, Math.min(1, v ?? 0));
const bump = (u, from, to) => (u <= from || u >= to ? 0 : Math.sin((Math.PI * (u - from)) / (to - from)) ** 2);

/**
 * The yawn of a bored dragon standing idle at `time` (seconds): now and then, a bout of one or
 * sometimes two yawns, more often the more bored it is. In each yawn the head tips back, the jaw
 * opens wide slowly with the eyes squeezed shut, the tongue curls and the wings shrug, then the jaw
 * shuts with a little smack, breathing out (`exhale`), and the head settles. `motion.bored` (0..1)
 * says how bored it is and `motion.idle` (0..1) how much of it plays on the ground (`stand`); never
 * asleep, in flight or not bored. `on` (0..1) covers the whole bout, `id` tells the yawns apart and
 * `since` is the seconds into this one. The same `seed` and `time` always yawn alike.
 * @param {{ age?: string }} anatomy
 * @param {{ idle?: number, stand?: number, wings?: number, sleep?: number, bored?: number } | undefined} motion
 * @param {number | null} time
 * @param {number} seed
 * @returns {{ id: number, since: number, on: number, rise: number, gape: number, squeeze: number, curl: number, shrug: number, exhale: number, full: typeof ages.kid } | null}
 */
export function yawnOf(anatomy, motion, time, seed) {
  const bored = share(motion?.bored);
  const k = share(motion?.idle) * share(motion?.stand) * (1 - share(motion?.wings)) * (1 - sleepOf(motion)) * smoothstep(0, 0.15, bored);
  if (k <= 0 || time === null) return null;
  const full = ages[anatomy.age] ?? ages.adult;
  const at = time + SLOT * hash(seed, 61),
    n = Math.floor(at / SLOT);
  if (hash(seed + 37, n) >= CHANCE[0] + (CHANCE[1] - CHANCE[0]) * bored) return null;
  const count = hash(seed + 41, n) < TWICE[0] + (TWICE[1] - TWICE[0]) * bored ? 2 : 1,
    span = count * full.length + (count - 1) * PAUSE,
    s = at - n * SLOT - hash(seed + 43, n) * (SLOT - REST - span);
  if (s <= 0 || s >= span) return null;
  const second = s > full.length + PAUSE / 2 ? 1 : 0,
    since = Math.max(0, s - second * (full.length + PAUSE)),
    u = Math.min(1, since / full.length);
  const gape = smoothstep(0.1, 0.5, u) * (1 - smoothstep(0.66, 0.8, u)) + 0.18 * bump(u, 0.8, 0.9);
  return {
    id: 2 * n + second,
    since,
    on: k * smoothstep(0, 0.3, s) * (1 - smoothstep(span - 0.3, span, s)),
    rise: k * smoothstep(0, 0.4, u) * (1 - smoothstep(0.7, 1, u)),
    gape: k * gape,
    squeeze: k * smoothstep(0.14, 0.34, u) * (1 - smoothstep(0.72, 0.86, u)),
    curl: k * smoothstep(0.3, 0.55, u) * (1 - smoothstep(0.6, 0.72, u)),
    shrug: k * smoothstep(0.15, 0.45, u) * (1 - smoothstep(0.62, 0.9, u)),
    exhale: k * bump(u, 0.66, 0.95),
    full,
  };
}

const nudge = (bones, id, delta) => {
  const bone = (bones[id] ??= {});
  const r = bone.rotation ?? [0, 0, 0];
  bone.rotation = r.map((v, i) => v + delta[i]);
};

/**
 * Plays `yawn` on top of a standing pose: the neck lifts and the head tips back, the jaw opens
 * towards its widest gape, the tongue draws back and curls up inside, the wings shrug and the nostrils flare as it
 * breathes out.
 * @param {Record<string, { rotation?: number[] }>} bones
 * @param {{ age?: string, genome?: object, scale?: number, bones: { id: string }[] }} anatomy
 * @param {NonNullable<ReturnType<typeof yawnOf>>} yawn
 */
export function yawnPose(bones, anatomy, { rise, gape, curl, shrug, exhale, full }) {
  const lift = full.rise * rise;
  nudge(bones, "chest", [0, 0, 0.12 * lift]);
  nudge(bones, "neck-0", [0, 0, 0.35 * lift]);
  nudge(bones, "neck-1", [0, 0, 0.1 * lift]);
  nudge(bones, "neck-2", [0, 0, 0.15 * lift]);
  nudge(bones, "head", [0, 0, 0.4 * lift]);
  const profile = mouthProfile(anatomy);
  if (bones.jaw?.rotation) {
    const [x, y, z] = bones.jaw.rotation,
      open = profile.closed - z,
      wide = Math.max(open, full.gape * profile.limit);
    bones.jaw.rotation = [x, y, profile.closed - (open + (wide - open) * gape)];
  }
  const has = (id) => anatomy.bones.some((bone) => bone.id === id);
  if (has("tongue")) {
    nudge(bones, "tongue", [0, 0, 0.2 * curl]);
    const p = bones.tongue.position ?? [0, 0, 0];
    bones.tongue.position = [p[0] - 0.08 * (anatomy.scale ?? creatureScale) * curl, p[1], p[2]];
  }
  if (has("tongue-tip")) nudge(bones, "tongue-tip", [0, 0, 0.5 * curl]);
  for (const side of [-1, 1]) {
    nudge(bones, `wing-${side}`, [side * full.shrug * shrug, 0, 0]);
    if (has(`nostril-${side}`)) nudge(bones, `nostril-${side}`, [side * 0.25 * exhale, 0, 0.08 * exhale]);
  }
}
