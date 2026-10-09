// A kid ready to evolve, evolved into a teen from its Evolve tile: the growth, then the breath reveal
// with its demo. Writes shots/breathReveal/<style>/<breath>-<lang>-<t>.png.
//   node tools/checks/breathRevealEvidence.mjs [--breath fire|nature|earth|storm|water] [--lang en|it]
//     [--style cozy|lowPoly] [--times 2,6,7,9] [--seed 7] [--url http://127.0.0.1:8094]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const breaths = ["fire", "nature", "earth", "storm", "water"];
const breath = option("breath", "fire");
const lang = option("lang", "en");
const styles = option("style") ? [option("style")] : ["cozy"];
const times = option("times", "2,6,7,9").split(",").map(Number);
const seed = option("seed", "7");
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));
const lock = join(tmpdir(), "dragonz-care-evidence.lock");

/** Waits for the browser lock, shared by every checkout, so parallel checks never share the GPU. */
async function acquire() {
  for (;;) {
    try {
      await mkdir(lock);
      return;
    } catch {
      await sleep(500);
    }
  }
}

const seedStable = `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const { needsOf } = await import("/src/stable/care.js");
  const { stageDurations } = await import("/src/stable/lifeStages.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const genome = { ...makeGenome(genes, "breath-${seed}"), breath: ${breaths.indexOf(breath)} };
  const dragon = createDragon({ seed: "breath-${seed}", genome, age: "kid", now: stable.clock.game });
  for (const n of needsOf(dragon.age)) dragon.care[n.id] = 95;
  dragon.growth = stageDurations.kid;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  stable.careTaught = true;
  window.__game.save();
  localStorage.setItem("dragonz-language", ${JSON.stringify(lang)});
  return dragon.id;
})()`;

async function run(style) {
  const out = resolve(root, "shots", "breathReveal", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const id = await evaluate(session, seedStable);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}&reload=1#/stable/${encodeURIComponent(id)}`, base).href });
    if (!(await waitFor(session, `document.querySelector('[data-action="evolve"]')`, 20000))) throw new Error(`No Evolve tile: ${errors.join("\n")}`);
    await sleep(1500);
    await evaluate(session, `document.querySelector('[data-action="evolve"]').click()`);
    let elapsed = 0;
    for (const t of times) {
      await sleep((t - elapsed) * 1000);
      elapsed = t;
      console.log(await screenshot(session, resolve(out, `${breath}-${lang}-${t.toFixed(1)}.png`)));
    }
    const card = await evaluate(session, `document.querySelector(".breath-reveal:not([hidden]) .breath-reveal__title")?.textContent ?? null`);
    if (!card) throw new Error("The breath reveal did not open");
    await evaluate(session, `location.hash = "#/race"`);
    await sleep(500);
    await evaluate(session, `location.hash = "#/stable"`);
    await sleep(500);
    if (await evaluate(session, `Boolean(document.querySelector(".breath-reveal:not([hidden])"))`)) throw new Error("The breath reveal outlived leaving the stable");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

await acquire();
try {
  for (const style of styles) await run(style);
} finally {
  await rmdir(lock);
}
