import { createOwnerPilot } from "../../src/race/ownerPilot.js";
import { breathTarget } from "../../src/race/breathAttacks.js";

const clamp = (v) => Math.max(-1, Math.min(1, v));
/** How long before a gate a loose steerer nudges towards it, and how far it moves the stick. */
const loose = { window: 3, stick: 0.6 };

/**
 * A scripted rider for batch runs: takes the reins at the start. With `steer` at `gates` the stick
 * aims at each gate's centre all the time, at `loose` it nudges towards the gate's centre for the
 * last `loose.window` seconds when the dragon is more than half a radius off it, and at `none` it is
 * left alone and the dragon flies the racer AI's line. With `breath` at `smart` it breathes whenever
 * the breath is ready and a rival it is not weak against is in reach, at `none` never.
 * Returns a pilot for `createRaceSim` and the input log.
 * @param {{ steer?: "none" | "gates" | "loose", breath?: "smart" | "none" }} options
 */
export function createScriptedRider({ steer = "none", breath = "smart" } = {}) {
  const owner = createOwnerPilot();
  owner.reins(true);
  const pilot = (racer, ctx) => {
    const gate = ctx.gates[racer.gate];
    if (gate && steer !== "none") {
      const x = clamp((gate.u - racer.u) / gate.radius),
        y = clamp((gate.y - racer.y) / (2 * gate.radius));
      const near = (gate.s - racer.s) / Math.max(racer.v, 1) < loose.window && Math.hypot(gate.u - racer.u, gate.y - racer.y) > gate.radius / 2;
      if (steer === "gates") owner.give({ type: "stick", x, y });
      else owner.give(near ? { type: "stick", x: x * loose.stick, y: y * loose.stick } : { type: "stick", x: 0, y: 0 });
    }
    if (breath === "smart" && ctx.t >= (racer.breathReady ?? Infinity) && (breathTarget(racer, ctx.racers)?.matchup ?? 0) >= 1) owner.give({ type: "breath" });
    return owner.pilot(racer, ctx);
  };
  return { pilot, log: owner.log };
}
