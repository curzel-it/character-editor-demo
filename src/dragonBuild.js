/** The five racing stats, in the order the profile draws them. */
export const statKeys = ["topSpeed", "acceleration", "handling", "weight", "breath"];

/** The gene behind each stat, as weights over centred shape genes; Weight is the dragon's overall bulk. */
export const statGenes = {
  topSpeed: { body: 1 },
  acceleration: { wingspan: 1 },
  handling: { tail: 1 },
  weight: { body: 0.3, thighs: 0.25, neck: 0.15, tail: 0.15, horns: 0.15 },
  breath: { horns: 1 },
};

/** How far a gene at either end of its range moves a stat's share from the even 1. */
const spread = 0.7;
/** Weight averages five genes, so it is stretched back to the spread of a single one. */
const bulkStretch = 1.8;
/** The largest share a stat can take, the edge of the profile's chart. */
export const maxShare = 1 + spread / 2;
export const minStars = 1;
export const maxStars = 5;

const centred = (genes, genome, name) => {
  const gene = genes.find((g) => g.name === name);
  if (!gene || !Number.isFinite(genome?.[name])) return 0;
  return Math.max(0, Math.min(1, (genome[name] - gene.min) / (gene.max - gene.min))) - 0.5;
};

/**
 * The dragon's build: how its genes split its strength across the five stats, as shares that
 * average 1. Two dragons of the same strength have the same total; the build says where it goes.
 * @returns {Record<string, number>}
 */
export function buildOf(genes, genome) {
  const raw = statKeys.map((key) => {
    let g = 0;
    for (const [name, w] of Object.entries(statGenes[key])) g += w * centred(genes, genome, name);
    if (key === "weight") g = Math.max(-0.5, Math.min(0.5, g * bulkStretch));
    return 1 + spread * g;
  });
  const mean = raw.reduce((sum, v) => sum + v, 0) / raw.length;
  return Object.fromEntries(statKeys.map((key, i) => [key, Math.min(maxShare, raw[i] / mean)]));
}

/** The stat the build gives the biggest share, what the dragon is built for. */
export function standout(genes, genome) {
  const build = buildOf(genes, genome);
  return statKeys.reduce((a, b) => (build[b] > build[a] ? b : a));
}

/** Strength as stars, 1 to 5, whatever the dragon carries. */
export const clampStars = (strength) => Math.max(minStars, Math.min(maxStars, Number.isFinite(strength) ? strength : minStars));

/** Stat levels the dragon's rare genes add on top of its build, from each choice gene's `bonuses`. */
export function geneBonus(genes, genome) {
  const bonus = Object.fromEntries(statKeys.map((key) => [key, 0]));
  for (const gene of genes)
    for (const [key, level] of Object.entries(gene.bonuses?.[Math.floor(genome?.[gene.name])] ?? {})) bonus[key] += level;
  return bonus;
}

/** Each stat's level: its share of the build times the dragon's strength in stars, plus its `geneBonus`. */
export function statLevels(genes, genome, strength) {
  const stars = clampStars(strength);
  const bonus = geneBonus(genes, genome);
  return Object.fromEntries(Object.entries(buildOf(genes, genome)).map(([key, share]) => [key, share * stars + bonus[key]]));
}
