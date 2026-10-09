// A live league race on a phone, in a language: the reins tour, the grid and countdown, the broadcast
// on Autopilot, riding, the commentary and the results. Writes shots/i18n/<style>/race-<lang>-<view>.png
// and prints the words on screen at each step.
//   node tools/checks/raceI18nEvidence.mjs [--style cozy|lowPoly] [--lang it,en] [--url http://127.0.0.1:8094]
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const style = option("style", "cozy");
const langs = option("lang", "it,en").split(",");
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));

const seedStable = `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { makeGenome, loadSubject } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const now = stable.clock.game;
  const teen = createDragon({ seed: "i18n-race", genome: makeGenome(genes, "i18n-race"), age: "teen", now });
  for (const id of Object.keys(teen.care)) teen.care[id] = 95;
  stable.dragons = [teen];
  stable.welcomed = true;
  stable.careTaught = true;
  stable.reinsInvited = false;
  stable.reinsTaught = false;
  window.__game.save();
  return teen.id;
})()`;

const startRace = (id) => `(async () => {
  const { startLeagueRace } = await import("/src/stable/leagueRace.js");
  const stable = window.__game.game.stable;
  startLeagueRace(stable, "teens", ${JSON.stringify(id)}, stable.clock.game);
  window.__game.save();
  location.hash = "#/live/teens";
})()`;

const words = `[...document.querySelectorAll(".broadcast .broadcast__title, .broadcast [data-mode], .broadcast [data-line], .broadcast__reins, .broadcast [data-camera-label], .dz-countdown:not([hidden]), .reins.is-on .reins__gauges, .reins.is-on .rider-controls__pedals, .reins-tour:not([hidden]) .coach-marks__card, .reins-tour:not([hidden]) [class*=card]")]
  .filter((n) => n.offsetParent || n.getClientRects().length).map((n) => n.textContent.replace(/\\s+/g, " ").trim()).filter(Boolean).join(" | ")`;

async function run(lang) {
  const out = resolve(root, "shots", "i18n", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const shot = async (view) => {
    console.log(`${lang} ${view}: ${await evaluate(session, words)}`);
    console.log(await screenshot(session, resolve(out, `race-${lang}-${view}.png`)));
  };
  const next = `document.querySelector('.reins-tour [data-tour="next"]').click()`;
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    await evaluate(session, `localStorage.setItem("dragonz-language", "${lang}")`);
    const id = await evaluate(session, seedStable);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}&lang=${lang}#/stable`, base).href });
    if (!(await waitFor(session, "window.__game && document.querySelector('[data-action]')", 20000))) throw new Error(`No stable: ${errors.join("\n")}`);
    await evaluate(session, startRace(id));
    if (!(await waitFor(session, "window.__game.broadcast().live && window.__game.broadcast().race", 30000))) throw new Error("The race did not go on air");
    if (!(await waitFor(session, `!document.querySelector(".reins-tour").hidden`, 30000))) throw new Error("No reins invitation");
    await sleep(600);
    await shot("tour-autopilot");
    await evaluate(session, next);
    await sleep(600);
    await shot("tour-reins");
    await evaluate(session, `document.querySelector('.reins-tour [data-tour="skip"]')?.click() ?? document.querySelector('.reins-tour [data-tour="next"]').click()`);
    await sleep(300);
    if (!(await waitFor(session, "window.__game.broadcast().time > -3", 10000))) throw new Error("The grid did not run");
    await sleep(200);
    await shot("countdown");
    if (!(await waitFor(session, "window.__game.broadcast().time > 0.2", 10000))) throw new Error("No Go");
    await shot("go");
    if (!(await waitFor(session, "window.__game.broadcast().time > 6", 20000))) throw new Error("The race did not get going");
    await shot("autopilot");
    await evaluate(session, `document.querySelector('[data-action="reins"]').click()`);
    for (const view of ["tour-stick", "tour-pedals", "tour-gauges", "tour-back"]) {
      await sleep(700);
      await shot(view);
      await evaluate(session, next);
    }
    await sleep(2500);
    await shot("riding");
    await evaluate(session, `document.querySelector('[data-action="reins"]').click()`);
    await sleep(3000);
    await shot("autopilot-again");
    const lines = new Set();
    for (let n = 0; n < 40 && !(await evaluate(session, `location.hash.startsWith("#/results/")`)); n++) {
      lines.add(await evaluate(session, `document.querySelector(".broadcast [data-line]")?.textContent ?? ""`));
      await evaluate(session, `document.querySelector('.broadcast [data-action="speed"]').click()`);
      await sleep(700);
    }
    console.log(`${lang} commentary:\n  ${[...lines].filter(Boolean).join("\n  ")}`);
    await evaluate(session, `location.hash.startsWith("#/results/") || document.querySelector('.broadcast [data-action="skip"]').click()`);
    if (!(await waitFor(session, `location.hash.startsWith("#/results/")`, 30000))) throw new Error("No results");
    await sleep(2500);
    await shot("results");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

for (const lang of langs) await run(lang);
