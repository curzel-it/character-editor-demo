import { makeRng } from "../rng.js";
import { froude } from "./froude.js";
import { breathOf, matchup } from "../breath/breathElements.js";
import { breathLength } from "../breath/breathCue.js";
import { canBreathe } from "../dragonAge.js";

const { length: L, time: T } = froude;
/** Where a rival must be to draw a breath, within a plume's reach: straight ahead, or level alongside to either side. */
const reach = {
  ahead: { near: 4.5 * L, far: 14 * L, width: 4.5 * L },
  beside: { along: 3 * L, near: 4.5 * L, far: 9 * L },
  height: 4 * L,
};
/** Seeded hesitation once the breath is ready and a rival is in reach, so no two racers breathe on the same beat. */
const hesitation = [0.2 * T, 1.4 * T];

/**
 * The rival `r` could breathe at, and whether it is ahead, to the left or to the right; null when
 * none is in reach. Rivals its element is strong against come first, then the ones ahead, then the nearest.
 */
export function breathTarget(r, racers) {
  const element = breathOf(r.genome).id;
  let best = null,
    bestScore = -Infinity;
  for (const o of racers) {
    if (o === r || o.finished || o.landing || o.retired) continue;
    const ds = o.s - r.s,
      du = o.u - r.u,
      dy = o.y - r.y;
    if (Math.abs(dy) > reach.height) continue;
    const ahead = ds > reach.ahead.near && ds < reach.ahead.far && Math.abs(du) < reach.ahead.width;
    const beside = Math.abs(ds) < reach.beside.along && Math.abs(du) > reach.beside.near && Math.abs(du) < reach.beside.far;
    if (!ahead && !beside) continue;
    const m = matchup(element, breathOf(o.genome).id);
    const score = m * 1000 + (ds > 0 ? 100 : 0) - Math.hypot(ds, du, dy);
    if (score > bestScore) {
      bestScore = score;
      best = { other: o, aim: ahead ? "ahead" : du > 0 ? "left" : "right", matchup: m };
    }
  }
  return best;
}

/** Breathes `element` at `target` (from `breathTarget`, or null for straight ahead): the event, and the racer's breath recharging. */
export function breathe(r, target, t) {
  const element = breathOf(r.genome);
  r.breathReady = t + breathLength + r.stats.recharge;
  const aim = target?.aim ?? "ahead";
  return {
    type: "breath",
    other: target?.other.id ?? null,
    aim,
    element: element.id,
    detail: `${element.label.toLowerCase()} ${aim === "ahead" ? "ahead" : `to the ${aim}`}`,
  };
}

/**
 * The racer AI's breath attacks: a racer breathes as soon as its breath is ready (`breathReady`,
 * recharging at its Breath stat) and a rival is in reach, after a short seeded hesitation, preferring
 * rivals it is strong against and sparing the ones that resist it. Racers flown by a `pilot` never
 * breathe on their own unless the pilot says it is on `autopilot`, and racers too young never do.
 */
export function createBreathAttacks(seed, racers, pilots = {}) {
  const breathers = racers.filter((r) => canBreathe(r.age));
  const state = new Map(breathers.map((r) => [r.id, { random: makeRng(`breath:${seed}:${r.id}`), since: null }]));
  for (const r of breathers) r.breathReady = r.stats.recharge * state.get(r.id).random();
  return {
    step(t, dt, emit) {
      for (const r of breathers) {
        const s = state.get(r.id);
        if ((pilots[r.id] && !pilots[r.id].autopilot) || r.finished || r.landing || r.takeoff || r.retired || t < r.breathReady) continue;
        const target = breathTarget(r, racers);
        if (!target || target.matchup < 1 || target.other.s < r.s) {
          s.since = null;
          continue;
        }
        s.since ??= t + hesitation[0] + (hesitation[1] - hesitation[0]) * s.random();
        if (t < s.since) continue;
        s.since = null;
        const { type, ...extra } = breathe(r, target, t);
        emit(t, type, r, extra);
      }
    },
  };
}
