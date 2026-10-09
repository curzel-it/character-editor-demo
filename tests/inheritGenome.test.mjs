import test from "node:test";
import assert from "node:assert/strict";
import { colourGenes, genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { inheritGenome, mutationChance } from "../src/genome/inheritGenome.js";

const parentsOf = (n) => Array.from({ length: n }, (_, i) => makeGenome(genes, `parent-${n}-${i}`));
const choiceGenes = genes.filter((g) => g.choices);
const shapeGenes = genes.filter((g) => !g.choices);

function checkChild(parents, seed) {
  const { genome, from } = inheritGenome(genes, parents, seed);
  for (const gene of genes) assert.ok(genome[gene.name] >= gene.min && genome[gene.name] <= gene.max, gene.name);
  for (const gene of choiceGenes) {
    const side = from[gene.name];
    if (side === null) {
      assert.ok(Number.isInteger(genome[gene.name]), gene.name);
      assert.ok(parents.every((p) => Math.floor(p[gene.name]) !== genome[gene.name]), `${gene.name} mutates into a variant no parent shows`);
      continue;
    }
    assert.ok(Number.isInteger(side) && side >= 0 && side < parents.length, gene.name);
    assert.equal(genome[gene.name], parents[side][gene.name], gene.name);
  }
  for (const gene of shapeGenes) {
    assert.ok(Number.isInteger(from[gene.name]) && from[gene.name] >= 0 && from[gene.name] < parents.length, gene.name);
    const values = parents.map((p) => p[gene.name]);
    const pad = 0.05 * (gene.max - gene.min) + 1e-9;
    assert.ok(genome[gene.name] >= Math.min(...values) - pad && genome[gene.name] <= Math.max(...values) + pad, gene.name);
  }
  return { genome, from };
}

for (const n of [2, 5]) {
  test(`a child of ${n} parents takes whole parts and colours from them, is deterministic and draws on every parent`, () => {
    const parents = parentsOf(n);
    const seen = new Set();
    let mutations = 0;
    for (let i = 0; i < 200; i++) {
      const child = checkChild(parents, `child:${i}`);
      assert.deepEqual(inheritGenome(genes, parents, `child:${i}`), child);
      for (const gene of choiceGenes) {
        if (child.from[gene.name] === null) mutations++;
        else seen.add(child.from[gene.name]);
      }
    }
    assert.deepEqual([...seen].sort(), [...Array(n).keys()]);
    assert.ok(mutations > 0);
  });
}

test("mutation is 5% when the parents agree and 20% when they all differ", () => {
  assert.equal(mutationChance(1, 2), 0.05);
  assert.ok(Math.abs(mutationChance(2, 2) - 0.2) < 1e-12);
  assert.ok(Math.abs(mutationChance(3, 5) - 0.125) < 1e-12);
  assert.ok(Math.abs(mutationChance(5, 5) - 0.2) < 1e-12);
  const rate = (parents) => {
    let mutated = 0;
    for (let i = 0; i < 4000; i++) mutated += inheritGenome(genes, parents, `rate:${i}`).from.scales === null;
    return mutated / 4000;
  };
  const base = makeGenome(genes, "rate");
  const agree = rate([base, { ...base }]);
  const differ = rate([base, { ...base, scales: (base.scales + 1) % 32 }]);
  assert.ok(Math.abs(agree - 0.05) < 0.015, `agreeing parents mutate ${agree}`);
  assert.ok(Math.abs(differ - 0.2) < 0.025, `differing parents mutate ${differ}`);
});

test("a trait whose every variant some parent shows cannot mutate", () => {
  const gene = genes.find((g) => g.name === "hindWings");
  const parents = gene.choices.map((_, i) => ({ ...makeGenome(genes, `all:${i}`), hindWings: i }));
  for (let i = 0; i < 300; i++) assert.notEqual(inheritGenome(genes, parents, `all:${i}`).from.hindWings, null);
});

test("each parent passes on its colours about evenly", () => {
  const parents = parentsOf(5);
  const counts = new Array(5).fill(0);
  for (let i = 0; i < 400; i++) {
    const { from } = inheritGenome(genes, parents, `even:${i}`);
    for (const name of colourGenes) if (from[name] !== null) counts[from[name]]++;
  }
  const expected = counts.reduce((a, b) => a + b, 0) / 5;
  for (const c of counts) assert.ok(Math.abs(c - expected) < expected * 0.25, `${counts}`);
});

test("a shape gene of a child of identical parents stays near theirs", () => {
  const one = makeGenome(genes, "twin");
  const { genome } = inheritGenome(genes, [one, one, one], "twins");
  for (const gene of shapeGenes) assert.ok(Math.abs(genome[gene.name] - one[gene.name]) <= 0.05 * (gene.max - gene.min) + 1e-9, gene.name);
});

test("eye colour is inherited on its own, apart from the scale colour", () => {
  const [a, b] = [{ ...makeGenome(genes, "eyes-a"), eyes: 1 }, { ...makeGenome(genes, "eyes-b"), eyes: 3 }];
  let apart = 0;
  for (let i = 0; i < 200; i++) {
    const { genome, from } = inheritGenome(genes, [a, b], `eyes:${i}`);
    if (from.eyes === null || from.scales === null) continue;
    assert.equal(genome.eyes, [a, b][from.eyes].eyes);
    apart += from.eyes !== from.scales;
  }
  assert.ok(apart > 40 && apart < 120, `${apart} of 200 have the other parent's eyes`);
});
