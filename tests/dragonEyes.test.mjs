import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { createAnatomy } from "../src/anatomy/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { ages } from "../src/dragonAge.js";

test("left and right eyes mirror each other on every head and age", () => {
  for (const head of [0, 1, 2, 3, 4])
    for (const { id: age } of ages) {
      const { parts } = createAnatomy({ ...makeGenome(genes, 2407), head }, { age });
      for (const id of ["eye", "eye-rim", "eye-socket"]) {
        const left = parts.find((p) => p.id === `${id}--1`),
          right = parts.find((p) => p.id === `${id}-1`);
        const mirrored = [...left.position, ...left.rotation].map((v, i) => (i === 2 || i === 3 || i === 4 ? -v : v));
        [...right.position, ...right.rotation].forEach((v, i) => assert.ok(Math.abs(v - mirrored[i]) < 1e-9, `${id} ${head} ${age}`));
      }
    }
});
