import test from "node:test";
import assert from "node:assert/strict";
import { genes, presets } from "../src/genome/dragon.js";
import { createAnatomy } from "../src/anatomy/dragon.js";
import { pose } from "../src/animate/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { dragonMarkings } from "../src/anatomy/dragonMarkings.js";
import { colourIndex, colourOf, dragonColors, dragonColours, dragonEyes, eyeColor } from "../src/palette.js";

const luminance = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const geometry = ({ genome, parts, ...anatomy }) => ({
  ...anatomy,
  parts: parts.map(({ color, colors, cornerColors, ...part }) => part),
});

test("Dragon palettes change colours without changing shape or animation", () => {
  const genome = makeGenome(genes, "2407");
  const original = createAnatomy(genome);
  const colours = new Set();
  for (const preset of presets) {
    for (const [name, value] of Object.entries(preset.genes)) {
      const gene = genes.find((entry) => entry.name === name);
      assert.equal(gene?.group, "color");
      assert.ok(value >= gene.min && value <= gene.max);
    }
    const anatomy = createAnatomy({ ...genome, ...preset.genes });
    assert.deepEqual(geometry(anatomy), geometry(original));
    for (const time of [0, 0.25, 0.5, 0.75, 1])
      assert.deepEqual(pose(anatomy, time), pose(original, time));
    colours.add(JSON.stringify(dragonColors(anatomy.genome)));
  }
  assert.equal(colours.size, 8);
});

test("Scale, wing and underside colours can be edited independently", () => {
  const genome = { ...makeGenome(genes, "2407"), ...presets[0].genes };
  const original = dragonColors(genome);
  for (const [name, region] of [
    ["scales", "skin"],
    ["wings", "membrane"],
    ["underside", "under"],
  ]) {
    const changed = dragonColors({ ...genome, [name]: 20 });
    assert.notDeepEqual(changed[region], original[region]);
    for (const other of Object.keys(original).filter((key) => key !== region))
      assert.deepEqual(changed[other], original[other]);
  }
});

test("Eye colour is its own gene: every choice colours the eyes alone, on every head and at every age", () => {
  const genome = { ...makeGenome(genes, "2407"), ...presets[0].genes };
  const gene = genes.find((entry) => entry.name === "eyes");
  assert.equal(gene.group, "color");
  assert.deepEqual(gene.choices, dragonEyes.map((eye) => eye.label));
  assert.deepEqual(dragonColors({ ...genome, eyes: undefined }).eye, dragonColors({ ...genome, eyes: 0 }).eye);
  const { eye: _, ...original } = dragonColors(genome);
  const irises = new Set();
  for (let value = 0; value < gene.max; value++) {
    const { eye, ...rest } = dragonColors({ ...genome, eyes: value });
    assert.deepEqual(rest, original);
    irises.add(eye.join());
    assert.ok(luminance(eye) > 0.2, `${dragonEyes[value].id} iris is bright enough for the pupil to read`);
    for (const head of [0, 1, 2, 3, 4])
      for (const age of ["kid", "adult"]) {
        const eyes = createAnatomy({ ...genome, head, eyes: value }, { age }).parts.filter(({ id }) => /^eye--?1$/.test(id));
        assert.equal(eyes.length, 2);
        for (const part of eyes) assert.deepEqual(part.color, eye, `head ${head} ${age}`);
      }
  }
  assert.equal(irises.size, gene.max);
});

test("Scales, wings and underside each pick one of the named colours, from its hex", () => {
  for (const name of ["scales", "wings", "underside"]) {
    const gene = genes.find((entry) => entry.name === name);
    assert.equal(gene.group, "color");
    assert.deepEqual(gene.choices, dragonColours.map((colour) => colour.label));
  }
  assert.equal(dragonColours.length, 32);
  assert.equal(new Set(dragonColours.map((colour) => colour.hex)).size, 32);
  assert.deepEqual(colourOf(colourIndex("crimson")), [0xb3 / 255, 0x26 / 255, 0x3a / 255]);
  assert.deepEqual(dragonColors({ scales: colourIndex("ivory") }).skin, colourOf(colourIndex("ivory")));
});

test("Every iris stands apart from every scale colour and stays bright enough for the pupil", () => {
  const distance = (a, b) => Math.hypot(...a.map((v, i) => v - b[i]));
  let shifted = 0;
  dragonColours.forEach((colour, scales) =>
    dragonEyes.forEach((_, eyes) => {
      const { eye, skin } = dragonColors({ scales, eyes });
      assert.ok(distance(eye, skin) >= 0.4 && luminance(eye) > 0.2, `${eyes} on ${colour.id}`);
      shifted += eye.join() !== eyeColor(eyes).join();
    }),
  );
  assert.ok(shifted > 0);
  assert.deepEqual(eyeColor(4, dragonColors(presets.find((p) => p.id === "slate").genes).skin), eyeColor(4));
  assert.notDeepEqual(eyeColor(4, dragonColors(presets.find((p) => p.id === "ember").genes).skin), eyeColor(4));
});

test("Eye colour is appended to the genes, so it leaves every older gene of a seed alone", () => {
  const at = genes.findIndex((gene) => gene.name === "eyes");
  const counts = new Array(dragonEyes.length).fill(0);
  for (let seed = 1; seed <= 1000; seed++) {
    const { eyes, ...older } = makeGenome(genes.slice(0, at + 1), seed);
    assert.deepEqual(makeGenome(genes.slice(0, at), seed), older);
    counts[eyes]++;
  }
  assert.ok(counts.every((n) => n > 0), `${counts}`);
  assert.equal(counts.indexOf(Math.max(...counts)), 0, "gold is the commonest");
});

test("Markings are appended to the genes, mostly none, and stay off the underside and wings but reach the wing arms", () => {
  assert.equal(genes.at(-1).name, "markings");
  const counts = new Array(dragonMarkings.length).fill(0);
  for (let seed = 1; seed <= 1000; seed++) {
    const { markings, ...older } = makeGenome(genes, seed);
    assert.deepEqual(makeGenome(genes.slice(0, -1), seed), older);
    counts[markings]++;
  }
  assert.ok(counts.every((n) => n > 0), `${counts}`);
  assert.equal(counts.indexOf(Math.max(...counts)), 0, "none is the commonest");
  const genome = makeGenome(genes, 7);
  assert.equal(createAnatomy({ ...genome, markings: 0 }).markings, null);
  const anatomy = createAnatomy({ ...genome, markings: 2 });
  assert.equal(anatomy.markings.kind, 2);
  const marked = anatomy.parts.filter((part) => part.markings);
  assert.ok(marked.some((part) => part.id === "continuous-hide"));
  assert.ok(marked.some((part) => part.markings === -1), "the legs are marked round");
  assert.ok(marked.some((part) => /^wing-arm-hide/.test(part.id)), "the wing arms are marked");
  assert.ok(!marked.some((part) => /^(wing-(?!arm-hide)|spar|hindwing)/.test(part.id)), "wings stay plain");
  const hide = marked.find((part) => part.id === "continuous-hide");
  assert.ok(hide.cornerMarks.includes(0) && hide.cornerMarks.includes(1), "the underside stays plain");
});
