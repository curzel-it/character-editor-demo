import test from "node:test";
import assert from "node:assert/strict";
import { colourGenes, genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { createStable } from "../src/stable/newStable.js";
import { createDragon } from "../src/stable/createDragon.js";
import { createEgg } from "../src/stable/egg.js";
import { hatchEgg } from "../src/stable/hatch.js";
import { stageDurations } from "../src/stable/lifeStages.js";
import { sendToWild } from "../src/stable/wild.js";
import { lineageOf } from "../src/stable/lineage.js";

function circle(count) {
  const stable = createStable(genes, "lineage", 0);
  const parents = Array.from({ length: count }, (_, i) =>
    createDragon({ seed: `lineage:${i}`, genome: makeGenome(genes, `lineage:${i}`), age: "adult" }),
  );
  stable.dragons.push(...parents);
  const egg = createEgg("ritual", 0, parents);
  stable.eggs.push(egg);
  return { stable, parents, egg };
}

function hatched(stable, egg) {
  egg.incubation = stageDurations.egg;
  return hatchEgg(stable, genes, egg.id, 0);
}

test("an egg of five parents lists all five, and its chick names a parent or a mutation for every trait", () => {
  const { stable, parents, egg } = circle(5);
  const eggLineage = lineageOf(stable, genes, egg);
  assert.deepEqual(eggLineage.parents.map((p) => p.name), parents.map((p) => p.name));
  const chick = hatched(stable, egg);
  const lineage = lineageOf(stable, genes, chick);
  assert.equal(lineage.parents.length, 5);
  for (const part of lineage.parts) {
    assert.equal(part.side, chick.from[part.name]);
    assert.equal(part.parents.length, 5);
    if (part.side !== null) assert.equal(part.value, part.parents[part.side]);
  }
  assert.deepEqual(lineage.colors.map((c) => c.side), colourGenes.map((name) => chick.from[name]));
  assert.deepEqual(lineage.mutations, [...lineage.parts, ...lineage.colors].filter((t) => t.side === null));
  const sides = [...lineage.parts, ...lineage.colors].map((t) => t.side).filter((s) => s !== null);
  assert.ok(sides.every((s) => s >= 0 && s < 5));
  assert.ok(new Set(sides).size > 2, "traits come from more than two of the five parents");
});

test("a parent in the wild is still owned and flagged, one released is gone, and grandparents follow renames", () => {
  const { stable, parents, egg } = circle(3);
  const chick = hatched(stable, egg);
  sendToWild(stable, parents[0].id, 0);
  stable.dragons.splice(stable.dragons.indexOf(parents[1]), 1);
  parents[2].name = "Renamed";
  const lineage = lineageOf(stable, genes, chick);
  assert.deepEqual(
    lineage.parents.map((p) => [p.name, Boolean(p.owned), p.wild]),
    [
      [parents[0].name, true, true],
      [parents[1].name, false, false],
      ["Renamed", true, false],
    ],
  );
  chick.age = "adult";
  const next = createEgg("next", 0, [chick, parents[2]]);
  stable.eggs.push(next);
  const grandchild = hatched(stable, next);
  assert.equal(grandchild.generation, 2);
  assert.deepEqual(lineageOf(stable, genes, grandchild).parents[0].parents.map((g) => g.name), parents.map((p) => p.name).slice(0, 2).concat("Renamed"));
});

test("a seed-born dragon has no lineage", () => {
  const { stable, parents } = circle(2);
  assert.equal(lineageOf(stable, genes, parents[0]), null);
});
