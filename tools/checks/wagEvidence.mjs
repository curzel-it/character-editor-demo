// A dragon wagging its tail in the yard, for review: one dragon of an age stands idle with the clock
// frozen and stepped through its next wag. Writes <out>/wag-<age>-<frame>.png.
//   node tools/checks/wagEvidence.mjs [--age kid|teen|adult] [--seed 7] [--fps 15] [--turn 0]
//     [--out /Volumes/SLEEPTUBE/dragons-animations/wag] [--url http://127.0.0.1:8094]
import { mkdir, rmdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep, drag } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const age = option("age", "kid");
const seed = option("seed", "7");
const fps = Number(option("fps", "15"));
const turn = Number(option("turn", "0"));
const out = option("out", "/Volumes/SLEEPTUBE/dragons-animations/wag");
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const START = 200;
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
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const dragon = createDragon({ seed: "wag-${seed}", genome: makeGenome(genes, "wag-${seed}"), age: ${JSON.stringify(age)}, now: stable.clock.game });
  for (const id of Object.keys(dragon.care)) dragon.care[id] = 95;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  window.__game.save();
  return dragon.id;
})()`;

const nextWag = `(async () => {
  const { wagOf } = await import("/src/animate/dragonWag.js");
  const { individualSeed } = await import("/src/animate/flightNoise.js");
  const seed = individualSeed(window.__game.game.stable.dragons[0].genome);
  let t = ${START} + 1;
  while (wagOf(t, seed) > 0) t += 0.05;
  while (wagOf(t, seed) <= 0) t += 0.05;
  const from = t - 0.4;
  while (wagOf(t, seed) > 0) t += 0.05;
  return [from, t + 0.4];
})()`;

const freeze = `(() => {
  const raf = window.requestAnimationFrame.bind(window), now = performance.now.bind(performance);
  window.requestAnimationFrame = (cb) => raf((t) => cb(window.__fake ?? t));
  performance.now = () => window.__fake ?? now();
  window.__fake = ${START * 1000};
})()`;

const bare = `document.head.insertAdjacentHTML("beforeend", "<style>body *:not(canvas):not(:has(canvas)){visibility:hidden}</style>")`;

await mkdir(out, { recursive: true });
await acquire();
const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await emulateDevice(session, PHONE);
  await session.send("Page.navigate", { url: new URL("/?style=cozy", base).href });
  if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
  const id = await evaluate(session, seedStable);
  await session.send("Page.navigate", { url: new URL(`/?style=cozy#/stable/${encodeURIComponent(id)}`, base).href });
  if (!(await waitFor(session, "document.querySelector('[data-action]')", 20000))) throw new Error(`No stable: ${errors.join("\n")}`);
  await sleep(1500);
  for (let n = 0; n < 4; n++) await evaluate(session, `document.querySelector('[data-tour="skip"]:not([hidden])')?.click()`);
  await evaluate(session, bare);
  if (turn) {
    await drag(session, 195, 330, 195 + turn, 330, { steps: 12 });
    await sleep(1500);
  }
  await evaluate(session, freeze);
  const [from, to] = await evaluate(session, nextWag);
  let frame = 0;
  for (let t = from; t <= to; t += 1 / fps) {
    await evaluate(session, `window.__fake = ${t * 1000}`);
    await sleep(120);
    await screenshot(session, join(out, `wag-${age}-${String(frame++).padStart(3, "0")}.png`));
  }
  console.log(`${frame} frames of ${(to - from).toFixed(1)} s in ${out}`);
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
  await rmdir(lock);
}
