import { createRaceSim } from "./raceSim.js";
import { createOwnerPilot } from "./ownerPilot.js";

/**
 * The owner's part in a race: the `racer` they ride and the `log` of their inputs.
 * @typedef {{ racer: string, log: import("./ownerPilot.js").RideInput[] }} Ride
 */

/** The pilots of a race with `ride`: the owner's pilot replaying its log, or none. */
export const ridePilots = (/** @type {Ride | null} */ ride) =>
  ride ? { [ride.racer]: createOwnerPilot({ log: ride.log.slice() }).pilot } : {};

/** Simulates a whole race from its seed, with the owner's `ride` when there is one, and returns the finished recording. */
export function simulateRace({ seed, course, roster, ride = null }) {
  const sim = createRaceSim({ seed, course, roster, pilots: ridePilots(ride) });
  while (!sim.done) sim.step();
  return sim.recording;
}
