// A bored dragon yawning, for review: head close-ups per age at rest and at the widest gape from the
// front, three-quarter and side, a strip through one yawn per age, and the yard with the clock frozen
// and stepped through the next yawn of a bored kid, teen and adult. Writes <out>/grid.png,
// <out>/strip.png and <out>/yard-<age>/<frame>.png, and with ffmpeg <out>/yawn-<age>.mp4 and
// <out>/yawn-ages.mp4 side by side.
//   node tools/checks/yawnEvidence.mjs [--ages kid,teen,adult] [--fps 15] [--turn -60] [--no-yard]
//     [--out /Volumes/SLEEPTUBE/dragons-animations/yawn] [--url http://127.0.0.1:8094]
import { mkdir, rm, rmdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep, drag } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const ages = option("ages", "kid,teen,adult").split(",");
const fps = Number(option("fps", "15"));
const turn = Number(option("turn", "-60"));
const out = option("out", "/Volumes/SLEEPTUBE/dragons-animations/yawn");
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const START = 200;
const lock = join(tmpdir(), "dragonz-care-evidence.lock");

/** Waits for the browser lock, shared by every checkout, so parallel checks never share the GPU. */
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

async function closeups() {
  const [{ createRenderer }, { loadSubject, makeGenome }, { palette }, { boneMatrices, point }, { creatureScale }, { yawnOf }, { individualSeed }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/math3d.js"), import("/src/worldScale.js"),
    import("/src/animate/dragonYawn.js"), import("/src/animate/flightNoise.js"),
  ]);
  const module = await loadSubject("dragon");
  const canvas = Object.assign(document.createElement("canvas"), { width: 300, height: 260 });
  const renderer = createRenderer(canvas);
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const label = 18;
  const sheet = (columns, rows) => {
    const out = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + label) * rows });
    const context = out.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, out.width, out.height);
    context.font = "12px system-ui";
    return { out, context };
  };
  const draw = ({ context }, anatomy, pose, [yaw, pitch], c, r, text) => {
    const ids = anatomy.bones.map((bone) => bone.id);
    const center = point(boneMatrices(anatomy, pose)[ids.indexOf("head")], [0.2, 0, 0].map((v) => v * anatomy.scale));
    renderer.render({ ...anatomy, bounds: { center, radius: 0.6 * creatureScale } }, pose, { style: "cozy", ground: false, yaw, pitch, zoom: 1 });
    const x = c * canvas.width, y = r * (canvas.height + label);
    context.drawImage(canvas, x, y);
    context.fillStyle = rgb(palette.ivory);
    context.fillText(text, x + 8, y + canvas.height + 13);
  };
  const rows = [["kid", 3], ["teen", 5], ["adult", 7], ["adult", 11], ["adult", 13]];
  const views = [["front rest", -Math.PI / 2, 0.1, false], ["front widest", -Math.PI / 2, 0.1, true], ["front low widest", -Math.PI / 2, -0.35, true], ["3/4 widest", -0.55, 0.1, true], ["side widest", 0, 0.1, true], ["3/4 high widest", -0.9, 0.6, true]];
  const grid = sheet(views.length, rows.length), strip = sheet(8, rows.length);
  const motion = (time) => ({ effort: 0, glide: 1, stand: 1, time, idle: 1, bored: 1 });
  try {
    rows.forEach(([age, n], r) => {
      const anatomy = module.createAnatomy(makeGenome(module.genes, 2400 + n), { age }),
        seed = individualSeed(anatomy.genome),
        yawn = (t) => yawnOf(anatomy, motion(t), t, seed);
      let start = 0;
      while (!yawn(start)) start += 0.02;
      let widest = start, end = start;
      while (yawn(end)?.id === yawn(start).id) {
        if (yawn(end).gape > yawn(widest).gape) widest = end;
        end += 0.02;
      }
      views.forEach(([name, yaw, pitch, wide], c) =>
        draw(grid, anatomy, module.pose(anatomy, 0, { ...motion(wide ? widest : start - 1), bored: wide ? 1 : 0 }), [yaw, pitch], c, r, `${age} · ${name}`));
      for (let c = 0; c < 8; c++) {
        const t = start + (c / 7) * (end - start);
        draw(strip, anatomy, module.pose(anatomy, 0, motion(t)), [-0.9, 0.15], c, r, `${age} · ${(t - start).toFixed(2)} s of ${(end - start).toFixed(2)}`);
      }
    });
    return { grid: grid.out.toDataURL("image/png"), strip: strip.out.toDataURL("image/png") };
  } finally {
    renderer.dispose();
  }
}

const seedStable = (age, i) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { makeGenome, loadSubject } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const dragon = createDragon({ seed: "yawn-${i}", genome: makeGenome(genes, "yawn-${i}"), age: ${JSON.stringify(age)}, now: stable.clock.game });
  for (const id of Object.keys(dragon.care)) dragon.care[id] = 95;
  dragon.care.happiness = 15;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  window.__game.save();
  return dragon.id;
})()`;

const nextYawn = `(async () => {
  const { yawnOf } = await import("/src/animate/dragonYawn.js");
  const { individualSeed } = await import("/src/animate/flightNoise.js");
  const dragon = window.__game.game.stable.dragons[0];
  const seed = individualSeed(dragon.genome), motion = { idle: 1, stand: 1, bored: 1 };
  let t = ${START} + 4;
  while (!yawnOf(dragon, motion, t, seed)) t += 0.05;
  const from = t - 0.5;
  while (yawnOf(dragon, motion, t, seed)) t += 0.05;
  return [from, t + 0.5];
})()`;

const freeze = `(() => {
  const raf = window.requestAnimationFrame.bind(window), now = performance.now.bind(performance);
  window.requestAnimationFrame = (cb) => raf((t) => cb(window.__fake ?? t));
  performance.now = () => window.__fake ?? now();
  window.__fake = ${START * 1000};
})()`;

/** Advances the frozen clock to `to` seconds in frame-sized steps so the camera and moods settle. */
async function advance(session, to) {
  for (;;) {
    const at = await evaluate(session, "window.__fake = Math.min(" + to * 1000 + ", window.__fake + 40)");
    if (at >= to * 1000) return;
    await sleep(20);
  }
}

const bare = `document.head.insertAdjacentHTML("beforeend", "<style>body *:not(.yard-stage):not(:has(.yard-stage)){visibility:hidden}</style>")`;

/** Opens a fresh browser of `size`, hands it to `work` and closes it, failing on any page error. */
async function browse(size, work) {
  const session = await launch({ url: "about:blank", ...size });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    if (size.dpr) await emulateDevice(session, size);
    const result = await work(session, errors);
    if (errors.length) throw new Error(errors.join("\n"));
    return result;
  } finally {
    await session.close();
  }
}

const ffmpeg = (...list) => execFileSync("ffmpeg", ["-y", "-loglevel", "error", ...list]);

await mkdir(out, { recursive: true });
await acquire();
try {
  await browse({ width: 1800, height: 1500 }, async (session, errors) => {
    await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
    if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
    const images = await evaluate(session, `(${closeups.toString()})()`);
    for (const [name, png] of Object.entries(images)) {
      await writeFile(resolve(out, `${name}.png`), Buffer.from(png.split(",")[1], "base64"));
      console.log(resolve(out, `${name}.png`));
    }
  });
  if (!args.includes("--no-yard")) {
    for (const [i, age] of ages.entries())
      await browse(PHONE, async (session, errors) => {
        const dir = resolve(out, `yard-${age}`);
        await rm(dir, { recursive: true, force: true });
        await mkdir(dir, { recursive: true });
        await session.send("Page.navigate", { url: new URL("/?style=cozy", base).href });
        if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
        const id = await evaluate(session, seedStable(age, i));
        await session.send("Page.navigate", { url: new URL(`/?style=cozy#/stable/${encodeURIComponent(id)}`, base).href });
        if (!(await waitFor(session, "document.querySelector('[data-action]')", 20000))) throw new Error(`No stable: ${errors.join("\n")}`);
        await sleep(1500);
        for (let n = 0; n < 4; n++) await evaluate(session, `document.querySelector('[data-tour="skip"]:not([hidden])')?.click()`);
        await evaluate(session, bare);
        if (turn) {
          await drag(session, 195, 330, 195 + turn, 330, { steps: 12 });
          await sleep(1500);
        }
        await evaluate(session, freeze);
        const [from, to] = await evaluate(session, nextYawn);
        await advance(session, from);
        let frame = 0;
        for (let t = from; t <= to; t += 1 / fps) {
          await evaluate(session, `window.__fake = ${t * 1000}`);
          await sleep(120);
          await screenshot(session, join(dir, `${String(frame++).padStart(3, "0")}.png`));
        }
        ffmpeg("-framerate", String(fps), "-i", join(dir, "%03d.png"), "-vf", "crop=iw:trunc(ih*0.56/2)*2:0:trunc(ih*0.18/2)*2", "-pix_fmt", "yuv420p", "-c:v", "libx264", resolve(out, `yawn-${age}.mp4`));
        console.log(`${frame} frames of ${(to - from).toFixed(1)} s, ${resolve(out, `yawn-${age}.mp4`)}`);
      });
    const inputs = ages.flatMap((age) => ["-i", resolve(out, `yawn-${age}.mp4`)]);
    if (ages.length > 1) ffmpeg(...inputs, "-filter_complex", `hstack=inputs=${ages.length}`, "-pix_fmt", "yuv420p", "-c:v", "libx264", resolve(out, "yawn-ages.mp4"));
    if (ages.length > 1) console.log(resolve(out, "yawn-ages.mp4"));
  }
} finally {
  await rmdir(lock);
}
