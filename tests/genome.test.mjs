import test from "node:test";
import assert from "node:assert/strict";
import { makeGenome, restoreGenome } from "../src/subjects.js";

test("Saved genes survive schema changes without missing or invalid anatomy values", () => {
  const genes = [
    { name: "size", min: 1, max: 5 },
    { name: "newWing", min: 2, max: 8 },
    { name: "hue", min: 0, max: 1 },
  ];
  const restored = restoreGenome(genes, "specimen", {
    size: 3,
    hue: 7,
    removedGene: 12,
  });
  assert.deepEqual(restored, {
    size: 3,
    newWing: makeGenome(genes, "specimen").newWing,
    hue: 1,
  });
  assert.deepEqual(
    restoreGenome(genes, "specimen", { size: NaN }),
    makeGenome(genes, "specimen"),
  );
  assert.deepEqual(
    restoreGenome(genes, "specimen", null),
    makeGenome(genes, "specimen"),
  );
});

test("Schema migration preserves compatible shape values and reseeds changed colours", () => {
  const genes = [
    { name: "body", label: "Torso length", min: 2, max: 4 },
    { name: "hue", label: "Scale hue", min: 0, max: 1 },
    { name: "lightness", label: "Scale lightness", min: 0.12, max: 0.8 },
  ];
  const previous = [
    genes[0],
    { name: "hue", label: "Scale hue", min: 0.3, max: 0.6 },
  ];
  const seeded = makeGenome(genes, "2407");
  assert.deepEqual(
    restoreGenome(genes, "2407", { body: 3.75, hue: 0.45 }, previous),
    {
      ...seeded,
      body: 3.75,
    },
  );
});
