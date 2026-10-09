// What an owner reads on a phone, for the clarity review: a kid's profile (with an info tip
// open), the race entry, the league page, the Soul Altar with two adults, and the live race
// on Autopilot and riding, mid-race and in the finish straight.
// Writes shots/clarity/<style>/<prefix>-*.png.
//   node tools/checks/clarityEvidence.mjs [--url http://127.0.0.1:8094] [--style cozy|lowPoly] [--prefix after]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate, bustCache, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const styles = option("style") ? [option("style")] : ["cozy"];
const prefix = option("prefix", "after");
const seed = Number(option("seed", 342450));
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));

const click = (selector) => `(() => { const node = document.querySelector(${JSON.stringify(selector)}); if (!node || node.disabled) return false; node.click(); return true; })()`;
const stable = "window.__game.game.stable";

async function run(style) {
  const out = resolve(root, "shots", "clarity", style);
  await mkdir(out, { recursive: true });
  const problems = [];
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const shot = async (label) => {
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    const path = resolve(out, `${prefix}-${label}.png`);
    await writeFile(path, Buffer.from(data, "base64"));
    console.log(path);
  };
  const js = (expression) => evaluate(session, expression);
  const go = async (hash, wait = 1500) => {
    await js(`location.hash = ${JSON.stringify(hash)}`);
    await sleep(wait);
  };
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await session.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `if (!localStorage.getItem("dragonz-stable")) { const random = Math.random; Math.random = () => ((Math.random = random), ${(seed + 0.5) / 1e6}); }`,
    });
    await emulateDevice(session, PHONE);
    await navigate(session, new URL(`/?style=${style}`, base).href);
    if (!(await waitFor(session, `window.__game && location.hash === "#/welcome"`, 20000))) throw new Error(`No welcome on a new stable: ${errors.join("\n")}`);
    await sleep(2000);
    for (let n = 0; n < 3; n++) {
      await js(click(".welcome [data-next]"));
      await sleep(2200);
    }
    await js(`(async () => {
      const { createDragon } = await import("/src/stable/createDragon.js");
      const { makeGenome } = await import("/src/subjects.js");
      const s = ${stable};
      s.careTaught = true;
      s.reinsInvited = true;
      s.reinsTaught = true;
      const genes = (await import("/src/genome/dragon.js")).genes;
      for (const k of ["ada", "bo"]) s.dragons.push(createDragon({ seed: "clarity-" + k, genome: makeGenome(genes, "clarity-" + k), age: "adult", bond: 0.6 }));
      const kid = s.dragons[0];
      kid.care.fullness = 55;
      kid.care.cleanliness = 70;
      window.__game.save();
    })()`);
    const kid = await js(`${stable}.dragons[0].id`);
    await navigate(session, bustCache(new URL(`/?style=${style}#/stable`, base).href, "clarity"));
    await waitFor(session, `window.__game && location.hash === "#/stable"`, 20000);
    await sleep(1500);
    await go(`#/stable/${kid}/profile`, 2000);
    await shot("profile");
    if (await js(click(".profile-sheet .dz-info"))) {
      await sleep(500);
      await shot("profile-info");
      await js(click(".profile-sheet .dz-info"));
    }
    await js(click('.profile-sheet [data-tab="traits"]'));
    await sleep(600);
    await shot("profile-traits");
    await js(click('.profile-sheet [data-tab="history"]'));
    await sleep(600);
    await shot("profile-history");
    await go(`#/dragon/${kid}/details`, 1500);
    await shot("details");
    await js(`document.getElementById("screens").scrollTop = 9999`);
    await sleep(400);
    await shot("details-genes");
    await go("#/league/kids", 1500);
    await shot("league");
    if (await js(click(".league-detail .dz-info"))) {
      await sleep(500);
      await shot("league-info");
    }
    await go("#/race", 1500);
    await shot("races");
    await go("#/altar", 1800);
    await shot("altar");
    if (await js(click(".altar .dz-info"))) {
      await sleep(500);
      await shot("altar-info");
    }
    await go("#/league/kids/entry", 1500);
    await js(click(`[data-pick="${kid}"]`));
    await sleep(800);
    await shot("entry");
    await js(click("[data-start]"));
    if (!(await waitFor(session, "window.__game.broadcast().live && window.__game.broadcast().race", 30000))) throw new Error("The race did not go on air");
    await waitFor(session, "window.__game.broadcast().time > 12", 40000);
    await shot("live-autopilot");
    await js(click('[data-action="reins"]'));
    await sleep(3000);
    await shot("live-riding");
    await js(click('[data-action="reins"]'));
    await js(`(() => { const b = window.__game.broadcast(); b.live.advance(1e4, Infinity); })()`);
    await sleep(300);
    const end = await js(`(() => { const r = window.__game.broadcast().race.recording; return r.events.find((e) => e.type === "finish")?.t ?? r.duration; })()`);
    await js(`window.__game.broadcast().seek(${end - 4})`);
    await js(click('[data-action="play"]'));
    await sleep(1500);
    await shot("live-finish");
    if (errors.length) problems.push(...errors);
  } finally {
    await session.close();
  }
  return problems;
}

let failed = false;
for (const style of styles) {
  const problems = await run(style);
  for (const p of problems) console.error(`${style}: ${p}`);
  failed ||= problems.length > 0;
}
process.exit(failed ? 1 : 0);
