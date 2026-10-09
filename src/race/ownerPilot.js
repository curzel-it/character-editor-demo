import { decide } from "./pilot.js";
import { createRiderPilot } from "./riderPilot.js";
import { simulationHz } from "./raceSim.js";

const STICK_STEP = 0.05;
const STICK_STRIDE = 4;
const codes = { reins: "r", stick: "s", breath: "f" };
const types = Object.fromEntries(Object.entries(codes).map(([type, code]) => [code, type]));
const quantise = (v) => Math.round(Math.round(Math.max(-1, Math.min(1, v)) / STICK_STEP) * STICK_STEP * 100) / 100;

/**
 * One entry of a ride's input log, stamped with the simulation step it takes effect on:
 * `[step, "r", 1 | 0]` takes or hands back the reins, `[step, "s", x, y]` moves the stick and
 * `[step, "f"]` breathes.
 * @typedef {[number, string, ...number[]]} RideInput
 */

/** The command an input log entry stands for. */
export function inputCommand([, code, a, b]) {
  const type = types[code];
  if (type === "stick") return { type, x: a, y: b };
  if (type === "breath") return { type };
  return { type, on: a === 1 };
}

/**
 * A pilot for the owner's racer that flies on Autopilot (the racer AI's `decide`) until the owner
 * takes the reins, then flies their commands through `createRiderPilot`, until they hand back.
 * Everything the owner does goes into `log`, stamped with the next simulation step (the stick with
 * the next one of every `STICK_STRIDE`, so a busy thumb logs at most 15 moves a second), and a pilot
 * made with an earlier `log` replays it step for step, so the seed and the log give the same race.
 * The pilot function carries `autopilot`, which tells the racer AI's breath attacks to go on.
 * @param {{ log?: RideInput[] }} options
 */
export function createOwnerPilot({ log = [] } = {}) {
  let cursor = 0,
    lastStep = 0,
    rider = null,
    stick = null;

  function apply(entry, t) {
    const command = inputCommand(entry);
    if (command.type === "reins") {
      rider = command.on ? createRiderPilot({ from: t - 1 / simulationHz }) : null;
      stick = null;
    } else rider?.give(command);
  }

  const pilot = (racer, ctx) => {
    lastStep = Math.round(ctx.t * simulationHz);
    while (cursor < log.length && log[cursor][0] <= lastStep) apply(log[cursor++], ctx.t);
    return rider ? rider.pilot(racer, ctx) : decide(racer, ctx);
  };
  Object.defineProperty(pilot, "autopilot", { get: () => !rider });

  /** The reins as the log leaves them, counting entries not flown yet. */
  const riding = () => {
    for (let i = log.length - 1; i >= 0; i--) if (log[i][1] === codes.reins) return log[i][2] === 1;
    return false;
  };

  /** The step a command given now takes effect on, never before the last one logged. */
  const nextStep = (stride = 1) => Math.max(Math.ceil((lastStep + 1) / stride) * stride, log.at(-1)?.[0] ?? 0);

  return {
    pilot,
    log,
    /** Whether the owner holds the reins, or will at the next step. */
    get riding() {
      return riding();
    },
    /** The rider pilot's `state` while riding (the stick and the breath's recharge), else null. */
    get state() {
      return rider?.state ?? null;
    },
    /** Takes the reins (`true`) or hands back to Autopilot (`false`) at the next step. */
    reins(on) {
      if (on === riding()) return;
      log.push([nextStep(), codes.reins, on ? 1 : 0]);
      stick = null;
    },
    /** Hands the dragon a `RiderCommand` at the next step while riding; the stick moves in steps of 0.05, every `STICK_STRIDE` steps. */
    give(command) {
      if (!riding() || !codes[command.type] || command.type === "reins") return;
      const step = nextStep(command.type === "stick" ? STICK_STRIDE : 1);
      if (command.type === "stick") {
        const x = quantise(command.x),
          y = quantise(command.y);
        if (stick && stick[0] === x && stick[1] === y) return;
        stick = [x, y];
        const last = log.at(-1);
        if (last?.[0] === step && last[1] === codes.stick) log.pop();
        log.push([step, codes.stick, x, y]);
      } else log.push([step, codes.breath]);
    },
  };
}
