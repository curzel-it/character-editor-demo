import { deriveStats } from "../race/deriveStats.js";
import { handicap } from "../race/handicap.js";
import { leagueOf, leagues, seasonLength, seasonOver } from "../stable/leagues.js";
import { entryBlock } from "../stable/leagueRace.js";
import { divisionOf } from "../stable/divisions.js";
import { zonedStandings } from "../stable/seasonEnd.js";

/**
 * Where the stable stands in a league: the season, its division and progress, the owner's best
 * place in the points table and its promotion or relegation zone, and how many owned dragons are
 * of the league's age and free to race now. `locked` means the stable has no dragon of that age.
 */
export function leagueSummary(stable, leagueId) {
  const league = leagueOf(leagueId);
  const season = stable.leagues[leagueId];
  const members = stable.dragons.filter((w) => w.age === league.age);
  const table = zonedStandings(season);
  const best = table.find((row) => row.owned);
  return {
    league,
    season,
    division: divisionOf(season.division),
    racesRun: season.races.length,
    seasonLength,
    over: seasonOver(season),
    members: members.length,
    eligible: members.filter((w) => !entryBlock(stable, w, leagueId, stable.clock.game)).length,
    bestPlace: best?.rank ?? null,
    zone: best?.zone ?? null,
    locked: !members.length,
  };
}

/** The owner's finishers in a recorded race, best first. */
export const ownedPlacings = (race) => race.results.filter((r) => r.owned).sort((a, b) => a.place - b.place);

/** The field's favourite: the participant with the best public handicap, its stars included. */
export function favouriteOf(genes, participants) {
  let best = null,
    rating = -Infinity;
  for (const p of participants) {
    const r = handicap(deriveStats({ genes }, p.genome, p.age, p.strength));
    if (r > rating) [best, rating] = [p, r];
  }
  return best;
}

/** Every recorded race with an owned entrant, newest first: the Race tab's recent races. */
export function recentRaces(stable) {
  return leagues
    .map((l) => leagueSummary(stable, l.id))
    .flatMap((s) => s.season.races.map((race) => ({ league: s.league, season: s.season.number, race, placings: ownedPlacings(race) })))
    .filter((entry) => entry.placings.length)
    .sort((a, b) => b.race.at - a.race.at || b.race.index - a.race.index);
}
