import { createClock } from "./gameClock.js";
import { createSeason, leagues } from "./leagues.js";
import { createOwner } from "./owner.js";

/** A new, empty stable with the first season of every league; the welcome fills it (see `adoptStarter`). */
export function createStable(genes, seed, realNow) {
  const stable = {
    seed: String(seed),
    welcomed: false,
    owner: createOwner(seed),
    clock: createClock(realNow),
    eggs: [],
    dragons: [],
    wild: [],
    leagues: {},
    trophies: [],
    seasons: [],
    highscores: {},
  };
  for (const league of leagues) stable.leagues[league.id] = createSeason(genes, league, 1, seed);
  return stable;
}
