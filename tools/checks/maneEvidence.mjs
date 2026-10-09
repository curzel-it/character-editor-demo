// Element manes on the dragon's profile: one maned dragon per breath element and age, plus the yard
// with each age's, and with --clips a 5 s clip of each; with --race, a clip and stills of race 21, whose field has two maned dragons, in flight.
// Writes shots/mane/<style>/<age>-<breath>.png (.webm, -top.png from above), yard-<age>.png and race.webm, race-<k>.png.
//   node tools/checks/maneEvidence.mjs [--breath fire,water] [--age teen,adult] [--style cozy|lowPoly]
//     [--seed 7] [--headgear swept] [--dpr 2] [--wait 2] [--top] [--clips] [--race] [--at 20] [--url http://127.0.0.1:8094]
import { mkdir, rmdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, screenshot, sleep, dragTouch } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const elements = ["fire", "nature", "earth", "storm", "water"];
const breaths = option("breath", elements.join(",")).split(",");
const ages = option("age", "teen,adult").split(",");
const styles = option("style") ? [option("style")] : ["cozy"];
const seed = option("seed", "7");
const wait = Number(option("wait", "2"));
const base = option("url", "http://127.0.0.1:8094");
const racing = args.includes("--race");
const clips = args.includes("--clips");
const top = args.includes("--top");
const at = Number(option("at", "20"));
const CHUNK = 4 << 20;
const PHONE = { width: 390, height: 844, dpr: Number(option("dpr", "2")) };
const headgear = option("headgear");
const root = fileURLToPath(new URL("../../", import.meta.url));
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

const seedStable = (ages) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const { needsOf } = await import("/src/stable/care.js");
  const genes = (await loadSubject("dragon")).genes;
  const mane = genes.find((gene) => gene.name === "mane").ids.indexOf("element");
  const headgear = ${JSON.stringify(headgear ?? null)};
  const gear = headgear ? { headgear: genes.find((gene) => gene.name === "headgear").ids.indexOf(headgear) } : {};
  const stable = window.__game.game.stable;
  const dragons = [];
  for (const age of ${JSON.stringify(ages)})
    for (const breath of ${JSON.stringify(breaths)}) {
      const genome = { ...makeGenome(genes, "mane-${seed}-" + breath), breath: ${JSON.stringify(elements)}.indexOf(breath), mane, ...gear };
      const dragon = createDragon({ seed: "mane-${seed}-" + age + breath, genome, age, now: stable.clock.game });
      for (const n of needsOf(dragon.age)) dragon.care[n.id] = 95;
      dragons.push({ id: dragon.id, name: age + "-" + breath, dragon });
    }
  stable.dragons = dragons.map((d) => d.dragon);
  stable.eggs = [];
  stable.welcomed = true;
  stable.careTaught = true;
  window.__game.save();
  return dragons.map(({ id, name }) => ({ id, name }));
})()`;

/** Starts recording the canvas at `selector` into `window.__clip`. */
async function startClip(session, selector) {
  await evaluate(
    session,
    `(() => {
      const stream = document.querySelector(${JSON.stringify(selector)}).captureStream(60);
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10e6 });
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      window.__clip = { recorder, done: false };
      recorder.onstop = async () => {
        window.__clip.bytes = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
        window.__clip.done = true;
      };
      recorder.start(1000);
      return 0;
    })()`,
  );
}

/** Stops the clip `startClip` began and writes it to `path`. */
async function saveClip(session, path) {
  await evaluate(session, "(window.__clip.recorder.stop(), 0)");
  if (!(await waitFor(session, "window.__clip.done", 20000))) throw new Error("MediaRecorder did not finish");
  const size = await evaluate(session, "window.__clip.bytes.length");
  const parts = [];
  for (let offset = 0; offset < size; offset += CHUNK) {
    const text = await evaluate(
      session,
      `(() => { const b = window.__clip.bytes.subarray(${offset}, ${offset + CHUNK}); let s = ""; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); })()`,
    );
    parts.push(Buffer.from(text, "base64"));
  }
  await writeFile(path, Buffer.concat(parts));
  console.log(path);
}

async function run(style) {
  const out = resolve(root, "shots", "mane", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    for (const age of ages) {
      await session.send("Page.navigate", { url: new URL(`/?style=${style}`, base).href });
      if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
      const dragons = await evaluate(session, seedStable([age]));
      await session.send("Page.navigate", { url: new URL(`/?style=${style}&reload=1#/stable`, base).href });
      await sleep(wait * 1000 + 2000);
      console.log(await screenshot(session, resolve(out, `yard-${age}.png`)));
      for (const { id, name } of dragons) {
        await evaluate(session, `location.hash = ${JSON.stringify(`#/stable/${encodeURIComponent(id)}`)}`);
        await sleep(wait * 1000);
        console.log(await screenshot(session, resolve(out, `${name}.png`)));
        if (top) {
          await dragTouch(session, [195, 300], [95, 620], { steps: 12, ms: 400 });
          await sleep(1500);
          console.log(await screenshot(session, resolve(out, `${name}-top.png`)));
        }
        if (!clips) continue;
        await startClip(session, "canvas.yard-stage");
        await sleep(5000);
        await saveClip(session, resolve(out, `${name}.webm`));
      }
    }
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

/** Race 21 from `at` seconds, the director keeping to its maned racers: a 6 s clip, then stills a beat apart. */
async function race(style) {
  const out = resolve(root, "shots", "mane", style);
  await mkdir(out, { recursive: true });
  const session = await launch({ url: "about:blank", width: 1920, height: 1080 });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await session.send("Page.navigate", { url: new URL(`/race.html?paused&course=2407&race=21&style=${style}&motion=full&focus=w-21:1,w-21:5`, base).href });
    if (!(await waitFor(session, "window.__race && window.__race.ready", 30000))) throw new Error(`Race page did not load: ${errors.join("\n")}`);
    await evaluate(
      session,
      `(() => { const workspace = document.querySelector(".workspace"); if (workspace) workspace.style.gridTemplateColumns = "1fr"; const stage = document.getElementById("race-stage"); Object.assign(stage.style, { maxHeight: "none", aspectRatio: "auto", width: "1600px", height: "900px" }); return 0; })()`,
    );
    await evaluate(
      session,
      `(() => {
        const r = window.__race;
        r.setCamera("director");
        r.state.speed = 1;
        r.seek(${at});
        r.setPlaying(true);
        return 0;
      })()`,
    );
    await startClip(session, "#race-view");
    const clip = await evaluate(session, `(() => { const r = document.getElementById("race-stage").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 }; })()`);
    for (let k = 1; k <= 4; k++) {
      await sleep(1500);
      const { data } = await session.send("Page.captureScreenshot", { format: "png", clip });
      const path = resolve(out, `race-${k}.png`);
      await writeFile(path, Buffer.from(data, "base64"));
      console.log(path);
    }
    await evaluate(session, "(window.__race.setPlaying(false), 0)");
    await saveClip(session, resolve(out, "race.webm"));
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

await acquire();
try {
  for (const style of styles) await (racing ? race(style) : run(style));
} finally {
  await rmdir(lock);
}
