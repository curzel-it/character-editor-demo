import { hashSeed } from "../rng.js";
import { jockeyName } from "./jockeyName.js";
import { createSilks, restoreSilks } from "./jockeySilks.js";
import { createRiderLook, restoreRiderLook } from "./riderLook.js";

/** @typedef {{ seed: string, name: string, silks: import("./jockeySilks.js").Silks, look: import("./riderLook.js").RiderLook }} Rider */

export const riderNameLength = 28;

/** A seeded rider: a name, silks and a look. Riders change the look only, never the race. */
export function createJockey(seed) {
  return { seed: String(seed), name: jockeyName(seed), silks: createSilks(seed), look: createRiderLook(seed) };
}

/** The next seed after a reroll, derived from the current one so rerolls replay the same way. */
export const rerollJockeySeed = (seed) => String(hashSeed(`reroll:${seed}`) % 1000000);

/** @returns {Rider} */
export function restoreJockey(saved, seed) {
  const jockeySeed = typeof saved?.seed === "string" && saved.seed ? saved.seed : String(seed);
  const name = typeof saved?.name === "string" ? saved.name.trim().slice(0, riderNameLength) : "";
  return { seed: jockeySeed, name: name || jockeyName(jockeySeed), silks: restoreSilks(saved?.silks, jockeySeed), look: restoreRiderLook(saved?.look, jockeySeed) };
}
