import { smoothstep } from "./flightMotion.js";

const touchdowns = new WeakMap();

/** The recording's `land` events by racer id, cached per recording until a live one records more events. */
export function landingsOf(recording) {
  let cached = touchdowns.get(recording);
  if (cached?.count !== recording.events.length) {
    cached = {
      count: recording.events.length,
      byRacer: new Map(recording.events.filter((e) => e.type === "land").map((e) => [e.racer, e])),
    };
    touchdowns.set(recording, cached);
  }
  return cached.byRacer;
}

/**
 * Landing motion for a sampled racer at race time t: the flare as the approach ends (from the
 * recorded `landing` progress), then `stand` easing in from touchdown with an `impact` crouch.
 * @returns {{ flare: number, stand: number, impact: number }}
 */
export function landingFromEvents(recording, racer, t) {
  const land = landingsOf(recording).get(racer.id);
  const age = land ? t - land.t : -Infinity;
  const stand = age >= 0 ? smoothstep(0, 1.3, age) : 0;
  const impact = age < 0 ? 0 : age < 0.08 ? age / 0.08 : Math.exp(-(age - 0.08) / 0.28);
  const flare = smoothstep(0.7, 0.96, racer.landing ?? 0) * (1 - stand);
  return { flare, stand, impact };
}
