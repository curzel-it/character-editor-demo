import { makeRng } from "./rng.js";
import { genes, presets } from "./genome/dragon.js";
import { createAnatomy } from "./anatomy/dragon.js";
import { pose } from "./animate/dragon.js";

export const subjects = [
  { id: "dragon", label: "Dragons", note: "Two hind legs, two wings" },
];
export const styles = [
  { id: "lowPoly", label: "Low-poly" },
  { id: "cozy", label: "Cozy" },
];

const loaded = { dragon: { genes, presets, createAnatomy, pose } };

export async function loadSubject(id) {
  if (!subjects.some((s) => s.id === id))
    throw new Error(`Unknown subject: ${id}`);
  return loaded[id];
}

export function makeGenome(genes, seed) {
  const random = makeRng(seed);
  return Object.fromEntries(
    genes.map((gene) => {
      const r = random();
      return [gene.name, gene.weights ? weightedChoice(gene.weights, r) : gene.min + r * (gene.max - gene.min)];
    }),
  );
}

/** Index picked by `r` in [0, 1) from relative choice weights. */
function weightedChoice(weights, r) {
  const total = weights.reduce((sum, w) => sum + w, 0);
  let at = r * total;
  for (let i = 0; i < weights.length; i++) if ((at -= weights[i]) < 0) return i;
  return weights.length - 1;
}

export function restoreGenome(genes, seed, saved = {}, previousGenes) {
  const defaults = makeGenome(genes, seed);
  return Object.fromEntries(
    genes.map((gene) => {
      const previous = previousGenes?.find((entry) => entry.name === gene.name);
      const compatible =
        !previousGenes ||
        (previous &&
          ["min", "max"].every((key) => previous[key] === gene[key]));
      const value = compatible ? saved?.[gene.name] : undefined;
      return [
        gene.name,
        Number.isFinite(value)
          ? Math.max(gene.min, Math.min(gene.max, value))
          : defaults[gene.name],
      ];
    }),
  );
}
