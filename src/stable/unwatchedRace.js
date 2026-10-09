import { simulationHz } from "../race/raceSim.js";
import { finishLeagueRace } from "./leagueRace.js";

/**
 * A race on air nobody watches flies on by itself on Autopilot, in game time: `left` is when the
 * owner left it at `step`, and `end` its finish once worked out (`settleUnwatched`), the
 * finishing `step` and the results, the same as watching it to the end on Autopilot would give.
 * @typedef {{ step: number, results: { id: string, place: number, time: number }[] }} UnwatchedEnd
 */

const msPerStep = 1000 / simulationHz;

/**
 * Leaves the race on air in `leagueId` at simulation `step` and game time `now`; it keeps flying on
 * Autopilot (the reins handed back at the next step) and finishes by itself unless the owner
 * rejoins it first. Returns the race, or null with none on air.
 */
export function leaveLiveRace(stable, leagueId, step, now) {
  const live = stable.leagues?.[leagueId]?.live;
  if (!live) return null;
  const { log } = live.ride;
  const reins = log.findLast((entry) => entry[1] === "r");
  if (reins?.[2] === 1) log.push([Math.max(step + 1, log.at(-1)[0]), "r", 0]);
  live.step = step;
  live.left = now;
  live.end = null;
  return live;
}

/** Keeps the finished `recording` of an unwatched race as its `end`. */
export function settleUnwatched(live, recording) {
  live.end = { step: Math.round(recording.duration * simulationHz), results: recording.results.map(({ id, place, time }) => ({ id, place, time })) };
}

/** The step an unwatched race has flown to by game time `now`, its finish at most; a watched race's saved `step`. */
export function liveStep(live, now) {
  if (live.left == null) return live.step;
  const step = live.step + Math.max(0, Math.floor(((now - live.left) * simulationHz) / 1000));
  return live.end ? Math.min(step, live.end.step) : step;
}

/** The game time an unwatched race finishes, or null while unwatched with its `end` not worked out yet, or watched. */
export const unwatchedFinish = (live) => (live.left != null && live.end ? live.left + (live.end.step - live.step) * msPerStep : null);

/** Takes the owner back to the race on air in `leagueId` where it has flown by game time `now`; returns it, or null with none on air. */
export function rejoinLiveRace(stable, leagueId, now) {
  const live = stable.leagues?.[leagueId]?.live;
  if (!live) return null;
  live.step = liveStep(live, now);
  delete live.left;
  delete live.end;
  return live;
}

/**
 * Records every unwatched race that finished by game time `now`, at its finishing time, and returns
 * one `{ type: "raced", id, league, season, race, left }` event each: the dragon, the race's league,
 * season number and index, and when the owner left it.
 */
export function finishUnwatchedRaces(stable, now) {
  const events = [];
  for (const [leagueId, season] of Object.entries(stable.leagues ?? {})) {
    const live = season?.live;
    const at = live ? unwatchedFinish(live) : null;
    if (at === null || at > now) continue;
    const run = finishLeagueRace(stable, leagueId, live.end.results, at);
    if (run) events.push({ type: "raced", id: live.dragon, league: leagueId, season: season.number, race: run.race.index, left: live.left });
  }
  return events;
}
