// The stable home on a phone, for review: a kid, a teen and an egg in the yard, the tour already seen.
// Writes shots/stable/<style>/<label>.png: the kid, the egg and the kid's profile.
//   node tools/checks/stableEvidence.mjs [--style cozy|lowPoly] [--url http://127.0.0.1:8094] [--out stable]
import { mkdir, rmdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const styles = option("style") ? [option("style")] : ["cozy"];
const base = option("url", "http://127.0.0.1:8094");
const folder = option("out", "stable");
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
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const { needsOf } = await import("/src/stable/care.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const now = stable.clock.game;
  const kid = createDragon({ seed: "stable-7", genome: makeGenome(genes, "stable-7"), age: "kid", now });
  const teen = createDragon({ seed: "stable-9", genome: makeGenome(genes, "stable-9"), age: "teen", now });
  for (const d of [kid, teen]) for (const n of needsOf(d.age)) d.care[n.id] = 80;
  kid.care.fullness = 25;
  stable.dragons = [kid, teen];
  stable.eggs = [createEgg("stable-egg", now)];
  stable.welcomed = true;
  stable.careTaught = true;
  window.__game.save();
  return { kid: kid.id, egg: stable.eggs[0]?.id };
})()`;

async function run(style) {
  const out = resolve(root, "shots", folder, style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const go = async (hash) => {
    await session.send("Page.navigate", { url: new URL(`/?style=${style}${hash}`, base).href });
    if (!(await waitFor(session, `document.querySelector(".stable-home [data-actions] > *")`, 20000))) throw new Error(`No stable at ${hash}`);
    await sleep(2500);
  };
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    const ids = await evaluate(session, seedStable);
    await go(`#/stable/${encodeURIComponent(ids.kid)}`);
    console.log(await screenshot(session, resolve(out, "1-kid.png")));
    if (ids.egg) {
      await go(`#/stable/${encodeURIComponent(ids.egg)}`);
      console.log(await screenshot(session, resolve(out, "2-egg.png")));
    }
    await go(`#/stable/${encodeURIComponent(ids.kid)}/profile`);
    console.log(await screenshot(session, resolve(out, "3-profile.png")));
    if (errors.length) console.warn(errors.join("\n"));
  } finally {
    await session.close();
  }
}

await acquire();
try {
  for (const style of styles) await run(style);
} finally {
  await rmdir(lock).catch(() => {});
}
