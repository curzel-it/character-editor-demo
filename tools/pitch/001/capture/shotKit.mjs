import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { spawn } from "node:child_process";
import { evaluate } from "../../../cdp.mjs";

/**
 * Serves the page's render-resolution modules pinned for captures: every 3D stage renders at the
 * device pixel ratio, the broadcast's adaptive scale stays at 1 and the race view's pixel cap is
 * lifted to 4K. Nothing in src/ changes; the browser just gets these copies.
 */
export async function pinResolution(session, base) {
  const swaps = {
    "/src/renderDensity.js": () => "export function renderDensity() { return globalThis.devicePixelRatio || 1; }\n",
    "/src/scene/renderScale.js": () => "export function createRenderScale() { return { value: 1, frame() {} }; }\n",
    "/src/scene/raceView.js": async () => (await (await fetch(new URL("/src/scene/raceView.js", base))).text()).replace(/MAX_PIXELS = [^,]+,/, "MAX_PIXELS = 3840 * 2400,"),
  };
  await session.send("Fetch.enable", { patterns: Object.keys(swaps).map((path) => ({ urlPattern: `*${path}*`, requestStage: "Request" })) });
  session.on("Fetch.requestPaused", async ({ requestId, request }) => {
    const path = new URL(request.url).pathname;
    const swap = swaps[path];
    if (!swap) return session.send("Fetch.continueRequest", { requestId });
    const body = Buffer.from(await swap()).toString("base64");
    await session.send("Fetch.fulfillRequest", { requestId, responseCode: 200, responseHeaders: [{ name: "Content-Type", value: "text/javascript; charset=utf-8" }, { name: "Cache-Control", value: "no-store" }], body });
  });
}

/** A PNG screenshot of the viewport (or `clip`) as a buffer. */
export async function grab(session, clip = null) {
  const { data } = await session.send("Page.captureScreenshot", { format: "png", ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: false });
  return Buffer.from(data, "base64");
}

/** Writes a PNG buffer as WebP at `quality`, optionally scaled to `width`×`height`. */
export async function webp(png, file, { quality = 90, width = null, height = null } = {}) {
  await mkdir(dirname(file), { recursive: true });
  const scale = width && height ? ["-vf", `scale=${width}:${height}:flags=lanczos`] : [];
  await run("ffmpeg", ["-y", "-loglevel", "error", "-f", "png_pipe", "-i", "-", ...scale, "-c:v", "libwebp", "-quality", String(quality), "-compression_level", "6", file], png);
  return file;
}

export async function savePng(png, file) {
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, png);
  return file;
}

function run(cmd, argv, input) {
  return new Promise((done, fail) => {
    const child = spawn(cmd, argv, { stdio: ["pipe", "inherit", "inherit"] });
    child.on("exit", (code) => (code ? fail(new Error(`${cmd} exited ${code}`)) : done()));
    child.stdin.end(input);
  });
}

/** Evaluates `fn` in the page with JSON `args`. */
export const call = (session, fn, ...args) => evaluate(session, `(${fn.toString()})(...${JSON.stringify(args)})`);

/**
 * A clip on the virtual clock (`virtualClock.js`): each frame moves the page's clock 1/30 s on in
 * 60 Hz steps and pipes a screenshot to ffmpeg as h264 yuv420p at `crf`, scaled to `size` if given.
 */
export async function startClip(session, file, { crf = 20, fps = 30, size = null } = {}) {
  await mkdir(dirname(file), { recursive: true });
  await evaluate(session, "__clock.hold()");
  const scale = size ? ["-vf", `scale=${size}:flags=lanczos`] : [];
  const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-c:v", "png", "-i", "-", ...scale, "-c:v", "libx264", "-preset", "slow", "-crf", String(crf), "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(fps), file], { stdio: ["pipe", "inherit", "inherit"] });
  const exited = new Promise((done, fail) => ffmpeg.on("exit", (code) => (code ? fail(new Error(`ffmpeg exited ${code} on ${file}`)) : done())));
  let count = 0;
  const clip = {
    async frame(between = null) {
      await evaluate(session, `__clock.step(${1000 / fps}, ${1000 / 60})`);
      if (between) await between();
      const { data } = await session.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
      if (!ffmpeg.stdin.write(Buffer.from(data, "base64"))) await new Promise((done) => ffmpeg.stdin.once("drain", done));
      count++;
    },
    async play(seconds, each = null) {
      const n = Math.round(seconds * fps);
      for (let i = 0; i < n; i++) await clip.frame(each && (() => each(i, n)));
    },
    async close() {
      ffmpeg.stdin.end();
      await exited;
      return count;
    },
  };
  return clip;
}
