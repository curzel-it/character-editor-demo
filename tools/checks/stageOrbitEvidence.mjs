// The welcome's camera gestures on a phone, for review: the rider and the kid pick at their own
// framing, turned by a drag, zoomed and panned by a pinch, and eased home by picking another kid.
// Writes shots/stageOrbit/<style>/.
//   node tools/checks/stageOrbitEvidence.mjs [--url http://127.0.0.1:8094] [--style cozy|lowPoly]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, sleep, touchAt, dragTouch } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const styles = option("style") ? [option("style")] : ["cozy"];
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));

const middle = `JSON.stringify((() => { const s = document.querySelector(".meadow-stage").getBoundingClientRect(); const head = document.querySelector(".welcome [data-head]").getBoundingClientRect(); const foot = document.querySelector(".welcome [data-foot]").getBoundingClientRect(); return [s.left + s.width / 2, (head.bottom + foot.top) / 2]; })())`;

async function run(style) {
  const out = resolve(root, "shots", "stageOrbit", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const shot = async (label) => {
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    const path = resolve(out, `${label}.png`);
    await writeFile(path, Buffer.from(data, "base64"));
    console.log(path);
  };
  const pinch = async ([x, y], steps) => {
    await touchAt(session, "touchStart", [[x - 30, y], [x + 30, y]]);
    for (let i = 1; i <= steps; i++) {
      await touchAt(session, "touchMove", [[x - 30 - i * 8, y - i * 4], [x + 30 + i * 8, y - i * 4]]);
      await sleep(20);
    }
    await touchAt(session, "touchEnd", []);
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
    await shot("1-rider");
    const mid = JSON.parse(await evaluate(session, middle));
    await dragTouch(session, mid, [mid[0] - 140, mid[1] + 60], { steps: 10, ms: 300 });
    await touchAt(session, "touchEnd", []);
    await sleep(1200);
    await shot("2-rider-turned");
    await pinch(mid, 8);
    await sleep(900);
    await shot("3-rider-pinched");
    await evaluate(session, `document.querySelector(".welcome [data-next]").click()`);
    await sleep(2500);
    await shot("4-pick");
    const centre = JSON.parse(await evaluate(session, middle));
    await dragTouch(session, centre, [centre[0] + 120, centre[1] - 30], { steps: 10, ms: 300 });
    await touchAt(session, "touchEnd", []);
    await pinch(centre, 8);
    await sleep(900);
    if (await evaluate(session, `window.__game.game.stable.dragons.length`)) throw new Error("A gesture adopted a kid");
    await shot("5-pick-turned-pinched");
    await evaluate(session, `document.querySelector('.welcome [data-kid="2"]').click()`);
    await sleep(1500);
    if ((await evaluate(session, `document.querySelector('.welcome [data-kid="2"]').getAttribute("aria-selected")`)) !== "true") throw new Error("Picking a kid from the roster failed");
    await shot("6-pick-third-home");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

for (const style of styles) await run(style);
