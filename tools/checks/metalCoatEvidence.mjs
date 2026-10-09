// The metallic coats in the yard, for review: one adult per coat standing in the stable, at 1920×1080.
// Writes shots/metalCoats/<style>/<coat>.png.
//   node tools/checks/metalCoatEvidence.mjs [--style cozy] [--url http://127.0.0.1:8094] [--seed stable-7] [--looks none,gold,silver,goldSilver,silverGold] [--age adult] [--wait 2500]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, screenshot, sleep } from "../cdp.mjs";
import { metalCoats } from "../../src/genome/metalCoats.js";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const style = option("style", "cozy");
const base = option("url", "http://127.0.0.1:8094");
const seed = option("seed", "stable-7");
const looks = option("looks", "none,gold,silver,goldSilver,silverGold").split(",");
const age = option("age", "adult");
const wait = Number(option("wait", 2500));
const out = resolve(fileURLToPath(new URL("../../", import.meta.url)), "shots", "metalCoats", style);
const lock = join(tmpdir(), "dragonz-care-evidence.lock");

const seedStable = (genes) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const { needsOf } = await import("/src/stable/care.js");
  const stable = window.__game.game.stable;
  const now = stable.clock.game;
  const genome = { ...makeGenome((await loadSubject("dragon")).genes, ${JSON.stringify(seed)}), ...${JSON.stringify(genes)} };
  const dragon = createDragon({ seed: ${JSON.stringify(seed)}, genome, age: ${JSON.stringify(age)}, now });
  for (const n of needsOf(dragon.age)) dragon.care[n.id] = 90;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  stable.careTaught = true;
  window.__game.save();
  return dragon.id;
})()`;

for (;;) {
  try {
    await mkdir(lock);
    break;
  } catch {
    await sleep(500);
  }
}
try {
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: 1920, height: 1080 });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    for (const look of looks) {
      const metal = metalCoats.findIndex((coat) => coat.id === look);
      if (metal < 0) throw new Error(`Unknown look ${look}`);
      await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
      if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
      const id = await evaluate(session, seedStable({ metal }));
      await session.send("Page.navigate", { url: new URL(`/?style=${style}#/stable/${encodeURIComponent(id)}`, base).href });
      if (!(await waitFor(session, `document.querySelector(".stable-home [data-actions] > *")`, 20000))) throw new Error(`No stable for ${look}`);
      await sleep(wait);
      console.log(await screenshot(session, resolve(out, `${look}.png`)));
    }
    if (errors.length) console.warn(errors.join("\n"));
  } finally {
    await session.close();
  }
} finally {
  await rmdir(lock);
}
