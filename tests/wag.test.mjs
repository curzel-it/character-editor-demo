import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { wagOf } from "../src/animate/dragonWag.js";

const module = await loadSubject("dragon");
const standing = { effort: 0, glide: 1, stand: 1 };
const times = Array.from({ length: 2400 }, (_, i) => i * 0.05);

test("an idle dragon wags now and then for a couple of seconds, the same way every time", () => {
  for (const seed of [0, 7.5, 42]) {
    const wags = times.map((t) => wagOf(t, seed));
    assert.deepEqual(wags, times.map((t) => wagOf(t, seed)));
    const share = wags.filter((w) => w > 0).length / wags.length;
    assert.ok(share > 0.05 && share < 0.4, `seed ${seed} wags ${share} of the time`);
    let run = 0, longest = 0;
    for (const w of wags) longest = Math.max(longest, (run = w > 0 ? run + 1 : 0));
    assert.ok(longest * 0.05 <= 3.2, `seed ${seed} wags for ${longest * 0.05} s`);
  }
});

test("the tail only wags standing awake and free to", () => {
  const anatomy = module.createAnatomy(makeGenome(module.genes, 2407), { age: "kid" });
  const tail = (motion, t) => module.pose(anatomy, t % 1, { ...standing, time: t, ...motion }).bones["tail-6"].rotation[1];
  assert.ok(times.some((t) => Math.abs(tail({ idle: 1 }, t) - tail({}, t)) > 0.01), "the tail never wagged");
  for (const t of times.slice(0, 400)) {
    assert.equal(tail({ idle: 1, sleep: 1 }, t), tail({ sleep: 1 }, t));
    assert.equal(tail({ idle: 0 }, t), tail({}, t));
  }
});
