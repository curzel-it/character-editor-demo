// Stars earned and still to earn on a phone: the stable's name plate and roster with the toast of a
// star just earned, the profile's Stars row and its ⓘ, and the race entry.
// Writes shots/stars/<style>/<lang>-*.png.
//   node tools/checks/starsEvidence.mjs [--url http://127.0.0.1:8094] [--style cozy|lowPoly] [--lang it,en]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate, bustCache, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const styles = option("style") ? [option("style")] : ["cozy"];
const langs = option("lang", "en,it").split(",");
const seed = Number(option("seed", 342450));
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));

const click = (selector) => `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node || node.disabled) return false; node.click(); return true; })()`;
const stable = "window.__game.game.stable";

async function run(style, lang) {
  const out = resolve(root, "shots", "stars", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const shot = async (label) => {
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    const path = resolve(out, `${lang}-${label}.png`);
    await writeFile(path, Buffer.from(data, "base64"));
    console.log(path);
  };
  const js = (expression) => evaluate(session, expression);
  const errors = await watchErrors(session);
  try {
    await session.send("Page.enable");
    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `localStorage.setItem("dragonz-language", "${lang}"); if (!localStorage.getItem("dragonz-stable")) { const random = Math.random; Math.random = () => ((Math.random = random), ${(seed + 0.5) / 1e6}); }`,
    });
    await emulateDevice(session, PHONE);
    await navigate(session, new URL(`/?style=${style}`, base).href);
    if (!(await waitFor(session, `window.__game && location.hash === "#/welcome"`, 20000))) throw new Error(`No welcome on a new stable: ${errors.join("\n")}`);
    await sleep(2000);
    for (let n = 0; n < 3; n++) {
      await js(click(".welcome [data-next]"));
      await sleep(2200);
    }
    await js(`(async () => {
      const { createDragon } = await import("/src/stable/createDragon.js");
      const { makeGenome } = await import("/src/subjects.js");
      const genes = (await import("/src/genome/dragon.js")).genes;
      const s = ${stable};
      Object.assign(s, { careTaught: true, reinsInvited: true, reinsTaught: true });
      const kid = s.dragons[0];
      kid.strength = 2.08;
      kid.starsCelebrated = 2;
      const adult = createDragon({ seed: "stars-adult", genome: makeGenome(genes, "stars-adult"), age: "kid", strength: 5 });
      s.dragons.push(adult);
      window.__game.save();
    })()`);
    const kid = await js(`${stable}.dragons[0].id`);
    await navigate(session, bustCache(new URL(`/?style=${style}&lang=${lang}#/stable/${kid}`, base).href, `stars-${lang}`));
    await waitFor(session, `window.__game && location.hash.startsWith("#/stable")`, 20000);
    await sleep(1500);
    await js(`${stable}.dragons[0].starsCelebrated = 1`);
    if (!(await waitFor(session, `document.querySelector(".dz-toast")`, 5000))) errors.push("No star toast");
    await sleep(500);
    await shot("stable-toast");
    await js(`location.hash = "#/stable/${kid}/profile"`);
    await sleep(2000);
    await js(`document.querySelector('[data-meter="stars"]')?.scrollIntoView({ block: "center" })`);
    await sleep(500);
    await shot("profile-stars");
    if (await js(click('[data-meter="stars"] .dz-info'))) {
      await sleep(500);
      await shot("profile-stars-info");
    }
    await js(`location.hash = "#/league/kids/entry/${kid}"`);
    await sleep(1800);
    await shot("entry");
  } finally {
    await session.close();
  }
  return errors;
}

let failed = false;
for (const style of styles)
  for (const lang of langs)
    for (const problem of await run(style, lang)) {
      failed = true;
      console.error(`${style} ${lang}: ${problem}`);
    }
if (failed) process.exitCode = 1;
