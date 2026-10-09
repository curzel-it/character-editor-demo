import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { fieldCourse } from "../src/fieldCourse.js";
import { raceRoster } from "../src/raceField.js";
import { simulateRace } from "../src/race/simulateRace.js";
import { createLiveRace } from "../src/race/liveRace.js";
import { simulationHz } from "../src/race/raceSim.js";
import { advanceStable } from "../src/stable/advanceStable.js";
import { summariseAway } from "../src/stable/awaySummary.js";
import { liveRaceOf, startLeagueRace } from "../src/stable/leagueRace.js";
import { onAirBlock } from "../src/stable/onAir.js";
import { finishUnwatchedRaces, leaveLiveRace, liveStep, rejoinLiveRace, settleUnwatched, unwatchedFinish } from "../src/stable/unwatchedRace.js";

const hour = 3_600_000;
const msPerStep = 1000 / simulationHz;

/** A kid league race on air, left at `step` an hour in, with the race it flies. */
function leftRace(seed, step = 600) {
  const stable = stockedStable(genes, seed, 0);
  const kid = stable.dragons.find((w) => w.age === "kid");
  const live = startLeagueRace(stable, "kids", kid.id, hour);
  const race = { seed: live.field.raceSeed, course: fieldCourse(live.field), roster: raceRoster(live.field) };
  leaveLiveRace(stable, "kids", step, hour);
  return { stable, kid, live, race };
}

test("a race left on air flies on by itself and is recorded at its finish, as watching it on Autopilot would", () => {
  const { stable, kid, live, race } = leftRace("unwatched");
  assert.equal(unwatchedFinish(live), null, "no finish until it is worked out");
  assert.deepEqual(finishUnwatchedRaces(stable, 100 * hour), [], "nor recorded");
  assert.equal(liveStep(live, hour + 10_000), 600 + 10 * simulationHz, "it keeps flying in game time");

  const recording = simulateRace({ ...race, ride: live.ride });
  settleUnwatched(live, recording);
  const end = unwatchedFinish(live);
  assert.equal(end, hour + (Math.round(recording.duration * simulationHz) - 600) * msPerStep);
  assert.equal(liveStep(live, end + hour), live.end.step, "never past its finish");
  assert.deepEqual(finishUnwatchedRaces(stable, end - 1), [], "still on air a moment before the finish");
  assert.equal(onAirBlock(stable, kid.id), "onAir");

  const watched = createLiveRace({ ...race, ride: structuredClone(live.ride), step: 600 }).complete();
  const [event] = finishUnwatchedRaces(stable, end);
  assert.deepEqual(event, { type: "raced", id: kid.id, league: "kids", season: 1, race: 0, left: hour });
  assert.equal(liveRaceOf(stable, "kids"), null);
  assert.equal(onAirBlock(stable, kid.id), null, "no longer on air");
  const [recorded] = stable.leagues.kids.races;
  assert.equal(recorded.at, end, "recorded at its finish");
  assert.deepEqual(
    recorded.results.map(({ id, place, time }) => ({ id, place, time })),
    watched.results.map(({ id, place, time }) => ({ id, place, time })),
    "the same results as the race watched to the end",
  );
  assert.equal(kid.record.starts, 1);
  assert.equal(kid.history[0].place, recorded.results.find((r) => r.id === kid.id).place);
});

test("advancing the stable records a finished unwatched race first and the away summary leads with it", () => {
  const { stable, kid, live, race } = leftRace("unwatched-away");
  settleUnwatched(live, simulateRace({ ...race, ride: live.ride }));
  const events = advanceStable(stable, hour, 2 * hour);
  assert.equal(events[0].type, "raced");
  const [entry] = summariseAway(stable, events);
  assert.deepEqual(entry, { type: "raced", id: kid.id, league: "kids", season: 1, race: 0 });
  assert.deepEqual(advanceStable(stable, hour, 3 * hour).filter((e) => e.type === "raced"), [], "recorded once");

  stable.leagues.kids.number = 2;
  assert.ok(!summariseAway(stable, events).some((e) => e.type === "raced"), "a race of a season that moved on drops out");
});

test("rejoining a race left on air picks it up where it has flown to, and it waits for the owner again", () => {
  const { stable, live, race } = leftRace("unwatched-rejoin");
  settleUnwatched(live, simulateRace({ ...race, ride: live.ride }));
  const back = rejoinLiveRace(stable, "kids", hour + 30_000);
  assert.equal(back, live);
  assert.equal(live.step, 600 + 30 * simulationHz);
  assert.equal(live.left, undefined);
  assert.equal(live.end, undefined);
  assert.deepEqual(finishUnwatchedRaces(stable, 100 * hour), [], "a watched race finishes only on screen");
  assert.equal(rejoinLiveRace(stockedStable(genes, "none", 0), "kids", hour), null);
});

test("leaving while riding hands the reins back, so the rest flies on Autopilot", () => {
  const stable = stockedStable(genes, "unwatched-ride", 0);
  const kid = stable.dragons.find((w) => w.age === "kid");
  const live = startLeagueRace(stable, "kids", kid.id, hour);
  live.ride.log.push([300, "r", 1], [304, "s", 0.5, 0]);
  leaveLiveRace(stable, "kids", 400, hour);
  assert.deepEqual(live.ride.log.at(-1), [401, "r", 0]);
  leaveLiveRace(stable, "kids", 500, 2 * hour);
  assert.equal(live.ride.log.length, 3, "handed back once");
  assert.equal(live.left, 2 * hour);
});
