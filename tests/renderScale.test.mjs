import test from "node:test";
import assert from "node:assert/strict";
import { createRenderScale } from "../src/scene/renderScale.js";

const run = (scale, interval, seconds, start = 0) => {
  let now = start;
  for (; now < start + seconds * 1000; now += interval) scale.frame(now);
  return now;
};

test("render scale holds at full resolution while frames keep up", () => {
  const scale = createRenderScale();
  run(scale, 1000 / 60, 10);
  assert.equal(scale.value, 1);
});

test("render scale steps down while frames run slow, to a floor", () => {
  const scale = createRenderScale();
  run(scale, 1000 / 25, 2);
  assert.ok(scale.value < 1);
  run(scale, 1000 / 25, 60, 2000);
  assert.equal(scale.value, 0.6);
});

test("render scale ignores pauses and single frames driven by tools", () => {
  const scale = createRenderScale();
  run(scale, 500, 60);
  assert.equal(scale.value, 1);
});

test("render scale climbs back after a calm spell, waiting longer each retry", () => {
  const scale = createRenderScale();
  let now = run(scale, 1000 / 25, 1.3);
  const low = scale.value;
  now = run(scale, 1000 / 60, 7, now);
  assert.equal(scale.value, low);
  now = run(scale, 1000 / 60, 2, now);
  assert.ok(scale.value > low);
  now = run(scale, 1000 / 25, 1.3, now);
  const again = scale.value;
  run(scale, 1000 / 60, 12, now);
  assert.equal(scale.value, again);
});
