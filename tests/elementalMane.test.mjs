import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { createAnatomy } from "../src/anatomy/dragon.js";
import { inheritGenome } from "../src/genome/inheritGenome.js";
import { breathElements } from "../src/breath/breathElements.js";
import { boneMatrices, inverseRigid, multiply, transform } from "../src/math3d.js";
import { createElementalManes, maneEmitter } from "../src/scene/elementalMane.js";

const maneGene = genes.find((gene) => gene.name === "mane");
const maned = maneGene.ids.indexOf("element");
const genomeOf = (seed, extra = {}) => ({ ...makeGenome(genes, seed), ...extra });
const crests = (anatomy) => anatomy.parts.filter(({ id }) => /^(neck|dorsal|tail|cranial)-crest/.test(id)).length;

/** Each bone's matrix times its inverse bind, as the scene hands them to the mane. */
function skinsOf(anatomy) {
  const bind = boneMatrices(anatomy).map(inverseRigid);
  const skins = new Float32Array(anatomy.bones.length * 16);
  boneMatrices(anatomy).forEach((m, i) => skins.set(multiply(m, bind[i]), i * 16));
  return skins;
}

test("The mane gene is rare, appended after the older genes and leaves their seeds alone", () => {
  const at = genes.indexOf(maneGene);
  let count = 0;
  for (let seed = 1; seed <= 2000; seed++) {
    const genome = makeGenome(genes, seed);
    const older = makeGenome(genes.slice(0, at), seed);
    for (const name of Object.keys(older)) assert.equal(genome[name], older[name]);
    if (genome.mane === maned) count++;
  }
  assert.ok(count > 20 && count < 160, `${count} maned of 2000`);
});

test("A mane turns up anew in a litter only at its own odds and passes on whole", () => {
  const spikes = [genomeOf("a", { mane: 0 }), genomeOf("b", { mane: 0 })];
  let mutated = 0;
  for (let seed = 0; seed < 4000; seed++) if (inheritGenome(genes, spikes, seed).genome.mane === maned) mutated++;
  assert.ok(mutated > 4000 * 0.02 && mutated < 4000 * 0.07, `${mutated} fresh manes`);
  const both = [genomeOf("a", { mane: maned }), genomeOf("b", { mane: 0 })];
  let inherited = 0;
  for (let seed = 0; seed < 400; seed++) if (inheritGenome(genes, both, seed).genome.mane === maned) inherited++;
  assert.ok(inherited > 160 && inherited < 260, `${inherited} of 400`);
});

test("Kids keep their spikes; from the teen years on the mane runs from the tail tip to the forehead in their place", () => {
  const genome = genomeOf(7, { mane: maned });
  const kid = createAnatomy(genome, { age: "kid" });
  assert.equal(kid.mane, undefined);
  const spikes = crests(kid);
  assert.ok(spikes >= 20, `${spikes} spikes`);
  const plain = createAnatomy(genomeOf(7, { mane: 0 }), { age: "adult" });
  assert.equal(plain.mane, undefined);
  for (const age of ["teen", "adult"]) {
    const anatomy = createAnatomy(genome, { age });
    assert.equal(crests(anatomy), 0, age);
    const anchors = anatomy.mane.anchors;
    assert.ok(anchors.length >= 21, `${anchors.length} anchors`);
    for (let i = 1; i < anchors.length; i++) assert.ok(anchors[i].p[0] > anchors[i - 1].p[0], "the mane runs from the tail tip forwards");
    assert.ok(anchors.slice(0, 14).every((a) => a.up[0] < 0), "the tail and back flames lean back");
    assert.ok(anchors[0].up[1] < anchors[10].up[1], "the tail's flames lie flatter than the back's");
    assert.equal(anatomy.mane.breath, genome.breath);
    const ids = new Set(anatomy.bones.map((bone) => bone.id));
    for (const anchor of anatomy.mane.anchors) {
      assert.ok(anchor.joints.every((id) => ids.has(id)));
      assert.ok(anchor.height > 0);
    }
  }
  const teen = createAnatomy(genome, { age: "teen" }).mane.anchors,
    adult = createAnatomy(genome, { age: "adult" }).mane.anchors;
  assert.ok(teen[6].height < adult[6].height && teen[6].height > adult[6].height * 0.4, "a teen's mane is smaller, but not by much");
});

test("Every element's mane sits on the posed back, burns while shown and dies out after", () => {
  for (const [breath, element] of breathElements.entries()) {
    const anatomy = createAnatomy(genomeOf(3, { mane: maned, breath }), { age: "adult" });
    const model = transform([100, 0, 0]);
    const emitter = maneEmitter(anatomy, skinsOf(anatomy), model);
    assert.equal(emitter.element, element.id);
    emitter.anchors.forEach((a, i) => {
      const bind = anatomy.mane.anchors[i];
      assert.ok(Math.abs(a.p[0] - bind.p[0] - 100) < 1e-4 && Math.abs(a.p[1] - bind.p[1]) < 1e-4, "anchors follow the model");
      assert.ok(Math.abs(a.height - bind.height) < 1e-4);
    });
    const manes = createElementalManes();
    for (let f = 0; f <= 30; f++) manes.update([maneEmitter(anatomy, skinsOf(anatomy), model)], f / 30);
    const quads = manes.build([100, 5, 40], false);
    assert.ok(quads.count > 0 && quads.count % 6 === 0, element.id);
    for (let f = 0; f <= 60; f++) manes.update([], 1.05 + f / 30);
    assert.equal(manes.build([100, 5, 40], false).count, 0, `${element.id} dies out`);
  }
});
