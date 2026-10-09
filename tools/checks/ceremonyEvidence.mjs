// The awards ceremony on a phone, for review: a season raced in full per case with the owner's
// place forced, then the ceremony as it swoops in, once the cup is handed out and scrolled to the
// standings, plus the owner's honours in the stable, on the profile and under More.
// Writes shots/ceremony/<style>/.
//   node tools/checks/ceremonyEvidence.mjs [--url http://127.0.0.1:8094] [--style cozy|lowPoly] [--case kids-gold-champion,...]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const CASES = {
  "kids-gold-champion": { league: "kids", division: "gold", place: 1 },
  "teens-silver-promoted": { league: "teens", division: "silver", place: 2 },
  "adults-bronze-off-podium": { league: "adults", division: "bronze", place: 6 },
  "kids-silver-relegated": { league: "kids", division: "silver", place: 8 },
};
const cases = option("case", Object.keys(CASES).join(",")).split(",");
const styles = option("style") ? [option("style")] : ["cozy"];
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));

/** A welcomed stable whose `league` season in `division` is over, the owner's dragon `place` in every race. */
function seedStable({ league, division, place }) {
  return `(async () => {
    const [{ makeGenome }, { createDragon }, { createStable }, { genes }, { createSeason, leagueOf, seasonLength }, { runLeagueRace }, { seasonEnd }] = await Promise.all([
      import("/src/subjects.js"), import("/src/stable/createDragon.js"), import("/src/stable/newStable.js"), import("/src/genome/dragon.js"),
      import("/src/stable/leagues.js"), import("/src/stable/leagueRace.js"), import("/src/stable/seasonEnd.js"),
    ]);
    const hour = 3600000;
    const stable = createStable(genes, "ceremony-evidence", Date.now());
    stable.welcomed = true;
    const info = leagueOf(${JSON.stringify(league)});
    for (const [i, age] of ["kid", "teen", "adult"].entries())
      stable.dragons.push(createDragon({ seed: "ceremony:" + i, genome: makeGenome(genes, "ceremony:" + i), age, now: 0, bond: 0.8 }));
    const dragon = stable.dragons.find((w) => w.age === info.age);
    stable.leagues[info.id] = createSeason(genes, info, 1, stable.seed, ${JSON.stringify(division)});
    for (let i = 0; i < seasonLength; i++) {
      Object.assign(dragon, { fatigue: 0, injury: null });
      runLeagueRace(stable, info.id, dragon.id, i * hour);
    }
    const season = stable.leagues[info.id];
    for (const race of season.races) {
      const mine = race.results.find((r) => r.owned), other = race.results.find((r) => r.place === ${place});
      [mine.place, other.place] = [other.place, mine.place];
    }
    const places = season.races.map((race) => race.results.find((r) => r.owned).place);
    dragon.history = dragon.history.map((h) => ({ ...h, place: places[h.race] }));
    dragon.record = { starts: places.length, wins: places.filter((p) => p === 1).length, podiums: places.filter((p) => p <= 3).length };
    stable.seasons = [];
    stable.trophies = [];
    season.end = seasonEnd(season, seasonLength * hour);
    stable.seasons.unshift(season.end);
    if (season.end.trophy) stable.trophies.push(season.end.trophy);
    Object.assign(dragon, { fatigue: 0, injury: null });
    stable.clock.game = (seasonLength + 1) * hour;
    window.__game.game.stable = stable;
    window.__game.save();
    return { id: dragon.id, league: info.id };
  })()`;
}

async function run(style, name) {
  const out = resolve(root, "shots", "ceremony", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const shot = async (label) => {
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    const path = resolve(out, `${name}-${label}.png`);
    await writeFile(path, Buffer.from(data, "base64"));
    console.log(path);
  };
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const { id, league } = await evaluate(session, seedStable(CASES[name]));
    await evaluate(session, `location.hash = "#/results/${league}/1/15"`);
    await sleep(1200);
    await evaluate(session, `document.querySelector(".results-ceremony")?.scrollIntoView({ block: "center" })`);
    await sleep(400);
    await shot("0-results");
    await evaluate(session, `location.hash = "#/ceremony/${league}/1"`);
    for (const [label, t] of [["1-swoop", 0.3], ["2-cup-falling", 2.4], ["3-handed-out", 6]]) {
      await evaluate(session, `window.__game.ceremony().stage.seek(${t})`);
      await sleep(700);
      await shot(label);
    }
    await evaluate(session, `document.getElementById("screens").scrollTop = 99999`);
    await sleep(500);
    await shot("4-standings");
    await evaluate(session, `location.hash = "#/stable/${id}"`);
    await sleep(2500);
    await shot("5-stable");
    await evaluate(session, `location.hash = "#/stable/${id}/profile"`);
    await sleep(1800);
    await evaluate(session, `document.querySelector('[data-tab="history"]')?.click()`);
    await sleep(800);
    await shot("6-profile-history");
    await evaluate(session, `location.hash = "#/more"`);
    await sleep(800);
    await shot("7-more-cabinet");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

for (const style of styles) for (const name of cases) await run(style, name);
