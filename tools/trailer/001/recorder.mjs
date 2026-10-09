import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate } from "../../cdp.mjs";
import { installVirtualClock } from "./virtualClock.js";

/** A 9:16 phone whose screenshots come out at 1080×1920. */
export const PHONE = { width: 405, height: 720, dpr: 1080 / 405 };
export const FPS = 30;
/** Page time, in ms, every clip starts from, so a run does not depend on how long the page took to load. */
const HOLD_AT = 60_000;

/** Headless Chrome as a phone, with the virtual clock in every page it loads. */
export async function openPhone() {
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await emulateDevice(session, { ...PHONE, maxTouchPoints: 2 });
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installVirtualClock})()` });
  return { session, errors };
}

/** Loads `url` and waits for `ready` to hold, at real speed. */
export async function load(session, url, ready, errors) {
  await navigate(session, url);
  if (!(await waitFor(session, ready, 30000))) throw new Error(`${url} did not get ready: ${errors.join("\n")}`);
}

/**
 * A clip being written: each `frame()` moves the page's clock one frame on (`scale` times a frame of
 * real time) and pipes a screenshot to ffmpeg; `idle(seconds)` moves it on unseen.
 */
export async function startClip(session, file) {
  await mkdir(dirname(file), { recursive: true });
  await evaluate(session, `__clock.hold(${HOLD_AT})`);
  const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "14", "-pix_fmt", "yuv420p", "-r", String(FPS), file], { stdio: ["pipe", "inherit", "inherit"] });
  const exited = new Promise((done, fail) => ffmpeg.on("exit", (code) => (code ? fail(new Error(`ffmpeg exited ${code} on ${file}`)) : done())));
  let count = 0;
  const clip = {
    get frames() {
      return count;
    },
    /** Moves the clock one frame of `scale` real frames on, then captures it. */
    async frame(scale = 1, between = null) {
      const ms = (1000 / FPS) * scale;
      await evaluate(session, `__clock.step(${ms}, ${Math.min(ms, 1000 / 60)})`);
      if (between) await between();
      const { data } = await session.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
      if (!ffmpeg.stdin.write(Buffer.from(data, "base64"))) await new Promise((done) => ffmpeg.stdin.once("drain", done));
      count++;
    },
    /** Captures `seconds` of footage played at `scale` times real speed. */
    async play(seconds, scale = 1, each = null) {
      const n = Math.round(seconds * FPS);
      for (let i = 0; i < n; i++) await clip.frame(scale, each && (() => each(i, n)));
    },
    /** Moves the clock `seconds` on without capturing, a frame at a time so the page keeps up. */
    async idle(seconds) {
      const steps = Math.ceil(seconds * 30);
      for (let i = 0; i < steps; i++) await evaluate(session, `__clock.step(${(seconds * 1000) / steps}, ${1000 / 60})`);
    },
    async close() {
      ffmpeg.stdin.end();
      await exited;
      return count;
    },
  };
  return clip;
}
