import { leagueOf } from "../stable/leagues.js";

/** The `league/season/race` part of a broadcast or results link. */
export const racePath = (leagueId, seasonNumber, index) => `${encodeURIComponent(leagueId)}/${seasonNumber}/${index}`;

/** A race of a league's current season with its league and season, or null when it is not there (the season moved on). */
export function findLeagueRace(stable, leagueId, seasonNumber, index) {
  const season = stable.leagues?.[leagueId];
  const race = Number.isInteger(index) && leagueOf(leagueId) && season?.number === seasonNumber ? season.races[index] : null;
  return race ? { league: leagueOf(leagueId), season, race } : null;
}
