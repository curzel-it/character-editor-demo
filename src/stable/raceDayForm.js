import { raceForm } from "../race/racerTraits.js";
import { dayOf } from "./gameClock.js";

/** The shape `dragonId` is in for the race of `raceSeed` at game time `now`: an owned dragon is in perfect shape all through the game's first day. */
export const raceDayForm = (stable, raceSeed, dragonId, now) =>
  dayOf(now) === 0 && stable.dragons.some((w) => w.id === dragonId) ? "perfect" : raceForm(raceSeed, dragonId);
