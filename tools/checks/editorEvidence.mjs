// Screenshots of the character editor as a person sees it, on a desktop and a phone, through a
// scripted tour of its tabs. Writes shots/editor/.
//   node tools/checks/editorEvidence.mjs [--url http://127.0.0.1:8120] [--only desktop|phone] [--steps '<json>']
// A step is { name, run } where `run` is JavaScript evaluated in the page before the shot.
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const base = option("--url", "http://127.0.0.1:8120");
const only = option("--only", null);
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = resolve(root, "shots/editor");
const tab = (id) => `document.querySelector('[data-tab=${id}]').click()`;
const steps = option("--steps", null)
  ? JSON.parse(option("--steps"))
  : [
      { name: "body", run: "" },
      { name: "face", run: tab("face") },
      { name: "eyes", run: tab("eyes") },
      { name: "hair", run: tab("hair") },
      { name: "outfit", run: tab("outfit") },
      { name: "extras", run: tab("extras") },
    ];
const devices = [
  { name: "desktop", width: 1440, height: 900, scale: 1, mobile: false },
  { name: "phone", width: 390, height: 844, scale: 2, mobile: true },
].filter((d) => !only || d.name === only);

await mkdir(out, { recursive: true });
for (const device of devices) {
  const session = await launch({ url: "about:blank", width: device.width, height: device.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await session.send("Emulation.setDeviceMetricsOverride", { width: device.width, height: device.height, deviceScaleFactor: device.scale, mobile: device.mobile });
    await session.send("Page.navigate", { url: new URL("/editor.html", base).href });
    if (!(await waitFor(session, "document.querySelector('.ce-app.is-ready')", 20000))) throw new Error(`Editor did not get ready: ${errors.join("\n")}`);
    await evaluate(session, "localStorage.clear()");
    for (const step of steps) {
      if (step.run) await evaluate(session, `(async () => { ${step.run} })()`);
      await waitFor(session, "!document.querySelector('.ce-app.is-building') && [...document.querySelectorAll('.ce-group:not([hidden]) .ce-tile')].slice(0, 12).every((t) => t.classList.contains('is-drawn') || t.closest('[hidden]'))", 25000, 100);
      await new Promise((r) => setTimeout(r, step.wait ?? 1400));
      const { data } = await session.send("Page.captureScreenshot", { format: "png" });
      const path = resolve(out, `${device.name}-${step.name}.png`);
      await writeFile(path, Buffer.from(data, "base64"));
      console.log(path);
    }
    if (errors.length) console.log("Page errors:\n" + errors.join("\n"));
  } finally {
    await session.close();
  }
}
