import test from "node:test";
import assert from "node:assert/strict";
import { matchRoute } from "../src/ui/router.js";
import { badgeOf, moodOf } from "../src/ui/mood.js";
import { freshCare } from "../src/stable/care.js";
import { createEgg } from "../src/stable/egg.js";
import { stageDurations } from "../src/stable/lifeStages.js";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { raceField } from "../src/stable/leagues.js";
import { runLeagueRace } from "../src/stable/leagueRace.js";
import { deriveStats } from "../src/race/deriveStats.js";
import { handicap } from "../src/race/handicap.js";
import { favouriteOf, leagueSummary, ownedPlacings, recentRaces } from "../src/ui/leagueSummary.js";
import { lockedText } from "../src/ui/leagueLook.js";

test("A locked league says whether the stable's dragons are too young, too old or missing", () => {
  const stable = { dragons: [{ age: "kid" }] };
  assert.match(lockedText(stable, "adults"), /not old enough.*Main Event is for adults/);
  stable.dragons = [{ age: "adult" }];
  assert.match(lockedText(stable, "kids"), /outgrown/);
  stable.dragons = [];
  assert.match(lockedText(stable, "kids"), /hatch an egg/);
});

const routes = [{ path: "stable" }, { path: "dragon/:id" }, { path: "dragon/:id/lineage" }];

test("Routes match whole paths and decode their parameters", () => {
  assert.equal(matchRoute(routes, "#/stable").route.path, "stable");
  assert.deepEqual(matchRoute(routes, "#/dragon/s-1%3Astarter%3A2").params, { id: "s-1:starter:2" });
  assert.equal(matchRoute(routes, "#/dragon/a/lineage").route.path, "dragon/:id/lineage");
  assert.equal(matchRoute(routes, "#/dragon"), null);
  assert.equal(matchRoute(routes, "#/nowhere"), null);
  assert.equal(matchRoute(routes, "#/dragon/%E0%A4%A"), null);
});

test("Moods follow the neediest need, the condition and the egg", () => {
  const kid = { age: "kid", care: freshCare(), bond: 0.1, fatigue: 0, injury: null };
  assert.equal(moodOf(kid, "kid").tone, "happy");
  assert.equal(badgeOf(kid, "kid"), null);
  kid.care.cleanliness = 10;
  assert.deepEqual(moodOf(kid, "kid"), { text: "Needs a bath", icon: "drop", tone: "warn" });
  assert.equal(badgeOf(kid, "kid"), "drop");
  const racer = { age: "teen", care: freshCare(), fatigue: 0, injury: null };
  assert.equal(moodOf(racer, "racer").text, "Ready to race!");
  racer.fatigue = 0.9;
  assert.equal(moodOf(racer, "racer").tone, "warn");
  racer.injury = { id: "leg" };
  assert.equal(moodOf(racer, "racer").text, "Sore leg");
  racer.injury = null;
  racer.fatigue = 0;
  racer.slumberUntil = 2 * 3_600_000;
  assert.deepEqual(moodOf(racer, "racer", 3_600_000), { text: "Slumbering · wakes in 1h 0m", icon: "moon", tone: "warn" });
  assert.equal(badgeOf(racer, "racer", 3_600_000), "bedColor");
  assert.equal(moodOf(racer, "racer", 2 * 3_600_000).text, "Ready to race!");
  const onAir = { leagues: { teens: { live: { dragon: "flier" } } } };
  racer.id = "flier";
  assert.deepEqual(moodOf(racer, "racer", 2 * 3_600_000, onAir), { text: "On air", icon: "playCircle", tone: "happy" });
  assert.equal(badgeOf(racer, "racer", 2 * 3_600_000, onAir), "playCircle");
  racer.wild = { since: 0, homeAt: null };
  assert.equal(moodOf(racer, "racer", 0).text, "In the wild");
  racer.wild.homeAt = 5;
  assert.equal(moodOf(racer, "racer", 0).text, "On the way home");
  const egg = createEgg("mood", 0);
  assert.equal(moodOf(egg, "egg"), null);
  egg.incubation = stageDurations.egg;
  assert.equal(badgeOf(egg, "egg"), "sparkle");
});

test("League summaries count ready dragons, the best place and locked leagues", () => {
  const stable = stockedStable(genes, "ui-league", 0);
  const kid = stable.dragons.find((w) => w.age === "kid");
  let kids = leagueSummary(stable, "kids");
  assert.deepEqual([kids.members, kids.eligible, kids.racesRun, kids.bestPlace, kids.locked, kids.over], [2, 2, 0, null, false, false]);
  const run = runLeagueRace(stable, "kids", kid.id, 1000);
  kids = leagueSummary(stable, "kids");
  assert.equal(kids.racesRun, 1);
  assert.equal(kids.eligible, 2, "the first ever race leaves the kid fresh");
  runLeagueRace(stable, "kids", kid.id, 2000);
  assert.equal(leagueSummary(stable, "kids").eligible, 1, "a later race tires it");
  assert.ok(kids.bestPlace >= 1);
  assert.deepEqual(ownedPlacings(run.race).map((r) => r.id), [kid.id]);
  for (const w of stable.dragons) if (w.age === "kid") w.age = "teen";
  assert.equal(leagueSummary(stable, "kids").locked, true);
});

test("Recent races are the owned ones, newest first", () => {
  const stable = stockedStable(genes, "ui-log", 0);
  const kid = stable.dragons.find((w) => w.age === "kid");
  const teen = stable.dragons.find((w) => w.age === "teen");
  runLeagueRace(stable, "kids", kid.id, 1000);
  runLeagueRace(stable, "teens", teen.id, 2000);
  assert.deepEqual(recentRaces(stable).map((p) => p.league.id), ["teens", "kids"]);
});

test("The favourite is the field's best public handicap, stars included", () => {
  const stable = stockedStable(genes, "ui-fav", 0);
  const { participants } = raceField(stable.leagues.kids);
  const raced = (p) => handicap(deriveStats({ genes }, p.genome, p.age, p.strength));
  const best = Math.max(...participants.map(raced));
  assert.equal(raced(favouriteOf(genes, participants)), best);
});
