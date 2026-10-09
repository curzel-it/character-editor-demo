import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { edgeOf, ownerEdge, startLeagueRace } from "../src/stable/leagueRace.js";
import { raceDayForm } from "../src/stable/raceDayForm.js";
import { applyEdge, raceForm } from "../src/race/racerTraits.js";
import { raceRoster } from "../src/raceField.js";

const day = 86_400_000;

test("owned dragons are in perfect shape all through the first day, then roll their form from the race seed", () => {
  const s = stockedStable(genes, "first-day", 0);
  const seeds = Array.from({ length: 40 }, (_, i) => `seed-${i}`);
  for (const w of s.dragons) {
    for (const seed of seeds) assert.equal(raceDayForm(s, seed, w.id, day - 1), "perfect");
    assert.ok(seeds.some((seed) => raceDayForm(s, seed, w.id, day) !== "perfect"));
    for (const seed of seeds) assert.equal(raceDayForm(s, seed, w.id, day), raceForm(seed, w.id));
  }
  assert.equal(raceDayForm(s, "seed-0", "a-rival", 0), raceForm("seed-0", "a-rival"));
});

test("a race started on the first day carries the owner's perfect form into the simulation", () => {
  const s = stockedStable(genes, "first-day-race", 0);
  const kid = s.dragons.find((w) => w.age === "kid");
  const live = startLeagueRace(s, "kids", kid.id, 1000);
  assert.equal(raceRoster(live.field).find((r) => r.id === kid.id).form, "perfect");
  assert.ok(raceRoster(live.field).filter((r) => r.id !== kid.id).every((r) => !r.form));
});

test("the owner's dragon races with the owner's edge, more for a weak dragon in bronze, and rivals race without one", () => {
  const s = stockedStable(genes, "owner-edge", 0);
  const kid = s.dragons.find((w) => w.age === "kid");
  const season = s.leagues.kids;
  const weak = edgeOf(season, { ...kid, strength: 1 }),
    strong = edgeOf(season, { ...kid, strength: 5 });
  assert.ok(weak > strong && strong === ownerEdge.base.bronze);
  assert.ok(edgeOf({ ...season, division: "gold" }, { ...kid, strength: 1 }) < strong);
  const live = startLeagueRace(s, "kids", kid.id, 1000);
  const roster = raceRoster(live.field);
  assert.equal(roster.find((r) => r.id === kid.id).edge, Math.round(edgeOf(season, kid) * 1000) / 1000);
  assert.ok(roster.filter((r) => r.id !== kid.id).every((r) => !r.edge));
  const stats = { topSpeed: 50, acceleration: 2, climb: 6, handling: 8, weight: 1 };
  assert.deepEqual(applyEdge(stats, 0), stats);
  assert.ok(applyEdge(stats, 0.1).topSpeed > 50 && applyEdge(stats, 0.1).weight === 1);
});
