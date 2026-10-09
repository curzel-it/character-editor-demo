/** The trailer's dragon: a blue coat, a fire breath and the element mane that burns from the teen years on. */
export const STAR = "azure fire mane:element";

/**
 * Page code for an egg whose baby is `STAR`: an altar egg of two `STAR` parents, its seed tried until
 * the baby inherits every part and colour unchanged. Defines `starEgg(stable)`, resolving to the egg,
 * and `starBaby(stable)`, resolving to that baby's genome.
 */
const STAR_EGG = `
  const { createEgg, eggBaby } = await import("/src/stable/egg.js");
  const { cheatDragon } = await import("/src/stable/cheats.js");
  const { loadSubject } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const starEgg = (stable) => {
    const parent = cheatDragon(genes, stable, ${JSON.stringify(STAR)}, { seed: "trailer-parent", strength: 4 });
    const parents = [{ ...parent, id: "trailer-a" }, { ...parent, id: "trailer-b" }];
    const choices = genes.filter((g) => g.ids).map((g) => g.name);
    for (let n = 0; n < 2000; n++) {
      const egg = createEgg("trailer-" + n, stable.clock.game, parents);
      const { genome } = eggBaby(genes, egg);
      if (choices.every((name) => Math.floor(genome[name]) === Math.floor(parent.genome[name]))) return egg;
    }
    throw new Error("No egg hatches the trailer's dragon");
  };
  const starBaby = (stable) => eggBaby(genes, starEgg(stable)).genome;
`;

/** Page code that marks every lesson as seen, so no coach mark, hint or tour shows. */
const SEEN = `Object.assign(window.__game.game.stable, { welcomed: true, careTaught: true, raceHint: "done", reinsInvited: true, reinsTaught: true });`;

/** Page code that empties the stable, marks every lesson as seen and lays the star's egg, ready to hatch. Resolves to the egg's id. */
export const layEgg = `(async () => {
  ${STAR_EGG}
  const stable = window.__game.game.stable;
  const egg = starEgg(stable);
  egg.incubation = egg.incubationTime;
  ${SEEN}
  Object.assign(stable, { eggs: [egg], dragons: [] });
  window.__game.save();
  return egg.id;
})()`;

/**
 * Page code that saves the exhibition field: the star at `age` and `stars` on the front of the grid and
 * `rivals` seeded rivals of the same age and 3 stars, breathing nature, the element fire beats, over race `raceSeed`.
 * Resolves to the star's racer id.
 */
export const raceField = (age, raceSeed, rivals, stars = 3) => `(async () => {
  ${STAR_EGG}
  const { createParticipant } = await import("/src/raceField.js");
  ${SEEN}
  window.__game.save();
  const module = { genes };
  const nature = genes.find((g) => g.name === "breath").ids.indexOf("nature");
  const star = { ...createParticipant(module, "trailer-star"), genome: starBaby(window.__game.game.stable), age: ${JSON.stringify(age)}, strength: ${stars} };
  const field = [star];
  for (let i = 0; i < ${rivals}; i++) {
    const rival = createParticipant(module, "trailer-rival-" + ${JSON.stringify(raceSeed)} + "-" + i, field.map((p) => p.id));
    field.push({ ...rival, genome: { ...rival.genome, breath: nature }, age: ${JSON.stringify(age)}, strength: 3 });
  }
  localStorage.setItem("dragonz-race-field", JSON.stringify({ version: 3, courseSeed: "2407", courseType: "valley", raceSeed: ${JSON.stringify(raceSeed)}, participants: field }));
  return star.id;
})()`;

/** Page code that readies the stable's dragon to evolve and leaves Play as its care tile. */
export const readyToGrow = `(async () => {
  const { stageDurations } = await import("/src/stable/lifeStages.js");
  const dragon = window.__game.game.stable.dragons[0];
  dragon.growth = stageDurations[dragon.age];
  for (const id of Object.keys(dragon.care)) dragon.care[id] = 95;
  dragon.care.happiness = 15;
  dragon.fatigue = 0;
  window.__game.save();
  return dragon.id;
})()`;

/** Page code that leaves Play as the care tile and fetch as the game it opens. */
export const wantsFetch = `(() => {
  const dragon = window.__game.game.stable.dragons[0];
  for (const id of Object.keys(dragon.care)) dragon.care[id] = 95;
  dragon.care.happiness = 15;
  Math.random = () => 0.99;
  return 0;
})()`;

/**
 * Page code that nudges the game clock on a millisecond at a time until the fetch game seeded now
 * brings back `find` on its second throw, then opens it from the Play tile.
 */
export const playFetch = (find) => `(async () => {
  const { findOf } = await import("/src/minigames/fetchFinds.js");
  const { stable } = window.__game.game;
  const id = stable.dragons[0].id;
  for (let n = 0; findOf(id + ":" + stable.clock.game, 1) !== ${JSON.stringify(find)}; n++) {
    if (n > 5000) throw new Error("No ${find} in reach");
    stable.clock.game++;
  }
  document.querySelector('[data-action="play"]').click();
  return 0;
})()`;
