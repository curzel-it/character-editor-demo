import test from "node:test";
import assert from "node:assert/strict";
import { orbitShot } from "../src/ui/stageOrbit.js";

const shot = { eye: [0, 2, 10], target: [0, 1, 0], fov: 0.7 };
const home = { yaw: 0, pitch: 0, zoom: 1, pan: /** @type {[number, number]} */ ([0, 0]) };
const near = (a, b) => a.every((v, k) => Math.abs(v - b[k]) < 1e-9);
const span = (s) => Math.hypot(...s.eye.map((v, k) => v - s.target[k]));

test("the stage's own framing is the rest view", () => {
  assert.ok(near(orbitShot(shot, home).eye, shot.eye));
  assert.equal(orbitShot(shot, home).fov, 0.7);
});

test("orbiting keeps the distance, zoom brings the camera closer and the eye stays above ground", () => {
  const turned = orbitShot(shot, { ...home, yaw: Math.PI / 2 });
  assert.ok(Math.abs(span(turned) - span(shot)) < 1e-9);
  assert.ok(turned.eye[0] > 9);
  assert.ok(Math.abs(span(orbitShot(shot, { ...home, zoom: 2 })) - span(shot) / 2) < 1e-9);
  assert.ok(orbitShot(shot, { ...home, pitch: -3 }).eye[1] >= 0.3);
});

test("panning moves the target and the eye together across the frame", () => {
  const panned = orbitShot(shot, { ...home, pan: [0.5, 0] });
  assert.ok(panned.target[0] > 0);
  assert.ok(Math.abs(span(panned) - span(shot)) < 1e-9);
  assert.ok(Math.abs(panned.eye[0] - panned.target[0]) < 1e-9);
});
