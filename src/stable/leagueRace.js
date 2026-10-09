import { fieldCourse } from "../fieldCourse.js";
import { simulateRace } from "../race/simulateRace.js";
import { raceRoster } from "../raceField.js";
import { afterRaceCare } from "./care.js";
import { afterRace, unfitReason } from "./condition.js";
import { createSeason, leagueOf, raceField, seasonOver } from "./leagues.js";
import { onAirBlock } from "./onAir.js";
import { markRaceHintDone } from "./raceLesson.js";
import { raceDayForm } from "./raceDayForm.js";
import { riddenByOwner } from "./owner.js";
import { closeSeason } from "./seasonEnd.js";
import { slumberBlock } from "./soulAltar.js";

/**
 * A league race on air: the owned `dragon` ridden in it, the `field` fixed at the start (every
 * dragon's stars included), the owner's `ride` (the input log) and the
 * simulation `step` it had reached when last saved.
 * @typedef {{ dragon: string, at: number, field: object, ride: import("../race/simulateRace.js").Ride, step: number }} LiveRace
 */

/** Why `dragon` cannot enter the next race of `leagueId` at game time `now` as a block code, or null when it can. */
export function entryBlock(stable, dragon, leagueId, now) {
  if (dragon.age !== leagueOf(leagueId).age) return "wrongAge";
  return onAirBlock(stable, dragon.id) ?? unfitReason(dragon) ?? slumberBlock(dragon, now);
}

/** The next race's field at game time `now` with the owner riding `dragon`: the season's rivals plus it, on a seeded grid, with its form for the day. */
export function ownerField(stable, leagueId, dragon, now) {
  const field = raceField(stable.leagues[leagueId], riddenByOwner(stable, dragon));
  const entrant = field.participants.find((p) => p.id === dragon.id);
  entrant.form = raceDayForm(stable, field.raceSeed, dragon.id, now);
  return field;
}

/** The race of `leagueId` on air, or null. */
export const liveRaceOf = (stable, leagueId) => stable.leagues?.[leagueId]?.live ?? null;

/**
 * Starts the next race of a league with the owner riding `dragonId` and keeps it on the season as
 * `live` until `finishLeagueRace`; null without a dragon fit to enter, after the last race, or while
 * another race of the league is on air. Nothing is recorded until it finishes, and a race once
 * started cannot be started again. Entering a race puts the first race hint away.
 * @returns {LiveRace | null}
 */
export function startLeagueRace(stable, leagueId, dragonId, now) {
  const season = stable.leagues[leagueId];
  const dragon = stable.dragons.find((w) => w.id === dragonId);
  if (!season || season.live || seasonOver(season) || !dragon || entryBlock(stable, dragon, leagueId, now)) return null;
  season.live = { dragon: dragon.id, at: now, field: ownerField(stable, leagueId, dragon, now), ride: { racer: dragon.id, log: [] }, step: 0 };
  markRaceHintDone(stable);
  return season.live;
}

/** True before the owner's first ever race has finished: no season closed and no race recorded. */
const firstEverRace = (stable) => !stable.seasons?.length && Object.values(stable.leagues ?? {}).every((s) => !s.races.length);

/**
 * Records the race on air in `leagueId` with its `results` (the finished recording's), in the season
 * and on the dragon (record, history, fatigue, injuries, needs and bond; the owner's first ever race
 * leaves it fresh, so it does not sleep), and returns the race and
 * the field, plus the season's end after its last race (`closeSeason`), or null with no race on air.
 * The race keeps the `ride` when the owner took the reins, so it replays the same.
 */
export function finishLeagueRace(stable, leagueId, results, now) {
  const season = stable.leagues[leagueId];
  const live = season?.live;
  if (!live) return null;
  const tiring = !firstEverRace(stable);
  season.live = null;
  const { field, ride } = live;
  const owned = new Set([live.dragon]);
  const entries = new Map(field.participants.map((p) => [p.id, p]));
  const race = {
    index: season.races.length,
    division: season.division,
    at: now,
    field,
    ...(ride.log.length ? { ride } : {}),
    results: results.map(({ id, place, time }) => {
      const { name, team, teamName } = entries.get(id);
      return { id, name, ...(team ? { team, teamName } : {}), place, time, owned: owned.has(id) };
    }),
  };
  season.races.push(race);
  const injuries = [];
  const dragon = stable.dragons.find((w) => w.id === live.dragon);
  if (dragon) {
    const { place } = race.results.find((r) => r.id === dragon.id);
    dragon.record.starts++;
    if (place === 1) dragon.record.wins++;
    if (place <= 3) dragon.record.podiums++;
    dragon.history.unshift({ league: leagueId, division: season.division, season: season.number, race: race.index, place, of: field.participants.length, at: now });
    dragon.history.length = Math.min(dragon.history.length, 20);
    afterRaceCare(dragon);
    const injury = afterRace(dragon, field.raceSeed, now, tiring);
    if (injury) injuries.push({ id: dragon.id, name: dragon.name, injury });
  }
  return { race, field, injuries, seasonEnd: closeSeason(stable, leagueId, now) };
}

/**
 * Runs the next race of a league at once with the owner's dragon on Autopilot: `startLeagueRace`,
 * the whole simulation, then `finishLeagueRace`. Null when the race cannot start.
 */
export function runLeagueRace(stable, leagueId, dragonId, now) {
  const live = startLeagueRace(stable, leagueId, dragonId, now);
  if (!live) return null;
  const { field, ride } = live;
  const recording = simulateRace({ seed: field.raceSeed, course: fieldCourse(field), roster: raceRoster(field), ride });
  return finishLeagueRace(stable, leagueId, recording.results, now);
}

/** Replaces a finished season with the next one, in the division its end moved the owner to. */
export function startNextSeason(stable, genes, leagueId) {
  const season = stable.leagues[leagueId];
  if (season && !seasonOver(season)) return season;
  const division = season?.end?.next ?? season?.division;
  stable.leagues[leagueId] = createSeason(genes, leagueOf(leagueId), (season?.number ?? 0) + 1, stable.seed, division);
  return stable.leagues[leagueId];
}
