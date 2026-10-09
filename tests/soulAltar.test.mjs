import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { createStable } from "../src/stable/newStable.js";
import { createDragon } from "../src/stable/createDragon.js";
import { createEgg } from "../src/stable/egg.js";
import { fatigueLimit } from "../src/stable/condition.js";
import { stableSlots } from "../src/stable/stableSlots.js";
import {
  failureSlumber,
  performRitual,
  ritualBlock,
  ritualOdds,
  slumberBlock,
  slumbering,
  slumberLeft,
  successSlumber,
} from "../src/stable/soulAltar.js";

const hour = 3_600_000;

function altarStable(seed = "altar", ages = ["adult", "adult", "adult", "adult", "kid"]) {
  const stable = createStable(genes, seed, 0);
  stable.welcomed = true;
  ages.forEach((age, i) => {
    const dragonSeed = `${seed}:w:${i}`;
    stable.dragons.push(createDragon({ seed: dragonSeed, genome: makeGenome(genes, dragonSeed), age }));
  });
  return stable;
}

const adults = (stable) => stable.dragons.filter((w) => w.age === "adult");

/** The first seed whose first ritual of `count` adults ends as `success`. */
function stableWithOutcome(success, count = 2) {
  for (let i = 0; i < 200; i++) {
    const stable = altarStable(`altar:${i}`);
    const ids = adults(stable).slice(0, count).map((w) => w.id);
    const probe = structuredClone(stable);
    if (performRitual(probe, genes, ids, 0).success === success) return { stable, ids };
  }
  throw new Error("no seed found");
}

test("odds start at 36% with two parents, each extra one adds less, and top out at 90% with six", () => {
  assert.equal(ritualOdds(1), 0);
  assert.deepEqual([2, 3, 4, 5, 6].map((n) => Math.round(ritualOdds(n) * 100)), [36, 56, 70, 81, 90]);
  assert.ok(Math.abs(ritualOdds(6) - 0.9) < 1e-12);
  assert.equal(ritualOdds(9), ritualOdds(6));
});

test("a ritual is blocked for every reason a parent cannot take part", () => {
  const s = altarStable();
  const [a, b, c] = adults(s);
  const kid = s.dragons.find((w) => w.age === "kid");
  assert.equal(ritualBlock(s, [a, b], 0), null);
  assert.equal(ritualBlock(s, [a], 0), "ritual.needTwo");
  assert.equal(ritualBlock(s, [a, a], 0), "ritual.needTwo");
  assert.equal(ritualBlock(s, [a, kid], 0), "ritual.adultsOnly");

  b.injury = { id: "leg", label: "Sore leg", until: hour };
  assert.deepEqual(ritualBlock(s, [a, b], 0), { code: "ritual.unfit", name: b.name, reason: "injury.leg" });
  b.injury = null;

  b.fatigue = fatigueLimit + 0.1;
  assert.deepEqual(ritualBlock(s, [a, b], 0), { code: "ritual.unfit", name: b.name, reason: "tired" });
  b.fatigue = 0;

  b.slumberUntil = hour;
  assert.deepEqual(ritualBlock(s, [a, b], 0), { code: "ritual.slumbering", name: b.name });
  assert.equal(ritualBlock(s, [a, b], hour), null);
  b.slumberUntil = undefined;

  const wild = s.dragons.splice(s.dragons.indexOf(c), 1)[0];
  assert.deepEqual(ritualBlock(s, [a, wild], 0), { code: "ritual.notInStable", name: wild.name });
  s.dragons.push(wild);

  while (s.eggs.length + s.dragons.length < stableSlots) s.eggs.push(createEgg(`fill:${s.eggs.length}`, 0));
  assert.equal(ritualBlock(s, [a, b], 0), "stableFull");
});

test("no ritual and no egg without a free slot", () => {
  const s = altarStable();
  while (s.eggs.length + s.dragons.length < stableSlots) s.eggs.push(createEgg(`fill:${s.eggs.length}`, 0));
  const eggs = s.eggs.length;
  const ids = adults(s).map((w) => w.id);
  assert.equal(performRitual(s, genes, ids, 0), null);
  assert.equal(s.eggs.length, eggs);
  assert.ok(adults(s).every((w) => !slumbering(w, 0)));
});

test("a ritual is deterministic from the stable's seed and ritual count", () => {
  const run = () => {
    const s = altarStable("same");
    const ids = adults(s).slice(0, 3).map((w) => w.id);
    return [performRitual(s, genes, ids, 0), performRitual(s, genes, adults(s).slice(3).concat(adults(s)[0]).map((w) => w.id), 7 * hour)];
  };
  assert.deepEqual(run(), run());
});

test("a success lays an egg from every parent and they slumber 3 h", () => {
  const { stable, ids } = stableWithOutcome(true, 3);
  const result = performRitual(stable, genes, ids, hour);
  assert.equal(result.success, true);
  assert.equal(result.odds, ritualOdds(3));
  assert.ok(stable.eggs.includes(result.egg));
  assert.equal(result.egg.seed, `${stable.seed}:ritual:1`);
  assert.deepEqual(
    result.egg.parents.map((p) => p.id),
    ids,
  );
  for (const id of ids) {
    const w = stable.dragons.find((x) => x.id === id);
    assert.equal(w.slumberUntil, hour + successSlumber);
    assert.equal(slumberLeft(w, hour), successSlumber);
    assert.equal(slumberBlock(w, hour), "slumbering");
    assert.equal(slumbering(w, hour + successSlumber), false);
    assert.equal(slumberLeft(w, hour + successSlumber + 1), 0);
  }
});

test("a failure lays nothing and the parents slumber 1 h", () => {
  const { stable, ids } = stableWithOutcome(false);
  const eggs = stable.eggs.length;
  const result = performRitual(stable, genes, ids, 0);
  assert.deepEqual(result, { success: false, egg: null, odds: ritualOdds(2), seed: `${stable.seed}:ritual:${stable.rituals}` });
  assert.equal(stable.eggs.length, eggs);
  for (const id of ids) {
    const w = stable.dragons.find((x) => x.id === id);
    assert.equal(slumberLeft(w, 0), failureSlumber);
    assert.equal(ritualBlock(stable, [w, adults(stable).find((x) => !ids.includes(x.id))], failureSlumber / 2)?.code, "ritual.slumbering");
    assert.equal(slumberBlock(w, failureSlumber), null);
  }
});

test("a parent id not in the stable holds no ritual", () => {
  const s = altarStable();
  const [a] = adults(s);
  assert.equal(performRitual(s, genes, [a.id, "gone"], 0), null);
  assert.equal(slumbering(a, 0), false);
  assert.equal(s.rituals, undefined);
});
