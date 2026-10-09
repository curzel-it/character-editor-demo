// A dragon greeting its owner back as a strip of frames, for review: a dragon last on screen nine hours
// ago is brought into the yard with the clock frozen and stepped through its feste.
// Writes <out>/<age>-<t>.png.
//   node tools/checks/festeEvidence.mjs [--ages kid,teen,adult] [--style cozy] [--times 0,0.2,…]
//     [--turn <px dragged across, to orbit the camera>] [--seed 7] [--out /Volumes/SLEEPTUBE/dragons-animations/feste] [--url http://127.0.0.1:8094]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep, drag } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const ages = option("ages", "kid,teen,adult").split(",");
const style = option("style", "cozy");
const times = option("times", "0,0.2,0.4,0.6,0.8,1,1.2,1.4,1.6,1.8,2,2.2,2.4,2.6,2.8,3").split(",").map(Number);
const seed = option("seed", "7");
const turn = Number(option("turn", "0"));
const base = option("url", "http://127.0.0.1:8094");
const out = resolve(option("out", "/Volumes/SLEEPTUBE/dragons-animations/feste"));
const PHONE = { width: 390, height: 844, dpr: 2 };
const START = 200000;
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

const seedStable = (age) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const dragon = createDragon({ seed: "feste-${seed}", genome: makeGenome(genes, "feste-${seed}"), age: ${JSON.stringify(age)}, now: stable.clock.game });
  dragon.seenAt = Date.now() - 9 * 3600 * 1000;
  delete stable.festeAt;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  stable.careTaught = true;
  window.__game.save();
  return dragon.id;
})()`;

const freeze = `(() => {
  const raf = window.requestAnimationFrame.bind(window), now = performance.now.bind(performance);
  window.requestAnimationFrame = (cb) => raf((t) => cb(window.__fake ?? t));
  performance.now = () => window.__fake ?? now();
  window.__fake = ${START};
})()`;

const session = await (async () => {
  await acquire();
  return launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
})();
try {
  await mkdir(out, { recursive: true });
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await emulateDevice(session, PHONE);
  for (const age of ages) {
    await session.send("Page.navigate", { url: new URL(`/?style=${style}&run=${age}#/altar`, base).href });
    await sleep(500);
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const id = await evaluate(session, seedStable(age));
    await sleep(500);
    await evaluate(session, freeze);
    await evaluate(session, `location.hash = "#/stable/${encodeURIComponent(id)}"`);
    if (!(await waitFor(session, `window.__game.game.stable.festeAt`, 5000))) throw new Error(`The ${age} did not greet: ${errors.join("\n")}`);
    await sleep(800);
    if (turn) await drag(session, 195, 420, 195 + turn, 420, { steps: 12 });
    for (const t of times) {
      await evaluate(session, `window.__fake = ${START} + ${t * 1000}`);
      await sleep(250);
      console.log(await screenshot(session, resolve(out, `${age}${turn ? `-turn${turn}` : ""}-${t.toFixed(2)}.png`)));
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
  await rmdir(lock);
}
