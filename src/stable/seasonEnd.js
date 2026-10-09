import { divisionAfter, topDivision, zoneOf } from "./divisions.js";
import { seasonOver, standings } from "./leagues.js";
import { awardPrizeEgg, prizeStars } from "./prizeEgg.js";

/**
 * @typedef {import("./leagues.js").StandingsRow & { rank: number, zone: import("./divisions.js").Zone }} FinalRow
 * @typedef {{ genome: object, age: string, harness: boolean, jockey: import("../jockey/createJockey.js").Rider | null }} Look
 * @typedef {FinalRow & { look: Look | null }} DressedRow
 * @typedef {{ league: string, season: number, division: string, at: number, standings: FinalRow[],
 *   podium: DressedRow[], champion: DressedRow | null, owner: DressedRow | null,
 *   outcome: "promoted" | "relegated" | "stayed", next: string,
 *   trophy: null | { league: string, season: number, division: string, id: string, name: string, at: number },
 *   prize: null | { stars: number, egg: string | null, left: { id: string, name: string } | null } }} SeasonEnd
 */

/** The season's points table with each row's place and promotion or relegation zone. @returns {FinalRow[]} */
export function zonedStandings(season) {
  const table = standings(season);
  return table.map((row, i) => ({ ...row, rank: i + 1, zone: zoneOf(season.division, i + 1, table.length) }));
}

/** How `id` looked in its last race of the season, ridden as it raced, or null when no race kept its field. @returns {Look | null} */
function lookOf(season, id) {
  for (let i = season.races.length - 1; i >= 0; i--) {
    const p = season.races[i].field?.participants.find((entry) => entry.id === id);
    if (p) return { genome: p.genome, age: p.age, harness: p.harness !== false, jockey: p.jockey ?? null };
  }
  return null;
}

/**
 * How a finished season ended: the final standings of stables, the podium, the division champion,
 * the owner's stable (null when none of theirs started) and its outcome, the owner's division next
 * season, the trophy, won by the owner as champion of the top division and kept by their `lead`
 * dragon, and the prize egg its stars, won by the owner on the podium (its `egg` and the dragon that
 * `left` to make room are filled in when the season closes). An owner without a starter stays where
 * it is. The podium, the champion and the owner's row keep their lead dragon's `look` (genome, age,
 * harness and rider), so the awards ceremony can stage them after the season's rivals are gone.
 * @returns {SeasonEnd}
 */
export function seasonEnd(season, now) {
  const final = zonedStandings(season);
  const dress = (row) => row && { ...row, look: lookOf(season, row.lead.id) };
  const podium = final.slice(0, 3).map(dress);
  const owner = dress(final.find((row) => row.owned) ?? null);
  const zone = owner?.zone ?? null;
  const [champion = null] = podium;
  const crowned = champion?.owned && topDivision(season.division);
  const stars = prizeStars(season.division, owner?.rank ?? 0);
  return {
    league: season.league,
    season: season.number,
    division: season.division,
    at: now,
    standings: final,
    podium,
    champion,
    owner,
    outcome: zone === "promote" ? "promoted" : zone === "relegate" ? "relegated" : "stayed",
    next: divisionAfter(season.division, zone),
    trophy: crowned ? { league: season.league, season: season.number, division: season.division, id: champion.lead.id, name: champion.lead.name, at: now } : null,
    prize: stars === null ? null : { stars, egg: null, left: null },
  };
}

/**
 * Closes a league's season once its last race is in: sets `season.end`, keeps it in the stable's
 * season history (newest first) and hands out the trophy and the prize egg (`awardPrizeEgg`). Returns the end, or null while races
 * are left or when it is already closed.
 * @returns {SeasonEnd | null}
 */
export function closeSeason(stable, leagueId, now) {
  const season = stable.leagues[leagueId];
  if (!season || !seasonOver(season) || season.end) return null;
  season.end = seasonEnd(season, now);
  stable.seasons.unshift(season.end);
  if (season.end.trophy) stable.trophies.push(season.end.trophy);
  if (season.end.prize) {
    const award = awardPrizeEgg(stable, season.end, now);
    season.end.prize = award && { stars: award.stars, egg: award.egg.id, left: award.left };
  }
  return season.end;
}

/** The end of season `number` of a league: the one waiting for Next season, else from the history. @returns {SeasonEnd | null} */
export function findSeasonEnd(stable, leagueId, number) {
  const current = stable.leagues[leagueId];
  if (current?.number === number && current.end) return current.end;
  return stable.seasons.find((end) => end.league === leagueId && end.season === number) ?? null;
}
