import { sampleRace } from "../race/sampleRace.js";
import { ageOf } from "../dragonAge.js";

export const TICK = 0.25;
export const LOOKAHEAD = 3;
const EPS = 1e-6;

/**
 * Read-only view of a recording for the director. Every query that looks
 * ahead is bounded by `horizon(t)`, the last frame at or before t + LOOKAHEAD.
 */
export function createRaceIndex(recording, course) {
  const { hz, frames } = recording;
  const lastT = Math.max(0, (frames.length - 1) / hz);
  const roster = recording.roster?.length
    ? recording.roster
    : frames[0].racers.map(({ id }) => ({ id }));
  const names = new Map(roster.map((r) => [r.id, r.name || String(r.id)]));
  const sizes = new Map(roster.map((r) => [r.id, ageOf(r.age).size]));
  const ids = frames[0].racers.map((r) => r.id);
  const finishS = course.gates?.at(-1)?.s ?? course.length;

  const sample = (t) => {
    const x = Math.max(0, Math.min(lastT, t)) * hz,
      i = Math.round(x);
    if (Math.abs(x - i) < EPS) return { t, racers: frames[i].racers };
    return sampleRace(recording, t);
  };

  const summarise = (t) => {
    const byId = new Map();
    for (const r of sample(t).racers)
      byId.set(r.id, {
        id: r.id,
        progress: r.progress,
        speed: r.speed,
        place: r.place,
        finished: r.finished,
      });
    const order = [...byId.values()]
      .sort((a, b) => a.place - b.place || b.progress - a.progress)
      .map((r) => r.id);
    order.forEach((id, i) => (byId.get(id).rank = i + 1));
    return { t, byId, order };
  };

  const ticks = [];
  for (let k = 0; k * TICK <= lastT + EPS; k++) ticks.push(summarise(k * TICK));

  const recorded = (recording.events ?? []).filter(
    (e) => e.type !== "overtake",
  );
  const derived = [];
  for (let k = 1; k < ticks.length; k++) {
      const a = ticks[k - 1],
        b = ticks[k];
      for (const id of b.order) {
        const now = b.byId.get(id).rank,
          before = a.byId.get(id).rank;
        if (now < before)
          derived.push({
            t: b.t,
            type: "overtake",
            racer: id,
            other: a.order[now - 1],
            place: now,
          });
      }
  }
  const events = [...recorded, ...derived].sort((a, b) => a.t - b.t);

  const crossings = new Map();
  for (const id of ids)
    for (let k = 0; k < ticks.length; k++) {
      const r = ticks[k].byId.get(id);
      if (r.progress < finishS - 1e-3 && !r.finished) continue;
      const prev = k > 0 ? ticks[k - 1].byId.get(id).progress : r.progress;
      const f =
        r.progress > prev
          ? Math.min(1, Math.max(0, (finishS - prev) / (r.progress - prev)))
          : 1;
      crossings.set(id, { t: ticks[k].t - TICK * (1 - f), known: ticks[k].t });
      break;
    }

  const horizon = (t) =>
    Math.min(lastT, Math.floor((t + LOOKAHEAD) * hz + EPS) / hz);
  const tickIndex = (t) =>
    Math.max(0, Math.min(ticks.length - 1, Math.round(t / TICK)));

  return {
    hz,
    lastT,
    ids,
    finishS,
    ticks,
    sample,
    horizon,
    name: (id) => names.get(id) ?? String(id),
    /** Body scale of a racer for its age range: 1 for adults. */
    size: (id) => sizes.get(id) ?? 1,
    tickAt: (t) => ticks[tickIndex(t)],
    ticksBetween(a, b) {
      const out = [];
      for (let k = Math.max(0, Math.ceil(a / TICK - EPS)); k < ticks.length; k++) {
        if (ticks[k].t > b + EPS) break;
        out.push(ticks[k]);
      }
      return out;
    },
    eventsBetween: (a, b) => events.filter((e) => e.t >= a && e.t <= b),
    /**
     * Speed trend of a racer at t in m/s², a weighted slope over the raw frames within
     * `radius` seconds whose weights vanish at the edges, so it is continuous in t.
     */
    acceleration(id, t, radius = 0.6) {
      const n = ids.indexOf(id);
      if (n < 0) return 0;
      let num = 0,
        den = 0;
      const first = Math.max(0, Math.ceil((t - radius) * hz)),
        last = Math.min(frames.length - 1, Math.floor((t + radius) * hz));
      for (let i = first; i <= last; i++) {
        const o = i / hz - t,
          w = 1 - Math.abs(o) / radius;
        if (w <= 0) continue;
        num += w * o * frames[i].racers[n].speed;
        den += w * o * o;
      }
      return den > 1e-9 ? num / den : 0;
    },
    crossing(id, limit) {
      const c = crossings.get(id);
      return c && c.known <= limit + EPS ? c.t : null;
    },
  };
}
