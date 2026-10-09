import test from "node:test";
import assert from "node:assert/strict";
import { careAlarm } from "../src/stable/awaySummary.js";
import { freshCare } from "../src/stable/care.js";
import { createEgg } from "../src/stable/egg.js";
import { careCap, extraCap, missedAfter, planReminders, quietFrom, quietTo, reminderMoments } from "../src/stable/reminderPlan.js";

process.env.TZ = "UTC";
const hour = 3_600_000;
const dragon = (id, age, care = {}, bond = 0.5) => ({ id, name: id, age, care: { ...freshCare(), ...care }, bond, fatigue: 0, growth: 0 });
const stableOf = (dragons, eggs = []) => ({ dragons, eggs, wild: [], clock: { speed: 1, game: 0 } });
/** 10:00 UTC on a weekday. */
const morning = Date.UTC(2026, 9, 7, 10);

test("every need of every dragon is a moment where it drops below the alarm, at once when it already has", () => {
  const moments = reminderMoments(stableOf([dragon("Ember", "teen", { happiness: 10 })]), morning);
  const at = (need) => moments.find((m) => m.need === need).at - morning;
  assert.equal(at("happiness"), 0);
  assert.equal(at("fullness"), Math.round(((100 - careAlarm) / 12) * 60) * 60_000);
  assert.ok(at("exercise") > 0);
  assert.equal(moments.some((m) => m.need === "affection"), false);
});

test("eggs are moments when they can be warmed and when they hatch, and the dearest dragon misses the owner after a week", () => {
  const egg = createEgg(1, 0);
  const moments = reminderMoments(stableOf([dragon("Ember", "adult", {}, 0.2), dragon("Ash", "adult", {}, 0.9)], [egg]), morning);
  assert.deepEqual(moments.find((m) => m.kind === "warm"), { kind: "warm", id: egg.id, at: morning });
  assert.equal(moments.find((m) => m.kind === "hatch").at, morning + 8 * hour);
  assert.deepEqual(moments.find((m) => m.kind === "missed"), { kind: "missed", id: "Ash", name: "Ash", at: morning + missedAfter });
});

test("reminders stay out of the quiet hours, apart and within the day's cap, and carry everything due", () => {
  const dragons = ["Ember", "Ash", "Moss", "Pip"].map((id, i) => dragon(id, "adult", { fullness: 40 + i * 15, cleanliness: 35 + i * 10 }));
  const stable = stableOf(dragons, [createEgg(2, 0)]);
  const evening = Date.UTC(2026, 9, 7, 20, 7);
  const plan = planReminders(stable, evening);
  const moments = reminderMoments(stable, Date.UTC(2026, 9, 7, 20));
  assert.equal(plan.flatMap((r) => r.moments).length, moments.length);
  assert.ok(plan[0].at >= evening + 45 * 60_000);
  const perDay = new Map();
  plan.forEach((r, i) => {
    const h = new Date(r.at).getUTCHours();
    assert.ok(h >= quietTo && h < quietFrom, `reminder ${i} at ${new Date(r.at).toISOString()}`);
    if (i) assert.ok(r.at - plan[i - 1].at >= 4 * hour);
    for (const m of r.moments) assert.ok(m.at <= r.at + hour);
    const day = new Date(r.at).toDateString();
    perDay.set(day, [...(perDay.get(day) ?? []), r]);
  });
  for (const day of perDay.values()) {
    const extra = day.some((r) => r.moments.some((m) => m.kind === "hatch" || m.kind === "missed"));
    assert.ok(day.length <= (extra ? extraCap : careCap));
  }
  assert.equal(plan.at(-1).moments.at(-1).kind, "missed");
});

test("a plan made a few minutes later is the same plan", () => {
  const stable = stableOf([dragon("Ember", "adult", { fullness: 50 })]);
  const later = Date.UTC(2026, 9, 7, 10, 14);
  assert.deepEqual(planReminders(stable, morning), planReminders(stable, later));
});

test("the app gets the plan in words once per change, and nothing when reminders are off", async () => {
  const posted = [];
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v), removeItem: (k) => store.delete(k) };
  globalThis.DragonzNotifications = { post: (json) => posted.push(JSON.parse(json)) };
  const { reminderBody, scheduleReminders, setRemindersOn } = await import("../src/needNotifications.js");
  const stable = stableOf([dragon("Ember", "kid", { fullness: 20 }), dragon("Ash", "kid", { cleanliness: 20 })]);
  scheduleReminders(stable, morning);
  scheduleReminders(stable, morning + 60_000);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].reminders[0].body, "Ember is hungry! Ash needs you too.");
  assert.equal(posted[0].reminders[0].at, morning + hour);
  setRemindersOn(false);
  scheduleReminders(stable, morning);
  assert.deepEqual(posted.at(-1), { type: "schedule", reminders: [] });
  setRemindersOn(true);
  assert.equal(posted.at(-1).type, "ask");
  delete globalThis.DragonzNotifications;
  delete globalThis.localStorage;
  const egg = { kind: "hatch", at: 0 };
  assert.equal(reminderBody([{ kind: "warm", at: 0 }, egg]), "Your egg is ready to hatch!");
  const need = (name, at) => ({ kind: "need", need: "fullness", name, at });
  assert.equal(reminderBody([need("A", 0), need("B", 1), need("C", 2), need("D", 3)]), "A is hungry! B and 2 more need you too.");
});
