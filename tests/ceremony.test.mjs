import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { rivalCount, seasonLength } from "../src/stable/leagues.js";
import { runLeagueRace, startNextSeason } from "../src/stable/leagueRace.js";
import { findSeasonEnd, seasonEnd } from "../src/stable/seasonEnd.js";
import { honoursOf, medalOf, medalsOf, trophiesOf } from "../src/stable/honours.js";
import { podiumAnatomy, stepTop } from "../src/scene/podiumMesh.js";
import { trophyAnatomy } from "../src/scene/trophyMesh.js";
import { createConfetti } from "../src/scene/confetti.js";
import { makeSkinMesh } from "../src/skinMesh.js";

const hour = 3_600_000;

/** A finished season of `division` where the owner's dragon `id` finishes every race in `place`. */
function playedSeason(division, place, number = 1, id = "mine") {
  const season = { league: "kids", number, division, seed: "x", rivals: [], races: [], end: null };
  for (let index = 0; index < seasonLength; index++) {
    const order = Array.from({ length: rivalCount }, (_, i) => ({ id: `r${i}`, name: `Rival ${i}`, owned: false }));
    order.splice(place - 1, 0, { id, name: "Mine", owned: true });
    season.races.push({ index, division, at: index, results: order.map((r, i) => ({ ...r, place: i + 1, time: 100 + i })) });
  }
  return season;
}

test("a season's end keeps how the podium and the owner's dragon looked, ridden as they raced", () => {
  const s = stockedStable(genes, "ceremony", 0);
  const kid = s.dragons.find((w) => w.age === "kid");
  let end = null;
  for (let i = 0; i < seasonLength; i++) {
    Object.assign(kid, { fatigue: 0, injury: null });
    end = runLeagueRace(s, "kids", kid.id, i * hour).seasonEnd ?? end;
  }
  assert.ok(end);
  assert.equal(end.podium.length, 3);
  for (const row of [...end.podium, end.owner]) {
    assert.ok(row.look, `${row.name} has a look`);
    assert.equal(row.look.age, "kid");
    assert.ok(row.look.jockey?.silks, "every dragon is ridden");
  }
  assert.deepEqual(end.owner.look.jockey, s.owner, "the owner rides their own dragon");
  assert.deepEqual(end.owner.look.genome, kid.genome);
  assert.equal(end.champion, end.podium[0]);
  assert.equal(end.standings[0].look, undefined, "the standings stay plain");
  assert.equal(JSON.parse(JSON.stringify(end)).podium[0].look.genome.body, end.podium[0].look.genome.body, "it survives the save");

  assert.equal(findSeasonEnd(s, "kids", 1), end, "the ceremony reads the season waiting for Next season");
  startNextSeason(s, genes, "kids");
  assert.equal(findSeasonEnd(s, "kids", 1), end, "and the history once the next one began");
  assert.equal(findSeasonEnd(s, "kids", 2), null);
  assert.equal(findSeasonEnd(s, "teens", 1), null);
});

test("a season without race fields still ends, with no looks to stage", () => {
  const end = seasonEnd(playedSeason("bronze", 2), 5);
  assert.equal(end.podium[1].look, null);
  assert.equal(end.owner.look, null);
});

test("owned dragons on a season's podium win a medal of their place, Gold champions the trophy too", () => {
  const s = stockedStable(genes, "honours", 0);
  const ends = [seasonEnd(playedSeason("bronze", 1, 1), 1), seasonEnd(playedSeason("silver", 3, 2), 2), seasonEnd(playedSeason("silver", 5, 3), 3), seasonEnd(playedSeason("gold", 1, 4, "other"), 4)];
  for (const end of ends) {
    s.seasons.unshift(end);
    if (end.trophy) s.trophies.push(end.trophy);
  }
  assert.deepEqual(medalsOf(s).map((m) => [m.season, m.place, m.medal, m.division, m.id]), [
    [4, 1, "gold", "gold", "other"],
    [2, 3, "bronze", "silver", "mine"],
    [1, 1, "gold", "bronze", "mine"],
  ]);
  assert.deepEqual(trophiesOf(s).map((t) => [t.id, t.season, t.division]), [["other", 4, "gold"]]);
  const mine = honoursOf(s, "mine");
  assert.deepEqual([mine.trophies.length, mine.medals.length, mine.best, mine.count], [0, 2, "gold", 2]);
  const other = honoursOf(s, "other");
  assert.deepEqual([other.best, other.count], ["trophy", 2]);
  assert.deepEqual(honoursOf(s, "nobody"), { trophies: [], medals: [], best: null, count: 0 });
  assert.deepEqual([1, 2, 3, 4].map((p) => medalOf(p)?.id ?? null), ["gold", "silver", "bronze", null]);
});

test("the podium, the cup and the confetti are deterministic props the scene can draw", () => {
  const steps = [
    { x: 0, height: 1, halfWidth: 2, halfDepth: 1.5, medal: "gold" },
    { x: -4.5, height: 0.7, halfWidth: 2, halfDepth: 1.5, medal: "silver" },
    { x: 4.5, height: 0.4, halfWidth: 2, halfDepth: 1.5, medal: "bronze" },
  ];
  const podium = podiumAnatomy(steps, "silver");
  assert.deepEqual(podium, podiumAnatomy(steps, "silver"));
  assert.ok(stepTop(steps[0]) > stepTop(steps[1]) && stepTop(steps[1]) > stepTop(steps[2]), "first stands highest, third lowest");
  const cup = trophyAnatomy("gold", 1.5);
  for (const prop of [podium, cup]) {
    const mesh = makeSkinMesh(prop);
    assert.ok(mesh.vertices.length > 0);
    assert.ok(Number.isFinite(prop.bounds.radius) && prop.bounds.radius > 0);
  }
  const ys = cup.parts[0].vertices.filter((_, i) => i % 3 === 1);
  assert.ok(Math.abs(Math.max(...ys) - 1.5 * 0.96) < 1e-9 && Math.min(...ys) === 0, "the cup stands on its foot at its size");
  const options = { centre: [0, 0, 0], halfWidth: 8, halfDepth: 4, height: 10, size: 0.2, start: 1, seed: "s" };
  const a = createConfetti(options).build(4, [0, 5, 30]),
    b = createConfetti(options).build(4, [0, 5, 30]);
  assert.ok(a.count > 0);
  assert.deepEqual(a.data, b.data);
  assert.equal(createConfetti(options).build(0.5, [0, 5, 30]).count, 0, "none before it starts");
});
