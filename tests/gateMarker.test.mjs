import test from "node:test";
import assert from "node:assert/strict";
import { gateMarker } from "../src/scene/gateMarker.js";
import { shotMatrix } from "../src/scene.js";

const matrix = shotMatrix({ eye: [0, 0, 10], target: [0, 0, 0], fov: 1 }, 1);
const clip = (m, [x, y, z]) => {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  return [(m[0] * x + m[4] * y + m[8] * z + m[12]) / w, (m[1] * x + m[5] * y + m[9] * z + m[13]) / w];
};
const points = (a) => Array.from({ length: a.length / 3 }, (_, i) => [...a.slice(i * 3, i * 3 + 3)]);

test("the gate marker points down at the gate and keeps its screen size with distance", () => {
  for (const z of [0, -40]) {
    const { arrow } = gateMarker([0, 0, z], matrix, 0.05);
    const ys = points(arrow).map((p) => clip(matrix, p)[1]);
    assert.ok(Math.abs(Math.max(...ys) - Math.min(...ys) - 0.1 * (25 / 32)) < 1e-4);
    assert.ok(Math.abs(ys[0] - Math.min(...ys)) < 1e-9, "the tip is the lowest point");
  }
});

test("the gate marker's shadow sits below the arrow, and nothing is drawn behind the lens", () => {
  const { arrow, shadow } = gateMarker([0, 0, 0], matrix, 0.05);
  assert.ok(clip(matrix, points(shadow)[0])[1] < clip(matrix, points(arrow)[0])[1]);
  assert.equal(gateMarker([0, 0, 20], matrix, 0.05), null);
});
