import test from "node:test";
import assert from "node:assert/strict";
import { faceOf } from "../src/ui/dragonFace.js";
import { expressionOf } from "../src/animate/dragonExpression.js";
import { freshCare } from "../src/stable/care.js";

test("A looked after dragon idles with open eyes, a hungry one heavy-lidded and an unhappy one glum", () => {
  const dragon = (care) => ({ age: "adult", care: { ...freshCare(), ...care } });
  assert.deepEqual(faceOf(dragon({})), { glum: 0, weary: 0, bored: 0 });
  const hungry = faceOf(dragon({ fullness: 5 }));
  assert.ok(hungry.weary > hungry.glum && hungry.glum > 0);
  assert.ok(faceOf(dragon({ fullness: 25 })).weary < hungry.weary);
  assert.equal(faceOf(dragon({ happiness: 0 })).glum, 1);
  assert.equal(faceOf(dragon({ happiness: 45 })).bored, 0);
  assert.ok(faceOf(dragon({ happiness: 35 })).bored > 0 && faceOf(dragon({ happiness: 35 })).glum === 0);
  assert.equal(faceOf(dragon({ happiness: 10 })).bored, 1);
  assert.deepEqual(faceOf({ age: "kid", care: { ...freshCare(), affection: 0 } }), { glum: 0, weary: 0, bored: 0 });
});

test("Moods lower the lids within their travel and the sad ones drop the gaze", () => {
  assert.deepEqual(expressionOf({}), { upper: 0, lower: 0, tilt: 0, down: 0 });
  const glum = expressionOf({ glum: 1 }), glee = expressionOf({ glee: 1 });
  assert.ok(glum.tilt > 0 && glum.down > 0 && glum.upper > glum.lower);
  assert.ok(glee.lower > glee.upper && glee.down === 0);
  const all = expressionOf({ glum: 5, weary: 1, glee: 1 });
  for (const key of ["upper", "lower", "tilt", "down"]) assert.ok(Math.abs(all[key]) <= 1);
});
