import { genes } from "../../src/genome/dragon.js";
import { createStable } from "../../src/stable/newStable.js";
import { adoptStarter, starterCount } from "../../src/stable/starters.js";
import { runLeagueRace, startNextSeason } from "../../src/stable/leagueRace.js";
import { createSeason, fieldSize, leagueOf, seasonLength } from "../../src/stable/leagues.js";
import { careNeeds } from "../../src/stable/care.js";
import { strengthen } from "../../src/stable/strength.js";

const hour = 3_600_000;
/** Hours a day an owner keeps a dragon's needs high when they hold at a care level: the night's decay leaves about 20. */
const caredHours = 20;

/**
 * A new stable's first `seasons` seasons: for each of `stables` seeded stables and each starter it
 * offers, the starter (grown to the league's age) races every race of `league` on Autopilot, from
 * `division` and then wherever its seasons take it, `perDay` races a game day, starting at `stars`.
 * Its needs and bond are held at `care` (0..1) and it rests before every race; between races it
 * grows stronger under that care for `caredHours` of every 24.
 */
export function runSeasons({ league = "kids", division = "bronze", stables = 8, care = 1, seasons = 1, perDay = 4, stars = 1 }) {
  const gap = (24 * hour) / perDay;
  const { age } = leagueOf(league);
  const bySeason = Array.from({ length: seasons }, () => ({ races: 0, places: 0, wins: 0, podiums: 0, last: 0, promoted: 0, champions: 0, seasons: 0, divisions: {}, from: 0, stars: 0 }));
  const perStarter = [];
  for (let s = 0; s < stables; s++)
    for (let pick = 0; pick < starterCount; pick++) {
      const stable = createStable(genes, `season-${s}`, 0);
      const dragon = Object.assign(adoptStarter(stable, genes, pick), { age, strength: stars });
      stable.leagues[league] = createSeason(genes, leagueOf(league), 1, stable.seed, division);
      const own = { wins: 0, podiums: 0 };
      for (let n = 0; n < seasons; n++) {
        const tally = bySeason[n];
        const season = n ? startNextSeason(stable, genes, league) : stable.leagues[league];
        tally.divisions[season.division] = (tally.divisions[season.division] ?? 0) + 1;
        let end = null;
        tally.from += dragon.strength;
        for (let r = 0; r < seasonLength; r++) {
          Object.assign(dragon, { fatigue: 0, injury: null, bond: care });
          for (const need of careNeeds) dragon.care[need.id] = 100 * care;
          strengthen(dragon, (gap * caredHours) / 24);
          const run = runLeagueRace(stable, league, dragon.id, (n * seasonLength + r + 1) * gap);
          const { place } = run.race.results.find((x) => x.owned);
          tally.races++;
          tally.places += place;
          tally.wins += place === 1 ? 1 : 0;
          tally.podiums += place <= 3 ? 1 : 0;
          tally.last += place === fieldSize ? 1 : 0;
          if (!n) {
            own.wins += place === 1 ? 1 : 0;
            own.podiums += place <= 3 ? 1 : 0;
          }
          end = run.seasonEnd ?? end;
        }
        tally.seasons++;
        tally.promoted += (end?.owner?.rank ?? Infinity) <= 2 ? 1 : 0;
        tally.champions += end?.owner?.rank === 1 ? 1 : 0;
        tally.stars += dragon.strength;
      }
      perStarter.push(own);
    }
  return { bySeason, perStarter };
}

/** Prints `runSeasons` as batch lines. */
export function printSeasons(options) {
  const started = performance.now();
  const { bySeason, perStarter } = runSeasons(options);
  const spread = (key) => perStarter.map((x) => x[key]).sort((a, b) => a - b).join(" ");
  console.log(`Seasons: ${options.league} from ${options.division} (${options.stables} stables × ${starterCount} starters), care ${options.care}, ${options.perDay} races a day; ${((performance.now() - started) / 1000).toFixed(1)} s`);
  bySeason.forEach((t, n) => {
    const pct = (v, d = t.races) => `${((100 * v) / d).toFixed(1)}%`;
    const divisions = Object.entries(t.divisions).map(([id, count]) => `${id} ${count}`).join(", ");
    console.log(
      `Season ${n + 1} (${divisions}): wins ${pct(t.wins)}, podiums ${pct(t.podiums)}, last ${pct(t.last)}, mean place ${(t.places / t.races).toFixed(2)}; champion ${pct(t.champions, t.seasons)}, top two ${pct(t.promoted, t.seasons)}; stars ${(t.from / t.seasons).toFixed(2)} → ${(t.stars / t.seasons).toFixed(2)}`,
    );
  });
  console.log(`Per starter, first season wins of ${seasonLength}: ${spread("wins")}`);
  console.log(`Per starter, first season podiums of ${seasonLength}: ${spread("podiums")}`);
}
