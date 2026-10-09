import { needsOf, needValue } from "../stable/care.js";
import { careAlarm } from "../stable/awaySummary.js";

/** How each need running low shows in the eyes, at full strength. */
const looks = {
  fullness: { weary: 0.8, glum: 0.5 },
  happiness: { glum: 1 },
  cleanliness: { glum: 0.5 },
  exercise: { weary: 0.4, glum: 0.3 },
  affection: { glum: 0.7 },
};
/** Need points under `careAlarm` at which a need shows in full. */
const RAMP = 20;
/** Happiness under which a dragon starts to get bored, and the points further down at which it is fully bored. */
const BORED = [40, 25];

/**
 * The moods (`glum`, `weary`) a stable dragon's eyes show while it idles, as motion for its pose:
 * every need under `careAlarm` shows more the lower it runs, a hungry dragon heavy-lidded and wistful,
 * an unhappy or lonely one glum; an injured one is glum too. A dragon that wants to play is `bored`
 * and yawns now and then (see `dragonYawn.js`). Empty when it is looked after.
 * @param {{ age: string, care?: Record<string, number>, injury?: object }} dragon
 */
export function faceOf(dragon) {
  const face = { glum: dragon.injury ? 0.7 : 0, weary: 0, bored: 0 };
  if (!dragon.care) return face;
  face.bored = Math.max(0, Math.min(1, (BORED[0] - needValue(dragon, "happiness")) / BORED[1]));
  for (const need of needsOf(dragon.age)) {
    const k = Math.max(0, Math.min(1, (careAlarm - needValue(dragon, need.id)) / RAMP));
    for (const [mood, share] of Object.entries(looks[need.id] ?? {})) face[mood] = Math.max(face[mood], k * share);
  }
  return face;
}
