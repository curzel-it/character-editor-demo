import { playRace } from "./raceSounds.js";
import { playDragonCall, playStable } from "./stableSounds.js";
import { playUi } from "./uiSounds.js";

const maxJump = 0.5;

/**
 * Plays the Soul Altar's beats that fall in `(from, to]` of its show: the stone waking, the
 * parents landing, their breath, the burst and the egg or the silent stone.
 * @param {{beats: {id: string, at: number}[], arrivals: {land: number}[], success: boolean}} timeline
 * @param {number} from @param {number} to
 */
export function playRitualBeats(timeline, from, to) {
  if (to <= from || to - from > maxJump) return;
  const crossed = (/** @type {number} */ at) => at > from && at <= to;
  for (const arrival of timeline.arrivals) {
    if (crossed(arrival.land)) {
      playStable("step", { level: 1.4 });
      playDragonCall("adult", 0.5);
    }
  }
  for (const beat of timeline.beats) {
    if (!crossed(beat.at)) continue;
    if (beat.id === "raise" || beat.id === "merge") playStable("altarHum");
    if (beat.id === "breathe") playRace("breath", { level: 0.8 });
    if (beat.id === "burst") playStable(timeline.success ? "altarBloom" : "miss", { level: timeline.success ? 1 : 1.5 });
    if (beat.id === "reveal") timeline.success ? playStable("hatch") : playUi("nope");
  }
}
