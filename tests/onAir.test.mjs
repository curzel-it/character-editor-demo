import test from "node:test";
import assert from "node:assert/strict";
import { genes } from "../src/genome/dragon.js";
import { stockedStable } from "./stableHelpers.mjs";
import { entryBlock, finishLeagueRace, startLeagueRace } from "../src/stable/leagueRace.js";
import { evolve, stageDurations } from "../src/stable/lifeStages.js";
import { onAirLeague } from "../src/stable/onAir.js";
import { ritualBlock } from "../src/stable/soulAltar.js";
import { sendToWild, wildBlock } from "../src/stable/wild.js";

const hour = 3_600_000;

test("a dragon on air cannot race elsewhere, evolve, go to the wild or hold a ritual until its race finishes", () => {
  const s = stockedStable(genes, "on-air", 0);
  const kid = s.dragons.find((w) => w.age === "kid");
  kid.growth = stageDurations.kid;
  assert.ok(startLeagueRace(s, "kids", kid.id, hour));
  assert.equal(onAirLeague(s, kid.id), "kids");
  assert.equal(entryBlock(s, kid, "kids", hour), "onAir");
  assert.equal(evolve(s, kid), null, "a kid on air stays a kid");
  kid.age = "teen";
  assert.equal(entryBlock(s, kid, "teens", hour), "onAir", "nor races in another league");
  assert.equal(startLeagueRace(s, "teens", kid.id, hour), null);
  kid.age = "kid";
  finishLeagueRace(s, "kids", s.leagues.kids.live.field.participants.map((p, i) => ({ id: p.id, place: i + 1, time: 60 + i })), hour);
  assert.equal(onAirLeague(s, kid.id), null);
  assert.equal(evolve(s, kid), "teen", "it grows once the race is over");

  const [adult, other] = s.dragons.filter((w) => w.age === "adult");
  assert.ok(startLeagueRace(s, "adults", adult.id, hour));
  assert.equal(wildBlock(s, adult.id), "onAir");
  assert.equal(sendToWild(s, adult.id, hour), null);
  assert.deepEqual(ritualBlock(s, [adult, other], hour), { code: "ritual.unfit", name: adult.name, reason: "onAir" });
});
