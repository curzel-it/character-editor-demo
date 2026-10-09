// The loading screen on a phone, for review, held up after the game has loaded.
// Writes shots/loading/loading.png.
//   node tools/checks/loadingEvidence.mjs [--url http://127.0.0.1:8094]
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const out = resolve(fileURLToPath(new URL("../../", import.meta.url)), "shots", "loading");

await mkdir(out, { recursive: true });
const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await emulateDevice(session, PHONE);
  await session.send("Page.navigate", { url: base });
  if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
  await sleep(1500);
  await evaluate(session, `(() => { const el = document.getElementById("loading"); el.hidden = false; el.classList.remove("is-leaving"); })()`);
  await sleep(600);
  console.log(await screenshot(session, resolve(out, "loading.png")));
} finally {
  await session.close();
}
