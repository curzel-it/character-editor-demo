import test from "node:test";
import assert from "node:assert/strict";
import { clearOfBlockers, hidesTarget, riseOverBlockers } from "../src/scene/cameraClearance.js";

const barn = { centre: [0, -10], yaw: 0, halfA: 5, halfB: 3, top: 8, wall: [4, 2] };

test("a camera behind a building rises around the target, at the same distance, to see over it", () => {
  const shed = { ...barn, top: 4 };
  const shot = { eye: [0, 2, -20], target: [0, 2, 0] };
  const { eye } = clearOfBlockers(shot, [shed]);
  assert.ok(Math.abs(Math.hypot(eye[0], eye[1] - 2, eye[2]) - 20) < 1e-9);
  assert.ok(eye[1] > 2 && eye[2] < 0);
  assert.equal(clearOfBlockers({ eye, target: shot.target }, [shed]).eye, eye);
});

test("a camera that cannot rise far enough over a building draws in to stand in front of it", () => {
  const tower = { ...barn, top: 1000 };
  const shot = { eye: [0, 2, -20], target: [0, 2, 0] };
  assert.equal(riseOverBlockers(shot, [tower]), null);
  assert.ok(Math.abs(clearOfBlockers(shot, [tower]).eye[2] - -6.4) < 1e-9);
});

test("a camera with a clear view, or looking over the roof, stays put", () => {
  const front = { eye: [0, 2, 20], target: [0, 2, 0] };
  assert.equal(clearOfBlockers(front, [barn]), front);
  const over = { eye: [0, 30, -20], target: [0, 9, 0] };
  assert.equal(clearOfBlockers(over, [barn]), over);
});

test("a building hides the target from a camera behind it or inside it, not from one in front or above", () => {
  const target = [0, 2, 0];
  assert.ok(hidesTarget({ eye: [0, 2, -20], target }, [barn]));
  assert.ok(hidesTarget({ eye: [3, 2, -11], target }, [barn]));
  assert.ok(!hidesTarget({ eye: [0, 2, 20], target }, [barn]));
  assert.ok(!hidesTarget({ eye: [0, 30, -20], target: [0, 9, 0] }, [barn]));
  assert.ok(!hidesTarget({ eye: [12, 2, -20], target }, [{ ...barn, yaw: Math.PI / 2 }]));
});
