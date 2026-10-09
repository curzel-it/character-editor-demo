import { speedScale as V } from "../worldScale.js";
import { TICK } from "./raceIndex.js";
import { shotCandidates, LANDING_LEAD } from "./shotCandidates.js";
import { cutRules, shotTypes } from "./shotTypes.js";

const EPS = 1e-6;
// Real seconds a touchdown shot stays on the landed dragon.
const LANDING_HOLD = 3;
// Real seconds before its lead that the winner's touchdown calls the camera off the finish line.
const TOUCHDOWN_CALL = 1.5;
const GRID_HOLD = 3.5,
  FINISH_APPROACH = 60 * V,
  MIN_SPEED = 5 * V;

/** Whether the winner touches down soon enough that the camera should be on its way to it. */
function touchdownDue(index, t) {
  const now = index.tickAt(t);
  return index
    .eventsBetween(t, index.horizon(t))
    .some((e) => e.type === "land" && now.byId.get(e.racer)?.rank === 1 && e.t >= t + LANDING_LEAD && e.t < t + LANDING_LEAD + TOUCHDOWN_CALL);
}

/** Value of staying on the current shot at decision time t. */
function holdValue(shot, t, index, course, candidates) {
  const now = index.tickAt(t);
  if (shot.shot === "grid") return t < GRID_HOLD ? 20 : 0;
  if (shot.shot === "finish") {
    if (touchdownDue(index, t)) return 1;
    const H = index.horizon(t);
    const busy = index.ids.some((id) => {
      const c = index.crossing(id, H);
      return c === null
        ? now.byId.get(id).progress > index.finishS - FINISH_APPROACH
        : c > t - 1.2 && c < t + 1.5;
    });
    return busy ? 60 : 1;
  }
  if (shot.shot === "gate") {
    const gate = course.gates[shot.gate];
    const r = now.byId.get(shot.subject);
    if (!gate || !r) return 0;
    const past = r.progress - gate.s;
    return past < Math.max(r.speed, MIN_SPEED) * 1.2 ? 6 : 0.5;
  }
  if (shot.shot === "trackside") {
    const r = now.byId.get(shot.subject);
    if (!r) return 0;
    return r.progress - shot.anchor.s < Math.max(r.speed, MIN_SPEED) * 0.9 ? 8 : 0.5;
  }
  if (shot.shot === "flyby") {
    const r = now.byId.get(shot.subject);
    if (!r) return 0;
    const camera = shot.anchor.s + shot.anchor.pace * (t - shot.start);
    return r.progress - camera < Math.max(r.speed, MIN_SPEED) * 0.7 ? 7 : 0.5;
  }
  if (shot.shot === "rider") return t - shot.start < 3.5 ? 5 : 0.5;
  if (shot.shot === "landing") return t < shot.anchor.t + LANDING_HOLD ? 12 : 0.5;
  const same = candidates.find(
    (c) =>
      c.shot === shot.shot &&
      c.subject === shot.subject &&
      (c.other ?? null) === (shot.other ?? null),
  );
  const fresh = shot.shot === "battle" ? 2.5 : 4;
  const fatigue = 0.45 * Math.max(0, t - shot.start - fresh);
  return same ? same.score + 0.5 - fatigue : 1.5;
}

/**
 * Builds the edit decision list. The cut at time t depends only on data up
 * to index.horizon(t), so any prefix is stable under recording truncation.
 */
export function buildTimeline(index, course) {
  const shots = [];
  const screen = new Map(index.ids.map((id) => [id, 0]));
  const first = index.tickAt(0);
  let side = 1;
  let current = {
    start: 0,
    shot: "grid",
    subject: first.order[0] ?? null,
    other: null,
    group: first.order.slice(),
    side,
    reason: `${first.order.length} racers line up on the grid`,
  };
  let previousType = null;

  const close = (end) => {
    current.end = end;
    if (current.subject !== null && screen.has(current.subject))
      screen.set(
        current.subject,
        screen.get(current.subject) + end - current.start,
      );
    shots.push(current);
  };

  for (let k = 1; k * TICK <= index.lastT + EPS; k++) {
    const t = k * TICK,
      elapsed = t - current.start;
    if (elapsed < cutRules.minShot - EPS && (current.shot === "landing" || !touchdownDue(index, t))) continue;
    const { list, finishDue, finishNear } = shotCandidates(index, course, t);
    const total = [...screen.values()].reduce((a, b) => a + b, 0) || 1;
    const fair = (id) =>
      Math.max(0, 1 - (screen.get(id) / total) * index.ids.length);

    const recent = (c) => {
      let penalty = 0;
      for (let i = shots.length - 1; i >= 0 && shots[i].end > t - 30; i--) {
        const s = shots[i],
          overlap = s.end - Math.max(s.start, t - 30);
        if (s.shot === c.shot) penalty += 0.12 * overlap;
        if (s.shot === c.shot && s.subject === c.subject && s.end > t - 20)
          penalty += 1;
      }
      return penalty;
    };
    let best = null;
    for (const c of list) {
      if (c.shot === current.shot) continue;
      if (finishNear && c.shot !== "finish") continue;
      let score = c.score - (c.shot === "finish" ? 0 : recent(c));
      if (c.subject !== null && screen.has(c.subject))
        score += (c.filler ? 2 : 0.8) * fair(c.subject);
      if (c.subject === current.subject && c.shot !== "finish") score -= 0.7;
      if (c.shot === previousType) score -= 0.5;
      if (!best || score > best.score) best = { ...c, score };
    }
    if (!best) continue;
    const hold = holdValue(current, t, index, course, list);
    const approach = finishNear && current.shot !== "finish";
    const cut = approach
      ? finishDue || elapsed >= cutRules.maxShot - EPS
      : elapsed >= cutRules.maxShot - EPS ||
      (finishDue && current.shot !== "finish") ||
      best.score > hold + 1.5 ||
      (elapsed >= cutRules.preferredShot - EPS && best.score >= hold - 0.5);
    if (!cut) continue;
    close(t);
    previousType = current.shot;
    if (shotTypes[best.shot].sided && !shotTypes[current.shot].sided)
      side = -side;
    const { score, filler, ...rest } = best;
    current = {
      ...rest,
      other: rest.other ?? null,
      side: shotTypes[best.shot].sided ? side : 0,
      start: t,
    };
  }
  close(index.lastT);
  return shots;
}
