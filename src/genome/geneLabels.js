import { t } from "../i18n.js";

/** The string for `key`, or `fallback` when no language has it. */
const labelOr = (key, fallback) => {
  const text = t(key);
  return text === key ? fallback : text;
};

/**
 * Makes a gene's `label`, and a choice gene's `choices`, read in the current language, keyed by the
 * gene's name and each choice's id (under `choiceKey` instead of the name when the gene shares its
 * choices, like the colour genes); the English given here is the fallback.
 * @template {{ name: string, label: string, choices?: string[], ids?: string[], choiceKey?: string }} G
 * @param {G} gene
 * @returns {G}
 */
export function withGeneLabels(gene) {
  const { label, choices, ids } = gene;
  const key = gene.choiceKey ?? gene.name;
  Object.defineProperty(gene, "label", { get: () => labelOr(`genes.labels.${gene.name}`, label), enumerable: true });
  if (choices && ids)
    Object.defineProperty(gene, "choices", {
      get: () => ids.map((id, i) => labelOr(`genes.choices.${key}.${id}`, choices[i])),
      enumerable: true,
    });
  return gene;
}
