// One care action as a strip of frames, for review: a dragon whose care tile is the action, tapped
// with the clock frozen and stepped through its reaction. Writes shots/care/<style>/<action>-<age>-<t>.png.
//   node tools/checks/careEvidence.mjs --action feed [--age kid|teen|adult] [--style cozy|lowPoly]
//     [--times 0.3,0.6,1] [--seed 7] [--url http://127.0.0.1:8094]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const action = option("action", "feed");
const youngest = { feed: "kid", play: "kid", clean: "kid", exercise: "teen", groom: "adult" };
const age = option("age", youngest[action]);
const styles = option("style") ? [option("style")] : ["cozy"];
const times = option("times", "0.2,0.5,0.8,1.1,1.4,1.7,2,2.5,3,3.5").split(",").map(Number);
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
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const dragon = createDragon({ seed: "care-${seed}", genome: makeGenome(genes, "care-${seed}"), age: ${JSON.stringify(age)}, now: stable.clock.game });
  const need = { feed: "fullness", play: "happiness", clean: "cleanliness", exercise: "exercise", groom: "affection" }[${JSON.stringify(action)}];
  for (const n of needsOf(dragon.age)) dragon.care[n.id] = n.id === need ? 10 : 95;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  window.__game.save();
  return dragon.id;
})()`;

const freeze = `(() => {
  const raf = window.requestAnimationFrame.bind(window), now = performance.now.bind(performance);
  window.requestAnimationFrame = (cb) => raf((t) => cb(window.__fake ?? t));
  performance.now = () => window.__fake ?? now();
  window.__fake = 200000;
})()`;

async function run(style) {
  const out = resolve(root, "shots", "care", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const id = await evaluate(session, seedStable);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}#/stable/${encodeURIComponent(id)}`, base).href });
    if (!(await waitFor(session, `document.querySelector('[data-action="${action}"]')`, 20000))) throw new Error(`No ${action} tile: ${errors.join("\n")}`);
    await sleep(1500);
    await evaluate(session, freeze);
    await sleep(300);
    await evaluate(session, `document.querySelector('[data-action="${action}"]').click()`);
    for (const t of times) {
      await evaluate(session, `window.__fake = 200000 + ${t * 1000}`);
      await sleep(300);
      console.log(await screenshot(session, resolve(out, `${action}-${age}-${t.toFixed(2)}.png`)));
    }
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
