import { LEAD_IN } from "./countdown.js";

const WINDOW = 4;

/** Worth of each event to the commentator; events of owned racers count for more. */
const weight = (e) =>
  ({
    finish: e.place === 1 ? 10 : 5,
    overtake: e.place === 1 ? 8 : 3,
    miss: 7,
    dnf: 7,
    land: 5,
    breath: 4,
    hit: e.matchup > 1 ? 7 : 5,
    thermal: 1,
  })[e.type] ?? 0;

/** Seconds each opening call holds on the grid. */
const OPENING = 1.2;

/**
 * What the commentator calls at race time `t`: the most telling event of the last few seconds, owned
 * racers first, before the start the grid call (`{ type: "grid", count }`) and then who is in
 * perfect or off shape (`{ type: "form", racer, form }`, owned racers first), or the start call
 * (`{ type: "start", place }`). The UI words the `event`; null when there is nothing new.
 * @returns {{ key: string, event: Record<string, any>, owned: boolean } | null}
 */
export function commentaryAt(recording, t, { owned = new Set(), place = "course" } = {}) {
  if (t < 0) {
    const forms = recording.roster.filter((e) => e.form && e.form !== "usual").sort((a, b) => Number(owned.has(b.id)) - Number(owned.has(a.id)));
    const call = forms[Math.floor((t + LEAD_IN) / OPENING) - 1];
    if (call) return { key: `form:${call.id}`, event: { type: "form", racer: call.id, form: call.form }, owned: owned.has(call.id) };
    return { key: "grid", event: { type: "grid", count: recording.roster.length }, owned: false };
  }
  let best = null,
    bestScore = 0;
  for (const e of recording.events) {
    if (e.t > t || e.t <= t - WINDOW) continue;
    const score = weight(e) * (owned.has(e.racer) ? 2 : 1);
    if (score > 0 && score >= bestScore) {
      best = e;
      bestScore = score;
    }
  }
  if (best) return { key: `${best.t}:${best.type}:${best.racer}`, event: best, owned: owned.has(best.racer) };
  if (t < WINDOW) return { key: "start", event: { type: "start", place }, owned: false };
  return null;
}
