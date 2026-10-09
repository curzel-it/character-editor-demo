// Whether the Groom camera keeps every place a dragon may itch in view: per adult and screen, the game is
// started, the camera left to settle and each point of the itchy regions and the nose projected; the
// share left outside the band the game's HUD leaves free is printed, and a shot with the points marked
// (green in, red out) written to shots/groomFrame/<screen>-<seed>.png. Exits 1 when any point is out.
//   node tools/checks/groomFrameEvidence.mjs [--seeds 1,2,3,4] [--screens phone,landscape,tablet]
//     [--url http://127.0.0.1:8094]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const seeds = option("seeds", "1,2,3,4").split(",");
const SCREENS = { phone: { width: 390, height: 844, dpr: 2 }, landscape: { width: 844, height: 390, dpr: 2 }, tablet: { width: 1024, height: 1366, dpr: 1 } };
const screens = option("screens", "phone,landscape,tablet").split(",");
const base = option("url", "http://127.0.0.1:8094");
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

const seedStable = (seed) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const { needsOf } = await import("/src/stable/care.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const dragon = createDragon({ seed: "groom-${seed}", genome: makeGenome(genes, "groom-${seed}"), age: "adult", now: stable.clock.game });
  for (const n of needsOf(dragon.age)) dragon.care[n.id] = n.id === "affection" ? 10 : 95;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  stable.careTaught = true;
  window.__game.save();
  return dragon.id;
})()`;

/** Records the groom game and its last view on `window.__mg`. */
const hook = `(async () => {
  const { minigames } = await import("/src/minigames/minigames.js");
  for (const list of Object.values(minigames))
    for (const def of list) {
      def.original ??= def.create;
      def.create = (options) => {
        const game = def.original(options);
        const update = game.update;
        game.update = (view) => {
          window.__mg.view = view;
          return update.call(game, view);
        };
        window.__mg = { game, options, view: null };
        return game;
      };
    }
})()`;

/** Projects the itchy regions and the nose, marks them over the page and counts those outside the free band. */
const measure = `(async () => {
  const { scratchSpots } = await import("/src/minigames/scratchSpots.js");
  const { spotPoints } = await import("/src/minigames/coatSpots.js");
  const { view, options } = window.__mg;
  const { itchy, nose } = scratchSpots(options.anatomy, { side: 1, seed: "x" });
  const box = document.querySelector(".yard canvas").getBoundingClientRect();
  const top = document.querySelector(".topbar").getBoundingClientRect().bottom;
  const bottom = document.querySelector(".yard__play")?.getBoundingClientRect().top ?? box.bottom;
  const points = spotPoints([...itchy, nose], view.dragon).map((p) => view.project(p)).map((q) => ({ x: q.x + box.left, y: q.y + box.top, front: q.front }));
  const out = points.filter((p) => !p.front || p.x < box.left || p.x > box.right || p.y < top || p.y > bottom);
  for (const p of points) {
    const dot = document.createElement("div");
    const bad = out.includes(p);
    dot.style.cssText = "position:fixed;z-index:99999;width:5px;height:5px;margin:-2px;border-radius:50%;pointer-events:none;left:" + p.x + "px;top:" + Math.max(0, Math.min(innerHeight - 4, p.y)) + "px;background:" + (bad ? "#f22" : "#2e2");
    document.body.append(dot);
  }
  const ys = points.map((p) => p.y), xs = points.map((p) => p.x);
  return { total: points.length, out: out.length, band: [Math.round(top), Math.round(bottom)], x: [Math.round(Math.min(...xs)), Math.round(Math.max(...xs))], y: [Math.round(Math.min(...ys)), Math.round(Math.max(...ys))] };
})()`;

async function run(name, seed) {
  const device = SCREENS[name];
  const out = resolve(root, "shots", "groomFrame");
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: device.width, height: device.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, device);
    await session.send("Page.navigate", { url: new URL("/", base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const id = await evaluate(session, seedStable(seed));
    await session.send("Page.navigate", { url: new URL(`/#/stable/${encodeURIComponent(id)}`, base).href });
    if (!(await waitFor(session, `document.querySelector('[data-action="groom"]')`, 20000))) throw new Error(`No groom tile: ${errors.join("\n")}`);
    await evaluate(session, hook);
    await sleep(1500);
    await evaluate(session, `document.querySelector('[data-action="groom"]').click()`);
    if (!(await waitFor(session, "window.__mg?.view", 10000))) throw new Error(`Groom did not start: ${errors.join("\n")}`);
    await sleep(3500);
    const result = await evaluate(session, measure);
    await screenshot(session, resolve(out, `${name}-${seed}.png`));
    if (errors.length) throw new Error(errors.join("\n"));
    return result;
  } finally {
    await session.close();
  }
}

await acquire();
let missed = 0;
try {
  for (const name of screens)
    for (const seed of seeds) {
      const r = await run(name, seed);
      missed += r.out;
      console.log(`${name.padEnd(9)} seed ${seed.padEnd(3)} ${r.out}/${r.total} out  band y ${r.band.join("..")}  points x ${r.x.join("..")} y ${r.y.join("..")}`);
    }
} finally {
  await rmdir(lock);
}
process.exitCode = missed ? 1 : 0;
