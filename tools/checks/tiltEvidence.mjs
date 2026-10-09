// The idle head tilt, for review: head close-ups per age at rest and tilted each way, from the front,
// three-quarter and side, and a strip of the stable yard through one tilt per age. Writes
// <out>/grid.png, <out>/strip.png (one tilt through time per age) and <out>/yard-<age>-<n>.png.
//   node tools/checks/tiltEvidence.mjs [--ages kid,teen,adult] [--frames 6] [--no-yard]
//     [--out /Volumes/SLEEPTUBE/dragons-animations/tilt] [--url http://127.0.0.1:8094]
import { mkdir, rmdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const ages = option("ages", "kid,teen,adult").split(",");
const frames = Number(option("frames", "6"));
const out = option("out", "/Volumes/SLEEPTUBE/dragons-animations/tilt");
const base = option("url", "http://127.0.0.1:8094");
const PHONE = { width: 390, height: 844, dpr: 2 };
const lock = join(tmpdir(), "dragonz-care-evidence.lock");

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

/** Seconds into `[from, to)` where the tilt of `anatomy` peaks each way, and the first tilt's span. */
async function peaks(ageList) {
  const [{ loadSubject, makeGenome }, { tiltOf }, { individualSeed }] = await Promise.all([
    import("/src/subjects.js"), import("/src/animate/dragonTilt.js"), import("/src/animate/flightNoise.js"),
  ]);
  const module = await loadSubject("dragon");
  return ageList.map((age, i) => {
    const anatomy = module.createAnatomy(makeGenome(module.genes, "yard-" + i), { age }),
      seed = individualSeed(anatomy.genome);
    let start = null, end = null;
    for (let t = 200; t < 400 && end === null; t += 0.02) {
      const on = tiltOf(anatomy, { idle: 1, stand: 1 }, t, seed);
      if (on && start === null) start = t;
      if (!on && start !== null) end = t;
    }
    return { start, end };
  });
}

async function closeups() {
  const [{ createRenderer }, { loadSubject, makeGenome }, { palette }, { boneMatrices, point }, { creatureScale }, { tiltOf }, { individualSeed }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/math3d.js"), import("/src/worldScale.js"),
    import("/src/animate/dragonTilt.js"), import("/src/animate/flightNoise.js"),
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
  const draw = ({ context }, anatomy, pose, [yaw, body], c, r, text) => {
    const ids = anatomy.bones.map((bone) => bone.id);
    const center = point(boneMatrices(anatomy, pose)[ids.indexOf(body ? "neck-0" : "head")], [0.2, 0, 0].map((v) => v * anatomy.scale));
    renderer.render({ ...anatomy, bounds: { center, radius: body ? 0.45 * anatomy.bounds.radius : 0.6 * creatureScale } }, pose, { style: "cozy", ground: false, yaw, pitch: 0.1, zoom: 1 });
    const x = c * canvas.width, y = r * (canvas.height + label);
    context.drawImage(canvas, x, y);
    context.fillStyle = rgb(palette.ivory);
    context.fillText(text, x + 8, y + canvas.height + 13);
  };
  const rows = [["kid", 3], ["teen", 5], ["adult", 7], ["adult", 11]];
  const views = [["front rest", -Math.PI / 2, 0], ["front tilt", -Math.PI / 2, 1], ["front other way", -Math.PI / 2, -1], ["3/4 tilt", -0.55, 1], ["side tilt", 0, 1], ["body front tilt", -1.2, 1, true]];
  const grid = sheet(views.length, rows.length), strip = sheet(8, rows.length);
  const resting = (time, idle) => ({ effort: 0, glide: 1, stand: 1, time, idle });
  try {
    rows.forEach(([age, n], r) => {
      const anatomy = module.createAnatomy(makeGenome(module.genes, 2400 + n), { age }),
        seed = individualSeed(anatomy.genome),
        roll = (t) => tiltOf(anatomy, { idle: 1, stand: 1 }, t, seed)?.roll ?? 0;
      const peak = (side) => {
        let best = 0, at = 0;
        for (let t = 0; t < 300; t += 0.02) if (side * roll(t) > best) [best, at] = [side * roll(t), t];
        return at;
      };
      const times = { 1: peak(1), [-1]: peak(-1) };
      views.forEach(([name, yaw, side, body], c) =>
        draw(grid, anatomy, module.pose(anatomy, 0, resting(times[side || 1], side ? 1 : 0)), [yaw, body], c, r, `${age} · ${name}`));
      let start = times[-1];
      while (roll(start - 0.02) !== 0) start -= 0.02;
      let end = start + 0.02;
      while (roll(end) !== 0) end += 0.02;
      for (let c = 0; c < 8; c++) {
        const t = start + (c / 7) * (end - start);
        draw(strip, anatomy, module.pose(anatomy, 0, resting(t, 1)), [-1.2], c, r, `${age} · ${(t - start).toFixed(2)} s of ${(end - start).toFixed(2)}`);
      }
    });
    return { grid: grid.out.toDataURL("image/png"), strip: strip.out.toDataURL("image/png") };
  } finally {
    renderer.dispose();
  }
}

const seedStable = (age) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { makeGenome, loadSubject } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const i = ${ages.indexOf(age)};
  const dragon = createDragon({ seed: "yard-" + i, genome: makeGenome(genes, "yard-" + i), age: ${JSON.stringify(age)}, now: stable.clock.game });
  for (const id of Object.keys(dragon.care)) dragon.care[id] = 95;
  stable.dragons = [dragon];
  stable.eggs = [];
  stable.welcomed = true;
  window.__game.save();
  return dragon.id;
})()`;

const freeze = `(() => {
  const raf = window.requestAnimationFrame.bind(window), now = performance.now.bind(performance);
  window.requestAnimationFrame = (cb) => raf((t) => cb(window.__fake ?? t));
  performance.now = () => window.__fake ?? now();
  window.__fake = 200000;
})()`;

/** Advances the frozen clock by `seconds` in frame-sized steps so the camera settles. */
async function advance(session, seconds) {
  for (let t = 0; t < seconds; t += 0.04) {
    await evaluate(session, "window.__fake += 40");
    await sleep(20);
  }
}

const bare = `document.body.classList.add("yard-bare"); document.getElementById("yard-bare") || document.head.insertAdjacentHTML("beforeend", "<style id=yard-bare>.yard-bare *:not(canvas):not(:has(canvas)){visibility:hidden}</style>")`;

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

await mkdir(out, { recursive: true });
await acquire();
try {
  const spans = await browse({ width: 1800, height: 1100 }, async (session, errors) => {
    await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
    if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
    const images = await evaluate(session, `(${closeups.toString()})()`);
    for (const [name, png] of Object.entries(images)) {
      await writeFile(resolve(out, `${name}.png`), Buffer.from(png.split(",")[1], "base64"));
      console.log(resolve(out, `${name}.png`));
    }
    return evaluate(session, `(${peaks.toString()})(${JSON.stringify(ages)})`);
  });
  if (!args.includes("--no-yard"))
    for (const [i, age] of ages.entries())
      await browse(PHONE, async (session, errors) => {
        await session.send("Page.navigate", { url: new URL("/?style=cozy", base).href });
        if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
        const id = await evaluate(session, seedStable(age));
        await session.send("Page.navigate", { url: new URL(`/?style=cozy#/stable/${encodeURIComponent(id)}`, base).href });
        if (!(await waitFor(session, "document.querySelector('[data-action]')", 20000))) throw new Error(`No stable: ${errors.join("\n")}`);
        await sleep(1500);
        for (let n = 0; n < 4; n++) await evaluate(session, `document.querySelector('[data-tour="skip"]:not([hidden])')?.click()`);
        await evaluate(session, freeze);
        await evaluate(session, bare);
        const { start, end } = spans[i];
        await evaluate(session, `window.__fake = ${(start - 4) * 1000}`);
        await advance(session, 4);
        for (let f = 0; f < frames; f++) {
          await advance(session, (end - start) / (frames + 1));
          await sleep(200);
          console.log(await screenshot(session, resolve(out, `yard-${age}-${f}.png`)));
        }
      });
} finally {
  await rmdir(lock);
}
