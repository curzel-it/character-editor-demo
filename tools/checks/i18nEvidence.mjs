// The stable, its first-visit tour, the profile tabs and While you were away on a phone, in a language.
// Writes shots/i18n/<style>/<lang>-<view>.png.
//   node tools/checks/i18nEvidence.mjs [--style cozy|lowPoly] [--lang it|en] [--url http://127.0.0.1:8094]
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
  const { createEgg } = await import("/src/stable/egg.js");
  const { makeGenome, loadSubject } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const now = stable.clock.game;
  const adult = createDragon({ seed: "i18n-a", genome: makeGenome(genes, "i18n-a"), age: "adult", now });
  const teen = createDragon({ seed: "i18n-t", genome: makeGenome(genes, "i18n-t"), age: "teen", now });
  for (const id of Object.keys(adult.care)) adult.care[id] = 90;
  for (const id of Object.keys(teen.care)) teen.care[id] = 90;
  adult.care.fullness = 30;
  stable.dragons = [adult, teen];
  stable.eggs = [createEgg("i18n-egg", now)];
  stable.welcomed = true;
  stable.careTaught = false;
  window.__game.save();
  return [adult.id, teen.id, stable.eggs[0].id];
})()`;

async function run(lang) {
  const out = resolve(root, "shots", "i18n", style);
  await mkdir(out, { recursive: true });
  const shot = async (session, view) => console.log(await screenshot(session, resolve(out, `${lang}-${view}.png`)));
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    await evaluate(session, `localStorage.setItem("dragonz-language", "${lang}")`);
    const [adult, , egg] = await evaluate(session, seedStable);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}&lang=${lang}#/stable/${encodeURIComponent(adult)}`, base).href });
    if (!(await waitFor(session, "document.querySelector('[data-action]')", 20000))) throw new Error(`No stable: ${errors.join("\n")}`);
    await sleep(2500);
    for (let step = 1; await evaluate(session, `Boolean(document.querySelector('.stable-tour:not([hidden])'))`); step++) {
      await shot(session, `tour-${step}`);
      await evaluate(session, `(document.querySelector('.stable-tour [data-tour="next"]:not([hidden])') ?? document.querySelector('.stable-tour [data-tour="skip"]')).click()`);
      await sleep(400);
    }
    await shot(session, "stable");
    for (const tab of ["overview", "traits", "history"]) {
      await evaluate(session, `location.hash = "#/stable/${encodeURIComponent(adult)}/profile"`);
      await sleep(600);
      await evaluate(session, `document.querySelector('[data-tab="${tab}"]').click()`);
      await sleep(400);
      await shot(session, `profile-${tab}`);
    }
    await evaluate(session, `location.hash = "#/stable/${encodeURIComponent(egg)}"`);
    await sleep(1500);
    await shot(session, "egg");
    await evaluate(session, `location.hash = "#/stable"; window.__game.away(6 * 3600_000)`);
    await sleep(1500);
    await shot(session, "away");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

for (const lang of langs) await run(lang);
