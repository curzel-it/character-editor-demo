import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { arrivals, callBlock, callHome, findWild, flightHome, sendToWild, timeToArrive, wildBlock } from "../src/stable/wild.js";
import { callable, slotsBooked, slotsFree, slotsUsed, stableSlots } from "../src/stable/stableSlots.js";

const stable = () => stockedStable(genes, "wild", 0);
const idsOf = (s, age) => s.dragons.filter((w) => w.age === age).map((w) => w.id);

test("only adults go to the wild, freeing their slot at once and keeping their record", () => {
  const s = stable();
  const [kid] = idsOf(s, "kid"),
    [teen] = idsOf(s, "teen"),
    [adult] = idsOf(s, "adult");
  assert.equal(wildBlock(s, kid), "wild.adultsOnly");
  assert.equal(wildBlock(s, teen), "wild.adultsOnly");
  assert.equal(wildBlock(s, s.eggs[0].id), "wild.notInStable");
  assert.equal(sendToWild(s, kid, 0), null);
  assert.equal(slotsUsed(s), 6);
  const dragon = s.dragons.find((w) => w.id === adult);
  dragon.record.wins = 3;
  assert.equal(sendToWild(s, adult, 1000), dragon);
  assert.equal(slotsUsed(s), 5);
  assert.equal(slotsFree(s), 1);
  assert.ok(!s.dragons.some((w) => w.id === adult));
  assert.equal(findWild(s, adult).record.wins, 3);
  assert.equal(wildBlock(s, adult), "wild.alreadyWild");
  assert.equal(timeToArrive(dragon, 5000), null);
});

test("calling home books a slot at once and needs one free", () => {
  const s = stable();
  const [a, b] = idsOf(s, "adult");
  sendToWild(s, a, 0);
  sendToWild(s, b, 0);
  assert.equal(slotsFree(s), 2);
  assert.equal(callable(s, [a, b]), 2);
  const w = callHome(s, a, 1000);
  assert.equal(w.id, a);
  assert.deepEqual([slotsBooked(s), slotsUsed(s), slotsFree(s)], [1, 5, 1]);
  assert.equal(callBlock(s, a), "wild.onTheWay");
  assert.equal(callable(s, [a, b]), 1);
  assert.equal(timeToArrive(w, 1000 + flightHome / 2), flightHome / 2);
  s.eggs.push({ ...s.eggs[0], id: "extra" });
  assert.equal(slotsFree(s), 0);
  assert.equal(callBlock(s, b), "stableFull");
  assert.equal(callHome(s, b, 2000), null);
  assert.equal(callable(s, [a, b]), 0);
  assert.equal(callBlock(s, "nobody"), "wild.notWild");
});

test("dragons land when their flight ends, earliest first", () => {
  const s = stable();
  const [a, b] = idsOf(s, "adult");
  sendToWild(s, a, 0);
  sendToWild(s, b, 0);
  callHome(s, b, 0);
  callHome(s, a, 1000);
  assert.deepEqual(arrivals(s, flightHome - 1), []);
  assert.deepEqual(arrivals(s, flightHome), [{ type: "arrived", id: b }]);
  assert.equal(slotsUsed(s), stableSlots, "an arrival keeps the slot it booked");
  assert.deepEqual(arrivals(s, flightHome + 5000), [{ type: "arrived", id: a }]);
  assert.deepEqual([s.wild.length, slotsUsed(s)], [0, 6]);
  assert.equal(s.dragons.find((w) => w.id === a).wild, undefined);
  assert.deepEqual(arrivals(s, flightHome * 10), []);
});

test("a full stable swaps one adult for another, and sending one back frees a slot", () => {
  const s = stable();
  const [a, b] = idsOf(s, "adult");
  sendToWild(s, a, 0);
  s.eggs.push({ ...s.eggs[0], id: "extra" });
  assert.equal(slotsUsed(s), stableSlots);
  assert.equal(callHome(s, a, 0), null);
  sendToWild(s, b, 100);
  assert.equal(callHome(s, a, 100).id, a);
  assert.equal(slotsFree(s), 0);
  assert.deepEqual(arrivals(s, 100 + flightHome), [{ type: "arrived", id: a }]);
  assert.deepEqual([findWild(s, b)?.id, slotsUsed(s)], [b, stableSlots]);
  sendToWild(s, a, 100 + flightHome);
  assert.equal(slotsFree(s), 1);
});

test("the wild is deterministic", () => {
  const run = () => {
    const s = stable();
    const [a, b] = idsOf(s, "adult");
    sendToWild(s, b, 0);
    sendToWild(s, a, 0);
    callHome(s, a, 500);
    callHome(s, b, 500);
    return { events: arrivals(s, 500 + flightHome), stable: s };
  };
  const [one, two] = [run(), run()];
  assert.deepEqual(one, two);
  assert.deepEqual(
    one.events.map((e) => e.id),
    [...one.events.map((e) => e.id)].sort(),
  );
});
