/**
 * What runs along the neck and back: the spikes every dragon hatches with or, rarely, a mane of its
 * breath element that takes their place once it has grown to `maneMaturity` (a teen). The mane has no
 * mesh; `src/scene/elementalMane.js` draws it as particles from the anatomy's `mane` anchors.
 */
export const dragonManes = [
  { id: "spikes", label: "Spikes", weight: 24 },
  { id: "element", label: "Element mane", weight: 1 },
];

export const maneMaturity = 0.5;

/** Whether `genome` wears its element mane at this `maturity` (see `src/dragonAge.js`). */
export function wearsMane(genome, maturity) {
  const index = Math.max(0, Math.min(dragonManes.length - 1, Math.floor(genome.mane) || 0));
  return dragonManes[index].id === "element" && maturity >= maneMaturity;
}
