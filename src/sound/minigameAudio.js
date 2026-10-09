import { playDragonCall, playStable } from "./stableSounds.js";
import { playUi } from "./uiSounds.js";

/** @typedef {import("./stableSounds.js").StableSound} StableSound */

/** What a scoring moment sounds like in each game, by game id and, where it matters, its step. */
const scored = /** @type {Readonly<Record<string, (step: string) => StableSound[]>>} */ ({
  feed: () => ["munch", "catch"],
  fetch: () => ["catch"],
  volleyball: () => ["bounce"],
  exercise: () => ["step", "catch"],
  groom: () => ["sparkle"],
  clean: (step) => [step === "rinse" ? "splash" : "brush", "sparkle"],
  warm: () => ["warm"],
});

/** What a game's new step sounds like, as `game:step`. */
const stepped = /** @type {Readonly<Record<string, StableSound | "call" | "nope">>} */ ({
  "feed:grass": "miss",
  "feed:lost": "miss",
  "fetch:fetch": "throw",
  "fetch:plop": "bounce",
  "fetch:stick": "catch",
  "fetch:log": "catch",
  "fetch:bone": "catch",
  "volleyball:throw": "throw",
  "volleyball:dropped": "miss",
  "volleyball:whiffed": "miss",
  "exercise:flop": "miss",
  "groom:warm": "purr",
  "groom:bliss": "purr",
  "groom:found": "call",
  "groom:snort": "nope",
  "clean:rinse": "splash",
  "clean:swing": "splash",
  "warm:hot": "miss",
  "warm:fizzle": "miss",
  "warm:cosy": "sparkle",
});

/**
 * @param {string} game the minigame's id
 * @param {{combo?: number}} event a scoring moment
 * @param {string} step the step it scored in
 */
export function playMinigameScore(game, event, step) {
  const rate = 1 + 0.06 * Math.min(6, Math.max(0, (event.combo ?? 1) - 1));
  (scored[game]?.(step) ?? ["catch"]).forEach((name, index) => playStable(name, { rate: index ? rate : 1 }));
}

/** @param {string} game @param {string} step @param {string} age the dragon's life stage */
export function playMinigameStep(game, step, age) {
  const sound = stepped[`${game}:${step}`];
  if (sound === "call") playDragonCall(age, 0.7);
  else if (sound === "nope") playUi("nope");
  else if (sound) playStable(sound);
}
