import { createDragon } from "./createDragon.js";
import { eggBaby, eggReady, hatchStrength } from "./egg.js";
import { eggBond } from "./bond.js";

/** Hatches a ready egg into a kid in the stable, as strong as its stars and warms and bonded by every warm; returns the kid, or null if it is not ready. */
export function hatchEgg(stable, genes, eggId, now) {
  const index = stable.eggs.findIndex((e) => e.id === eggId);
  const egg = stable.eggs[index];
  if (!egg || !eggReady(egg)) return null;
  const { genome, from } = eggBaby(genes, egg);
  const parents = egg.parents?.map((p) => ({ ...p, genome: { ...p.genome } })) ?? null;
  const generation = egg.parents ? 1 + Math.max(...egg.parents.map((p) => p.generation ?? 0)) : 0;
  const kid = createDragon({ seed: egg.seed, genome, now, parents, from, generation, bond: eggBond(egg), strength: hatchStrength(egg) });
  stable.eggs.splice(index, 1);
  stable.dragons.push(kid);
  return kid;
}
