import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { loadSubject } from "../src/subjects.js";
import { stockedStable } from "./stableHelpers.mjs";
import { runLeagueRace } from "../src/stable/leagueRace.js";
import { buildRace, raceKey } from "../src/race/buildRace.js";
import { commentaryAt } from "../src/race/commentary.js";
import { commentaryLine } from "../src/ui/commentaryLine.js";
import { setLanguage } from "../src/i18n.js";
import { raceShot } from "../src/camera/raceShot.js";
import { findLeagueRace } from "../src/ui/findLeagueRace.js";
import { ordinal } from "../src/ordinal.js";

const hour = 3_600_000;
const module = await loadSubject("dragon");
const stable = stockedStable(genes, "broadcast", 0);
const kid = stable.dragons.find((w) => w.age === "kid");
const run = runLeagueRace(stable, "kids", kid.id, hour);
const race = buildRace(module, run.race.field);

test("Ordinals read as places", () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st"]);
});

test("A stored league race replays to the same result and is found by league and index", () => {
  assert.deepEqual(
    race.recording.results.map(({ id, place }) => [id, place]),
    run.race.results.map(({ id, place }) => [id, place]),
  );
  assert.equal(raceKey(run.race.field), raceKey(structuredClone(run.race.field)));
  assert.equal(findLeagueRace(stable, "kids", 1, 0).race, run.race);
  assert.equal(findLeagueRace(stable, "kids", 1, 1), null);
  assert.equal(findLeagueRace(stable, "nowhere", 1, 0), null);
  assert.equal(findLeagueRace(stable, "kids", 1, Number("x")), null);
});

test("The broadcast cameras frame the race from the director, the saddle and a frozen shot", () => {
  const t = race.recording.duration / 2;
  const director = raceShot(race, t, {});
  assert.ok(director.shot.eye.every(Number.isFinite));
  const rider = raceShot(race, t, { camera: "rider", rider: kid.id });
  assert.equal(rider.shot.shot, "rider");
  assert.equal(rider.shot.subject, kid.id);
  assert.ok(rider.previous, "an onboard shot never cuts, so it has a previous frame");
  const fixed = { eye: [0, 1, 0], target: [0, 0, 0] };
  assert.equal(raceShot(race, t, { fixed }).shot, fixed);
});

test("The commentator calls the start, the owner's dragon and the winner, in English and Italian", () => {
  setLanguage("en");
  const names = new Map(run.race.field.participants.map((p) => [p.id, p.name]));
  const owned = new Set([kid.id]);
  const say = (t, options) => {
    const line = commentaryAt(race.recording, t, options);
    return line && commentaryLine(line.event, names);
  };
  assert.match(say(0, { owned, place: "valley" }), /off into the valley/);
  const winner = run.race.results.find((r) => r.place === 1);
  assert.equal(say(winner.time + 0.01, {}), `${winner.name} wins it!`);
  assert.equal(say(-4.4, {}), `${race.recording.roster.length} dragons line up on the grid…`);
  const shaped = race.recording.roster.filter((e) => e.form !== "usual");
  const opening = new Set();
  for (let t = -4.4; t < 0; t += 0.1) opening.add(say(t, {}));
  for (const e of shaped.slice(0, 3)) assert.ok([...opening].some((line) => line.includes(e.name) && /shape|off/.test(line)), `${e.name} is in ${e.form} form`);
  const lines = new Set();
  for (let t = 0; t < race.recording.duration; t += 1) {
    const line = say(t, { owned });
    assert.ok(!line?.includes("commentaryLine"), line);
    if (line) lines.add(line);
  }
  assert.ok(lines.size > 5, "the commentary moves on through the race");
  setLanguage("it");
  assert.equal(say(winner.time + 0.01, {}), `${winner.name} vince!`);
  assert.match(say(0, { owned, place: "canyon" }), /dentro il canyon/);
  setLanguage("en");
});
