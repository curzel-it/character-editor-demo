import test from "node:test";
import assert from "node:assert/strict";
import { genes, showsGene } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { inheritGenome } from "../src/genome/inheritGenome.js";
import { metalCoats } from "../src/genome/metalCoats.js";
import { dragonColors, metalPalette } from "../src/palette.js";
import { geneBonus, statLevels } from "../src/dragonBuild.js";
import { createAnatomy } from "../src/anatomy/dragon.js";
import { metalIds, metalToneOf } from "../src/anatomy/metalTone.js";
import { makeSkinMesh } from "../src/skinMesh.js";

const metal = genes.find((gene) => gene.name === "metal");
const coat = (id) => metalCoats.findIndex((c) => c.id === id);

test("The metal gene is appended after the eyes, so it leaves every older gene of a seed alone", () => {
  const at = genes.indexOf(metal);
  assert.equal(genes[at - 1].name, "eyes");
  for (let seed = 1; seed <= 200; seed++) {
    const { metal: _, ...older } = makeGenome(genes.slice(0, at + 1), seed);
    assert.deepEqual(makeGenome(genes.slice(0, at), seed), older);
  }
});

test("One dragon in a thousand has a metal coat, evenly gold, silver or either mix", () => {
  const total = metal.weights.reduce((sum, w) => sum + w, 0);
  assert.equal(metal.weights[0] / total, 0.999);
  assert.ok(metal.weights.slice(1).every((w) => w === metal.weights[1]));
});

test("A metal coat passes down whole from a parent, but ordinary parents almost never make one", () => {
  const plain = (i) => ({ ...makeGenome(genes, `plain-${i}`), metal: 0 });
  let fresh = 0,
    passed = 0;
  for (let i = 0; i < 4000; i++) {
    if (inheritGenome(genes, [plain(0), plain(1)], `child-${i}`).genome.metal) fresh++;
    if (inheritGenome(genes, [{ ...plain(2), metal: coat("gold") }, plain(3)], `child-${i}`).genome.metal === coat("gold")) passed++;
  }
  assert.ok(fresh < 20, `${fresh} metal children of ordinary parents`);
  assert.ok(passed > 1600 && passed < 2400, `${passed} of 4000 children take the gold coat`);
});

test("A metal coat colours the body with its first metal and the wings with its second, whatever the colour genes", () => {
  const base = makeGenome(genes, 2407);
  const { skin, membrane, under } = dragonColors({ ...base, metal: coat("silverGold") });
  assert.deepEqual(skin, metalPalette.silver.scales);
  assert.deepEqual(under, metalPalette.silver.underside);
  assert.deepEqual(membrane, metalPalette.gold.wings);
  assert.deepEqual(dragonColors({ ...base, scales: 0, metal: coat("gold") }), dragonColors({ ...base, scales: 5, metal: coat("gold") }));
});

test("Gold adds top speed, silver acceleration and handling, a mixed coat half of each", () => {
  const base = { ...makeGenome(genes, 2407), metal: 0 };
  assert.ok(Object.values(geneBonus(genes, base)).every((v) => v === 0));
  const plain = statLevels(genes, base, 3);
  const gold = statLevels(genes, { ...base, metal: coat("gold") }, 3);
  assert.ok(gold.topSpeed > plain.topSpeed);
  for (const key of ["acceleration", "handling", "weight", "breath"]) assert.equal(gold[key], plain[key]);
  const silver = geneBonus(genes, { ...base, metal: coat("silver") });
  assert.ok(silver.acceleration > 0 && silver.handling > 0 && silver.topSpeed === 0);
  const mixed = geneBonus(genes, { ...base, metal: coat("goldSilver") });
  assert.equal(mixed.topSpeed, geneBonus(genes, { ...base, metal: coat("gold") }).topSpeed / 2);
  assert.equal(mixed.acceleration, silver.acceleration / 2);
});

test("Only the coat turns metal: hide and wings do, horns, claws and eyes do not", () => {
  const genome = { ...makeGenome(genes, 7), metal: coat("goldSilver") };
  const tone = metalToneOf(genome);
  const anatomy = createAnatomy(genome);
  const of = (id) => tone(anatomy.parts.find((p) => p.id === id).color);
  assert.equal(of("continuous-hide"), metalIds.gold);
  assert.equal(of("wing-membrane--1"), metalIds.silver);
  for (const id of ["dorsal-crest-0", "eye--1", "pupil--1"]) assert.equal(of(id), 0, id);
  assert.equal(metalToneOf({ ...genome, metal: 0 }), null);
  assert.ok(makeSkinMesh(createAnatomy({ ...genome, metal: 0 })).metals.every((m) => m === 0));
});

test("A rare gene shows as a trait only on the dragons carrying it", () => {
  assert.equal(showsGene(metal, { metal: 0 }), false);
  assert.equal(showsGene(metal, { metal: coat("silver") }), true);
  assert.equal(showsGene(genes.find((g) => g.name === "head"), { head: 0 }), true);
});
