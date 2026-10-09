import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { createAnatomy } from "../src/anatomy/dragon.js";
import { makeGenome } from "../src/subjects.js";
import { createJockey, restoreJockey, rerollJockeySeed } from "../src/jockey/createJockey.js";
import { silkColors, silkPatterns, silksRgb } from "../src/jockey/jockeySilks.js";
import { riderLookFields } from "../src/jockey/riderLook.js";
import { riderFigure } from "../src/jockey/riderFigure.js";
import { withJockey } from "../src/jockey/withJockey.js";
import { withTack } from "../src/jockey/withTack.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { windingCourse } from "../src/race/windingCourse.js";
import { defaultField, loadField, saveField, raceRoster } from "../src/raceField.js";

const module = { genes };
const course = windingCourse("jockey-test");

test("jockeys are deterministic from their seed and within range", () => {
  assert.deepEqual(createJockey("a:1"), createJockey("a:1"));
  assert.notDeepEqual(createJockey("a:1"), createJockey("a:2"));
  const ids = new Set(silkColors.map((c) => c.id));
  for (let i = 0; i < 200; i++) {
    const j = createJockey(`range:${i}`);
    assert.ok(silkPatterns.some((p) => p.id === j.silks.pattern));
    assert.ok(j.silks.colors.length >= 2 && j.silks.colors.length <= 3);
    assert.equal(new Set(j.silks.colors).size, j.silks.colors.length);
    assert.ok(j.silks.colors.every((c) => ids.has(c)));
    assert.ok(Object.values(silksRgb(j.silks)).every((rgb) => rgb.length === 3));
    assert.ok(j.name.includes(" "));
  }
  assert.equal(rerollJockeySeed("x"), rerollJockeySeed("x"));
  assert.notEqual(rerollJockeySeed("x"), "x");
});

test("a rider is a name, silks and a look; restoring one fills gaps from the seed", () => {
  const base = createJockey("r");
  assert.deepEqual(Object.keys(base).sort(), ["look", "name", "seed", "silks"]);
  assert.deepEqual(restoreJockey(undefined, "r"), base);
  const edited = restoreJockey({ ...base, name: "  ", weight: 99, skill: -1, silks: { pattern: "hoops", colors: ["gold"] }, look: { hat: "pointed", build: "huge" } }, "r");
  assert.deepEqual(Object.keys(edited).sort(), ["look", "name", "seed", "silks"]);
  assert.equal(edited.name, base.name);
  assert.equal(edited.silks.pattern, "hoops");
  assert.deepEqual(edited.silks.colors, base.silks.colors);
  assert.equal(edited.look.hat, "pointed");
  assert.equal(edited.look.build, base.look.build);
  assert.deepEqual(Object.keys(edited.look).sort(), riderLookFields.map((f) => f.key).sort());
});

test("every look choice dresses the rider in the saddle and on foot with finite geometry", () => {
  const anatomy = createAnatomy(makeGenome(genes, "looks"));
  const base = createJockey("looks");
  for (const { key, options } of riderLookFields)
    for (const option of options) {
      const jockey = { ...base, look: { ...base.look, [key]: option.id } };
      for (const parts of [withJockey(anatomy, jockey).parts.filter((p) => p.id.startsWith("jockey-")), riderFigure(jockey).parts]) {
        assert.ok(parts.length > 15, `${key} ${option.id}`);
        for (const p of parts) for (const v of [...(p.vertices ?? []), ...(p.position ?? []), ...(p.scale ?? [])]) assert.ok(Number.isFinite(v), `${key} ${option.id} ${p.id}`);
      }
    }
  const ids = (jockey) => riderFigure(jockey).parts.map((p) => p.id);
  assert.ok(!ids({ ...base, look: { ...base.look, hair: "bald" } }).some((id) => id.includes("hair")));
  assert.ok(ids({ ...base, look: { ...base.look, hat: "none", hair: "afro" } }).some((id) => id.includes("afro")));
  assert.ok(ids({ ...base, look: { ...base.look, facialHair: "beard" } }).some((id) => id.includes("beard")));
  assert.ok(ids({ ...base, look: { ...base.look, hair: "braid" } }).some((id) => id.includes("braid")));
  assert.ok(ids({ ...base, look: { ...base.look, hat: "horned" } }).some((id) => id.includes("horn")));
});

test("the rider on foot stands about 1.8 m tall with its feet on the ground", () => {
  const rider = createJockey("standing");
  const figure = riderFigure({ ...rider, look: { ...rider.look, hat: "cap" } });
  const ys = figure.parts.flatMap((p) => (p.vertices ? p.vertices.filter((_, i) => i % 3 === 1) : [p.position[1] - p.scale[1], p.position[1] + p.scale[1]]));
  const [low, high] = [Math.min(...ys), Math.max(...ys)];
  assert.ok(low > -0.05 && low < 0.05, `feet at ${low}`);
  assert.ok(high > 1.7 && high < 1.95, `height ${high}`);
});

const tackPart = /^(jockey|saddle|harness)-/;

function checkRider(anatomy, rider, minimum = 15) {
  const bones = new Set(anatomy.bones.map((b) => b.id));
  const added = rider.parts.filter((p) => tackPart.test(p.id));
  assert.ok(added.length > minimum, "tack parts missing");
  assert.equal(new Set(rider.parts.map((p) => p.id)).size, rider.parts.length, "part ids are unique");
  for (const part of added) {
    assert.ok(bones.has(part.bone), `${part.id} bone ${part.bone}`);
    for (const key of ["position", "rotation", "scale", "color"]) assert.ok(part[key].every(Number.isFinite), `${part.id} ${key}`);
    if (part.vertices) {
      assert.ok(part.vertices.every(Number.isFinite), `${part.id} vertices`);
      assert.ok(part.indices.every((i) => Number.isInteger(i) && i >= 0 && i < part.vertices.length / 3), `${part.id} indices`);
      assert.equal(part.colors.length, part.vertices.length, `${part.id} colours`);
    }
    if (part.skin) {
      assert.equal(part.skin.joints.length, part.vertices.length / 3);
      assert.ok(part.skin.joints.flat().every((id) => bones.has(id)), `${part.id} joints`);
      assert.ok(part.skin.weights.every((w) => w >= 0 && w <= 1), `${part.id} weights`);
    }
  }
  assert.deepEqual(rider.bones, anatomy.bones, "the rider adds no bones");
  assert.ok(rider.bounds.radius > 0);
  return added;
}

test("the rider sits on the saddle socket with valid, finite geometry", () => {
  const anatomy = createAnatomy(makeGenome(genes, "rider"));
  const jockey = createJockey("rider");
  const rider = withJockey(anatomy, jockey);
  const added = checkRider(anatomy, rider);
  const saddle = anatomy.sockets.find((s) => s.id === "saddle");
  if (saddle) assert.ok(added.filter((p) => !p.skin && p.id !== "jockey-collar").every((p) => p.bone === saddle.bone));
  assert.deepEqual(withJockey(anatomy, jockey), rider, "deterministic");
  assert.equal(withJockey(anatomy, null), anatomy);
  // About 1.75 m of rider in a racing tuck: lying along the back, so well under a standing height.
  const ys = added.filter((p) => /jacket|helmet|boot/.test(p.id)).flatMap((p) => p.vertices.filter((_, i) => i % 3 === 1));
  const height = Math.max(...ys) - Math.min(...ys);
  assert.ok(height > 0.5 && height < 0.95, `tuck height ${height}`);
});

test("without sockets the rider falls back to a point on the root behind the neck", () => {
  const anatomy = { ...createAnatomy(makeGenome(genes, "bare")), sockets: [] };
  const rider = withJockey(anatomy, createJockey("bare"));
  checkRider(anatomy, rider);
  const root = anatomy.bones.find((b) => !b.parent).id;
  assert.equal(rider.jockey.bone, root);
});

test("tack layers are independent: naked, harness, saddle and rider", () => {
  const anatomy = createAnatomy(makeGenome(genes, "layers"));
  const jockey = createJockey("layers");
  const layers = (a) => new Set(a.parts.filter((p) => tackPart.test(p.id)).map((p) => p.id.split("-")[0]));
  assert.equal(withTack(anatomy), anatomy, "naked by default");
  assert.equal(withTack(anatomy, { harness: false, saddle: false }), anatomy);

  const harnessed = withTack(anatomy, { harness: true });
  checkRider(anatomy, harnessed, 5);
  assert.deepEqual([...layers(harnessed)], ["harness"]);
  assert.ok(harnessed.parts.some((p) => p.id === "harness-roller-pad"), "a roller anchors the harness without a saddle");
  assert.deepEqual(harnessed.tack, { ...harnessed.tack, harness: true, saddle: false, jockey: null });
  assert.equal(harnessed.jockey, undefined);

  const saddled = withTack(anatomy, { saddle: true });
  checkRider(anatomy, saddled, 5);
  assert.deepEqual([...layers(saddled)], ["saddle"]);

  const ridden = withTack(anatomy, { jockey });
  assert.deepEqual([...layers(ridden)].sort(), ["jockey", "saddle"], "a rider brings a saddle");
  assert.equal(ridden.tack.saddle, true);

  const full = withTack(anatomy, { harness: true, jockey });
  assert.deepEqual([...layers(full)].sort(), ["harness", "jockey", "saddle"]);
  assert.ok(!full.parts.some((p) => p.id === "harness-roller-pad"), "the saddle replaces the roller");
  assert.deepEqual(withJockey(anatomy, jockey), full, "withJockey rides in full tack");
  assert.deepEqual(withJockey(anatomy, jockey, { harness: false }), ridden);
});

test("tack stays out of addon keep-clear zones", () => {
  const anatomy = createAnatomy(makeGenome(genes, "zones"));
  const full = withTack(anatomy, { harness: true, jockey: createJockey("zones") });
  const loin = full.parts.find((p) => p.id === "harness-loin-strap");
  const at = loin.vertices.slice(0, 3);
  const zoned = { ...anatomy, addons: [...(anatomy.addons ?? []), { slot: "test", id: "probe", bones: [], keepClear: [{ center: at, radius: 0.2 }] }] };
  const dressed = withTack(zoned, { harness: true, jockey: createJockey("zones") });
  assert.ok(!dressed.parts.some((p) => p.id === "harness-loin-strap"), "the strap in the zone is left off");
  assert.ok(dressed.parts.some((p) => p.id === "jockey-helmet"), "tack elsewhere stays");
  for (let i = 0; i < 12; i++) {
    const a = createAnatomy(makeGenome(genes, `zones:${i}`));
    const tacked = withTack(a, { harness: true, jockey: createJockey(`zones:${i}`) });
    const before = withTack({ ...a, addons: [] }, { harness: true, jockey: createJockey(`zones:${i}`) });
    assert.equal(tacked.parts.length, before.parts.length, `real addons never cost tack (genome ${i})`);
  }
});

test("riders change the look only: any riders race the riderless recording", () => {
  const field = defaultField(module, "off", 6);
  const entries = raceRoster(field);
  assert.ok(entries.every((e) => !("jockey" in e)));
  const plain = field.participants.map(({ id, name, genome }) => ({ id, name, subject: "dragon", genome, harness: true, strength: 3 }));
  const ridden = plain.map((e) => ({ ...e, jockey: { ...createJockey(e.id), weight: 80, skill: 0 } }));
  const a = simulateRace({ seed: "off", course, roster: entries });
  assert.equal(JSON.stringify(a), JSON.stringify(simulateRace({ seed: "off", course, roster: plain })));
  assert.equal(JSON.stringify(a.results), JSON.stringify(simulateRace({ seed: "off", course, roster: ridden }).results));
});

test("a saved field keeps each rider's name and silks; one without riders gets seeded ones", () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => store.set(k, String(v)),
  };
  try {
    const old = defaultField(module, "m", 3);
    const legacy = {
      version: 2,
      courseSeed: old.courseSeed,
      raceSeed: old.raceSeed,
      participants: old.participants.map(({ jockey, ...rest }) => rest),
    };
    store.set("dragonz-race-field", JSON.stringify(legacy));
    const loaded = loadField(module);
    loaded.participants.forEach((p, i) => assert.deepEqual(p.jockey, createJockey(legacy.participants[i].seed)));

    loaded.participants[0].jockey = { ...loaded.participants[0].jockey, name: "Test Rider", silks: { pattern: "sash", colors: ["navy", "gold"] } };
    saveField(loaded);
    assert.equal(JSON.parse(store.get("dragonz-race-field")).version, 3);
    assert.deepEqual(loadField(module).participants[0].jockey, loaded.participants[0].jockey);
  } finally {
    delete globalThis.localStorage;
  }
});
