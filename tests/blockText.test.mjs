import test from "node:test";
import assert from "node:assert/strict";
import { setLanguage } from "../src/i18n.js";
import { blockText, injuryName } from "../src/ui/blockText.js";
import { ordinal } from "../src/ordinal.js";
import { ordinal as shotOrdinal } from "../src/camera/shotTypes.js";
import { unfitReason } from "../src/stable/condition.js";
import { lockedText } from "../src/ui/leagueLook.js";
import { outcomeText } from "../src/ui/seasonOutcome.js";

test("unfitReason gives a code for each way a dragon cannot race", () => {
  assert.equal(unfitReason({ fatigue: 0, injury: null }), null);
  assert.equal(unfitReason({ fatigue: 0.5, injury: null }), "tired");
  assert.equal(unfitReason({ fatigue: 0, injury: { id: "wing" } }), "injury.wing");
});

test("blocks read in the current language, nested reasons included", () => {
  setLanguage("en");
  assert.equal(blockText(null), "");
  assert.equal(blockText("tired"), "Tired");
  assert.equal(blockText({ code: "ritual.unfit", name: "Ada", reason: "injury.leg" }), "Ada: Sore leg");
  assert.equal(injuryName({ id: "membrane" }), "Torn membrane");
  setLanguage("it");
  assert.equal(blockText("wild.onTheWay"), "Sta già tornando a casa");
  assert.equal(blockText({ code: "ritual.unfit", name: "Ada", reason: "tired" }), "Ada: Stanco");
  setLanguage("en");
});

test("ordinals follow the language, in the camera's vocabulary too", () => {
  setLanguage("en");
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st"]);
  assert.equal(shotOrdinal(2), "2nd");
  setLanguage("it");
  assert.deepEqual([1, 2, 11].map(ordinal), ["1º", "2º", "11º"]);
  assert.equal(shotOrdinal(3), "3º");
  setLanguage("en");
});

test("locked leagues and season outcomes read in Italian", () => {
  setLanguage("it");
  assert.match(lockedText({ dragons: [{ age: "kid" }] }, "adults"), /troppo piccoli.*gli adulti/);
  assert.match(lockedText({ dragons: [] }, "kids"), /schiudere un uovo/);
  assert.equal(outcomeText({ division: "bronze", next: "silver", outcome: "promoted", owner: { name: "Ember", rank: 1 } }), "La tua scuderia ha chiuso 1º: promozione in Argento!");
  setLanguage("en");
  assert.equal(outcomeText({ division: "bronze", next: "silver", outcome: "promoted", owner: { name: "Ember", rank: 1 } }), "Your stable finished 1st: promoted to Silver!");
});
