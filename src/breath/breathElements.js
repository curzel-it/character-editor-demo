/**
 * The breath a dragon is born with, one per `breath` gene value, in the order of their cycle: each
 * beats the next and loses to the one before. `lean` is how hard its hits slow (`slow`), push back
 * (`knock`) and unsettle (`daze`) a rival, 1 being an even share; `linger` stretches a slowdown or
 * a knockback over a longer, softer spell.
 * Each layer is one kind of particle in the plume; lengths are in body radii and times in seconds. `kind` is `puff` for round blobs,
 * `shard` and `spark` for particles stretched along their flight, `bolt` for jagged lightning redrawn
 * every `flicker` seconds, `bolts` at a time. `lift` is upward acceleration, negative for gravity.
 */
export const breathElements = [
  {
    id: "fire",
    label: "Fire",
    lean: { slow: 1.3, knock: 0.9, daze: 0.8 },
    layers: [
      { kind: "puff", colors: "flame", rate: 60, life: [0.55, 0.95], speed: 2.8, spread: 0.12, drag: 1.5, lift: 1.6, size: [0.05, 0.24], swirl: 0.5 },
      { kind: "spark", colors: "ember", rate: 40, life: [0.4, 0.9], speed: 3.2, spread: 0.3, drag: 0.8, lift: 0.9, size: [0.02, 0.012], stretch: 0.05 },
    ],
  },
  {
    id: "nature",
    label: "Nature",
    lean: { slow: 1.1, knock: 1.4, daze: 0.9 },
    linger: { knock: 1.5 },
    layers: [
      { kind: "shard", colors: "thorn", rate: 50, life: [0.5, 0.8], speed: 3.2, spread: 0.16, drag: 0.7, lift: -1, size: [0.06, 0.03], stretch: 0.05 },
      { kind: "puff", colors: "leaf", rate: 40, life: [0.7, 1.2], speed: 2.4, spread: 0.2, drag: 1.4, lift: -0.4, size: [0.04, 0.12], swirl: 0.8 },
    ],
  },
  {
    id: "earth",
    label: "Earth",
    lean: { slow: 1, knock: 1.5, daze: 0.8 },
    layers: [
      { kind: "puff", colors: "sand", rate: 55, life: [0.6, 1.1], speed: 2.6, spread: 0.2, drag: 1.6, lift: -0.5, size: [0.06, 0.28], swirl: 0.4 },
      { kind: "shard", colors: "rock", rate: 30, life: [0.5, 0.9], speed: 3.4, spread: 0.18, drag: 0.4, lift: -3, size: [0.06, 0.06], stretch: 0.01 },
    ],
  },
  {
    id: "storm",
    label: "Storm",
    lean: { slow: 0.9, knock: 0.8, daze: 1.6 },
    layers: [
      { kind: "bolt", colors: "bolt", reach: 2.3, width: 0.022, flicker: 0.07, forks: 2, jitter: 0.07, bolts: 2 },
      { kind: "spark", colors: "bolt", rate: 70, life: [0.12, 0.3], speed: 4.5, spread: 0.32, drag: 0.5, lift: 0, size: [0.018, 0.01], stretch: 0.06 },
      { kind: "puff", colors: "charge", rate: 30, life: [0.2, 0.4], speed: 2.8, spread: 0.12, drag: 1.2, lift: 0, size: [0.04, 0.14] },
    ],
  },
  {
    id: "water",
    label: "Water",
    lean: { slow: 1.2, knock: 0.9, daze: 0.8 },
    linger: { slow: 1.5 },
    layers: [
      { kind: "puff", colors: "water", rate: 70, life: [0.45, 0.75], speed: 3.6, spread: 0.08, drag: 0.9, lift: -1.4, size: [0.05, 0.16] },
      { kind: "shard", colors: "frost", rate: 40, life: [0.5, 0.8], speed: 3.2, spread: 0.18, drag: 0.9, lift: -1.2, size: [0.05, 0.07], stretch: 0.04 },
      { kind: "puff", colors: "mist", rate: 25, life: [0.6, 1.1], speed: 2.2, spread: 0.2, drag: 1.7, lift: -0.25, size: [0.05, 0.3], swirl: 0.2 },
    ],
  },
];

/** The breath element of `genome`. */
export function breathOf(genome) {
  const index = Math.floor(Number(genome?.breath) || 0);
  return breathElements[Math.max(0, Math.min(breathElements.length - 1, index))];
}

/** How a breath of element `from` lands on a dragon of element `to`: 2 super effective, 0.5 resisted (an element resists itself), else 1. */
export function matchup(from, to) {
  const n = breathElements.length;
  const a = breathElements.findIndex((e) => e.id === from),
    b = breathElements.findIndex((e) => e.id === to);
  if (a < 0 || b < 0) return 1;
  if (a === b || (b + 1) % n === a) return 0.5;
  return (a + 1) % n === b ? 2 : 1;
}
