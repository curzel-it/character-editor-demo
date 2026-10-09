import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { divisionAfter, divisions, zoneOf } from "../src/stable/divisions.js";
import { createSeason, leagueOf, nextRaceCard, points, rivalCount, rivalStars, seasonLength, standings } from "../src/stable/leagues.js";
import { runLeagueRace, startNextSeason } from "../src/stable/leagueRace.js";
import { closeSeason, seasonEnd } from "../src/stable/seasonEnd.js";
import { fatigueLimit, restTime } from "../src/stable/condition.js";
import { divisionTeams, ownTeam, teams } from "../src/stable/teams.js";

const minute = 60_000;
const hour = 60 * minute;

/** A finished season of `division` where the owner's dragon finishes every race in `place`. */
function playedSeason(division, place) {
  const season = { league: "kids", number: 1, division, seed: "x", rivals: [], races: [], end: null };
  for (let index = 0; index < seasonLength; index++) {
    const order = Array.from({ length: rivalCount }, (_, i) => ({ id: `r${i}`, name: `Rival ${i}`, owned: false }));
    order.splice(place - 1, 0, { id: "mine", name: "Mine", owned: true });
    season.races.push({ index, division, at: index, results: order.map((r, i) => ({ ...r, place: i + 1, time: 100 + i })) });
  }
  return season;
}

test("a season is 16 races with points 10-8-6-5-4-3-2-1 and a field of 7 rivals plus one of the owner's", () => {
  assert.equal(seasonLength, 16);
  assert.deepEqual(points, [10, 8, 6, 5, 4, 3, 2, 1]);
  assert.equal(rivalCount, 7);
});

test("the top two promote and the bottom two relegate, but not out of Gold or Bronze", () => {
  assert.deepEqual(divisions.map((d) => d.id), ["bronze", "silver", "gold"]);
  assert.deepEqual([1, 2, 3, 6, 7, 8].map((rank) => zoneOf("silver", rank, 8)), ["promote", "promote", null, null, "relegate", "relegate"]);
  assert.deepEqual([1, 8].map((rank) => zoneOf("bronze", rank, 8)), ["promote", null]);
  assert.deepEqual([1, 8].map((rank) => zoneOf("gold", rank, 8)), [null, "relegate"]);
  assert.equal(divisionAfter("bronze", "promote"), "silver");
  assert.equal(divisionAfter("gold", "relegate"), "silver");
  assert.equal(divisionAfter("silver", null), "silver");
});

test("the division and the league set the rivals' stars", () => {
  for (const league of ["kids", "teens", "adults"]) {
    const mean = (division) => {
      const { rivals } = createSeason(genes, leagueOf(league), 1, "strength", division);
      assert.equal(rivals.length, rivalCount);
      const [lo, hi] = rivalStars[league][divisions.findIndex((d) => d.id === division)];
      assert.ok(rivals.every((r) => r.strength >= lo && r.strength <= hi), `${league} ${division} rivals sit in its band`);
      return rivals.reduce((sum, r) => sum + r.strength, 0) / rivals.length;
    };
    const [bronze, silver, gold] = divisions.map((d) => mean(d.id));
    assert.ok(bronze < silver && silver < gold, `${bronze} < ${silver} < ${gold}`);
  }
  assert.deepEqual(createSeason(genes, leagueOf("kids"), 1, "strength", "gold"), createSeason(genes, leagueOf("kids"), 1, "strength", "gold"), "seasons are deterministic");
});

test("a season's end gives the standings, the owner's outcome, the next division and the trophy", () => {
  const promoted = seasonEnd(playedSeason("bronze", 1), 5);
  assert.deepEqual([promoted.outcome, promoted.next, promoted.trophy, promoted.owner.rank], ["promoted", "silver", null, 1]);
  assert.equal(promoted.champion.id, "mine");
  assert.deepEqual(promoted.podium.map((r) => r.rank), [1, 2, 3]);
  assert.deepEqual(promoted.standings.map((r) => r.zone), ["promote", "promote", null, null, null, null, null, null]);
  const relegated = seasonEnd(playedSeason("silver", 8), 5);
  assert.deepEqual([relegated.outcome, relegated.next, relegated.owner.rank], ["relegated", "bronze", 8]);
  const stayed = seasonEnd(playedSeason("gold", 2), 5);
  assert.deepEqual([stayed.outcome, stayed.next, stayed.trophy], ["stayed", "gold", null], "second in Gold stays in Gold");
  const crowned = seasonEnd(playedSeason("gold", 1), 5);
  assert.deepEqual(crowned.trophy, { league: "kids", season: 1, division: "gold", id: "mine", name: "Mine", at: 5 });
});

test("rival stables sit in one division of a league, can race in every league and keep their rider", () => {
  for (const league of ["kids", "teens", "adults"]) {
    const seated = divisions.flatMap((d) => divisionTeams("teams", league, d.id, rivalCount).map((team) => team.id));
    assert.equal(new Set(seated).size, divisions.length * rivalCount, `${league} seats a stable once`);
  }
  const everywhere = teams.filter((team) => ["kids", "teens", "adults"].every((league) => divisions.some((d) => divisionTeams("teams", league, d.id, rivalCount).includes(team))));
  assert.ok(everywhere.length > 0, "some stables race in every league");
  const [one, two] = [1, 2].map((number) => createSeason(genes, leagueOf("teens"), number, "teams", "silver"));
  assert.deepEqual(one.rivals.map((r) => r.team), two.rivals.map((r) => r.team), "a division keeps its stables season after season");
  assert.deepEqual(one.rivals.map((r) => r.jockey), two.rivals.map((r) => r.jockey), "each with its own rider");
  assert.notDeepEqual(one.rivals.map((r) => r.genome), two.rivals.map((r) => r.genome), "racing new dragons");
});

test("standings are per stable: every dragon the owner races scores for the owner's row", () => {
  const season = playedSeason("silver", 3);
  season.races.forEach((race, i) => {
    for (const r of race.results) if (r.owned) Object.assign(r, { id: i < 4 ? "first" : "second", name: i < 4 ? "First" : "Second", team: ownTeam, teamName: "Me" });
  });
  const table = standings(season);
  assert.equal(table.length, rivalCount + 1);
  const mine = table.find((row) => row.owned);
  assert.deepEqual([mine.id, mine.name, mine.points, mine.starts], [ownTeam, "Me", 6 * seasonLength, seasonLength]);
  assert.deepEqual(mine.dragons.map((d) => [d.id, d.points]), [["first", 24], ["second", 72]]);
  assert.equal(mine.lead.id, "second");
});

test("a full season races 16 kids races, records the division and closes once", () => {
  const s = stockedStable(genes, "season", 0);
  const kid = s.dragons.find((w) => w.age === "kid");
  const league = s.leagues.kids;
  assert.equal(league.division, "bronze");
  const cards = new Set();
  let end = null;
  for (let i = 0; i < seasonLength; i++) {
    Object.assign(kid, { fatigue: 0, injury: null });
    cards.add(nextRaceCard(league).raceSeed);
    const run = runLeagueRace(s, "kids", kid.id, i * hour);
    assert.equal(run.race.division, "bronze");
    assert.equal(run.race.results.length, rivalCount + 1);
    if (i < seasonLength - 1) assert.equal(run.seasonEnd, null);
    else end = run.seasonEnd;
  }
  assert.equal(cards.size, seasonLength);
  assert.equal(kid.history[0].division, "bronze");
  assert.equal(runLeagueRace(s, "kids", kid.id, 0), null, "a finished season takes no more races");
  const table = standings(league);
  assert.ok(table.every((row) => row.starts === seasonLength), "every rival and the owner's kid start every race");
  assert.ok(end && league.end === end);
  assert.deepEqual(s.seasons, [end]);
  assert.equal(closeSeason(s, "kids", 0), null, "a season closes once");
  assert.deepEqual([end.owner.id, end.owner.lead.id, end.owner.name], [ownTeam, kid.id, s.owner.name]);
  assert.deepEqual(s.trophies, [], "only a Gold champion takes the trophy");
  const next = startNextSeason(s, genes, "kids");
  assert.deepEqual([next.number, next.division, next.races.length], [2, end.next, 0]);
});

test("the first ever race leaves the dragon fresh, later ones need about a quarter of an hour of rest", () => {
  const s = stockedStable(genes, "rest", 0);
  const kid = s.dragons.find((w) => w.age === "kid");
  runLeagueRace(s, "kids", kid.id, 0);
  assert.equal(kid.fatigue, 0, "no sleep after the first ever race");
  kid.injury = null;
  runLeagueRace(s, "kids", kid.id, hour);
  const fresh = restTime(kid);
  assert.ok(fresh > 10 * minute && fresh < 18 * minute, `rest from fresh ${fresh / minute} min`);
  kid.fatigue = fatigueLimit;
  kid.injury = null;
  runLeagueRace(s, "kids", kid.id, 2 * hour);
  const chained = restTime(kid);
  assert.ok(chained > 12 * minute && chained < 20 * minute, `rest when raced again at once ${chained / minute} min`);
});

test("a league race needs one fit owned entrant", () => {
  const s = stockedStable(genes, "none", 0);
  assert.equal(runLeagueRace(s, "kids", null, 0), null);
  const [first] = s.dragons.filter((w) => w.age === "kid");
  const run = runLeagueRace(s, "kids", first.id, 0);
  assert.deepEqual(run.race.results.filter((r) => r.owned).map((r) => r.id), [first.id]);
});
