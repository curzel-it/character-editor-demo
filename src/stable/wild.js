import { onAirBlock } from "./onAir.js";
import { slotsFree } from "./stableSlots.js";

/** Game time a wild dragon takes to fly home once called; provisional. */
export const flightHome = 2 * 3_600_000;

/** @param {{ wild?: object[] }} stable */
const wildOf = (stable) => (stable.wild ??= []);

export const findWild = (stable, id) => wildOf(stable).find((w) => w.id === id) ?? null;

/** Whether the wild dragon was called and is flying home. */
export const onTheWay = (dragon) => dragon.wild?.homeAt != null;

/** Why the dragon cannot be sent to the wild as a block code, or null when it can. */
export function wildBlock(stable, id) {
  const dragon = stable.dragons.find((w) => w.id === id);
  if (!dragon) return findWild(stable, id) ? "wild.alreadyWild" : "wild.notInStable";
  if (dragon.age !== "adult") return "wild.adultsOnly";
  return onAirBlock(stable, id);
}

/** Moves `dragon` from the stable to the wild, whatever its age, freeing its slot at once. */
export function goWild(stable, dragon, now) {
  stable.dragons.splice(stable.dragons.indexOf(dragon), 1);
  dragon.wild = { since: now, homeAt: null };
  wildOf(stable).push(dragon);
  return dragon;
}

/** Sends an adult to the wild, freeing its slot at once; returns it, or null when `wildBlock` refuses. */
export function sendToWild(stable, id, now) {
  if (wildBlock(stable, id)) return null;
  return goWild(stable, stable.dragons.find((w) => w.id === id), now);
}

/** Why the wild dragon cannot be called home as a block code, or null when it can. */
export function callBlock(stable, id) {
  const dragon = findWild(stable, id);
  if (!dragon) return "wild.notWild";
  if (onTheWay(dragon)) return "wild.onTheWay";
  if (!slotsFree(stable)) return "stableFull";
  return null;
}

/** Calls a wild dragon home: it holds a slot from now and lands `flightHome` later. Returns it, or null when `callBlock` refuses. */
export function callHome(stable, id, now) {
  if (callBlock(stable, id)) return null;
  const dragon = findWild(stable, id);
  dragon.wild.homeAt = now + flightHome;
  return dragon;
}

/** Game time left until a dragon on its way home lands, or null when it was not called. */
export const timeToArrive = (dragon, now) => (onTheWay(dragon) ? Math.max(0, dragon.wild.homeAt - now) : null);

/** Moves every dragon whose flight has landed by `now` into the stable, earliest first; returns `{ type: "arrived", id }` events. */
export function arrivals(stable, now) {
  const landed = wildOf(stable)
    .filter((w) => onTheWay(w) && w.wild.homeAt <= now)
    .sort((a, b) => a.wild.homeAt - b.wild.homeAt || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  stable.wild = stable.wild.filter((w) => !landed.includes(w));
  return landed.map((dragon) => {
    delete dragon.wild;
    stable.dragons.push(dragon);
    return { type: "arrived", id: dragon.id };
  });
}
