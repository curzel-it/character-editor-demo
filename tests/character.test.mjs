import { test } from "node:test";
import assert from "node:assert/strict";
import { fields, defaultSpec, normalizeSpec, fieldShown, validValue } from "../src/character/characterSpec.js";
import { createCharacter } from "../src/character/characterAnatomy.js";
import { characterPose, expressions, gestures, gestureLength } from "../src/character/characterPose.js";
import { encodeCharacter, decodeCharacter } from "../src/character/characterCode.js";
import { randomSpec } from "../src/character/characterRandom.js";
import { lightCharacter } from "../src/character/characterBuild.js";
import { createEditorState } from "../src/editor/editorState.js";
import { createWardrobeStore } from "../src/editor/wardrobe.js";

const finite = (values) => values.every((v) => Number.isFinite(v));

function assertSound(anatomy, label) {
  const bones = new Set(anatomy.bones.map((b) => b.id));
  assert.ok(anatomy.bones.length <= 64, `${label}: ${anatomy.bones.length} bones`);
  for (const part of anatomy.parts) {
    assert.ok(bones.has(part.bone), `${label}: ${part.id} on unknown bone ${part.bone}`);
    const numbers = [...(part.vertices ?? []), ...(part.position ?? []), ...(part.scale ?? []), ...(part.rotation ?? []), ...(part.colors ?? part.color)];
    assert.ok(finite(numbers), `${label}: ${part.id} has a non-finite number`);
    if (part.skin) for (const pair of part.skin.joints) for (const joint of pair) assert.ok(bones.has(joint), `${label}: ${part.id} skinned to ${joint}`);
    if (part.indices) assert.ok(part.indices.every((i) => i * 3 < part.vertices.length), `${label}: ${part.id} index out of range`);
  }
}

test("the default spec is valid in every field", () => {
  const spec = defaultSpec();
  for (const field of fields) assert.ok(validValue(field, spec[field.key]), field.key);
});

test("normalizing keeps valid values, clamps sliders and drops junk", () => {
  const spec = normalizeSpec({ name: "  Ada   Lovelace ", height: 3, hair: "nope", skin: "#ABCDEF", top: "hoodie" });
  assert.equal(spec.name, "Ada Lovelace");
  assert.equal(spec.height, 1);
  assert.equal(spec.hair, defaultSpec().hair);
  assert.equal(spec.skin, "#abcdef");
  assert.equal(spec.top, "hoodie");
  assert.deepEqual(normalizeSpec(null), defaultSpec());
});

test("every option of every choice builds a sound anatomy", () => {
  for (const field of fields.filter((f) => f.kind === "choice"))
    for (const option of field.options) assertSound(createCharacter({ ...defaultSpec(), [field.key]: option.id }), `${field.key}=${option.id}`);
});

test("slider extremes build sound anatomies", () => {
  for (const value of [0, 1]) {
    const spec = { ...defaultSpec(), ...Object.fromEntries(fields.filter((f) => f.kind === "slider").map((f) => [f.key, value])) };
    assertSound(createCharacter(spec), `all sliders at ${value}`);
  }
});

test("random characters build and stand on the ground, head up", () => {
  for (let k = 0; k < 40; k++) {
    const anatomy = createCharacter(randomSpec({ seed: `test-${k}` }));
    assertSound(anatomy, `seed ${k}`);
    assert.ok(anatomy.rig.height > 1.2 && anatomy.rig.height < 2.2, `height ${anatomy.rig.height}`);
    assert.ok(anatomy.joints.headCentre[1] > anatomy.joints.chest[1]);
  }
});

test("the same seed gives the same character, and locks keep groups", () => {
  assert.deepEqual(randomSpec({ seed: "a" }), randomSpec({ seed: "a" }));
  const base = randomSpec({ seed: "base" });
  const next = randomSpec({ seed: "other", base, keep: ["hair", "body"] });
  for (const field of fields.filter((f) => f.group === "hair" || f.group === "body")) assert.equal(next[field.key], base[field.key], field.key);
  const only = randomSpec({ seed: "other", base, only: "eyes" });
  for (const field of fields.filter((f) => f.group !== "eyes")) assert.equal(only[field.key], base[field.key], field.key);
  assert.equal(only.name, base.name);
});

test("codes round-trip every random character, custom colours and names included", () => {
  for (let k = 0; k < 120; k++) {
    const spec = { ...randomSpec({ seed: `code-${k}` }), topColor: "#123456", name: k % 2 ? "Zoë Ñandú" : "Wren" };
    const back = decodeCharacter(encodeCharacter(spec));
    for (const field of fields) {
      if (field.kind === "slider") assert.ok(Math.abs(back[field.key] - spec[field.key]) < 0.003, field.key);
      else assert.equal(back[field.key], spec[field.key], field.key);
    }
    assert.equal(back.name, spec.name);
  }
  assert.equal(decodeCharacter("hello"), null);
  assert.equal(decodeCharacter("CE1-%%%"), null);
});

test("poses are finite for every expression and gesture, and blinks close the lids", () => {
  const anatomy = createCharacter(defaultSpec());
  for (const expression of Object.keys(expressions))
    for (const gesture of [null, ...gestures])
      for (const time of [0, 0.4, 1.1, 2.7]) {
        const pose = characterPose(anatomy, time, { expression, expressionAt: 0, gesture, gestureAt: 0, look: [1, 1.6, 0.5] });
        for (const [id, bone] of Object.entries(pose.bones)) assert.ok(finite([...bone.rotation, ...(bone.position ?? [])]), `${expression}/${gesture}/${id}`);
      }
  for (const gesture of gestures) assert.ok(gestureLength(gesture) > 0.5, gesture);
  const lids = Array.from({ length: 400 }, (_, k) => characterPose(anatomy, k * 0.02).bones.lidL.rotation[2]);
  assert.ok(Math.min(...lids) < anatomy.rig.lids.open - 0.3, "a blink happens within eight seconds");
  assert.equal(characterPose(anatomy, 3, { still: true }).bones.lidL.rotation[2], anatomy.rig.lids.open);
});

test("a light character carries its prebuilt skin and no parts", () => {
  const light = lightCharacter(createCharacter(defaultSpec()), { bulge: 0.0008 });
  assert.equal(light.parts.length, 0);
  assert.ok(light.prebuilt.data.vertices.length > 1000);
  assert.equal(light.prebuilt.key, JSON.stringify({ bulge: 0.0008 }));
});

test("editor history makes one step of a slider drag and undoes it", () => {
  const state = createEditorState(defaultSpec());
  state.update({ height: 0.6 }, { commit: false });
  state.update({ height: 0.7 }, { commit: false });
  state.update({ height: 0.8 }, { commit: true });
  state.update({ hair: "afro" });
  state.undo();
  assert.equal(state.spec.hair, defaultSpec().hair);
  assert.equal(state.spec.height, 0.8);
  state.undo();
  assert.equal(state.spec.height, defaultSpec().height);
  assert.ok(!state.canUndo());
  state.redo();
  assert.equal(state.spec.height, 0.8);
  state.update({ name: "Kit" });
  assert.ok(!state.canRedo());
});

test("the wardrobe saves, updates in place and removes", () => {
  const memory = new Map();
  const storage = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => memory.set(k, v) };
  const store = createWardrobeStore(storage);
  const id = store.save({ ...defaultSpec(), name: "One" }, "");
  store.save({ ...defaultSpec(), name: "Two" }, "");
  store.save({ ...defaultSpec(), name: "One again" }, "", id);
  assert.deepEqual(store.list().map((s) => s.spec.name), ["One again", "Two"]);
  store.remove(id);
  assert.deepEqual(store.list().map((s) => s.spec.name), ["Two"]);
});

test("fields hidden for a spec are the colours of what is not worn", () => {
  const spec = { ...defaultSpec(), hat: "none", top: "dress" };
  assert.equal(fieldShown(fields.find((f) => f.key === "hatColor"), spec), false);
  assert.equal(fieldShown(fields.find((f) => f.key === "bottom"), spec), false);
});
