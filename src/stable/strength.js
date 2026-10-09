import { careLevel } from "./care.js";
import { clampStars, maxStars, minStars } from "../dragonBuild.js";

const hour = 3_600_000;

/**
 * How fast strength (stars) grows with care: `perHour` every game hour at a care level of `careFull`
 * or more, nothing at `careFrom` or less, so a 1-star hatchling reaches 5 in about three days of good care.
 */
export const strengthPace = { perHour: (maxStars - minStars) / 72, careFrom: 0.4, careFull: 0.75 };

/** The dragon's strength in stars, 1 to 5. */
export const strengthOf = (dragon) => clampStars(dragon?.strength);

/** Share of the full pace that a care level earns, 0..1. */
export const careShare = (level) => Math.max(0, Math.min(1, (level - strengthPace.careFrom) / (strengthPace.careFull - strengthPace.careFrom)));

/** Grows a dragon's strength over `dt` game ms of its current care; neglect only stops it. */
export function strengthen(dragon, dt) {
  const gain = (strengthPace.perHour * dt * careShare(careLevel(dragon))) / hour;
  if (gain > 0) dragon.strength = Math.min(maxStars, strengthOf(dragon) + gain);
}

/** Whole stars and `progress` (0..1) towards the next, which is 1 at the top. */
export function starsOf(dragon) {
  const strength = strengthOf(dragon);
  const stars = Math.floor(strength + 1e-9);
  return { stars, progress: stars >= maxStars ? 1 : strength - stars };
}

/** A whole star the dragon reached since the last one celebrated, or null. */
export function starToCelebrate(dragon) {
  const { stars } = starsOf(dragon);
  return stars > (dragon.starsCelebrated ?? minStars) ? stars : null;
}

/** Marks the dragon's stars up to `stars` as celebrated. */
export function markStarsCelebrated(dragon, stars) {
  dragon.starsCelebrated = Math.max(dragon.starsCelebrated ?? 0, stars);
}
