import { blendMotion, smoothstep } from "./flightMotion.js";
import { envelope, mouthCues } from "./mouthEvents.js";

/** Named flight states for previews and evidence. Positive bank turns towards +Z (left). */
export const flightStates = [
  { id: "cruise", label: "Cruise", motion: { effort: 0.5 } },
  { id: "sprint", label: "Sprint", motion: { effort: 1 } },
  { id: "glide", label: "Glide", motion: { effort: 0.15, glide: 1 } },
  { id: "bankLeft", label: "Bank left", motion: { effort: 0.55, bank: 0.8 } },
  { id: "bankRight", label: "Bank right", motion: { effort: 0.55, bank: -0.8 } },
  { id: "dive", label: "Dive", motion: { effort: 0.15, glide: 1, climb: -0.7 } },
  { id: "climb", label: "Climb", motion: { effort: 0.9, climb: 0.45 } },
  { id: "exhausted", label: "Exhausted", motion: { effort: 0.45, fatigue: 1 } },
  { id: "flare", label: "Landing flare", motion: { effort: 0.9, flare: 1 } },
  { id: "stand", label: "Landed", motion: { effort: 0, glide: 1, stand: 1 } },
];

const hold = 2.4,
  blend = 1.2;

/** Auto mode: each state held for a while, then blended smoothly into the next. */
export function autoMotion(time) {
  const period = hold + blend,
    count = flightStates.length;
  const cycle = ((time / period) % count + count) % count;
  const index = Math.floor(cycle),
    local = (cycle - index) * period;
  const from = flightStates[index],
    to = flightStates[(index + 1) % count];
  const k = smoothstep(hold, period, local);
  return {
    motion: { ...blendMotion(from.motion, to.motion, k), time },
    label: k < 0.5 ? from.label : to.label,
  };
}

const roarCycle = 3.2,
  snapCycle = 1.5;

/**
 * Mouth previews for the studio: expressions races drive from events, cycled in time so the
 * envelopes show. `preview` lists sample times for evidence strips.
 */
export const mouthStates = [
  {
    id: "panting",
    label: "Panting",
    motionAt: (time) => ({ effort: 0.95, gasp: 0.45, time }),
    preview: [0, 0.12, 0.24, 0.36, 0.48, 0.6],
  },
  {
    id: "roar",
    label: "Roar",
    motionAt: (time) => {
      const age = ((time % roarCycle) + roarCycle) % roarCycle;
      const { attack, hold, decay } = mouthCues.roar;
      return { effort: 0.7, roar: envelope(age - 0.3, attack, hold + 0.4, decay), time };
    },
    preview: [0.3, 0.45, 0.65, 1.1, 1.7, 2.1],
  },
  {
    id: "snap",
    label: "Snap",
    motionAt: (time) => {
      const cycle = Math.floor(time / snapCycle),
        age = time - cycle * snapCycle;
      const { attack, hold, decay } = mouthCues.snap;
      return { effort: 0.85, snap: envelope(age - 0.3, attack, hold, decay), snapSide: cycle % 2 ? -1 : 1, time };
    },
    preview: [0.3, 0.34, 0.37, 0.4, 0.46, 0.55],
  },
];
