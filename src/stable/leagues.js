import { makeRng } from "../rng.js";
import { makeGenome } from "../subjects.js";
import { racerName } from "../racerName.js";
import { createJockey } from "../jockey/createJockey.js";
import { divisionRank, firstDivision } from "./divisions.js";
import { divisionTeams } from "./teams.js";

/**
 * Age-restricted leagues: a dragon races in the league of its current age. `courseShare` is the
 * share of the full course length the league races, so each league's races run about as long as
 * its speed class suggests.
 */
export const leagues = [
  { id: "kids", age: "kid", label: "Kids League", courseShare: 0.4 },
  { id: "teens", age: "teen", label: "Teen League", courseShare: 0.5 },
  { id: "adults", age: "adult", label: "Main Event", courseShare: 0.6 },
];
export const seasonLength = 16;
export const fieldSize = 8;
export const points = [10, 8, 6, 5, 4, 3, 2, 1];
export const rivalCount = fieldSize - 1;

export const leagueOf = (id) => leagues.find((league) => league.id === id);
export const leagueForAge = (age) => leagues.find((league) => league.age === age) ?? null;

/**
 * The stars each division's rivals are seeded between, per league and weakest division first. Kids
 * and teens grow up in hours, so their fields stay close to where eggs hatch; adults spread over the
 * whole scale, so care decides how far a dragon climbs.
 */
export const rivalStars = {
  kids: [[1, 1.4], [1.3, 1.9], [1.8, 2.5]],
  teens: [[1.1, 1.7], [1.6, 2.3], [2.2, 3]],
  adults: [[1.5, 2.6], [2.5, 3.7], [3.6, 5]],
};

/**
 * A season of `league` in `division`: one seeded rival dragon at the league's age for each rival
 * stable of the division (`divisionTeams`), ridden by that stable's own rider and of seeded stars
 * typical of the division (`rivalStars`), and no races yet.
 */
export function createSeason(genes, league, number, stableSeed, division = firstDivision) {
  const seed = `${stableSeed}:${league.id}:${number}`;
  const [least, most] = rivalStars[league.id][divisionRank(division)];
  const rivals = divisionTeams(stableSeed, league.id, division, rivalCount).map((team, i) => {
    const rivalSeed = `${seed}:rival:${i}`;
    return {
      id: `r-${league.id}-${number}-${i}`,
      name: racerName(rivalSeed),
      seed: rivalSeed,
      team: team.id,
      teamName: team.name,
      genome: makeGenome(genes, rivalSeed),
      jockey: createJockey(`team:${stableSeed}:${team.id}`),
      harness: true,
      age: league.age,
      strength: Math.round((least + (most - least) * makeRng(`${rivalSeed}:stars`)()) * 100) / 100,
    };
  });
  return { league: league.id, number, division, seed, rivals, races: [], live: null, end: null };
}

export const seasonOver = (season) => season.races.length >= seasonLength;

/** The next race's course and seeds; courses alternate valley and canyon. */
export function nextRaceCard(season) {
  const index = season.races.length;
  const random = makeRng(`${season.seed}:card:${index}`);
  return {
    index,
    courseType: index % 2 ? "canyon" : "valley",
    courseSeed: String(Math.floor(random() * 100000)),
    raceSeed: `${season.seed}:race:${index}`,
  };
}

/** The field for the next race: every rival of the season plus the owner's `entrant`, if any, on a seeded grid. */
export function raceField(season, entrant = null) {
  const card = nextRaceCard(season);
  const random = makeRng(`${card.raceSeed}:field`);
  const shuffle = (list) => list.map((item) => [random(), item]).sort((x, y) => x[0] - y[0]).map(([, item]) => item);
  const participants = shuffle(entrant ? [...season.rivals, entrant] : season.rivals)
    .map((p) => ({
      id: p.id,
      name: p.name,
      seed: p.seed,
      team: p.team,
      teamName: p.teamName,
      genome: { ...p.genome },
      jockey: structuredClone(p.jockey),
      harness: p.harness !== false,
      age: p.age,
      strength: p.strength ?? 1,
    }));
  return { courseSeed: card.courseSeed, courseType: card.courseType, raceSeed: card.raceSeed, participants };
}

/**
 * Season points table of stables, best first; ties go to more wins, then the better best finish.
 * Every dragon a stable raced adds to its row, and `lead` is the one that scored the most (the later
 * on a tie). A result without a stable counts as a stable of its own.
 * @typedef {{ id: string, name: string, points: number }} Scorer
 * @typedef {{ id: string, name: string, points: number, wins: number, starts: number, best: number,
 *   owned: boolean, lead: Scorer, dragons: Scorer[] }} StandingsRow
 * @returns {StandingsRow[]}
 */
export function standings(season) {
  const rows = new Map();
  for (const race of season.races)
    for (const r of race.results) {
      const id = r.team ?? r.id;
      const row = rows.get(id) ?? { id, name: r.teamName ?? r.name, points: 0, wins: 0, starts: 0, best: Infinity, owned: !!r.owned, lead: null, dragons: [] };
      const earned = points[r.place - 1] ?? 0;
      row.points += earned;
      row.wins += r.place === 1 ? 1 : 0;
      row.starts++;
      row.best = Math.min(row.best, r.place);
      row.name = r.teamName ?? row.name;
      let dragon = row.dragons.find((d) => d.id === r.id);
      if (!dragon) row.dragons.push((dragon = { id: r.id, name: r.name, points: 0 }));
      dragon.points += earned;
      if (!row.lead || dragon.points >= row.lead.points) row.lead = dragon;
      rows.set(id, row);
    }
  return [...rows.values()].sort((a, b) => b.points - a.points || b.wins - a.wins || a.best - b.best);
}
