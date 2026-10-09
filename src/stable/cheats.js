import { makeGenome } from "../subjects.js";
import { presets } from "../genome/dragon.js";
import { standout, statKeys } from "../dragonBuild.js";
import { createDragon } from "./createDragon.js";

/** How many seeds a cheat tries before giving up on a standout stat. */
const rerolls = 500;
let cheated = 0;

/** What `cheatDragon` understands as a kind: coat presets, standout stats and each choice gene's ids. */
export function dragonKinds(genes) {
  return {
    presets: presets.map((p) => p.id),
    standouts: [...statKeys],
    genes: Object.fromEntries(genes.filter((g) => g.ids).map((g) => [g.name, [...g.ids]])),
  };
}

/** The choice value `value` (an id, a label or an index) names in gene `gene`, or undefined. */
function choiceIndex(gene, value) {
  if (Number.isInteger(value)) return value >= 0 && value < gene.ids.length ? value : undefined;
  const key = String(value).toLowerCase();
  const i = gene.ids.findIndex((id, n) => id.toLowerCase() === key || gene.choices[n].toLowerCase() === key);
  return i < 0 ? undefined : i;
}

/** Reads a kind (a word, "gene:id", a list of those, or a `{ gene: value }` object) into gene overrides and a standout stat. */
function readKind(genes, kind) {
  const overrides = {};
  let stat = null;
  const set = (gene, value) => {
    if (gene.ids) {
      const i = choiceIndex(gene, value);
      if (i === undefined) throw new Error(`No ${gene.name} "${value}"; try one of ${gene.ids.join(", ")}`);
      overrides[gene.name] = i;
    } else if (Number.isFinite(value)) overrides[gene.name] = Math.max(gene.min, Math.min(gene.max, value));
    else throw new Error(`${gene.name} takes a number from ${gene.min} to ${gene.max}`);
  };
  const word = (w) => {
    const [name, value] = String(w).split(":");
    if (value !== undefined) {
      const gene = genes.find((g) => g.name === name);
      if (!gene) throw new Error(`No gene "${name}"`);
      return set(gene, isNaN(value) ? value : Number(value));
    }
    const preset = presets.find((p) => p.id === w.toLowerCase());
    if (preset) return Object.assign(overrides, preset.genes);
    if (statKeys.includes(w)) return void (stat = w);
    const hits = genes.filter((g) => g.ids && choiceIndex(g, w) !== undefined);
    if (hits.length === 1) return set(hits[0], w);
    if (hits.length > 1) throw new Error(`"${w}" is ambiguous; say ${hits.map((g) => `${g.name}:${w}`).join(" or ")}`);
    throw new Error(`Unknown kind "${w}"; see __game.cheats.kinds()`);
  };
  if (kind == null) return { overrides, stat };
  if (typeof kind === "string") kind.split(/[\s,]+/).filter(Boolean).forEach(word);
  else if (Array.isArray(kind)) kind.forEach(word);
  else
    for (const [name, value] of Object.entries(kind)) {
      if (name === "standout") stat = value;
      else {
        const gene = genes.find((g) => g.name === name);
        if (!gene) throw new Error(`No gene "${name}"`);
        set(gene, value);
      }
    }
  return { overrides, stat };
}

/**
 * A dragon of the given kind, for the console cheats: `kind` is a coat preset ("ember"), a standout
 * stat ("topSpeed"), any choice gene's id ("fire", or "breath:fire" when the id is shared), a list
 * of those, or a `{ gene: value }` object. Not added to the stable.
 */
export function cheatDragon(genes, stable, kind, { age = "adult", strength = 3, name, seed } = {}) {
  const { overrides, stat } = readKind(genes, kind);
  const base = seed ?? `cheat:${stable.seed}:${Date.now()}:${cheated++}`;
  let genome, chosen;
  for (let n = 0; n < rerolls; n++) {
    chosen = n ? `${base}:${n}` : String(base);
    genome = { ...makeGenome(genes, chosen), ...overrides };
    if (!stat || standout(genes, genome) === stat) break;
    if (n === rerolls - 1) throw new Error(`No ${stat} dragon in ${rerolls} seeds with those genes`);
  }
  const dragon = createDragon({ seed: chosen, genome, age, now: stable.clock.game, strength });
  if (name) dragon.name = name;
  return dragon;
}
