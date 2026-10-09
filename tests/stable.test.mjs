import test from "node:test";
import assert from "node:assert/strict";
import { colourGenes, genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { inheritGenome } from "../src/genome/inheritGenome.js";
import { stockedStable } from "./stableHelpers.mjs";
import { advanceStable } from "../src/stable/advanceStable.js";
import { evolve, readyToEvolve, stageDurations, timeToAdult } from "../src/stable/lifeStages.js";
import { applyCare, careActionFor, careLevel, freshCare } from "../src/stable/care.js";
import { canWarm, createEgg, eggBaby, giftIncubation, hatchStrength, timeToHatch, timeToWarm, warmEgg, warmLimit, warmStars } from "../src/stable/egg.js";
import { hatchEgg } from "../src/stable/hatch.js";
import { slotsFree, slotsUsed, stableSlots } from "../src/stable/stableSlots.js";
import { sendToWild } from "../src/stable/wild.js";
import { standout } from "../src/dragonBuild.js";
import { tickClock } from "../src/stable/gameClock.js";
import { formatDuration } from "../src/ui/formatDuration.js";
import { fieldSize, raceField, rivalCount } from "../src/stable/leagues.js";
import { entryBlock, runLeagueRace, startLeagueRace } from "../src/stable/leagueRace.js";
import { createStable } from "../src/stable/newStable.js";
import { adoptStarter, giftEggSeed, starterCount, starterKids, welcomed } from "../src/stable/starters.js";
import { genomeDistance } from "../src/genome/genomeDistance.js";
import { dressOwner, renameOwner } from "../src/stable/owner.js";
import { markReinsInvited, markReinsTaught, reinsInviteDue, reinsInvited } from "../src/stable/reinsLesson.js";
import { loadStable, saveStable } from "../src/stable/stableSave.js";
import { markFirstCare, markRaceHintDone, raceHintDue } from "../src/stable/raceLesson.js";

const hour = 3_600_000;
const stable = () => stockedStable(genes, "test", 0);

test("the clock advances by real time times its speed", () => {
  const clock = { game: 0, real: 1000, speed: 60 };
  assert.equal(tickClock(clock, 2000), 60_000);
  assert.equal(clock.game, 60_000);
  assert.equal(formatDuration(2 * hour + 13 * 60_000 + 5000), "2h 13m");
  assert.equal(formatDuration(0), "0s");
});

test("a new stable is empty but for a season per league", () => {
  const s = createStable(genes, "test", 0);
  assert.deepEqual([s.eggs.length, s.dragons.length], [0, 0]);
  assert.deepEqual(Object.keys(s.leagues), ["kids", "teens", "adults"]);
  assert.deepEqual(createStable(genes, "test", 0), s, "the stable is deterministic from its seed");
});

test("dragons grow through every stage on time, waiting at the end of each until evolved, and care makes them stronger", () => {
  const s = stable();
  const kid = s.dragons.find((w) => w.age === "kid");
  s.eggs[0].incubation = stageDurations.egg - hour;
  const events = [];
  for (let t = 0; t < 2 * stageDurations.kid; t += 10 * 60_000) {
    events.push(...advanceStable(s, 10 * 60_000, 0));
    for (const action of ["feed", "play", "clean"]) applyCare(kid, action);
  }
  assert.equal(kid.age, "kid", "a finished stage waits");
  assert.ok(readyToEvolve(kid));
  assert.deepEqual(events.filter((e) => e.id === kid.id), [{ type: "evolve", id: kid.id, age: "teen" }], "reported once");
  assert.equal(evolve(s, kid), "teen");
  assert.equal(kid.growth, 0);
  assert.equal(evolve(s, kid), null, "a fresh teen cannot evolve yet");
  advanceStable(s, 2 * stageDurations.teen, 0);
  assert.equal(evolve(s, kid), "adult");
  assert.ok(events.some((e) => e.type === "ready"));
  const neglected = stable().dragons[0];
  const cared = stable().dragons[0];
  for (const id of Object.keys(neglected.care)) neglected.care[id] = 0;
  const a = { eggs: [], dragons: [neglected] },
    b = { eggs: [], dragons: [cared] };
  for (let i = 0; i < 12; i++) {
    advanceStable(a, 5 * 60_000, 0);
    advanceStable(b, 5 * 60_000, 0);
    for (const action of ["feed", "play", "clean"]) applyCare(cared, action);
  }
  assert.equal(cared.growth, neglected.growth, "growing up takes time only");
  assert.ok(careLevel(neglected) < careLevel(cared));
  assert.ok(cared.strength > neglected.strength, "care makes it stronger");
});

test("an egg incubates 8 hours, each hourly warm skips an hour and adds stars, and its one baby hatches", () => {
  assert.equal(stageDurations.egg, 8 * hour);
  const s = stable();
  const egg = createEgg("laid", 0);
  s.eggs = [egg];
  assert.ok(warmEgg(egg, 0));
  assert.equal(egg.incubation, hour);
  assert.equal(canWarm(egg, hour / 2), false, "once an hour");
  assert.equal(timeToWarm(egg, hour / 2), hour / 2);
  assert.ok(warmEgg(egg, hour), "an hour later it can be warmed again");
  for (let i = 2; i < warmLimit + 3; i++) warmEgg(egg, i * hour);
  assert.equal(egg.warms, warmLimit);
  assert.equal(timeToWarm(egg, 99 * hour), null);
  assert.equal(hatchStrength(egg), 1 + warmStars * warmLimit);
  assert.equal(hatchEgg(s, genes, egg.id, 0), null, "an egg hatches only when ready");
  assert.equal(timeToHatch(egg), 4 * hour);
  advanceStable(s, 4 * hour, 0);
  const kid = hatchEgg(s, genes, egg.id, 0);
  assert.equal(kid.age, "kid");
  assert.equal(kid.strength, 1.5);
  assert.deepEqual(kid.genome, eggBaby(genes, egg).genome);
  assert.equal(s.eggs.length, 0);
});

test("an altar egg holds a fixed child of its parents and hatches at half their average strength, at most 5", () => {
  const s = stable();
  const adults = s.dragons.filter((w) => w.age === "adult");
  adults[0].strength = 5;
  adults[1].strength = 4;
  const egg = createEgg("head-start", 0, adults);
  assert.equal(egg.stars, 2.25);
  assert.deepEqual(eggBaby(genes, egg), eggBaby(genes, egg));
  assert.deepEqual(eggBaby(genes, egg), inheritGenome(genes, adults.map((w) => w.genome), "head-start"));
  assert.equal(createEgg("plain", 0, [{ genome: {} }, { genome: {} }]).stars, 0.5);
  assert.equal(hatchStrength({ stars: 4.9, warms: 4 }), 5);
});

test("children inherit choices and colour sets whole and blend shape genes", () => {
  const a = makeGenome(genes, "mum"),
    b = makeGenome(genes, "dad");
  const { genome, from } = inheritGenome(genes, [a, b], "child");
  for (const gene of genes) {
    assert.ok(genome[gene.name] >= gene.min && genome[gene.name] <= gene.max, gene.name);
    if (gene.choices && from[gene.name] !== null) assert.equal(genome[gene.name], [a, b][from[gene.name]][gene.name]);
  }
  for (const name of colourGenes) assert.ok([0, 1, null].includes(from[name]));
  assert.deepEqual(inheritGenome(genes, [a, b], "child"), { genome, from });
});

test("eggs and dragons share the stable's slots, and sending one to the wild frees one", () => {
  const s = stable();
  assert.equal(slotsUsed(s), stableSlots);
  assert.equal(slotsFree(s), 0);
  assert.ok(sendToWild(s, s.dragons.find((w) => w.age === "adult").id, 0));
  assert.equal(slotsFree(s), 1);
  const egg = createEgg("laid", 0, s.dragons.filter((w) => w.age === "adult"));
  s.eggs.push(egg);
  assert.equal(slotsFree(s), 0);
  advanceStable(s, stageDurations.egg, 0);
  assert.ok(hatchEgg(s, genes, egg.id, 0));
  assert.equal(slotsFree(s), 0);
});

test("time to adulthood counts down, slower at a lower growth rate", () => {
  assert.equal(timeToAdult({ age: "adult", growth: 0 }), 0);
  assert.equal(timeToAdult({ age: "teen", growth: 1000 }), stageDurations.teen - 1000);
  assert.equal(timeToAdult({ age: "kid", growth: 0 }), stageDurations.kid + stageDurations.teen);
});

test("league races field every rival of the season plus the one dragon the owner rides", () => {
  const s = stable();
  const kid = s.dragons.find((w) => w.age === "kid");
  const teen = s.dragons.find((w) => w.age === "teen");
  assert.equal(rivalCount, 7);
  assert.equal(entryBlock(s, teen, "kids", hour), "wrongAge");
  assert.equal(runLeagueRace(s, "kids", teen.id, hour), null, "the wrong age cannot enter");
  assert.equal(runLeagueRace(s, "kids", null, hour), null, "no race without one of the owner's dragons");
  assert.equal(s.leagues.kids.races.length, 0);
  const field = raceField(s.leagues.kids, kid);
  assert.equal(field.participants.length, fieldSize);
  assert.ok(field.participants.some((p) => p.id === kid.id));
  const run = runLeagueRace(s, "kids", kid.id, hour);
  assert.equal(run.race.results.length, fieldSize);
  assert.deepEqual(run.field.participants.find((p) => p.id === kid.id).jockey, s.owner, "the owner rides it in their silks");
  assert.ok(!("jockey" in kid), "the rider is the owner's, not the dragon's");
  assert.equal(kid.record.starts, 1);
  assert.equal(kid.history[0].place, run.race.results.find((r) => r.id === kid.id).place);
  assert.equal(kid.fatigue, 0, "the first ever race leaves it fresh");
  kid.injury = null;
  runLeagueRace(s, "kids", kid.id, hour);
  assert.ok(kid.fatigue > 0);
  assert.equal(entryBlock(s, kid, "kids", hour), kid.injury ? `injury.${kid.injury.id}` : "tired", "a later race needs rest after it");
  const again = runLeagueRace(stable(), "kids", kid.id, hour);
  assert.deepEqual(again.race.results, run.race.results, "league races are deterministic");
  const dressed = stable();
  dressOwner(dressed, { pattern: "hoops", colors: ["scarlet", "white"] });
  renameOwner(dressed, "Someone Else");
  const order = (results) => results.map(({ id, place, time }) => [id, place, time]);
  assert.deepEqual(order(runLeagueRace(dressed, "kids", kid.id, hour).race.results), order(run.race.results), "the rider's name and silks never change the race");
  assert.equal(rivalCount + 1, fieldSize);
});

test("the welcome offers three seeded kids and adopting one gifts the first egg", () => {
  const s = createStable(genes, "test", 0);
  const kids = starterKids(genes, s);
  assert.equal(kids.length, starterCount);
  assert.ok(kids.every((k) => k.age === "kid"));
  assert.equal(new Set(kids.map((k) => k.id)).size, starterCount);
  assert.deepEqual(starterKids(genes, s), kids, "the kids are deterministic from the stable's seed");
  for (const seed of ["test", "a", "b", "c"]) {
    const offered = starterKids(genes, createStable(genes, seed, 0));
    assert.ok(offered.every((k) => k.strength === 1), "every starter hatched at 1 star");
    assert.equal(new Set(offered.map((k) => standout(genes, k.genome))).size, starterCount, "each starter is built for something else");
  }
  assert.equal(welcomed(s), false);
  const kid = adoptStarter(s, genes, 1);
  assert.equal(welcomed(s), true);
  assert.deepEqual(kid, { ...kids[1], care: { ...kids[1].care, fullness: kid.care.fullness } });
  assert.equal(careActionFor(kid).id, "feed", "the adopted kid arrives hungry");
  assert.deepEqual(s.dragons, [kid]);
  assert.equal(s.eggs.length, 1);
  assert.equal(s.eggs[0].seed, giftEggSeed(genes, createStable(genes, "test", 0), kid), "the gift egg is deterministic from the stable and the kid");
  assert.equal(s.eggs[0].stars, 1, "the gift egg hatches at 1 star");
  assert.equal(timeToHatch(s.eggs[0]), giftIncubation, "the gift egg hatches within the first session");
  const gift = eggBaby(genes, s.eggs[0]).genome;
  assert.notEqual(standout(genes, gift), standout(genes, kid.genome), "the gift is built for something else");
  assert.ok(genomeDistance(genes, kid.genome, gift) > genomeDistance(genes, kid.genome, eggBaby(genes, createEgg("test:egg:0", 0)).genome), "the gift is further than the plain seeded egg");
});

test("the first race on Autopilot invites the owner to take the reins once", () => {
  const s = createStable(genes, "reins", 0);
  assert.equal(reinsInviteDue(s, true), false, "not while already riding");
  assert.equal(reinsInviteDue(s, false), true);
  markReinsInvited(s);
  assert.equal(reinsInviteDue(s, false), false, "only once");
  const rider = createStable(genes, "rider", 0);
  markReinsTaught(rider);
  assert.equal(reinsInvited(rider), true, "an owner who took the reins on their own is not invited");
});

test("the first care points the owner at a race until they enter one or dismiss the hint", () => {
  const s = stable();
  const kid = s.dragons.find((w) => w.age === "kid");
  assert.equal(raceHintDue(s), false, "not before any care");
  markFirstCare(s);
  assert.equal(raceHintDue(s), true);
  markFirstCare(s);
  assert.equal(raceHintDue(s), true, "later care keeps it up");
  assert.ok(startLeagueRace(s, "kids", kid.id, 0));
  assert.equal(raceHintDue(s), false, "entering a race puts it away");
  markFirstCare(s);
  assert.equal(raceHintDue(s), false, "and it never comes back");
  const dismissed = stable();
  markFirstCare(dismissed);
  markRaceHintDone(dismissed);
  markFirstCare(dismissed);
  assert.equal(raceHintDue(dismissed), false, "dismissed for good");
  const racer = stable();
  startLeagueRace(racer, "kids", racer.dragons.find((w) => w.age === "kid").id, 0);
  markFirstCare(racer);
  assert.equal(raceHintDue(racer), false, "an owner who raced before caring is not pointed at a race");
});

test("a slumbering dragon cannot race until it wakes", () => {
  const s = stable();
  const adult = s.dragons.find((w) => w.age === "adult");
  adult.slumberUntil = 2 * hour;
  assert.equal(entryBlock(s, adult, "adults", hour), "slumbering");
  assert.equal(runLeagueRace(s, "adults", adult.id, hour), null, "a slumbering entrant cannot race");
  assert.equal(adult.record.starts, 0);
  assert.equal(entryBlock(s, adult, "adults", 2 * hour), null);
});

test("the owner has a seeded name and silks, renamed and redressed at will", () => {
  const s = createStable(genes, "owner", 0);
  assert.ok(s.owner.name.includes(" "));
  assert.ok(s.owner.silks.colors.length >= 2);
  assert.deepEqual(createStable(genes, "owner", 0).owner, s.owner);
  assert.notDeepEqual(createStable(genes, "other", 0).owner, s.owner);
  assert.equal(renameOwner(s, "  Fede  ").name, "Fede");
  assert.equal(renameOwner(s, "   ").name, "Fede", "a blank name keeps the current one");
  assert.deepEqual(dressOwner(s, { pattern: "sash", colors: ["navy", "gold"] }).silks, { pattern: "sash", colors: ["navy", "gold"] });
  assert.equal(dressOwner(s, { pattern: "nope", colors: ["navy", "gold"] }).silks.pattern, createStable(genes, "owner", 0).owner.silks.pattern);
});

test("a saved stable keeps the owner and every dragon's bond", () => {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  try {
    const s = stable();
    renameOwner(s, "Fede");
    s.dragons[0].bond = 0.4;
    s.dragons[1].bond = 7;
    saveStable(s);
    const loaded = loadStable(genes);
    assert.deepEqual(loaded.owner, s.owner);
    assert.deepEqual(loaded.dragons.map((w) => w.bond), s.dragons.map((w) => Math.min(1, w.bond)));
  } finally {
    delete globalThis.localStorage;
  }
});

test("the cloud save wins over a fresh stable and an older one, and only a welcomed stable goes up", () => {
  const store = new Map();
  const cloud = { raw: null };
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  globalThis.DragonzCloud = { load: () => cloud.raw, save: (raw) => (cloud.raw = raw) };
  try {
    const fresh = createStable(genes, "fresh", 0);
    saveStable(fresh);
    assert.equal(cloud.raw, null, "a stable still in the welcome stays on the device");
    const played = stable();
    played.welcomed = true;
    played.clock.real = 1000;
    renameOwner(played, "Cloud");
    saveStable(played);
    store.set("dragonz-stable", JSON.stringify({ ...fresh, version: JSON.parse(cloud.raw).version }));
    assert.equal(loadStable(genes).owner.name, "Cloud", "a reinstall gets the welcomed stable back");
    const older = JSON.parse(cloud.raw);
    older.clock.real = 500;
    older.owner.name = "Older";
    store.set("dragonz-stable", JSON.stringify(older));
    assert.equal(loadStable(genes).owner.name, "Cloud", "the one played last wins");
  } finally {
    delete globalThis.localStorage;
    delete globalThis.DragonzCloud;
  }
});

test("a new stable starts with an empty wild", () => {
  assert.deepEqual(createStable(genes, "fresh", 0).wild, []);
});
