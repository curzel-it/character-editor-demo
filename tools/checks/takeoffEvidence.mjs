// An adult sent to the wild from its profile, flying off the yard. Writes shots/takeoff/<style>/<seed>-<ms>.png
// for as many frames as the browser can capture during the take-off.
//   node tools/checks/takeoffEvidence.mjs [--style cozy|lowPoly] [--seed 7] [--sleep] [--url http://127.0.0.1:8094]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const styles = option("style") ? [option("style")] : ["cozy"];
const seed = option("seed", "7");
const asleep = args.includes("--sleep");
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const LENGTH = 3200;
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
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const make = (name) => {
    const dragon = createDragon({ seed: name, genome: makeGenome(genes, name), age: "adult", now: stable.clock.game });
    for (const n of needsOf(dragon.age)) dragon.care[n.id] = ${asleep ? 5 : 95};
    return dragon;
  };
  stable.dragons = [make("takeoff-${seed}"), make("takeoff-${seed}-stays")];
  stable.eggs = [];
  stable.welcomed = true;
  stable.careTaught = true;
  window.__game.save();
  return stable.dragons[0].id;
})()`;

async function run(style) {
  const out = resolve(root, "shots", "takeoff", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const id = await evaluate(session, seedStable);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}&reload=1#/stable/${encodeURIComponent(id)}/profile`, base).href });
    if (!(await waitFor(session, `document.querySelector('.profile-sheet__tab[data-tab="history"]')`, 20000))) throw new Error(`No profile: ${errors.join("\n")}`);
    await sleep(1500);
    await evaluate(session, `document.querySelector('.profile-sheet__tab[data-tab="history"]').click()`);
    await sleep(300);
    await evaluate(session, `document.querySelector('[data-sheet-action="wild"]').click()`);
    await sleep(300);
    await evaluate(session, `document.querySelector('[data-sheet-action="confirm-wild"]').click()`);
    const start = Date.now();
    while (Date.now() - start < LENGTH) console.log(await screenshot(session, resolve(out, `${seed}${asleep ? "-asleep" : ""}-${String(Date.now() - start).padStart(4, "0")}.png`)));
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
