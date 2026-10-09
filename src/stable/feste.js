const HOUR = 3600 * 1000;

/** Real milliseconds a dragon must have been out of sight to greet its owner when it comes back on screen. */
export const festeAway = 8 * HOUR;
/** Real milliseconds after one greeting before any dragon greets again. */
export const festeRest = 5 * 60 * 1000;

/**
 * Whether `dragon`, coming on screen at `now` (real milliseconds), greets its owner: it was last on
 * screen more than `festeAway` ago, no dragon of `stable` greeted in the last `festeRest` and it is
 * awake. A dragon never seen before has no one to miss and does not greet.
 * @param {{ festeAt?: number }} stable
 * @param {{ seenAt?: number }} dragon
 * @param {number} now
 * @param {{ asleep?: boolean }} [state]
 */
export function festeDue(stable, dragon, now, { asleep = false } = {}) {
  if (asleep || !Number.isFinite(dragon.seenAt)) return false;
  return now - dragon.seenAt > festeAway && !(now - stable.festeAt < festeRest);
}

/** Notes `dragon` on screen at `now` (real milliseconds), greeting or not. */
export function markSeen(dragon, now) {
  dragon.seenAt = now;
}

/** Notes a dragon of `stable` greeting at `now` (real milliseconds). */
export function markFeste(stable, now) {
  stable.festeAt = now;
}
