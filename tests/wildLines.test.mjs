import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { callHome, sendToWild } from "../src/stable/wild.js";
import { createEgg } from "../src/stable/egg.js";
import { callAllNote, flightLabel, leavesEmpty, noRoomLine, sendAwayQuestion, waitingInWild } from "../src/ui/wildLines.js";
import { eggOrigin } from "../src/ui/stableView.js";

const adults = (s) => s.dragons.filter((w) => w.age === "adult").map((w) => w.id);

test("the warning counts every dragon on its way home and every egg once the stable is full", () => {
  const s = stockedStable(genes, "lines", 0);
  const [a, b] = adults(s);
  assert.equal(noRoomLine(s), "1 egg: no free slot");
  sendToWild(s, a, 0);
  sendToWild(s, b, 0);
  assert.equal(noRoomLine(s), null);
  callHome(s, a, 0);
  s.eggs.push(createEgg("lines:egg:1", 0));
  assert.equal(noRoomLine(s), "1 on its way home and 2 eggs: no free slot");
  s.eggs.pop();
  callHome(s, b, 0);
  s.eggs.pop();
  s.eggs.push(createEgg("lines:egg:2", 0));
  assert.equal(noRoomLine(s), "2 on their way home and 1 egg: no free slot");
  s.eggs.length = 0;
  s.dragons.push({ ...s.dragons[0], id: "extra" });
  assert.equal(noRoomLine(s), "2 on their way home: no free slot");
});

test("a full stable of dragons alone still says why", () => {
  const s = stockedStable(genes, "lines", 0);
  s.eggs.length = 0;
  s.dragons.push({ ...s.dragons[0], id: "extra" });
  assert.equal(noRoomLine(s), "The stable is full: no free slot");
});

test("calling several says how many fit", () => {
  const s = stockedStable(genes, "lines", 0);
  const [a, b] = adults(s);
  sendToWild(s, a, 0);
  assert.equal(callAllNote(s), null);
  sendToWild(s, b, 0);
  assert.deepEqual(callAllNote(s), { fit: 2, of: 2, line: "All 2 fit" });
  s.eggs.push(createEgg("lines:egg:1", 0));
  assert.deepEqual(callAllNote(s), { fit: 1, of: 2, line: "Only 1 of 2 fit" });
  s.eggs.push(createEgg("lines:egg:2", 0));
  assert.deepEqual(callAllNote(s), { fit: 0, of: 2, line: null });
  s.eggs.length = 1;
  callHome(s, a, 0);
  assert.deepEqual(
    waitingInWild(s).map((w) => w.id),
    [b],
  );
  assert.equal(callAllNote(s), null);
});

test("sending away asks with the flight time, and knows when the stable would be empty", () => {
  const s = stockedStable(genes, "lines", 0);
  const [a] = adults(s);
  const ada = s.dragons.find((w) => w.id === a);
  assert.equal(flightLabel(), "2 h");
  assert.equal(sendAwayQuestion({ name: "Ada" }), "Ada leaves the stable; calling it back takes 2 h.");
  assert.equal(leavesEmpty(s, a), false);
  s.dragons = [ada];
  assert.equal(leavesEmpty(s, a), true);
});

test("an egg of a ritual names its first two parents and counts the rest", () => {
  const parents = (n) => ({ parents: ["Zevexze", "Rokvoror", "Ada", "Bram", "Cid"].slice(0, n).map((name) => ({ name })) });
  assert.equal(eggOrigin({}), "Gift egg");
  assert.equal(eggOrigin(parents(2)), "Zevexze × Rokvoror");
  assert.equal(eggOrigin(parents(5)), "Zevexze, Rokvoror +3");
});
