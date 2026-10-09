// The stable yard behind a dragon on a phone, with and without the screen's UI. Writes
// shots/yard/<style>/<age>[-bare].png, or a strip of a swap with --swap.
//   node tools/checks/yardEvidence.mjs [--style cozy|lowPoly] [--ages kid,teen,adult,egg] [--swap]
//     [--sleep <index,…>] [--times 0.3,0.8] [--tag before] [--url http://127.0.0.1:8094]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const styles = option("style") ? [option("style")] : ["cozy"];
const ages = option("ages", "kid,teen,adult").split(",");
const swap = args.includes("--swap");
const sleeper = option("sleep", "");
const times = option("times", "0,0.3,0.6,0.9,1.2,1.5,1.8,2.1,2.4,3").split(",").map(Number);
const tag = option("tag", "");
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));
const lock = join(tmpdir(), "dragonz-care-evidence.lock");

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
  const { createEgg } = await import("/src/stable/egg.js");
  const { makeGenome, loadSubject } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const born = ${JSON.stringify(ages)}.map((age, i) => {
    if (age === "egg") return createEgg("yard-egg-" + i, stable.clock.game);
    const dragon = createDragon({ seed: "yard-" + i, genome: makeGenome(genes, "yard-" + i), age, now: stable.clock.game });
    for (const id of Object.keys(dragon.care)) dragon.care[id] = 95;
    if (${JSON.stringify(sleeper.split(","))}.includes(String(i))) dragon.fatigue = 1e6;
    return dragon;
  });
  stable.dragons = born.filter((d) => d.incubation === undefined);
  stable.eggs = born.filter((d) => d.incubation !== undefined);
  stable.welcomed = true;
  window.__game.save();
  return born.map((d) => d.id);
})()`;

const freeze = `(() => {
  const raf = window.requestAnimationFrame.bind(window), now = performance.now.bind(performance);
  window.requestAnimationFrame = (cb) => raf((t) => cb(window.__fake ?? t));
  performance.now = () => window.__fake ?? now();
  window.__fake = 200000;
})()`;

/** Advances the frozen clock by `seconds` in frame-sized steps so springs and glides settle. */
async function advance(session, seconds) {
  for (let t = 0; t < seconds; t += 0.04) {
    await evaluate(session, "window.__fake += 40");
    await sleep(20);
  }
}

const bare = (on) => `document.body.classList.toggle("yard-bare", ${on}); document.getElementById("yard-bare") || document.head.insertAdjacentHTML("beforeend", "<style id=yard-bare>.yard-bare *:not(canvas):not(:has(canvas)){visibility:hidden}</style>")`;

async function run(style) {
  const out = resolve(root, "shots", "yard", style);
  await mkdir(out, { recursive: true });
  const name = (s) => resolve(out, `${s}${tag ? `-${tag}` : ""}.png`);
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const ids = await evaluate(session, seedStable);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}#/stable/${encodeURIComponent(ids[0])}`, base).href });
    if (!(await waitFor(session, "document.querySelector('[data-action]')", 20000))) throw new Error(`No stable: ${errors.join("\n")}`);
    await sleep(1500);
    for (let n = 0; n < 4; n++) await evaluate(session, `document.querySelector('[data-tour="skip"]:not([hidden])')?.click()`);
    await evaluate(session, freeze);
    if (swap) {
      let prev = 0;
      await evaluate(session, bare(true));
      await evaluate(session, `location.hash = "#/stable/${encodeURIComponent(ids[1])}"`);
      for (const t of times) {
        await advance(session, t - prev);
        prev = t;
        console.log(await screenshot(session, name(`swap-${t.toFixed(2)}`)));
      }
    } else
      for (const [i, id] of ids.entries()) {
        await evaluate(session, `location.hash = "#/stable/${encodeURIComponent(id)}"`);
        await advance(session, 3);
        console.log(await screenshot(session, name(ages[i])));
        await evaluate(session, bare(true));
        await sleep(300);
        console.log(await screenshot(session, name(`${ages[i]}-bare`)));
        await evaluate(session, bare(false));
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
