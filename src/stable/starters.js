import { makeGenome } from "../subjects.js";
import { createEgg, giftIncubation } from "./egg.js";
import { createDragon } from "./createDragon.js";
import { standout } from "../dragonBuild.js";
import { genomeDistance } from "../genome/genomeDistance.js";

export const starterCount = 3;
/** How many seeded eggs the gift is chosen from. */
const giftCandidates = 48;
/** How full the adopted kid arrives, low enough that the first thing the owner does is feed it. */
const starterFullness = 25;
/** The kids a new stable picks its first dragon from, seeded by the stable, each at 1 star like the gift egg and each built for something else (`standout`). */
export function starterKids(genes, stable) {
  const taken = new Set();
  return Array.from({ length: starterCount }, (_, i) => {
    let seed = `${stable.seed}:starter:${i}`,
      genome = makeGenome(genes, seed);
    for (let n = 1; taken.has(standout(genes, genome)) && n < 50; n++) genome = makeGenome(genes, (seed = `${stable.seed}:starter:${i}:${n}`));
    taken.add(standout(genes, genome));
    return createDragon({ seed, genome, age: "kid", now: stable.clock.game });
  });
}

/** The seed of the gift egg: of the stable's candidate eggs, the one whose baby is furthest from `kid`. */
export function giftEggSeed(genes, stable, kid) {
  let best = null,
    bestDistance = -1;
  for (let i = 0; i < giftCandidates; i++) {
    const seed = i ? `${stable.seed}:egg:0:${i}` : `${stable.seed}:egg:0`;
    const distance = genomeDistance(genes, kid.genome, makeGenome(genes, seed));
    if (distance > bestDistance) [best, bestDistance] = [seed, distance];
  }
  return best;
}

/** Moves starter kid `index` into the stable, hungry, with the gift of a first egg, one that hatches a very different dragon within the session. Returns the kid. */
export function adoptStarter(stable, genes, index) {
  const kid = starterKids(genes, stable)[index];
  kid.care.fullness = starterFullness;
  stable.dragons.push(kid);
  stable.eggs.push(createEgg(giftEggSeed(genes, stable, kid), stable.clock.game, null, 1, giftIncubation));
  stable.welcomed = true;
  return kid;
}

/** Whether the owner has been through the welcome and picked a kid. */
export const welcomed = (stable) => stable.welcomed === true;
