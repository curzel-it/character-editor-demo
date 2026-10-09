import { makeGenome } from "../src/subjects.js";
import { createStable } from "../src/stable/newStable.js";
import { createEgg } from "../src/stable/egg.js";
import { createDragon } from "../src/stable/createDragon.js";

/** A welcomed stable holding an egg and a dragon of every age, adults well bonded, so each stage and league can be tried at once. */
export function stockedStable(genes, seed, realNow = 0) {
  const stable = createStable(genes, seed, realNow);
  stable.welcomed = true;
  stable.eggs.push(createEgg(`${seed}:egg:0`, 0));
  ["kid", "kid", "teen", "adult", "adult"].forEach((age, i) => {
    const dragonSeed = `${seed}:stock:${i}`;
    stable.dragons.push(createDragon({ seed: dragonSeed, genome: makeGenome(genes, dragonSeed), age, bond: age === "adult" ? 0.8 : undefined }));
  });
  return stable;
}
