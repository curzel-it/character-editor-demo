import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { createAnatomy } from "../src/anatomy/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { deriveStats } from "../src/race/deriveStats.js";
import { standHeight } from "../src/race/landing.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { windingCourse } from "../src/race/windingCourse.js";
import { defaultField, raceRoster } from "../src/raceField.js";
import { withTack } from "../src/jockey/withTack.js";
import { createJockey } from "../src/jockey/createJockey.js";
import { ages, ageOf, canBreathe, grownWingspan } from "../src/dragonAge.js";
import { creatureScale } from "../src/worldScale.js";

const genome = makeGenome(genes, "age-1");

const extent = (anatomy, keep) => {
  const xs = [];
  for (const part of anatomy.parts.filter(keep))
    if (part.vertices) for (let i = 0; i < part.vertices.length; i += 3) xs.push(part.vertices[i]);
  return Math.max(...xs) - Math.min(...xs);
};
const head = (anatomy) => extent(anatomy, ({ bone }) => bone === "head");
const body = (anatomy) => {
  const headBones = new Set(["head"]);
  for (const { id, parent } of anatomy.bones) if (headBones.has(parent)) headBones.add(id);
  return anatomy.bones.filter(({ id }) => !headBones.has(id) || id === "head").map(({ id }) => id);
};

test("adults are the reference: no age changes nothing", () => {
  assert.equal(ageOf(undefined).id, "adult");
  assert.equal(ageOf("ancient").id, "adult");
  const plain = createAnatomy(genome);
  assert.equal(plain.age, "adult");
  assert.equal(plain.scale, creatureScale);
  assert.deepEqual(createAnatomy(genome, { age: "adult" }), plain);
  assert.deepEqual(deriveStats("dragon", genome, "adult"), deriveStats("dragon", genome));
  assert.equal(grownWingspan(genome, "adult"), genome.wingspan);
});

test("younger dragons are smaller, with bigger heads for their size", () => {
  const [kid, teen, adult] = ["kid", "teen", "adult"].map((age) => createAnatomy(genome, { age }));
  assert.ok(kid.bounds.radius < teen.bounds.radius && teen.bounds.radius < adult.bounds.radius);
  assert.ok(kid.scale < teen.scale && teen.scale < adult.scale);
  const relative = (a) => head(a) / a.bounds.radius;
  assert.ok(relative(kid) > relative(teen) && relative(teen) > relative(adult), "head grows slower than the body");
  assert.ok(grownWingspan(genome, "kid") < grownWingspan(genome, "teen"));
  assert.ok(standHeight(genome, "kid") < standHeight(genome, "adult"));
  for (const anatomy of [kid, teen]) {
    assert.deepEqual(body(anatomy), body(adult), "same skeleton outside the head, which the round head rigs its own way");
    assert.deepEqual(anatomy.genome, genome, "the genome itself is untouched");
    for (const part of anatomy.parts)
      assert.ok((part.vertices ?? part.position).every(Number.isFinite), `${anatomy.age} ${part.id}`);
    assert.ok(withTack(anatomy, { harness: true, jockey: createJockey("age") }).parts.length > anatomy.parts.length);
  }
});

test("age scales racing stats: kids fly and accelerate slower, the rest is the same", () => {
  const [kid, adult] = ["kid", "adult"].map((age) => deriveStats("dragon", genome, age, 3));
  assert.ok(kid.topSpeed < adult.topSpeed && kid.acceleration < adult.acceleration);
  assert.equal(kid.handling, adult.handling);
  for (const age of ages) assert.ok(Object.values(deriveStats("dragon", genome, age.id)).every(Number.isFinite));
});

test("speed classes step evenly from kid to teen to adult", () => {
  const [kid, teen] = ["kid", "teen"].map((age) => ageOf(age).stats);
  for (const key of ["topSpeed", "acceleration"]) {
    assert.ok(kid[key] < teen[key] && teen[key] < 1, key);
    assert.ok(Math.abs(1 - teen[key] - (teen[key] - kid[key])) < 0.03, `${key} steps are even`);
  }
});

test("breath comes with the teen", () => {
  assert.deepEqual(ages.map(({ id }) => canBreathe(id)), [false, true, true]);
  assert.equal(canBreathe(undefined), true, "adults by default");
});

test("the roster carries age only for the young, and kids finish their races", () => {
  const field = defaultField({ genes }, "ages", 6);
  field.participants.forEach((p, i) => (p.age = ["kid", "teen", "adult"][i % 3]));
  const roster = raceRoster(field);
  assert.deepEqual(roster.map((e) => e.age), ["kid", "teen", undefined, "kid", "teen", undefined]);
  const course = windingCourse("age-test");
  const kids = roster.map((e) => ({ ...e, age: "kid" }));
  const a = simulateRace({ seed: "ages", course, roster: kids });
  assert.equal(JSON.stringify(a), JSON.stringify(simulateRace({ seed: "ages", course, roster: kids })));
  assert.ok(a.results.every((r) => r.time !== null), "every kid finishes");
  const adults = simulateRace({ seed: "ages", course, roster: roster.map(({ age, ...e }) => e) });
  assert.ok(a.results[0].time > adults.results[0].time, "kids win in slower times");
});

test("kids have bigger eyes for their head, and headgear grows in shape with age", () => {
  const eyeShare = (age) => {
    const a = createAnatomy({ ...genome, head: 0 }, { age });
    return a.parts.find(({ id }) => id === "eye-1").scale[0] / head(a);
  };
  assert.ok(eyeShare("kid") > eyeShare("teen") && eyeShare("teen") > eyeShare("adult"));
  const count = (headgear, age, prefix) =>
    createAnatomy({ ...genome, headgear }, { age }).parts.filter(({ id }) => id.startsWith(prefix)).length;
  const antlers = ages.map(({ id }) => count(4, id, "antler-tine-"));
  assert.deepEqual(antlers, [0, 4, 6], "kids have bare antler stubs; teens two tines a side");
  const crown = ages.map(({ id }) => count(3, id, "crown-spike-"));
  assert.ok(crown[0] < crown[1] && crown[1] < crown[2]);
  const curl = (age) => {
    const horn = createAnatomy({ ...genome, headgear: 1 }, { age }).parts.find(({ id }) => id === "ram-horn-1");
    return horn.vertices.length;
  };
  assert.ok(curl("kid") < curl("teen") && curl("teen") < curl("adult"), "ram horns curl further with age");
});
