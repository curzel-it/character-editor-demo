import { neediest, needValue } from "./care.js";
import { unfitReason } from "./condition.js";
import { eggReady } from "./egg.js";
import { nextAge, readyToEvolve } from "./lifeStages.js";
import { slumbering } from "./soulAltar.js";

/** A dragon needs care once its neediest need drops below this, as its mood says. */
export const careAlarm = 30;

/**
 * @typedef {{ type: "raced", id: string, league: string, season: number, race: number }
 *   | { type: "ready", id: string }
 *   | { type: "care", id: string, need: string }
 *   | { type: "evolve", id: string, age: string }
 *   | { type: "arrived" | "woke" | "healed" | "rested", id: string }} AwayEntry
 */

/**
 * What changed while the owner was away, from the `advanceStable` events of that time and the
 * stable as it is now (game time `now`): races that finished unwatched, eggs still waiting to hatch,
 * dragons needing care, and for each dragon whether it waits to evolve into its next age, came back
 * from the wild, woke from its slumber, and healed or rested and can race. Most urgent first; entries that no longer hold (hatched eggs,
 * sent back to the wild, slumbering or injured again, races of a season that moved on) are dropped.
 * @param {{ eggs: any[], dragons: any[], clock: { game: number }, leagues?: object }} stable
 * @param {{ type: string, id: string, age?: string, league?: string, season?: number, race?: number }[]} events
 * @param {number} [now]
 * @returns {AwayEntry[]}
 */
export function summariseAway(stable, events, now = stable.clock.game) {
  const eggs = new Map(stable.eggs.map((egg) => [egg.id, egg]));
  const dragons = new Map(stable.dragons.map((w) => [w.id, w]));
  const happened = (type) => new Set(events.filter((e) => e.type === type).map((e) => e.id));
  const ready = happened("ready"),
    healed = happened("healed"),
    rested = happened("rested"),
    arrived = happened("arrived"),
    woke = happened("woke");
  const evolving = new Map(events.filter((e) => e.type === "evolve").map((e) => [e.id, e.age]));
  const entries = [];
  for (const { type, id, league, season, race } of events) {
    const current = stable.leagues?.[league];
    if (type === "raced" && dragons.has(id) && current?.number === season && current.races[race]) entries.push({ type, id, league, season, race });
  }
  for (const id of ready) if (eggs.has(id) && eggReady(eggs.get(id))) entries.push({ type: "ready", id });
  for (const w of dragons.values()) {
    const need = neediest(w);
    if (needValue(w, need.id) < careAlarm) entries.push({ type: "care", id: w.id, need: need.id });
  }
  for (const [id, age] of evolving) {
    const w = dragons.get(id);
    if (w && readyToEvolve(w) && nextAge[w.age] === age) entries.push({ type: "evolve", id, age });
  }
  for (const id of arrived) if (dragons.has(id)) entries.push({ type: "arrived", id });
  for (const id of woke) if (dragons.has(id) && !slumbering(dragons.get(id), now)) entries.push({ type: "woke", id });
  for (const w of dragons.values()) {
    if (unfitReason(w)) continue;
    if (healed.has(w.id)) entries.push({ type: "healed", id: w.id });
    else if (rested.has(w.id)) entries.push({ type: "rested", id: w.id });
  }
  return entries;
}
