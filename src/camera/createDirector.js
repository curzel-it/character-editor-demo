import { buildTimeline } from "./buildTimeline.js";
import { frameShot } from "./frameShot.js";
import { createRaceIndex, LOOKAHEAD } from "./raceIndex.js";
import { cutRules } from "./shotTypes.js";
import { LEAD_IN } from "../race/countdown.js";

/**
 * Broadcast director. Analyses the recording once into a shot list, then
 * `shotAt(t, { aspect, focus })` frames the active shot as a pure function of t; before the start (down to
 * -LEAD_IN) it is the grid shot, framing the `focus` racer ids (the owner's) when given.
 * Additive: `timeline` (the edit decision list), `rules` and `lookahead`.
 */
const SLOW = 0.35;

export function createDirector(recording, course, options = {}) {
  const index = createRaceIndex(recording, course);
  const timeline = buildTimeline(index, course, options);
  const find = (t) => {
    let lo = 0,
      hi = timeline.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (timeline[mid].start <= t) lo = mid;
      else hi = mid - 1;
    }
    return timeline[lo];
  };
  return {
    timeline,
    rules: cutRules,
    /**
     * Playback rate for broadcast time at race time t: 1, easing to `SLOW` within a second of the
     * touchdown a landing shot is waiting for. The race itself is unchanged.
     */
    pace(time) {
      const entry = find(Math.max(0, Math.min(index.lastT, Number(time) || 0)));
      if (entry.shot !== "landing") return 1;
      const k = Math.min(1, Math.max(0, (Math.abs(time - entry.anchor.t) - 0.2) / 0.9));
      return 1 - (1 - SLOW) * (1 - k * k);
    },
    lookahead: LOOKAHEAD,
    shotAt(time, { aspect, focus } = {}) {
      const t = Math.max(-LEAD_IN, Math.min(index.lastT, Number(time) || 0));
      const entry = find(Math.max(0, t));
      return {
        ...frameShot(entry, t, index, course, { aspect, focus }),
        cut: entry.start,
        shot: entry.shot,
        subject: entry.subject,
        other: entry.other ?? null,
        reason: entry.reason,
      };
    },
    /** The onboard shot from racer `id`'s saddle at time t, outside the edit. */
    riderShotAt(id, time) {
      const t = Math.max(0, Math.min(index.lastT, Number(time) || 0));
      const entry = { shot: "rider", subject: id, start: 0 };
      return { ...frameShot(entry, t, index, course), cut: `rider:${id}`, shot: "rider", subject: id, other: null, reason: "Onboard" };
    },
  };
}
