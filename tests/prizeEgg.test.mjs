import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { stockedStable } from "./stableHelpers.mjs";
import { seasonLength, rivalCount } from "../src/stable/leagues.js";
import { closeSeason, seasonEnd } from "../src/stable/seasonEnd.js";
import { prizeStars } from "../src/stable/prizeEgg.js";
import { eggBaby } from "../src/stable/egg.js";
import { slotsFree, stableSlots } from "../src/stable/stableSlots.js";
import { callHome, findWild } from "../src/stable/wild.js";

/** A finished kids season of `division` where the owner's dragon `id` finishes every race in `place`. */
function playedSeason(division, place, id = "mine") {
  const season = { league: "kids", number: 1, division, seed: "x", rivals: [], races: [], end: null };
  for (let index = 0; index < seasonLength; index++) {
    const order = Array.from({ length: rivalCount }, (_, i) => ({ id: `r${i}`, name: `Rival ${i}`, owned: false }));
    order.splice(place - 1, 0, { id, name: "Mine", owned: true });
    season.races.push({ index, division, at: index, results: order.map((r, i) => ({ ...r, place: i + 1, time: 100 + i })) });
  }
  return season;
}

test("a prize egg's stars rise with the division and the podium place", () => {
  assert.deepEqual(["bronze", "silver", "gold"].map((d) => [3, 2, 1].map((place) => prizeStars(d, place))), [
    [1, 1.25, 1.5],
    [1.5, 1.75, 2],
    [2, 2.25, 2.5],
  ]);
  assert.equal(prizeStars("gold", 4), null);
  assert.deepEqual(seasonEnd(playedSeason("silver", 2), 5).prize, { stars: 1.75, egg: null, left: null });
  assert.equal(seasonEnd(playedSeason("silver", 4), 5).prize, null);
});

test("closing a season on the podium lays a fresh prize egg with no parents", () => {
  const s = stockedStable(genes, "prize", 0);
  s.dragons.pop();
  s.leagues.kids = playedSeason("gold", 1);
  const end = closeSeason(s, "kids", 10);
  const egg = s.eggs.find((e) => e.id === end.prize.egg);
  assert.ok(egg);
  assert.equal(egg.parents, null);
  assert.equal(egg.stars, 2.5);
  assert.deepEqual(eggBaby(genes, egg).genome, makeGenome(genes, egg.seed));
  assert.equal(end.prize.left, null);
  assert.deepEqual(s.seasons[0].prize, end.prize);
});

test("a prize egg won in a full stable sends the oldest dragon to the wild, from where it can be called home", () => {
  const s = stockedStable(genes, "full", 0);
  s.dragons.forEach((w, i) => (w.hatchedAt = 100 - i));
  const oldest = s.dragons.at(-1);
  assert.equal(slotsFree(s), 0);
  s.leagues.kids = playedSeason("bronze", 3);
  const end = closeSeason(s, "kids", 10);
  assert.deepEqual(end.prize.left, { id: oldest.id, name: oldest.name });
  assert.ok(!s.dragons.includes(oldest));
  assert.equal(findWild(s, oldest.id), oldest);
  assert.equal(s.eggs.length + s.dragons.length, stableSlots);
  assert.equal(s.eggs.at(-1).stars, 1);
  s.eggs.pop();
  assert.ok(callHome(s, oldest.id, 20));
});
