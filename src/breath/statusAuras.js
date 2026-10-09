/**
 * What a status looks like on the dragon carrying it, keyed by status id: plume layers (see
 * `breathElements`) spawned from points all over the body, with `direction` the world direction
 * they leave in. A slowed dragon sheds a trail of spray, a dazed one crackles with sparks. The body
 * also takes on the status's `statusTint` (palette.js).
 */
export const statusAuras = {
  slow: {
    direction: [0, -1, 0],
    layers: [{ kind: "puff", colors: "mist", rate: 22, life: [0.5, 0.9], speed: 0.15, spread: 1.4, drag: 1.5, lift: -0.2, size: [0.05, 0.14] }],
  },
  daze: {
    direction: [0, 1, 0],
    layers: [
      { kind: "spark", colors: "ember", rate: 90, life: [0.08, 0.2], speed: 1.6, spread: 3.1, drag: 0.5, lift: 0, size: [0.014, 0.008], stretch: 0.04 },
      { kind: "puff", colors: "charge", rate: 20, life: [0.1, 0.2], speed: 0.3, spread: 3.1, drag: 1, lift: 0, size: [0.05, 0.12] },
    ],
  },
};
