import test from "node:test";
import assert from "node:assert/strict";
import {
  CLEARANCE,
  legalEye,
  nearestS,
  pathAt,
  terrainHeight,
} from "../src/camera/courseGeometry.js";
import { createSyntheticCourse } from "../src/camera/syntheticRace.js";
import { lengthScale as L } from "../src/worldScale.js";

const terrain = {
  origin: [0, 0],
  cellSize: 10,
  columns: 3,
  rows: 2,
  heights: [0, 10, 20, 30, 40, 50],
};

test("Terrain height is bilinear and clamps at the edges", () => {
  assert.equal(terrainHeight(terrain, 0, 0), 0);
  assert.equal(terrainHeight(terrain, 5, 0), 5);
  assert.equal(terrainHeight(terrain, 5, 5), 20);
  assert.equal(terrainHeight(terrain, 20, 10), 50);
  assert.equal(terrainHeight(terrain, -50, -50), 0);
  assert.equal(terrainHeight(terrain, 99, 99), 50);
});

test("Path sampling round-trips arc length", () => {
  const course = createSyntheticCourse("geometry");
  for (const s of [0, 13, 505 * L, 1234.5 * L, course.length]) {
    const p = pathAt(course, s).position;
    assert.ok(Math.abs(nearestS(course, p) - s) < 0.5, `s=${s}`);
  }
});

test("Illegal eyes are pulled into the corridor, above ground and in sight", () => {
  const course = createSyntheticCourse("geometry", { hilly: 3 });
  const c = pathAt(course, 800 * L);
  const target = c.position;
  for (const eye of [
    [c.position[0], -500 * L, c.position[2]],
    [c.position[0] + 5 * L, c.position[1], c.position[2] + 400 * L],
    [c.position[0], c.position[1] + 900 * L, c.position[2]],
  ]) {
    const legal = legalEye(course, eye, target, { hint: 800 * L });
    assert.ok(legal[1] >= terrainHeight(course.terrain, legal[0], legal[2]) + CLEARANCE - 1e-9);
    const near = pathAt(course, nearestS(course, legal));
    assert.ok(legal[1] <= near.ceiling + 31 * L);
    const off = Math.hypot(legal[0] - near.position[0], legal[2] - near.position[2]);
    assert.ok(off < near.halfWidth, `eye ${off.toFixed(1)} m off the centreline`);
  }
});
