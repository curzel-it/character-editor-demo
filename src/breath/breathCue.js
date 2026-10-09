import { envelope } from "../animate/mouthEvents.js";

/** Seconds a breath attack lasts from the cue to the last of the plume leaving the mouth. */
export const breathLength = 2.6;

/**
 * Motion for a breath attack `age` seconds after its cue: the head rears back to draw breath, then
 * `breath` holds the jaw open while the plume pours out. Spread it into the motion passed to `pose`;
 * `breath` is also the plume's strength.
 */
export function breathCue(age) {
  return {
    roar: 0.35 * envelope(age, 0.25, 0.1, 0.25),
    breath: envelope(age - 0.45, 0.15, 1.55, 0.35),
  };
}
