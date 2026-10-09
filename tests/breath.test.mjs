import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { breathElements, breathOf } from "../src/breath/breathElements.js";
import { breathCue, breathLength } from "../src/breath/breathCue.js";
import { breathPalette } from "../src/palette.js";
import { createBreathPlume } from "../src/scene/breathPlume.js";

test("Breath comes just before eye colour, clamps to its elements and every layer has colours", async () => {
  const module = await loadSubject("dragon");
  const gene = module.genes.find((g) => g.name === "breath");
  assert.equal(module.genes[module.genes.indexOf(gene) + 1].name, "eyes");
  assert.deepEqual(gene.choices, breathElements.map((e) => e.label));
  assert.equal(breathOf({ breath: -3 }).id, "fire");
  assert.equal(breathOf({ breath: 99 }).id, breathElements.at(-1).id);
  assert.equal(breathOf({}).id, "fire");
  for (const element of breathElements) for (const layer of element.layers) assert.ok(breathPalette[layer.colors], `${element.id} ${layer.colors}`);
});

test("A breath rears back first, then pours, and is over by its length", () => {
  assert.ok(breathCue(0.3).roar > 0);
  assert.equal(breathCue(0.3).breath, 0);
  assert.ok(breathCue(1.2).breath > 0.99);
  assert.equal(breathCue(breathLength).breath, 0);
  assert.equal(breathCue(breathLength).roar, 0);
});

test("Breath plumes emit while breathing, outlive the breath and clear after", () => {
  for (const element of breathElements) {
    const plume = createBreathPlume();
    const emitter = { key: {}, element, strength: 1, origin: [0, 5, 0], direction: [1, 0, 0], radius: 8, velocity: [0, 0, 0] };
    for (let f = 0; f <= 30; f++) plume.update([emitter], f / 30);
    const during = plume.build([0, 5, 40]).count;
    assert.ok(during > 0 && during % 6 === 0, element.id);
    plume.update([], 1.05);
    assert.ok(plume.build([0, 5, 40]).count > 0, `${element.id} lingers`);
    for (let f = 0; f <= 90; f++) plume.update([], 1.1 + f / 30);
    assert.equal(plume.build([0, 5, 40]).count, 0, `${element.id} clears`);
  }
});

test("The breath pose opens the jaw wider than the resting stand", async () => {
  const module = await loadSubject("dragon");
  const anatomy = module.createAnatomy(makeGenome(module.genes, 7), { age: "adult" });
  const jaw = (motion) => module.pose(anatomy, 0, { stand: 1, glide: 1, effort: 0, time: 3, ...motion }).bones.jaw.rotation[2];
  assert.ok(jaw({ breath: 1 }) < jaw({}) - 0.3);
});

test("Racers breathe at rivals in reach during a race, and never while flown by a pilot", async () => {
  const [{ createCourse }, { simulateRace }, { createRaceSim }, { genes }] = await Promise.all([
    import("../src/course/createCourse.js"),
    import("../src/race/simulateRace.js"),
    import("../src/race/raceSim.js"),
    import("../src/genome/dragon.js"),
  ]);
  const course = createCourse("breath-test");
  const roster = Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, subject: "dragon", genome: makeGenome(genes, `breath:${i}`), age: "adult" }));
  const recording = simulateRace({ seed: "breath", course, roster });
  const breaths = recording.events.filter((e) => e.type === "breath");
  assert.ok(breaths.length >= 3, `only ${breaths.length} breaths`);
  const ids = new Set(roster.map((r) => r.id));
  for (const e of breaths) {
    assert.ok(ids.has(e.other) && e.other !== e.racer);
    assert.ok(["ahead", "left", "right"].includes(e.aim));
    assert.equal(e.element, breathOf(roster.find((r) => r.id === e.racer).genome).id);
  }
  const perRacer = Map.groupBy(breaths, (e) => e.racer);
  for (const list of perRacer.values()) for (let i = 1; i < list.length; i++) assert.ok(list[i].t - list[i - 1].t > breathLength);

  const pilot = (racer) => ({ effort: 0.7, uWish: 0, yWish: 0, events: [] });
  const sim = createRaceSim({ seed: "breath", course, roster, pilots: { b0: pilot } });
  while (!sim.done) sim.step();
  assert.ok(!sim.recording.events.some((e) => e.type === "breath" && e.racer === "b0"));
});

test("Kids never breathe in a race; teens do", async () => {
  const [{ createCourse }, { simulateRace }, { genes }] = await Promise.all([
    import("../src/course/createCourse.js"),
    import("../src/race/simulateRace.js"),
    import("../src/genome/dragon.js"),
  ]);
  const course = createCourse("breath-test");
  const field = (age) => Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, subject: "dragon", genome: makeGenome(genes, `breath:${i}`), age }));
  const events = (age) => simulateRace({ seed: "breath", course, roster: field(age) }).events;
  assert.ok(!events("kid").some((e) => e.type === "breath" || e.type === "hit"));
  assert.ok(events("teen").some((e) => e.type === "breath"));
});

test("Breath attacks only read the racers", async () => {
  const { createBreathAttacks } = await import("../src/race/breathAttacks.js");
  const { froude } = await import("../src/race/froude.js");
  const racer = (id, s, u, breath = 0) => ({ id, s, u, y: 0, genome: { breath }, stats: { recharge: 5 }, finished: false, landing: null, retired: false });
  const L = froude.length;
  const run = (racers) => {
    const attacks = createBreathAttacks("read-only", racers);
    const before = JSON.stringify(racers);
    const events = [];
    for (let t = 0; t < 120; t += 1 / 60)
      attacks.step(t, 1 / 60, (at, type, r, extra) => {
        events.push({ t: at, type, racer: r.id, ...extra });
        r.breathReady = at + 8;
      });
    assert.equal(JSON.stringify(racers.map(({ breathReady, ...r }) => r)), JSON.stringify(JSON.parse(before).map(({ breathReady, ...r }) => r)), "only the breath's recharge changes");
    return events;
  };
  const ahead = run([racer("a", 0, 0), racer("b", 6 * L, 0, 2)]);
  assert.ok(ahead.some((e) => e.racer === "a" && e.aim === "ahead"));
  assert.ok(!ahead.some((e) => e.racer === "b"), "nobody breathes backwards");
  const beside = run([racer("a", 0, 0), racer("c", 0.5 * L, 6 * L, 2)]);
  assert.ok(beside.some((e) => e.racer === "a" && e.aim === "left"), "a rival alongside and a nose ahead draws a breath");
  assert.ok(!beside.some((e) => e.racer === "c"), "nobody breathes at a rival behind it");
  assert.equal(run([racer("a", 0, 0), racer("far", 30 * L, 0, 2)]).length, 0);
  assert.equal(run([racer("fire", 0, 0, 0), racer("water", 6 * L, 0, 4)]).length, 0, "fire spares water, which resists it");
});

test("A racer's breath is found by time and aimed at its rival", async () => {
  const { breathFromEvents } = await import("../src/animate/breathEvents.js");
  const { breathAim } = await import("../src/breath/breathAim.js");
  const recording = { events: [{ t: 10, type: "breath", racer: "a", other: "b", aim: "left", element: "water" }] };
  assert.equal(breathFromEvents(recording, "a", 9.9), null);
  assert.deepEqual(breathFromEvents(recording, "a", 11), { age: 1, other: "b", aim: "left", element: "water" });
  assert.equal(breathFromEvents(recording, "a", 10.01 + breathLength), null);
  recording.events.push({ t: 20, type: "breath", racer: "a", other: "c", aim: "ahead", element: "water" });
  assert.equal(breathFromEvents(recording, "a", 20.5).other, "c");
  const left = breathAim([0, 0, 0], [1, 0, 0], 0, [0, 0, 10]);
  assert.ok(left.yaw > 1.2 && Math.abs(left.pitch) < 1e-9);
  const ahead = breathAim([0, 0, 0], [1, 0, 0], 0, [10, 2, 0]);
  assert.ok(Math.abs(ahead.yaw) < 1e-9 && ahead.pitch > 0.1);
});

test("Elements form one cycle: each beats the next, resists itself and the one before", async () => {
  const { matchup } = await import("../src/breath/breathElements.js");
  const ids = breathElements.map((e) => e.id);
  assert.deepEqual(ids, ["fire", "nature", "earth", "storm", "water"]);
  ids.forEach((id, i) => {
    assert.equal(matchup(id, ids[(i + 1) % ids.length]), 2, `${id} beats the next`);
    assert.equal(matchup(id, id), 0.5, `${id} resists itself`);
    assert.equal(matchup(id, ids[(i + ids.length - 1) % ids.length]), 0.5, `${id} is resisted by the one before`);
    assert.equal(matchup(id, ids[(i + 2) % ids.length]), 1);
  });
});

test("A plume lands one hit on each rival inside it: slowed, knocked back and dazed, harder when super effective", async () => {
  const { createBreathHits } = await import("../src/race/breathHits.js");
  const { froude } = await import("../src/race/froude.js");
  const L = froude.length;
  const stats = { breath: 1, weight: 1, handling: 8 };
  const racer = (id, s, u, breath = 0) => ({ id, s, u, y: 0, genome: { breath }, stats, finished: false, landing: null, retired: false });
  const breathe = (element, aim, rivals) => {
    const from = racer("from", 0, 0);
    const racers = [from, ...rivals];
    const hits = createBreathHits(racers);
    const events = [];
    const emit = (t, type, r, extra) => events.push({ t, type, racer: r.id, ...extra });
    hits.watch(0, { type: "breath", racer: "from", aim, element });
    for (let t = 0; t <= breathLength + 0.1; t += 1 / 60) hits.step(t, 1 / 60, emit);
    return { racers, events };
  };
  const { racers, events } = breathe("fire", "left", [racer("left", 0, 5 * L), racer("right", 0, -5 * L), racer("behind", -8 * L, 0)]);
  assert.equal(events.length, 1);
  assert.deepEqual([events[0].type, events[0].racer, events[0].other], ["hit", "left", "from"]);
  assert.ok(racers[1].effects.slow > 0 && racers[1].effects.daze > 0 && racers[1].shove);
  assert.ok(!racers[2].effects && !racers[3].effects);
  const on = (target) => breathe("fire", "ahead", [racer("in", 5 * L, 0, target)]).events[0];
  const [neutral, strong, weak] = [2, 1, 4].map(on);
  assert.deepEqual([neutral.matchup, strong.matchup, weak.matchup], [1, 2, 0.5], "earth is neutral, nature burns, water resists");
  for (const key of ["slow", "knock", "daze"]) assert.ok(strong[key] > neutral[key] && neutral[key] > weak[key], key);
});

test("Hits in a race come from breaths and slow the rival down", async () => {
  const [{ createCourse }, { simulateRace }, { genes }, { hitFromEvents }] = await Promise.all([
    import("../src/course/createCourse.js"),
    import("../src/race/simulateRace.js"),
    import("../src/genome/dragon.js"),
    import("../src/animate/breathEvents.js"),
  ]);
  const course = createCourse("breath-test");
  const roster = Array.from({ length: 8 }, (_, i) => ({ id: `b${i}`, subject: "dragon", genome: makeGenome(genes, `breath:${i}`), age: "adult", strength: 3 }));
  const recording = simulateRace({ seed: "breath", course, roster });
  const hits = recording.events.filter((e) => e.type === "hit");
  assert.ok(hits.length > 0);
  const breaths = recording.events.filter((e) => e.type === "breath");
  for (const hit of hits) {
    assert.ok(breaths.some((b) => b.racer === hit.other && b.element === hit.element && hit.t >= b.t && hit.t <= b.t + breathLength));
    assert.ok(hit.amount > 0 && hit.amount <= 1);
    assert.equal(hitFromEvents(recording, hit.racer, hit.t + 0.01)?.other, hit.other);
    const frame = recording.frames.find((f) => f.t >= hit.t + 0.1);
    assert.ok(frame.racers.find((r) => r.id === hit.racer).effects?.some((e) => e.id === "slow"), "the frames carry the slowdown");
  }
});

test("Every status has an aura, a tint and a badge look, and its aura smoulders over the whole body", async () => {
  const [{ breathStatuses }, { statusAuras }, { statusEmitters, statusTint }, { effectLook }, { liveEffects }, { palette }] = await Promise.all([
    import("../src/race/breathEffects.js"),
    import("../src/breath/statusAuras.js"),
    import("../src/scene/statusAura.js"),
    import("../src/ui/effectLook.js"),
    import("../src/ui/effectBadges.js"),
    import("../src/palette.js"),
  ]);
  const module = await loadSubject("dragon");
  const anatomy = module.createAnatomy(makeGenome(module.genes, 3), { age: "adult" });
  const { boneMatrices, transform } = await import("../src/math3d.js");
  const bones = boneMatrices(anatomy, module.pose(anatomy, 0.2));
  for (const { id } of Object.values(breathStatuses)) {
    assert.ok(statusAuras[id], id);
    for (const layer of statusAuras[id].layers) assert.ok(breathPalette[layer.colors], `${id} ${layer.colors}`);
    assert.ok(palette.statusTint[id] && effectLook[id]?.icon, id);
    const racer = { anatomy, aura: [{ id, strength: 1 }] };
    const [emitter] = statusEmitters(racer, bones, transform([100, 0, 0]));
    assert.equal(emitter.origins.length, anatomy.bones.length);
    assert.ok(emitter.origins.every((p) => p[0] > 50), "emitters follow the model");
    assert.equal(statusEmitters(racer, bones, transform())[0].key, emitter.key, "one plume per anatomy and status");
    assert.ok(statusTint(racer, 1).amount > 0);
    const plume = createBreathPlume();
    for (let f = 0; f <= 30; f++) plume.update([emitter], f / 30);
    assert.ok(plume.build([0, 5, 40]).count > 0, `${id} aura draws`);
  }
  assert.equal(statusTint({ anatomy, aura: [] }, 1), null);
  const racer = { effects: [{ id: "slow", until: 10 }, { id: "daze", until: 4 }] };
  assert.deepEqual(liveEffects(racer, 5).map((e) => e.id), ["slow"]);
  assert.ok(Math.abs(liveEffects(racer, 10 - effectLook.slow.duration / 2)[0].left - 0.5) < 1e-9);
});
