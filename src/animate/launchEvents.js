import { smoothstep } from "./flightMotion.js";

const launches = new WeakMap();
const CROUCH = 0.35,
  RISE = 0.45;

/** The recording's `launch` events by racer id, cached per recording until a live one records more events. */
export function launchesOf(recording) {
  let cached = launches.get(recording);
  if (cached?.count !== recording.events.length) {
    cached = {
      count: recording.events.length,
      byRacer: new Map(recording.events.filter((e) => e.type === "launch").map((e) => [e.racer, e])),
    };
    launches.set(recording, cached);
  }
  return cached.byRacer;
}

/**
 * Takeoff motion for a sampled racer at race time t: standing on the grid, a crouch just before the
 * jump, then `stand` easing out as the wings take over.
 * @returns {{ stand: number, impact: number }}
 */
export function launchFromEvents(recording, racer, t) {
  const launch = launchesOf(recording).get(racer.id);
  if (!launch) return { stand: racer.grounded && !racer.finished ? 1 : 0, impact: 0 };
  const age = t - launch.t;
  if (age < 0) return { stand: 1, impact: smoothstep(-CROUCH, 0, age) };
  return { stand: 1 - smoothstep(0, RISE, age), impact: 0 };
}
