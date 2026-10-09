import { grow, nextAge } from "./lifeStages.js";
import { incubate } from "./egg.js";
import { decayCare } from "./care.js";
import { strengthen } from "./strength.js";
import { fatigueLimit, recover } from "./condition.js";
import { arrivals } from "./wild.js";
import { finishUnwatchedRaces } from "./unwatchedRace.js";

const maxSteps = 400,
  minStep = 60_000;

/**
 * Moves the stable forward by `dt` game ms ending at `now`: unwatched races that finished are
 * recorded (`finishUnwatchedRaces`), wild dragons called home land, eggs incubate, every dragon's needs drop, it grows, grows stronger while cared for, recovers and wakes. Returns what happened: the `raced` events, then
 * `{ type: "arrived" | "ready" | "evolve" | "healed" | "rested" | "woke", id, age? }` events; `evolve` is a dragon finishing its stage, waiting to evolve
 * into `age`, `rested` a tired dragon becoming fit to race again and `woke` one waking from its slumber.
 */
export function advanceStable(stable, dt, now) {
  const events = finishUnwatchedRaces(stable, now);
  if (dt <= 0) return events;
  events.push(...arrivals(stable, now));
  for (const egg of stable.eggs) if (incubate(egg, dt)) events.push({ type: "ready", id: egg.id });
  for (const dragon of stable.dragons) {
    const injured = Boolean(dragon.injury),
      tired = dragon.fatigue > fatigueLimit;
    recover(dragon, dt, now);
    if (injured && !dragon.injury) events.push({ type: "healed", id: dragon.id });
    if (tired && dragon.fatigue <= fatigueLimit) events.push({ type: "rested", id: dragon.id });
    if (dragon.slumberUntil > now - dt && dragon.slumberUntil <= now) events.push({ type: "woke", id: dragon.id });
    let grown = false;
    for (let left = dt; left > 0; ) {
      const slice = Math.min(Math.max(minStep, dt / maxSteps), left);
      left -= slice;
      decayCare(dragon, slice);
      strengthen(dragon, slice);
      grown ||= grow(dragon, slice);
    }
    if (grown) events.push({ type: "evolve", id: dragon.id, age: nextAge[dragon.age] });
  }
  return events;
}
