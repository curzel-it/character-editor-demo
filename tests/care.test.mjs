import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { advanceStable } from "../src/stable/advanceStable.js";
import { afterRaceCare, applyCare, careActionFor, careLevel, freshCare, neediest, needValue, needsOf } from "../src/stable/care.js";
import { careAlarm } from "../src/stable/awaySummary.js";
import { eggBond, hatchBond } from "../src/stable/bond.js";
import { warmEgg } from "../src/stable/egg.js";
import { hatchEgg } from "../src/stable/hatch.js";
import { stageDurations } from "../src/stable/lifeStages.js";
import { runLeagueRace } from "../src/stable/leagueRace.js";
import { raceRoster } from "../src/raceField.js";
import { fieldCourse } from "../src/fieldCourse.js";
import { simulateRace } from "../src/race/simulateRace.js";

const hour = 3_600_000;
const stable = () => stockedStable(genes, "care", 0);
const dragon = (age, care = {}, bond = 0.5) => ({ age, care: { ...freshCare(), ...care }, bond });

test("each age adds one need to the last: kids fed, happy and clean, teens exercise, adults affection", () => {
  assert.deepEqual(needsOf("kid").map((n) => n.id), ["fullness", "happiness", "cleanliness"]);
  assert.deepEqual(needsOf("teen").map((n) => n.id), ["fullness", "happiness", "cleanliness", "exercise"]);
  assert.deepEqual(needsOf("adult").map((n) => n.id), ["fullness", "happiness", "cleanliness", "exercise", "affection"]);
  assert.equal(neediest(dragon("kid", { exercise: 0, cleanliness: 90 }, 0)).id, "cleanliness", "a kid has no exercise or affection to ask for");
  assert.equal(careActionFor(dragon("teen", { exercise: 20 })).id, "exercise");
  assert.equal(careActionFor(dragon("adult", { affection: 20 })).id, "groom");
  assert.equal(careActionFor(dragon("adult", {}, 0.1)).id, "feed", "a low bond is not a need");
  const kid = dragon("kid");
  assert.equal(applyCare(kid, "exercise"), false, "kids are not exercised");
  assert.equal(applyCare(kid, "groom"), false);
});

test("needs drop slowly enough to need care a few times a day, not every hour", () => {
  for (const age of ["kid", "teen", "adult"]) {
    const s = { eggs: [], dragons: [Object.assign(stable().dragons.find((w) => w.age === age), { bond: 0.8 })], wild: [] };
    const w = s.dragons[0];
    advanceStable(s, 2 * hour, 2 * hour);
    assert.ok(needsOf(age).every((n) => needValue(w, n.id) > 70), `${age}: two hours leave every need well up`);
    advanceStable(s, 6 * hour, 8 * hour);
    assert.ok(needValue(w, neediest(w).id) < careAlarm, `${age}: eight hours leave a need asking for care`);
  }
});

test("bond builds from the egg, rises with care, races and grooming, and never fades", () => {
  const s = stable();
  const egg = s.eggs[0];
  for (let i = 0; i < 3; i++) warmEgg(egg, i * hour);
  advanceStable(s, stageDurations.egg, stageDurations.egg);
  const kid = hatchEgg(s, genes, egg.id, stageDurations.egg);
  assert.equal(kid.bond, eggBond(egg));
  assert.ok(kid.bond > hatchBond, "warming bonds");
  const before = kid.bond;
  applyCare(kid, "feed");
  assert.ok(kid.bond > before, "care bonds");
  const fed = kid.bond;
  afterRaceCare(kid);
  assert.ok(kid.bond > fed, "races bond");
  const young = { eggs: [], dragons: [kid], wild: [] };
  advanceStable(young, 10 * hour, 10 * hour);
  assert.equal(kid.bond, fed + 0.03, "a kid's bond does not fade");
  const adult = dragon("adult", {}, 0.5);
  advanceStable({ eggs: [], dragons: [Object.assign(adult, { growth: 0, fatigue: 0, injury: null })], wild: [] }, 10 * hour, 10 * hour);
  assert.equal(adult.bond, 0.5, "nor does an adult's");
  assert.ok(adult.care.affection < 100, "its affection does");
  applyCare(adult, "groom");
  assert.ok(adult.bond > 0.5 + 0.04, "grooming bonds more than other care");
});

test("a race exercises a dragon and leaves it hungry and dirty", () => {
  const teen = dragon("teen", { exercise: 20 });
  afterRaceCare(teen);
  assert.ok(teen.care.exercise > 60 && teen.care.fullness < 100 && teen.care.cleanliness < 100);
});

test("the care level is the mean need dragged down by the neediest", () => {
  assert.equal(careLevel(dragon("kid")), 1);
  assert.ok(careLevel(dragon("kid", { fullness: 50 })) < 1);
  assert.ok(careLevel(dragon("adult", { affection: 10 })) < careLevel(dragon("adult", { affection: 90 })), "an unloved adult is less well cared for");
});

test("league races carry every dragon's stars into the race, deterministically", () => {
  const run = (strength) => {
    const s = stable();
    const kid = s.dragons.find((w) => w.age === "kid");
    kid.strength = strength;
    const result = runLeagueRace(s, "kids", kid.id, hour);
    return { kid, ...result };
  };
  const fresh = run(1);
  const developed = run(5);
  const entrant = (r) => r.field.participants.find((p) => p.id === r.kid.id);
  assert.equal(entrant(fresh).strength, 1);
  assert.equal(entrant(developed).strength, 5);
  assert.ok(developed.field.participants.every((p) => p.strength >= 1 && p.strength <= 5), "rivals race at seeded stars");
  assert.ok(developed.race.results.every((r) => !("form" in r)), "results keep no form");
  const replay = simulateRace({ seed: developed.field.raceSeed, course: fieldCourse(developed.field), roster: raceRoster(developed.field) });
  assert.deepEqual(
    replay.results.map(({ id, place }) => [id, place]),
    developed.race.results.map(({ id, place }) => [id, place]),
    "the replay from the saved field is the race",
  );
  const time = (r) => r.race.results.find((x) => x.owned).time;
  assert.ok(time(developed) < time(fresh), "stars save time");
});
