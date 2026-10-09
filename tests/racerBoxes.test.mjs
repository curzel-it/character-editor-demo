import test from "node:test";
import assert from "node:assert/strict";
import { racerBoxes } from "../src/scene/racerBoxes.js";
import { shotMatrix } from "../src/scene.js";

const matrix = shotMatrix({ eye: [0, 0, 10], target: [0, 0, 0], fov: 1 }, 1);

test("racer boxes frame a sphere in front of the lens around the screen centre", () => {
  const { boxes, count } = racerBoxes([{ center: [0, 0, 0], radius: 1 }], matrix, [0, 0], 4);
  assert.equal(count, 1);
  const [u0, v0, u1, v1] = boxes;
  assert.ok(u0 < 0.5 && u1 > 0.5 && v0 < 0.5 && v1 > 0.5);
  assert.ok(u1 - u0 < 0.5);
});

test("racer boxes cover the screen for a sphere reaching behind the lens and skip ones off screen", () => {
  const behind = racerBoxes([{ center: [0, 0, 10], radius: 1 }], matrix, [0, 0], 4);
  assert.deepEqual([...behind.boxes.slice(0, 4)], [0, 0, 1, 1]);
  const aside = racerBoxes([{ center: [40, 0, 0], radius: 1 }], matrix, [0, 0], 4);
  assert.equal(aside.count, 0);
});

test("racer boxes merge into one when there are more spheres than slots", () => {
  const spheres = [-2, -1, 0, 1, 2].map((x) => ({ center: [x, 0, 0], radius: 0.2 }));
  const { boxes, count } = racerBoxes(spheres, matrix, [0.01, 0.01], 4);
  assert.equal(count, 1);
  assert.ok(boxes[0] < 0.4 && boxes[2] > 0.6);
});
