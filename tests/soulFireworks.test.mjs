import test from "node:test";
import assert from "node:assert/strict";
import { createSoulFireworks, fireworksPhases, fireworksPhase } from "../src/scene/soulFireworks.js";

const ring = (n) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * 6.28) * 9, 5, Math.sin((i / n) * 6.28) * 9]);
const show = (elements, extra = {}) => createSoulFireworks({ elements, origins: ring(elements.length), altar: [0, 1.1, 0], seed: "test", radius: 8.5, ...extra });
const eye = [10, 8, 45];

test("phases run in order and name the moment", () => {
  const order = ["breath", "merge", "burst", "settle", "reveal", "end"].map((k) => fireworksPhases[k]);
  assert.deepEqual([...order].sort((a, b) => a - b), order);
  assert.equal(fireworksPhase(fireworksPhases.burst + 0.1), "burst");
  assert.equal(fireworksPhase(fireworksPhases.end), "done");
});

test("the show is a pure function of its seed and time", () => {
  const a = show(["fire", "storm"]).build(6.2, eye).data;
  const b = show(["fire", "storm"]).build(6.2, eye).data;
  assert.deepEqual(a, b);
  const fireworks = show(["fire", "storm"]);
  const later = fireworks.build(9, eye).data.slice();
  fireworks.build(2, eye);
  assert.deepEqual(fireworks.build(9, eye).data, later);
});

test("particle counts stay phone sized, even with six parents", () => {
  const fireworks = show(["fire", "water", "nature", "storm", "fire", "storm"]);
  let most = 0;
  for (let t = 0; t < fireworksPhases.end; t += 0.1) most = Math.max(most, fireworks.build(t, eye).count / 6);
  assert.ok(most < 2500, `${most} quads`);
  assert.equal(fireworks.build(fireworksPhases.end + 1, eye).count, 0);
  assert.equal(fireworks.build(-0.5, eye).count, 0);
});

test("each mix of elements colours the burst differently", () => {
  const hue = (elements) => {
    const { data, count } = show(elements).build(fireworksPhases.burst + 0.6, eye);
    const sum = [0, 0, 0];
    for (let v = 0; v < count; v++) for (let k = 0; k < 3; k++) sum[k] += data[v * 11 + 5 + k] * data[v * 11 + 8];
    const total = sum[0] + sum[1] + sum[2];
    return sum.map((s) => s / total);
  };
  const fire = hue(["fire", "fire"]),
    ice = hue(["water", "water"]),
    mixed = hue(["fire", "water", "nature", "storm", "earth"]);
  assert.ok(fire[0] > fire[2] + 0.1);
  assert.ok(ice[2] > ice[0] + 0.05);
  assert.ok(Math.abs(mixed[0] - fire[0]) > 0.03);
});

test("the reveal differs by result", () => {
  const t = fireworksPhases.reveal + 0.2;
  const egg = show(["fire", "water"], { result: true });
  const none = show(["fire", "water"], { result: false });
  assert.ok(egg.light(t).strength > none.light(t).strength + 0.3);
  assert.notDeepEqual(egg.build(t, eye).data, none.build(t, eye).data);
});
