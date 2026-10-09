import { createRaceSim, recordingHz, simulationHz } from "./raceSim.js";
import { createOwnerPilot } from "./ownerPilot.js";
import { createDirector } from "../camera/createDirector.js";
import { LOOKAHEAD } from "../camera/raceIndex.js";

/** Seconds the forked sim runs past the race on screen, and the least it may lead by when the director is rebuilt. */
const AHEAD = LOOKAHEAD + 2,
  READY = LOOKAHEAD + 1.5;
const CHECK_EVERY = 120;

const stepOf = (sim) => Math.round(sim.t * simulationHz);

/**
 * A race flown live at `simulationHz` with the owner's racer on a `createOwnerPilot`: on Autopilot
 * until the owner takes the reins, flying their commands until they hand back. The sim and the
 * owner's input log (`ride.log`, appended in place) are the race, so it replays exactly from the seed.
 * The director needs to see 3 s ahead, so on Autopilot a forked sim replays the log and runs ahead
 * assuming Autopilot from there. Taking the reins restarts the fork if it ran past the live sim, and
 * while riding it replays the log from the seed a little at a time, never past the live sim's step,
 * the last one whose inputs are final; on the hand-back it only has to run ahead again. A race
 * resumed at `step` replays to it and opens on Autopilot.
 * @param {{ seed: string | number, course: object, roster: object[], ride: import("./simulateRace.js").Ride, step?: number }} options
 */
export function createLiveRace({ seed, course, roster, ride, step = 0 }) {
  const owner = createOwnerPilot({ log: ride.log });
  const main = createRaceSim({ seed, course, roster, pilots: { [ride.racer]: owner.pilot } });
  while (!main.done && stepOf(main) < step) main.step();
  owner.reins(false);
  let fork = null,
    director = null,
    final = -Infinity;

  function startFork() {
    fork = createRaceSim({ seed, course, roster, pilots: { [ride.racer]: createOwnerPilot({ log: ride.log }).pilot } });
    director = null;
    final = -Infinity;
  }
  startFork();

  /** Whether the race on screen comes from the fork, which the director has planned. */
  const broadcasting = () => !owner.riding && director !== null;

  /** Steps the fork while `more()` holds, spending at most `budget` ms. */
  function stepFork(budget, more) {
    const until = performance.now() + budget;
    for (let n = 1; !fork.done && more(); n++) {
      fork.step();
      if (n % CHECK_EVERY === 0 && performance.now() > until) break;
    }
  }

  return {
    /** The recording on screen: the fork's on Autopilot once its director is ready, else the live sim's. */
    get recording() {
      return broadcasting() ? fork.recording : main.recording;
    },
    /** The director over the fork's recording, or null while riding or while the fork catches up after a hand-back. */
    get director() {
      return broadcasting() ? director : null;
    },
    /** How far the fork has caught up after a hand-back, 0 to 1, or null while broadcasting or riding. */
    get catchingUp() {
      if (owner.riding || director) return null;
      return Math.min(1, fork.t / (main.t + READY));
    },
    /** Whether the owner holds the reins. */
    get riding() {
      return owner.riding;
    },
    /** The rider pilot's state while riding, for the controls. */
    get state() {
      return owner.state;
    },
    /** The live sim's step, where a resumed race picks up. */
    get step() {
      return stepOf(main);
    },
    /** Whether the recording on screen is complete. */
    get done() {
      return broadcasting() ? fork.done : main.done;
    },
    /**
     * Steps the race on to race time `t`, a frame past it so the screen can sample it, and on
     * Autopilot the fork up to `AHEAD` seconds further (while riding, up to the live sim), spending at
     * most `budget` ms on the fork; the director is rebuilt from the fork whenever `t` passes the last
     * cut it planned for good.
     */
    advance(t, budget = 6) {
      while (!main.done && main.t < t + 1 / recordingHz) main.step();
      if (owner.riding) return stepFork(budget, () => stepOf(fork) < stepOf(main));
      stepFork(budget, () => fork.t < t + AHEAD);
      const ahead = fork.done || fork.t >= t + READY;
      if (ahead && fork.t >= main.t && (!director || t > final)) {
        director = createDirector(fork.recording, course);
        final = fork.done ? Infinity : fork.t - LOOKAHEAD;
      }
    },
    /** Takes the reins (`true`) or hands back to Autopilot (`false`) at the next step. */
    reins(on) {
      if (on === owner.riding) return;
      owner.reins(on);
      if (on && stepOf(fork) > stepOf(main)) startFork();
      director = null;
    },
    /** Hands the dragon a rider command while riding. */
    give(command) {
      owner.give(command);
    },
    /** Hands back if riding and flies the rest of the race on Autopilot at once; returns the finished recording. */
    complete() {
      const sim = owner.riding ? main : fork;
      owner.reins(false);
      while (!sim.done) sim.step();
      return sim.recording;
    },
  };
}
