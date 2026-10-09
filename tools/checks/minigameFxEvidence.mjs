// The Fetch aim arc and the Clean hose's stream, held mid-gesture on a phone, for review.
// Writes shots/minigameFx/<style>/<game>.png, and the hose at rest as clean-rest.png.
//   node tools/checks/minigameFxEvidence.mjs [--style cozy|lowPoly] [--url http://127.0.0.1:8094]
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep, touchAt } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const styles = option("style") ? [option("style")] : ["cozy"];
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 3 };
const root = fileURLToPath(new URL("../../", import.meta.url));

const seedStable = (action, age) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const { needsOf } = await import("/src/stable/care.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const dragon = createDragon({ seed: "fx-7", genome: makeGenome(genes, "fx-7"), age: "${age}", now: stable.clock.game });
  for (const n of needsOf(dragon.age)) dragon.care[n.id] = n.id === "${action === "play" ? "happiness" : "cleanliness"}" ? 10 : 95;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  window.__game.save();
  return dragon.id;
})()`;

async function play(session, style, action, gesture) {
  await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
  await waitFor(session, "window.__game", 20000);
  const id = await evaluate(session, seedStable(action, "kid"));
  await session.send("Page.navigate", { url: new URL(`/?style=${style}#/stable/${encodeURIComponent(id)}`, base).href });
  await waitFor(session, `document.querySelector('[data-action="${action}"]')`, 20000);
  await sleep(1500);
  await evaluate(session, `document.querySelector('[data-tour="skip"]')?.click()`);
  await sleep(300);
  await evaluate(session, `Math.random = () => 0.99`);
  await evaluate(session, `document.querySelector('[data-action="${action}"]').click()`);
  await sleep(2000);
  await gesture();
}

async function run(style) {
  const out = resolve(root, "shots", "minigameFx", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await play(session, style, "play", async () => {
      await touchAt(session, "touchStart", [[200, 650]]);
      for (let i = 1; i <= 8; i++) {
        await touchAt(session, "touchMove", [[200 - 4 * i, 650 - 30 * i]]);
        await sleep(30);
      }
      await sleep(600);
      console.log(await screenshot(session, resolve(out, "fetch.png")));
      await touchAt(session, "touchCancel", []);
    });
    await play(session, style, "clean", async () => {
      const hint = () => evaluate(session, `document.querySelector(".is-playing") ? document.body.innerText : ""`);
      const first = await hint();
      for (let round = 0; round < 30 && (await hint()) === first; round++)
        for (let y = 220; y <= 520; y += 20) {
          await touchAt(session, "touchStart", [[60, y]]);
          for (let x = 60; x <= 370; x += 12) {
            await touchAt(session, "touchMove", [[x, y + (x % 24 ? 10 : -10)]]);
            await sleep(8);
          }
          await touchAt(session, "touchEnd", []);
        }
      await sleep(1500);
      await touchAt(session, "touchStart", [[180, 400]]);
      await touchAt(session, "touchMove", [[185, 405]]);
      await sleep(500);
      console.log(await screenshot(session, resolve(out, "clean.png")));
      await touchAt(session, "touchEnd", []);
      await sleep(800);
      console.log(await screenshot(session, resolve(out, "clean-rest.png")));
    });
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

for (const style of styles) await run(style);
