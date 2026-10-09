import test from "node:test";
import assert from "node:assert/strict";
import { loadSubject, makeGenome } from "../src/subjects.js";
import { breathElements } from "../src/breath/breathElements.js";
import { beatAt, lineAt, ritualTimeline } from "../src/scene/ritualTimeline.js";
import { shotAt } from "../src/scene/ritualShots.js";
import { createAltarPlace } from "../src/scene/altarPlace.js";
import { createAltarCast } from "../src/scene/altarCast.js";
import { createRitualShow } from "../src/scene/ritualShow.js";
import { createStable } from "../src/stable/newStable.js";

const module = await loadSubject("dragon");
const place = createAltarPlace();
const cast = createAltarCast(module, place);
const circle = (elements) =>
  elements.map((element, i) => ({ genome: { ...makeGenome(module.genes, `show:${i}`), breath: breathElements.findIndex((b) => b.id === element) } }));
const look = { shell: [0.8, 0.5, 0.3], spots: [0.3, 0.3, 0.8], seed: "egg" };

test("the ritual's timeline is deterministic, its beats in order, ending on the card", () => {
  for (const count of [2, 3, 5, 6])
    for (const success of [true, false]) {
      const timeline = ritualTimeline({ count, success, seed: "s:ritual:1" });
      assert.deepEqual(timeline, ritualTimeline({ count, success, seed: "s:ritual:1" }));
      const ids = timeline.beats.map((b) => b.id);
      assert.deepEqual(ids, ["raise", "arrive", "breathe", "merge", "burst", "settle", "reveal", "card"]);
      const times = timeline.beats.map((b) => b.at);
      assert.deepEqual([...times].sort((a, b) => a - b), times);
      assert.equal(timeline.beats.at(-1).at, timeline.card);
      assert.equal(timeline.length, timeline.card);
      assert.ok(timeline.card >= 20 && timeline.card <= 30, `${timeline.card} s`);
      assert.equal(beatAt(timeline, timeline.card + 1), "card");
      assert.equal(beatAt(timeline, 0), null);
      assert.equal(timeline.arrivals.length, count);
      for (const a of timeline.arrivals) assert.ok(a.land + 1.3 <= timeline.breath, "every parent stands before the breath");
      for (const line of timeline.lines) assert.ok(line.at < line.until && line.until <= timeline.card);
    }
});

test("the custodian's lines depend on the seed and the outcome", () => {
  const lines = (seed, success) => ritualTimeline({ count: 3, success, seed }).lines.map((l) => l.text);
  const seeds = Array.from({ length: 12 }, (_, i) => `s:ritual:${i}`);
  assert.ok(new Set(seeds.map((s) => lines(s, true).join())).size > 1);
  const timeline = ritualTimeline({ count: 3, success: false, seed: "s:ritual:1" });
  assert.equal(lineAt(timeline, timeline.card - 0.1), timeline.lines.at(-1));
  assert.notEqual(lines("s:ritual:1", true).at(-1), lines("s:ritual:1", false).at(-1));
});

test("the show plays planned cuts in order and frames every moment the same way twice", () => {
  for (const [elements, success] of [
    [["fire", "water"], false],
    [["fire", "water", "nature", "storm", "fire"], true],
  ]) {
    const make = () => createRitualShow({ place, cast, dragons: circle(elements), success, seed: "s:ritual:4", look });
    const show = make(),
      again = make();
    const { timeline, shots } = show;
    const order = shots.map((s) => s.id);
    assert.deepEqual(order.slice(0, 7), ["establish", "custodian", "landing", "head", "converge", "burst", "settle"]);
    assert.deepEqual(order.slice(7), success ? ["reveal"] : ["reveal", "console"]);
    for (let k = 1; k < shots.length; k++) assert.ok(shots[k].to > shots[k - 1].to);
    assert.ok(shots.at(-1).to >= timeline.card);
    for (const t of [0.5, 5, 9.5, 12, 15, 18, 22, timeline.card]) {
      const a = show.frame(t),
        b = again.frame(t);
      assert.deepEqual(a.camera, b.camera);
      assert.equal(a.shot, shotAt(shots, t).id);
      assert.deepEqual(a.racers.map((r) => r.position), b.racers.map((r) => r.position));
      assert.deepEqual(a.racers.map((r) => r.pose), b.racers.map((r) => r.pose));
      for (const v of a.camera.eye) assert.ok(Number.isFinite(v));
    }
    const before = show.frame(timeline.arrivals[0].start - 0.1).racers.length;
    assert.equal(before, 1, "only the custodian before the parents arrive");
    const after = show.frame(timeline.card).racers.length;
    assert.equal(after, 1 + elements.length + (success ? 1 : 0), "the egg lies on the altar only after a success");
    assert.ok(show.frame(timeline.breath + 6).fireworks, "the fireworks play from the breath");
    assert.equal(show.frame(timeline.breath - 1).fireworks, null);
  }
});

test("the parents land in formation and stand at the altar's circle", () => {
  const show = createRitualShow({ place, cast, dragons: circle(["fire", "storm", "water"]), success: true, seed: "s", look });
  const landed = show.frame(show.timeline.breath - 0.5).racers.slice(1);
  show.parents.forEach((p, i) => {
    assert.deepEqual(landed[i].position.map((v) => +v.toFixed(3)), p.root.map((v) => +v.toFixed(3)));
    assert.ok(Math.hypot(p.root[0], p.root[2]) > place.ring.radius + 4, "outside the stones");
  });
  const flying = show.frame(show.timeline.arrivals[0].start + 1).racers[1];
  assert.ok(flying.position[1] > show.parents[0].root[1] + 5, "the first one is still in the air");
});
