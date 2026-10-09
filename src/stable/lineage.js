import { colourGenes, showsGene } from "../genome/dragon.js";
import { findWild } from "./wild.js";

/**
 * @typedef {{ id: string, name: string }} Ancestor
 * @typedef {Ancestor & { generation: number, genome: object | null, owned: object | null, wild: boolean, parents: Ancestor[] | null }} LineageParent
 * @typedef {{ name: string, label: string, value: string, side: number | null, parents: (string | null)[] }} PartSource
 * @typedef {PartSource & { id: string }} ColorSource
 */

const choiceOf = (gene, genome) => (genome ? gene.choices[Math.floor(genome[gene.name])] : null);

/**
 * Where an altar-born dragon or egg came from, or null for a seed-born one: every parent of its ritual as it
 * was when the egg was made (renamed and still owned ones read from the stable or the wild, `owned`
 * is the live dragon or null, `wild` whether it is in the wild now, `parents` its own parents), and
 * for every part and every colour (scales, wings, underside) the index of the parent it came from
 * (null for a mutation) with what each parent carried, and every mutation among them.
 * @returns {{ parents: LineageParent[], parts: PartSource[], colors: ColorSource[], mutations: PartSource[] } | null}
 */
export function lineageOf(stable, genes, dragon) {
  if (!dragon.parents) return null;
  const live = (id) => stable.dragons.find((w) => w.id === id) ?? findWild(stable, id);
  const parents = dragon.parents.map((p) => {
    const owned = live(p.id);
    const grand = p.parents ?? owned?.parents ?? null;
    return {
      id: p.id,
      name: owned?.name ?? p.name,
      generation: p.generation ?? owned?.generation ?? 0,
      genome: p.genome ?? owned?.genome ?? null,
      owned,
      wild: Boolean(owned?.wild),
      parents: grand?.map(({ id, name }) => ({ id, name: live(id)?.name ?? name })) ?? null,
    };
  });
  const side = (key) => dragon.from?.[key] ?? null;
  const source = (gene) => ({ name: gene.name, label: gene.label, value: choiceOf(gene, dragon.genome), side: side(gene.name), parents: parents.map((p) => choiceOf(gene, p.genome)) });
  const parts = genes
    .filter((gene) => gene.choices && !colourGenes.includes(gene.name) && [dragon, ...parents].some((p) => showsGene(gene, p.genome)))
    .map(source);
  const colors = genes.filter((gene) => colourGenes.includes(gene.name)).map((gene) => ({ ...source(gene), id: gene.name }));
  const mutations = [...parts, ...colors].filter((trait) => trait.side === null);
  return { parents, parts, colors, mutations };
}
