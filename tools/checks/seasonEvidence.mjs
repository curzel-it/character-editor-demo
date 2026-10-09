// A new owner's whole first season on a phone, for review: the welcome with the rider's name and
// silks, the kid's care, warming and hatching the gift egg, the single-pick race entry, the first
// race on air with its invitation, taking the reins and handing back, a reload mid-race that
// resumes it, the season run to its last race, the awards ceremony and the next season's division,
// then the kid grown to a teen and an adult with their needs. The game clock is moved with
// `__game.away` and the season's middle races with `runLeagueRace`.
// Writes shots/season/<style>/ and prints what did not hold.
//   node tools/checks/seasonEvidence.mjs [--url http://127.0.0.1:8094] [--style cozy|lowPoly] [--seed 342450]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate, bustCache, key, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const styles = option("style") ? [option("style")] : ["cozy"];
const seed = Number(option("seed", 342450));
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));
const minute = 60_000,
  hour = 60 * minute;

const change = (selector, value) => `(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  node.value = ${JSON.stringify(value)};
  node.dispatchEvent(new Event("change", { bubbles: true }));
})()`;
const click = (selector) => `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node || node.disabled) return false; node.click(); return true; })()`;
const stable = "window.__game.game.stable";

async function run(style) {
  const out = resolve(root, "shots", "season", style);
  await mkdir(out, { recursive: true });
  const problems = [];
  const expect = (ok, text) => {
    if (!ok) problems.push(text);
  };
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  let shots = 0;
  const shot = async (label) => {
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    const path = resolve(out, `${String(++shots).padStart(2, "0")}-${label}.png`);
    await writeFile(path, Buffer.from(data, "base64"));
    console.log(path);
  };
  const js = (expression) => evaluate(session, expression);
  const away = async (ms, { sheet = false } = {}) => {
    await js(`window.__game.away(${ms})`);
    await sleep(sheet ? 1500 : 300);
    if (sheet) await shot(sheet);
    await js(`location.hash === "#/away" && location.replace("#/stable")`);
    await sleep(300);
  };
  const go = async (hash, wait = 1200) => {
    await js(`location.hash = ${JSON.stringify(hash)}`);
    await sleep(wait);
  };
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (!localStorage.getItem("dragonz-stable")) { const random = Math.random; Math.random = () => ((Math.random = random), ${(seed + 0.5) / 1e6}); }`,
    });
    await emulateDevice(session, PHONE);
    await navigate(session, new URL(`/?style=${style}`, base).href);
    if (!(await waitFor(session, `window.__game && location.hash === "#/welcome"`, 20000))) throw new Error(`No welcome on a new stable: ${errors.join("\n")}`);
    await sleep(2500);
    await js(change("[data-owner-name]", "Fede Curzel"));
    await js(click('[data-tab="silks"]'));
    await js(change("[data-silk-pattern]", "hoops"));
    await js(change('[data-silk="0"]', "navy"));
    await js(change('[data-silk="1"]', "gold"));
    await sleep(1500);
    await shot("welcome-rider");
    await js(click(".welcome [data-next]"));
    await sleep(2500);
    await shot("welcome-pick");
    await js(click(".welcome [data-next]"));
    await sleep(2500);
    await shot("welcome-gift");
    await js(click(".welcome [data-next]"));
    await sleep(2500);
    expect((await js(`location.hash`)) === "#/stable", "The welcome did not end in the stable");
    const kid = await js(`${stable}.dragons[0].id`);
    const egg = await js(`${stable}.eggs[0].id`);
    await js(`window.__game.game.stable.clock.speed = 1`);
    await shot("stable-kid");

    await js(click(`[data-id="${egg}"]`));
    await sleep(2000);
    await shot("egg");
    for (let n = 0; n < 4; n++) {
      await js(click('[data-action="nudge"]'));
      await sleep(200);
      await away(24 * hour);
    }
    expect((await js(`${stable}.eggs[0]?.warms`)) === 4, `The egg took ${await js(`${stable}.eggs[0]?.warms`)} warms of 4`);
    await shot("egg-warmed");

    await away(3 * hour, { sheet: "away" });
    await go("#/stable", 1500);
    await js(click(`[data-id="${kid}"]`));
    await sleep(1500);
    const kidNeeds = await js(`JSON.stringify(${stable}.dragons[0].care)`);
    const tile = await js(`[...document.querySelectorAll("[data-actions] [data-action]")].map((b) => b.dataset.action).join()`);
    expect(/feed|play|clean/.test(tile) && !/exercise|groom/.test(tile), `A kid's care tile should be Feed, Play or Clean, got ${tile}`);
    await shot("kid-needs");
    for (let n = 0; n < 6; n++) {
      const action = await js(`document.querySelector('[data-actions] [data-action]:last-child').dataset.action`);
      await js(click(`[data-action="${action}"]`));
      await sleep(400);
    }
    const cared = await js(`JSON.stringify(${stable}.dragons[0].care)`);
    console.log(`kid needs ${kidNeeds} -> ${cared}`);
    await shot("kid-cared");

    await js(click(`[data-id="${egg}"]`));
    await sleep(1500);
    await shot("egg-ready");
    for (let n = 0; n < 3; n++) {
      expect(await js(click('[data-action="hatch"]')), "Hatch was not offered once the egg was ready");
      await sleep(n < 2 ? 700 : 1800);
    }
    await shot("hatching");
    await sleep(5000);
    await shot("hatched");
    expect((await js(`${stable}.dragons.length`)) === 2 && (await js(`${stable}.eggs.length`)) === 0, "The egg did not hatch into a second kid");
    const bond = await js(`${stable}.dragons.find((w) => w.id !== ${JSON.stringify(kid)})?.bond`);
    expect(bond > 0.2, `A hatchling warmed four times should start with a bond above 0.2, got ${bond}`);

    await go("#/league/kids/entry", 1500);
    expect(await js(`document.querySelector("[data-start]").disabled`), "Start race was not waiting for a pick");
    expect((await js(`document.querySelectorAll("[data-pick]").length`)) === 2, "Both kids should be offered in the entry");
    await shot("entry-unpicked");
    await js(click(`[data-pick="${kid}"]`));
    await sleep(800);
    expect((await js(`document.querySelectorAll('[data-pick][aria-checked="true"]').length`)) === 1, "Exactly one kid should be picked");
    expect((await js(`document.querySelectorAll(".entry-field li").length`)) === 8, "The field should be eight with the pick");
    await shot("entry-picked");
    await js(click("[data-start]"));
    if (!(await waitFor(session, "window.__game.broadcast().live && window.__game.broadcast().race", 30000))) throw new Error("The race did not go on air");
    if (!(await waitFor(session, `!document.querySelector(".reins-tour").hidden`, 30000))) problems.push("No invitation to take the reins in the first race");
    expect((await js(`window.__game.broadcast().time`)) < 0, "The invitation should open on the grid, before Go");
    await sleep(500);
    await shot("tour-autopilot");
    await js(click('.reins-tour [data-tour="next"]'));
    await sleep(500);
    await shot("tour-reins");
    await js(click('[data-action="reins"]'));
    await sleep(800);
    await shot("tour-stick");
    await js(click('.reins-tour [data-tour="skip"]'));
    await sleep(1500);
    await shot("riding-countdown");
    await waitFor(session, "window.__game.broadcast().time > 1", 15000);
    await key(session, "Space", true);
    await sleep(2500);
    await shot("riding-chase");
    await js(click('[data-action="camera"]'));
    await sleep(2000);
    await shot("riding-rider-camera");
    await js(click('[data-action="camera"]'));
    await key(session, "ArrowLeft", true);
    await sleep(1200);
    await key(session, "ArrowLeft", false);
    await sleep(1500);
    await key(session, "Space", false);
    const riding = await js(`window.__game.broadcast().live.riding`);
    expect(riding, "Take the reins did not hand the dragon to the owner");
    const logged = await js(`${stable}.leagues.kids.live.ride.log.length`);
    expect(logged > 0, "Riding left no input in the log");
    await js(click('[data-action="reins"]'));
    await sleep(600);
    await shot("handback");
    await sleep(2500);
    await shot("autopilot-again");
    expect(!(await js(`window.__game.broadcast().live.riding`)), "Autopilot did not take the dragon back");
    const before = await js(`(window.__game.save(), JSON.stringify({ step: ${stable}.leagues.kids.live.step, log: ${stable}.leagues.kids.live.ride.log.length }))`);
    await navigate(session, bustCache(new URL(`/?style=${style}#/live/kids`, base).href, "resume"));
    if (!(await waitFor(session, "window.__game && window.__game.broadcast().live && window.__game.broadcast().race", 30000))) problems.push("The race did not resume after a reload");
    await sleep(1500);
    const after = await js(`JSON.stringify({ step: ${stable}.leagues.kids.live?.step, log: ${stable}.leagues.kids.live?.ride.log.length, hash: location.hash })`);
    console.log(`resume ${before} -> ${after}`);
    expect(JSON.parse(after).step >= JSON.parse(before).step && JSON.parse(after).log === JSON.parse(before).log, `The race did not resume where it stopped: ${before} -> ${after}`);
    await shot("resumed");
    await js(click('[data-action="skip"]'));
    if (!(await waitFor(session, `location.hash.startsWith("#/results/")`, 30000))) problems.push("Skipping the race on air did not open its results");
    await sleep(1500);
    await shot("results");
    const first = await js(`JSON.stringify(${stable}.leagues.kids.races[0].results.find((r) => r.owned))`);
    console.log(`first race ${first}`);
    expect(await js(`Boolean(${stable}.leagues.kids.races[0].ride)`), "The ridden race did not keep its ride for Watch again");
    const replayed = await js(`(async () => {
      const { simulateRace } = await import("/src/race/simulateRace.js");
      const { fieldCourse } = await import("/src/fieldCourse.js");
      const { raceRoster } = await import("/src/raceField.js");
      const race = ${stable}.leagues.kids.races[0];
      const again = simulateRace({ seed: race.field.raceSeed, course: fieldCourse(race.field), roster: raceRoster(race.field), ride: race.ride });
      const order = (results) => results.map((r) => r.id + ":" + r.time.toFixed(3)).join();
      return order(again.results) === order(race.results) ? "same" : order(race.results) + " vs " + order(again.results);
    })()`);
    expect(replayed === "same", `Watch again does not replay the ridden, resumed race: ${replayed}`);

    await go("#/stable", 800);
    const fit = `(async () => {
      const { entryBlock } = await import("/src/stable/leagueRace.js");
      const s = window.__game.game.stable;
      return entryBlock(s, s.dragons.find((w) => w.id === ${JSON.stringify(kid)}), "kids", s.clock.game);
    })()`;
    const rest = async () => {
      for (let n = 0; n < 40 && (await js(fit)); n++) await away(10 * minute);
    };
    let skipped = 0;
    while ((await js(`${stable}.leagues.kids.races.length`)) < 15) {
      await rest();
      const ran = await js(`(async () => {
        const { runLeagueRace } = await import("/src/stable/leagueRace.js");
        const { applyCare, careActionFor } = await import("/src/stable/care.js");
        const s = window.__game.game.stable;
        const dragon = s.dragons.find((w) => w.id === ${JSON.stringify(kid)});
        for (let k = 0; k < 4; k++) applyCare(dragon, careActionFor(dragon).id);
        return Boolean(runLeagueRace(s, "kids", dragon.id, s.clock.game));
      })()`);
      if (!ran && ++skipped > 3) throw new Error(`The season stalled: ${await js(fit)}`);
    }
    await rest();
    await go("#/league/kids", 1500);
    await shot("league-before-last");
    await go("#/league/kids/entry", 1500);
    await js(click(`[data-pick="${kid}"]`));
    await sleep(500);
    await js(click("[data-start]"));
    if (!(await waitFor(session, "window.__game.broadcast().live && window.__game.broadcast().race", 30000))) problems.push("The last race did not go on air");
    await sleep(1500);
    expect(await js(`document.querySelector(".reins-tour").hidden`), "The invitation came back after it was answered");
    await js(click('[data-action="skip"]'));
    if (!(await waitFor(session, `location.hash.startsWith("#/results/")`, 30000))) problems.push("The last race did not open its results");
    await sleep(1500);
    await shot("last-results");
    expect(await js(`Boolean(document.querySelector('a[href^="#/ceremony/"]'))`), "The last race's results did not lead to the ceremony");
    const end = await js(`JSON.stringify((({ outcome, division, next, owner }) => ({ outcome, division, next, rank: owner?.rank, points: owner?.points }))(${stable}.leagues.kids.end))`);
    console.log(`season end ${end}`);
    await js(click('a[href^="#/ceremony/"]'));
    if (!(await waitFor(session, `location.hash.startsWith("#/ceremony/")`, 10000))) problems.push("No ceremony");
    await sleep(2500);
    await shot("ceremony-podium");
    await sleep(6000);
    await shot("ceremony-cup");
    await js(`document.querySelector(".screen.ceremony")?.scrollTo?.(0, 9999); document.querySelector("#screens").scrollTop = 9999`);
    await sleep(800);
    await shot("ceremony-outcome");
    expect(await js(click("[data-next-season]")), "The ceremony did not offer the next season");
    await sleep(1500);
    const next = await js(`JSON.stringify({ number: ${stable}.leagues.kids.number, division: ${stable}.leagues.kids.division, hash: location.hash })`);
    console.log(`next season ${next}`);
    expect(JSON.parse(next).number === 2, `The next season did not start: ${next}`);
    expect(JSON.parse(next).division === JSON.parse(end).next, `The next season is not in the division the end named: ${next} vs ${end}`);
    await go("#/league/kids", 1500);
    await shot("next-season");

    const dragonJs = `${stable}.dragons.find((w) => w.id === ${JSON.stringify(kid)})`;
    const careFor = (rounds) => js(`(async () => {
      const { applyCare, careActionFor } = await import("/src/stable/care.js");
      for (let k = 0; k < ${rounds}; k++) applyCare(${dragonJs}, careActionFor(${dragonJs}).id);
    })()`);
    const growUp = async () => {
      for (let n = 0; n < 24 && !(await js(`(async () => (await import("/src/stable/lifeStages.js")).readyToEvolve(${dragonJs}))()`)); n++) {
        await careFor(4);
        await away(hour);
      }
    };
    const tiles = () => js(`[...document.querySelectorAll("[data-actions] [data-action]")].map((b) => b.dataset.action).join()`);
    const needs = () => js(`JSON.stringify(${dragonJs}.care)`);
    const evolveTo = async (age) => {
      await growUp();
      await go("#/stable", 800);
      await js(click(`[data-id="${kid}"]`));
      await sleep(1500);
      expect(await js(click('[data-action="evolve"]')), `Evolve was not offered on the way to ${age}`);
      await sleep(6500);
      expect((await js(`${dragonJs}.age`)) === age, `The dragon did not become a ${age}`);
      await shot(age);
    };
    await evolveTo("teen");
    await away(5 * hour);
    await go("#/stable", 800);
    await js(click(`[data-id="${kid}"]`));
    await sleep(1500);
    const teenTile = await tiles();
    console.log(`teen needs ${await needs()} tile ${teenTile}`);
    expect(/exercise/.test(await js(`(async () => (await import("/src/stable/care.js")).needsOf("teen").map((n) => n.id).join())()`)), "A teen has no exercise need");
    await shot("teen-needs");
    await careFor(3);
    await js(`${dragonJs}.care.exercise = 10`);
    await go("#/stable", 800);
    await sleep(1200);
    expect(/exercise/.test(await tiles()), `A teen with exercise lowest should show Exercise, got ${await tiles()}`);
    await shot("teen-exercise");
    await evolveTo("adult");
    await careFor(6);
    await js(`${dragonJs}.care.affection = 20`);
    await go("#/stable", 800);
    await sleep(1200);
    const adultTile = await tiles();
    console.log(`adult needs ${await needs()} tile ${adultTile}`);
    expect(/groom/.test(adultTile), `An adult with affection lowest should show Groom, got ${adultTile}`);
    await shot("adult-needs");
    await js(click('[data-action="profile"]'));
    await sleep(1500);
    await shot("adult-profile");
    await go("#/more", 1200);
    await shot("more");
    await go("#/more/profile", 1200);
    await shot("more-profile");
    if (errors.length) problems.push(...errors);
  } finally {
    await session.close();
  }
  return problems;
}

let failed = false;
for (const style of styles) {
  const problems = await run(style);
  for (const p of problems) console.error(`${style}: ${p}`);
  failed ||= problems.length > 0;
}
process.exit(failed ? 1 : 0);
