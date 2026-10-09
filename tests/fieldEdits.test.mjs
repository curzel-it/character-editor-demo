import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { defaultField, fieldLimits } from "../src/raceField.js";
import { racerName } from "../src/racerName.js";
import { addParticipant, fieldAge, moveParticipant, removeParticipant, reseedParticipant, setFieldAge, shuffleGrid, withSilkColor } from "../src/fieldEdits.js";

const module = { genes };

test("The exhibition field keeps between its limits and new dragons join at the shared age", () => {
  const field = defaultField(module, "7", fieldLimits.max - 1);
  setFieldAge(field, "kid");
  assert.equal(fieldAge(field), "kid");
  const added = addParticipant(module, field);
  assert.equal(added.age, "kid");
  assert.equal(new Set(field.participants.map((p) => p.id)).size, field.participants.length);
  assert.equal(addParticipant(module, field), null);
  field.participants[0].age = "teen";
  assert.equal(fieldAge(field), null);

  const small = defaultField(module, "7", fieldLimits.min);
  assert.equal(removeParticipant(small, 0), false);
  assert.equal(small.participants.length, fieldLimits.min);
});

test("Grid moves and shuffles keep every participant", () => {
  const field = defaultField(module, "3", 6);
  const ids = field.participants.map((p) => p.id);
  assert.ok(moveParticipant(field, 0, 2));
  assert.deepEqual(field.participants.map((p) => p.id), [ids[1], ids[2], ids[0], ...ids.slice(3)]);
  assert.equal(moveParticipant(field, 0, -1), false);
  shuffleGrid(field, 1);
  assert.deepEqual(field.participants.map((p) => p.id).sort(), [...ids].sort());
});

test("Reseeding follows a seed-derived name and keeps a chosen one", () => {
  const [p, q] = defaultField(module, "5", 2).participants;
  reseedParticipant(module, p, "42");
  assert.equal(p.seed, "42");
  assert.equal(p.name, racerName("42"));
  q.name = "Custom";
  reseedParticipant(module, q, "43");
  assert.equal(q.name, "Custom");
});

test("Silk colours drop from an emptied slot onwards", () => {
  const silks = { pattern: "plain", colors: ["red", "blue", "gold"] };
  assert.deepEqual(withSilkColor(silks, 1, "green").colors, ["red", "green", "gold"]);
  assert.deepEqual(withSilkColor(silks, 2, "").colors, ["red", "blue"]);
  assert.deepEqual(silks.colors, ["red", "blue", "gold"]);
});
