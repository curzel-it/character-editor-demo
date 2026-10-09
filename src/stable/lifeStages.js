import { onAirBlock } from "./onAir.js";

const hour = 3_600_000;

/** Game time each stage lasts before the next, whatever the care. An egg's warms skip some of its incubation. */
export const stageDurations = { egg: 8 * hour, kid: 4 * hour, teen: 8 * hour };

export const nextAge = { kid: "teen", teen: "adult" };

/** Game time left in the dragon's stage, or null for adults. */
export function timeToGrow(dragon) {
  const duration = stageDurations[dragon.age];
  return duration ? Math.max(0, duration - dragon.growth) : null;
}

/** Game time until the dragon is an adult. */
export function timeToAdult(dragon) {
  let left = timeToGrow(dragon) ?? 0;
  for (let age = nextAge[dragon.age]; nextAge[age]; age = nextAge[age]) left += stageDurations[age];
  return left;
}

/** Share of the current stage already grown, 0..1; adults are always 1. */
export const stageProgress = (dragon) =>
  stageDurations[dragon.age] ? Math.min(1, dragon.growth / stageDurations[dragon.age]) : 1;

/** Whether the dragon finished its stage and waits for its owner to `evolve` it. */
export const readyToEvolve = (dragon) => Boolean(stageDurations[dragon.age]) && dragon.growth >= stageDurations[dragon.age];

/** Grows a hatched dragon by `dt` game ms up to the end of its stage; returns true when it gets there. */
export function grow(dragon, dt) {
  const duration = stageDurations[dragon.age];
  if (!duration || dragon.growth >= duration) return false;
  dragon.growth = Math.min(duration, dragon.growth + dt);
  return dragon.growth >= duration;
}

/** Moves a dragon that finished its stage up to the next one, unless it is on air; returns the new age, or null. */
export function evolve(stable, dragon) {
  if (!readyToEvolve(dragon) || onAirBlock(stable, dragon.id)) return null;
  dragon.age = nextAge[dragon.age];
  dragon.growth = 0;
  return dragon.age;
}
