import { cleanBeats } from "./cleanBeats.js";
import { cleanSuds } from "./cleanSuds.js";

const CIRCLE = 0.32,
  SHAKE = 5.5;

const ease = (since, from, to) => {
  const t = Math.max(0, Math.min(1, (since - from) / (to - from)));
  return t * t * (3 - 2 * t);
};
const bump = (since, from, to) => (since > from && since < to ? Math.sin((Math.PI * (since - from)) / (to - from)) : 0);

const [scrubFrom, scrubTo] = cleanBeats.scrub;
const [dropFrom, dropTo] = cleanBeats.drop;
const [shakeFrom, shakeTo] = cleanBeats.shake;
const [shineFrom, shineTo] = cleanBeats.shine;

/**
 * How a dragon reacts to Clean, and how the keeper's hand gives it: the hand rises with the brush and
 * scrubs in quick small circles while soap bubbles well up off the dragon, which leans into it; the
 * hand drops, the dragon shakes itself dry like a wet dog, flinging water off, and ends glinting clean.
 */
export const clean = {
  length: cleanBeats.length,
  hand(since) {
    const reach = ease(since, 0, cleanBeats.rise) * (1 - ease(since, dropFrom, dropTo));
    if (reach <= 0) return null;
    const scrub = ease(since, scrubFrom - 0.1, scrubFrom + 0.15) * (1 - ease(since, scrubTo - 0.15, scrubTo));
    const turn = (2 * Math.PI * (since - scrubFrom)) / CIRCLE;
    const at = [0.3 + 0.07 * scrub * Math.cos(turn), -0.72 + 0.06 * scrub * Math.sin(turn)];
    return { reach, item: "brush", at, wrist: 0.05 - 0.2 * scrub * Math.sin(turn), twist: -0.9 + 0.15 * scrub * Math.cos(turn), curl: 0.78, thumb: 0.75, roll: -0.25 + 0.1 * scrub * Math.sin(turn) };
  },
  motion(since) {
    const lean = ease(since, scrubFrom + 0.1, scrubFrom + 0.4) * (1 - ease(since, scrubTo - 0.2, scrubTo + 0.1));
    const shake = bump(since, shakeFrom, shakeTo) ** 0.5 * ease(since, shakeFrom, shakeFrom + 0.15);
    const brace = bump(since, shakeFrom - 0.25, shakeFrom + 0.1);
    const wag = Math.sin(2 * Math.PI * SHAKE * (since - shakeFrom));
    const proud = bump(since, shineFrom, shineTo);
    return {
      impact: 0.3 * lean * (1 + 0.3 * Math.sin((2 * Math.PI * since) / CIRCLE)) + 0.7 * brace + 0.25 * shake * Math.abs(wag),
      stand: 1 - shake * (0.2 + 0.25 * Math.abs(wag)) - 0.15 * proud,
      snap: shake,
      snapSide: wag,
      bank: 1.2 * shake * wag,
      roar: 0.25 * proud,
      lift: 0.02 * shake * Math.abs(wag) + 0.05 * bump(since, shineFrom + 0.1, shineFrom + 0.5),
    };
  },
  particles: cleanSuds,
};
