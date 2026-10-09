import { makeRng } from "../rng.js";

const hour = 3_600_000;

/**
 * Fatigue is 0..1: a race adds to it, rest takes it away; above `fatigueLimit` a dragon cannot
 * race. A race from fresh needs about 13 minutes of rest and one entered the moment it was fit
 * again about 17, so a league race comes round about every quarter of an hour.
 */
export const fatigueLimit = 0.1;
const raceFatigue = 0.5;
const recoveryPerHour = 1.8;

const injuries = [{ id: "wing" }, { id: "leg" }, { id: "membrane" }];

export function recover(dragon, dt, now) {
  dragon.fatigue = Math.max(0, dragon.fatigue - (recoveryPerHour * dt) / hour);
  if (dragon.injury && dragon.injury.until <= now) dragon.injury = null;
}

/** Game time until a tired dragon can race again. */
export const restTime = (dragon) => (Math.max(0, dragon.fatigue - fatigueLimit) / recoveryPerHour) * hour;

/** Why the dragon cannot race now as a block code (`tired`, `injury.<id>`), or null when it can. */
export function unfitReason(dragon) {
  if (dragon.injury) return `injury.${dragon.injury.id}`;
  if (dragon.fatigue > fatigueLimit) return "tired";
  return null;
}

/**
 * After a race: fatigue grows unless `tiring` is false, and a tired or unlucky dragon may be injured
 * for 1 to 3 hours (seeded by the race).
 */
export function afterRace(dragon, raceSeed, now, tiring = true) {
  const random = makeRng(`injury:${raceSeed}:${dragon.id}`);
  const risk = 0.02 + 0.1 * dragon.fatigue;
  if (tiring) dragon.fatigue = Math.min(1, dragon.fatigue + raceFatigue);
  if (random() >= risk) return null;
  const kind = injuries[Math.floor(random() * injuries.length)];
  dragon.injury = { ...kind, until: now + (1 + 2 * random()) * hour };
  return dragon.injury;
}
