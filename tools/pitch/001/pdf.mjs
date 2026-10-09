// The deck as a PDF for review: one 1920x1080 page per slide with every build shown and each clip
// paused partway in. Needs the game served (npm run dev) and ImageMagick's `magick`.
//   node tools/pitch/001/pdf.mjs [--url http://127.0.0.1:8094] [--out <dir>] [--tmp <dir>] [--name pitch.pdf]
import { execFileSync } from "node:child_process";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { launch, evaluate, waitFor, watchErrors, navigate } from "../../cdp.mjs";
import { base, media, tmp } from "./capture/args.mjs";

/** Holds every clip on the live slide at a frame partway through, so its page is not a black first frame. */
const pauseClips = `Promise.all([...document.querySelectorAll(".slide.live video")].map((video) => new Promise((done) => {
  video.pause();
  const seek = () => {
    video.addEventListener("seeked", done, { once: true });
    video.currentTime = Math.min(video.duration * 0.45, 6);
  };
  if (video.readyState >= 1) seek();
  else video.addEventListener("loadedmetadata", seek, { once: true });
  setTimeout(done, 8000);
})))`;

const args = process.argv.slice(2);
const name = args.includes("--name") ? args[args.indexOf("--name") + 1] : "pitch.pdf";
const frames = resolve(tmp, "pdf");
await rm(frames, { recursive: true, force: true });
await mkdir(frames, { recursive: true });

const session = await launch({ url: "about:blank", width: 1600, height: 900 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: 1600, height: 900, deviceScaleFactor: 1.2, mobile: false });
  await navigate(session, new URL("/tools/pitch/001/index.html", base).href);
  if (!(await waitFor(session, "window.__deck", 30000))) throw new Error(`The deck did not load: ${errors.join("\n")}`);
  const count = await evaluate(session, "__deck.slides.length");
  for (let i = 0; i < count; i++) {
    await evaluate(session, `__deck.go(${i})`);
    await waitFor(session, `[...document.querySelectorAll(".slide.live canvas[data-dragon]")].every((c) => c.hasAttribute("data-drawn"))`, 60000);
    await evaluate(session, pauseClips);
    await new Promise((done) => setTimeout(done, 700));
    const { data } = await session.send("Page.captureScreenshot", { format: "jpeg", quality: 88 });
    await writeFile(resolve(frames, `slide-${String(i + 1).padStart(2, "0")}.jpg`), Buffer.from(data, "base64"));
  }
} finally {
  await session.close();
}

const pages = (await readdir(frames)).filter((file) => file.endsWith(".jpg")).sort().map((file) => resolve(frames, file));
const pdf = resolve(media, name);
await mkdir(media, { recursive: true });
execFileSync("magick", [...pages, "-quality", "85", pdf]);
console.log(`${pages.length} slides → ${pdf}`);
