/** Bond a fresh hatchling starts with, and how much each warm of its egg adds. */
export const hatchBond = 0.1;
export const warmBond = 0.03;
/** Bond points (out of 100) every care action and every race add. */
export const careBond = 1;
export const raceBond = 3;

/** Bond a kid hatched from `egg` starts with. */
export const eggBond = (egg) => Math.round((hatchBond + warmBond * (egg?.warms ?? 0)) * 100) / 100;

/** Adds `points` (out of 100, negative to lose) to the dragon's bond, kept in 0..1. */
export function addBond(dragon, points) {
  dragon.bond = Math.max(0, Math.min(1, (dragon.bond ?? 0) + points / 100));
  return dragon.bond;
}
