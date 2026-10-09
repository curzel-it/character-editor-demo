import test from "node:test";
import assert from "node:assert/strict";
import { countdownAt, LEAD_IN } from "../src/race/countdown.js";

test("the countdown calls the grid, 3, 2, 1 and Go around the start", () => {
  assert.equal(countdownAt(-LEAD_IN - 0.1), null);
  assert.equal(countdownAt(-LEAD_IN).id, "ready");
  assert.deepEqual([-2.5, -1.5, -0.5, 0].map((t) => countdownAt(t).id), ["3", "2", "1", "go"]);
  assert.equal(countdownAt(-2.5).progress, 0.5);
  assert.equal(countdownAt(2), null);
});
