// The first run on a phone, for review: the owner named, the welcome's kids side by side then each met from the roster, the kid ridden beside the gift egg, then the first league race on air with the stable hand's
// coach marks: Autopilot, Skip, Take the reins, then each riding control.
// Writes shots/welcome/<style>/.
//   node tools/checks/welcomeEvidence.mjs [--url http://127.0.0.1:8094] [--style cozy|lowPoly]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const styles = option("style") ? [option("style")] : ["cozy"];
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));

const change = (selector, value) => `(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  node.value = ${JSON.stringify(value)};
  node.dispatchEvent(new Event("change", { bubbles: true }));
})()`;

async function run(style) {
  const out = resolve(root, "shots", "welcome", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const shot = async (label) => {
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    const path = resolve(out, `${label}.png`);
    await writeFile(path, Buffer.from(data, "base64"));
    console.log(path);
  };
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    await evaluate(session, `localStorage.clear()`);
    await session.send("Page.reload");
    if (!(await waitFor(session, `window.__game && location.hash === "#/welcome"`, 20000))) throw new Error("No welcome on a new stable");
    await sleep(2500);
    await shot("1-name");
    await evaluate(session, change(".welcome [data-maker-name]", "Fede Curzel"));
    await evaluate(session, `document.querySelector(".welcome [data-greet]").requestSubmit()`);
    const owner = await evaluate(session, `JSON.stringify(window.__game.game.stable.owner)`);
    if (!owner.includes("Fede Curzel")) throw new Error(`The name was not kept: ${owner}`);
    await sleep(2500);
    await shot("4-pick");
    if (!(await evaluate(session, `document.querySelector(".welcome [data-next]").disabled`))) throw new Error("A kid can be raised before one is met");
    const meet = (kid) => evaluate(session, `document.querySelector('.welcome [data-kid="${kid}"]').click()`);
    for (const kid of ["0", "1", "2", "-1"]) {
      await meet(kid);
      await sleep(2500);
      await shot(`4-pick-${kid === "-1" ? "all" : kid}`);
    }
    await meet("0");
    await evaluate(session, `document.querySelector(".welcome [data-next]").click()`);
    await sleep(2500);
    await shot("5-gift");
    await evaluate(session, `window.DragonzNotifications = { post: (json) => (window.asked = JSON.parse(json).type === "ask" || window.asked) }`);
    await evaluate(session, `document.querySelector(".welcome [data-next]").click()`);
    if (!(await waitFor(session, `!document.querySelector(".stable-tour").hidden`, 10000))) throw new Error("No tour on the first stable visit");
    for (const name of ["5a-stable-care", "5b-stable-reminders", "5c-stable-saved"]) {
      await sleep(1200);
      await shot(name);
      await evaluate(session, `document.querySelector('.stable-tour [data-tour="next"]').click()`);
    }
    const taught = await evaluate(session, `JSON.stringify([window.__game.game.stable.careTaught, window.asked, document.querySelector(".stable-tour").hidden])`);
    if (taught !== "[true,true,true]") throw new Error(`The stable tour left ${taught}`);
    const league = await evaluate(session, `(async () => {
      const { startLeagueRace } = await import("/src/stable/leagueRace.js");
      const stable = window.__game.game.stable;
      const kid = stable.dragons[0];
      Object.assign(kid, { fatigue: 0, injury: null });
      startLeagueRace(stable, "kids", kid.id, stable.clock.game);
      window.__game.save();
      location.hash = "#/live/kids";
      return "kids";
    })()`);
    if (!(await waitFor(session, "window.__game.broadcast().live && window.__game.broadcast().race", 20000))) throw new Error("The race did not go on air");
    if (!(await waitFor(session, `!document.querySelector(".reins-tour").hidden`, 30000))) throw new Error(`No invitation in the ${league} race`);
    const opened = await evaluate(session, "window.__game.broadcast().time");
    if (!(opened < 0)) throw new Error(`The invitation opened at ${opened} s, after Go`);
    await sleep(600);
    await shot("6-tour-autopilot");
    await evaluate(session, `document.querySelector('.reins-tour [data-tour="next"]').click()`);
    await sleep(600);
    await shot("7-tour-skip");
    await evaluate(session, `document.querySelector('.reins-tour [data-tour="next"]').click()`);
    await sleep(600);
    await shot("8-tour-reins");
    await evaluate(session, `document.querySelector('[data-action="reins"]').click()`);
    const steps = ["9-tour-stick", "10-tour-pedals", "11-tour-gauges", "12-tour-autopilot"];
    for (const [i, name] of steps.entries()) {
      await sleep(i ? 600 : 1000);
      await shot(name);
      await evaluate(session, `document.querySelector('.reins-tour [data-tour="next"]').click()`);
    }
    await sleep(600);
    const flags = await evaluate(session, `JSON.stringify([window.__game.game.stable.reinsInvited, window.__game.game.stable.reinsTaught, window.__game.broadcast().live.riding, document.querySelector(".reins-tour").hidden])`);
    if (flags !== "[true,true,true,true]") throw new Error(`Taking the reins from the tour left ${flags}`);
    if (!(await waitFor(session, "window.__game.broadcast().time > 4 && window.__game.broadcast().live.riding", 20000))) throw new Error("The ridden race did not get going after the grid");
    await shot("13-riding");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

for (const style of styles) await run(style);
