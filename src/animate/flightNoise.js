/** Smooth deterministic wander in [-1, 1]: incommensurate sines, so it never visibly repeats. */
export const drift = (time, seed = 0) =>
  0.5 * Math.sin(time * 1.13 + seed) +
  0.3 * Math.sin(time * 2.71 + seed * 1.7 + 1.3) +
  0.2 * Math.sin(time * 4.37 + seed * 2.9 + 2.1);

/** Stable per-individual offset so racers sharing a state do not move in lockstep. */
export const individualSeed = (genome = {}) =>
  Object.values(genome).reduce(
    (sum, value, index) =>
      Number.isFinite(value) ? sum + value * (index * 7.31 + 3.17) : sum,
    0,
  ) % 100;

/** A deterministic pseudo-random number in [0, 1) for the pair `a`, `b`. */
export const hash = (a, b) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};
