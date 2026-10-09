import { breathLength } from "../breath/breathCue.js";

const cache = new WeakMap();

/**
 * The breath a racer is in the middle of at race time `t`, from the recording's `breath` events:
 * `{ age, other, aim, element }` with `age` in seconds since the cue, or null. The index is rebuilt
 * whenever the recording has grown, so a live simulation works too.
 */
export function breathFromEvents(recording, racerId, t) {
  let cached = cache.get(recording);
  if (cached?.count !== recording.events.length) {
    const byRacer = new Map();
    for (const e of recording.events)
      if (e.type === "breath") {
        if (!byRacer.has(e.racer)) byRacer.set(e.racer, []);
        byRacer.get(e.racer).push(e);
      }
    for (const list of byRacer.values()) list.sort((a, b) => a.t - b.t);
    cached = { count: recording.events.length, byRacer };
    cache.set(recording, cached);
  }
  const list = cached.byRacer.get(racerId);
  if (!list || !Number.isFinite(t)) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const age = t - list[i].t;
    if (age < 0) continue;
    return age < breathLength ? { age, other: list[i].other, aim: list[i].aim, element: list[i].element } : null;
  }
  return null;
}

const hitCache = new WeakMap();

/** How long a hit shows after the last contact with the plume. */
export const hitAfter = 1;

/**
 * The breath hit a racer is taking at race time `t`, from the recording's `hit` events:
 * `{ age, until, amount, element, matchup, other }` with `age` in seconds since the first contact, or null
 * once `hitAfter` seconds have passed since the last.
 */
export function hitFromEvents(recording, racerId, t) {
  let cached = hitCache.get(recording);
  if (cached?.count !== recording.events.length) {
    const byRacer = new Map();
    for (const e of recording.events)
      if (e.type === "hit") {
        if (!byRacer.has(e.racer)) byRacer.set(e.racer, []);
        byRacer.get(e.racer).push(e);
      }
    for (const list of byRacer.values()) list.sort((a, b) => a.t - b.t);
    cached = { count: recording.events.length, byRacer };
    hitCache.set(recording, cached);
  }
  const list = cached.byRacer.get(racerId);
  if (!list || !Number.isFinite(t)) return null;
  for (let i = list.length - 1; i >= 0; i--) {
    const e = list[i];
    if (t < e.t) continue;
    if (t > e.until + hitAfter) return null;
    return { age: t - e.t, until: e.until, amount: e.amount, element: e.element, matchup: e.matchup ?? 1, other: e.other };
  }
  return null;
}
