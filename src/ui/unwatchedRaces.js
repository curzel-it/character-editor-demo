import { fieldCourse } from "../fieldCourse.js";
import { createRaceSim } from "../race/raceSim.js";
import { ridePilots } from "../race/simulateRace.js";
import { raceRoster } from "../raceField.js";
import { settleUnwatched } from "../stable/unwatchedRace.js";

const SLICE = 12;

/**
 * Works out the finish of every race left on air in the background, a few ms at a time so the
 * screens stay smooth: the whole race replayed from its seed and the owner's log, on Autopilot
 * after it, kept with `settleUnwatched`. `kick()` starts on any race left without one, and a race
 * rejoined or left again meanwhile is dropped and started over.
 * @param {{ stable: any }} game
 */
export function createUnwatchedRaces(game) {
  let job = null;

  function next() {
    for (const season of Object.values(game.stable.leagues ?? {})) {
      const live = season?.live;
      if (live && live.left != null && !live.end) return live;
    }
    return null;
  }

  function work() {
    const { live, left, sim } = job;
    if (live.left !== left || live.end) return (job = null), kick();
    const until = performance.now() + SLICE;
    while (!sim.done && performance.now() < until) for (let n = 0; n < 30 && !sim.done; n++) sim.step();
    if (!sim.done) return void setTimeout(work);
    settleUnwatched(live, sim.recording);
    job = null;
    kick();
  }

  function kick() {
    if (job) return;
    const live = next();
    if (!live) return;
    const { field, ride } = live;
    job = { live, left: live.left, sim: createRaceSim({ seed: field.raceSeed, course: fieldCourse(field), roster: raceRoster(field), pilots: ridePilots(ride) }) };
    setTimeout(work);
  }

  return { kick };
}
