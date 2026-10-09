import { makeRng } from "../rng.js";

/** Chance a choice gene mutates when every parent agrees on it, and the most it adds when they all differ. */
export const baseMutation = 0.05;
export const disagreementMutation = 0.15;
/** Width of the noise on a blended shape gene, as a share of the gene's range. */
export const shapeNoise = 0.1;

const clamp = (gene, v) => Math.max(gene.min, Math.min(gene.max, v));

/** Chance that a choice gene mutates, given the variants `shown` by `parents` of them. */
export const mutationChance = (shown, parents) => baseMutation + (disagreementMutation * (shown - 1)) / Math.max(1, parents - 1);

/**
 * A child of two or more parent genomes. Choice genes (parts, element and colours) come whole from one
 * parent picked evenly, or mutate into a variant no parent shows, the likelier the more the parents
 * disagree (`mutationChance`); a `rare` gene instead turns up anew only at its own weighted odds, whatever
 * the parents show, and otherwise comes from one of them; shape genes blend across all parents with random weights that sum to 1,
 * plus a little noise. `from` maps each gene to a parent's index (for a shape gene, the heaviest
 * weight) or null (a mutation), for showing lineage.
 * @param {{ name: string, min: number, max: number, choices?: string[], weights?: number[] }[]} genes
 * @param {Record<string, number>[]} parents
 * @param {string | number} seed
 */
export function inheritGenome(genes, parents, seed) {
  const random = makeRng(`inherit:${seed}`);
  const pick = () => Math.min(parents.length - 1, Math.floor(random() * parents.length));
  const genome = {},
    from = {};
  for (const gene of genes) {
    if (gene.rare) {
      const fresh = weightedPick(gene.choices.map((_, i) => i), gene.weights, random());
      const side = pick();
      genome[gene.name] = fresh !== gene.default ? fresh : parents[side][gene.name];
      from[gene.name] = fresh !== gene.default ? null : side;
      continue;
    }
    if (gene.choices) {
      const shown = new Set(parents.map((parent) => Math.floor(parent[gene.name])));
      const unseen = gene.choices.map((_, i) => i).filter((i) => !shown.has(i));
      const roll = random();
      if (unseen.length && roll < mutationChance(shown.size, parents.length)) {
        genome[gene.name] = weightedPick(unseen, gene.weights, random());
        from[gene.name] = null;
      } else {
        const side = pick();
        genome[gene.name] = parents[side][gene.name];
        from[gene.name] = side;
      }
      continue;
    }
    const weights = blendWeights(random, parents.length);
    const noise = (random() - 0.5) * shapeNoise * (gene.max - gene.min);
    const blended = parents.reduce((sum, parent, i) => sum + parent[gene.name] * weights[i], 0);
    genome[gene.name] = clamp(gene, blended + noise);
    from[gene.name] = weights.indexOf(Math.max(...weights));
  }
  return { genome, from };
}

/** One of `options` picked by `r` in [0, 1), weighted by the gene's choice `weights` when it has them. */
function weightedPick(options, weights, r) {
  const of = options.map((i) => weights?.[i] ?? 1);
  let at = r * of.reduce((sum, w) => sum + w, 0);
  for (let k = 0; k < options.length; k++) if ((at -= of[k]) < 0) return options[k];
  return options.at(-1);
}

/** Random weights summing to 1, spread evenly over all splits; with two parents the split point is uniform. */
function blendWeights(random, n) {
  const raw = Array.from({ length: n }, () => -Math.log(1 - random()));
  const total = raw.reduce((sum, w) => sum + w, 0);
  return raw.map((w) => w / total);
}
