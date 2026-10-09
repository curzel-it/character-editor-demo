// Stills and clips of the breath elements and the rare coats for the talk's deck: a maned adult per element,
// each element's breath, the four metallic coats and a metal coat with an element mane, framed close in the
// stable yard with the UI hidden, plus a clip of a fire mane and one of a gold coat under an orbiting camera.
// Writes shots/elements/<n>-<name>.webp, mane-fire.mp4, metal.mp4 and shots/elements.json.
//   node tools/pitch/001/capture/elementShots.mjs [--url http://127.0.0.1:8094] [--out <media dir>] [--tmp <scratch dir>] [--only mane-fire,metal-gold] [--no-clips] [--no-stills]
//     [--try <dir>] [--elements fire,water] [--camera dx,dy,zoom] (a contact run: every palette candidate per element into <dir>, nothing else)
import { spawn } from "node:child_process";
import { mkdir, readFile, rmdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, navigate, sleep } from "../../../cdp.mjs";
import { installVirtualClock } from "./virtualClock.js";
import { pinResolution } from "./shotKit.mjs";
import { base, shotsDir, tmp } from "./args.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const only = option("only") ? option("only").split(",") : null;
const trying = option("try") && resolve(tmp, option("try"));
const VIEW = { width: 1600, height: 1000, dpr: 1.2 };
const FPS = 30;
const out = shotsDir("elements");
const lock = join(tmpdir(), "dragonz-care-evidence.lock");

/** The shared build every dragon in the set is grown from, so the shots differ only in coat and element. */
const BUILD = option("build", "talk-elements-3");

/** Coats per element: scales, wings, underside. The first is the one shot; --try shows them all. */
const palettes = {
  fire: [["black", "ember", "amber"], ["crimson", "tangerine", "sand"], ["slate", "amber", "sand"]],
  nature: [["chocolate", "moss", "sand"], ["jade", "lime", "mint"], ["ivory", "fern", "sand"]],
  earth: [["chocolate", "rust", "sand"], ["rust", "amber", "sand"], ["bronze", "sand", "ivory"]],
  storm: [["navy", "violet", "lavender"], ["slate", "sky", "ivory"], ["violet", "lavender", "ivory"]],
  water: [["cobalt", "turquoise", "mint"], ["azure", "sky", "ivory"], ["teal", "turquoise", "mint"]],
};
const elements = Object.keys(palettes);
const names = { fire: "Ember", nature: "Bramble", earth: "Dune", storm: "Volt", water: "Tide" };
const coat = (element, k = 0) => Object.fromEntries(["scales", "wings", "underside"].map((gene, i) => [gene, palettes[element][k][i]]));

/** Camera moves after the yard frames the dragon: a drag of `turn` CSS pixels and wheel `zoom` ticks in. */
const cameraOption = option("camera")?.split(",").map(Number);
const STAND = cameraOption ? { turn: cameraOption.slice(0, 2), zoom: cameraOption[2], pan: cameraOption.slice(3, 5).length ? cameraOption.slice(3, 5) : [0, 0] } : { turn: [120, 120], zoom: 0, pan: [-170, 40] };
const breathOption = option("breath-camera")?.split(",").map(Number);
const BREATH = breathOption ? { turn: breathOption.slice(0, 2), zoom: breathOption[2], pan: breathOption.slice(3, 5).length ? breathOption.slice(3, 5) : [0, 0] } : { turn: [220, 80], zoom: 4, pan: [-250, -80] };

const titles = { fire: "Fire", nature: "Nature", earth: "Earth", storm: "Storm", water: "Water" };
const maneCaptions = {
  fire: "One dragon in 25 is born with an element mane, and a fire mane never stops burning.",
  nature: "A nature mane grows in leaves that ripple along the spine with every breath.",
  earth: "An earth mane streams sand down the dragon's back like a desert wind.",
  storm: "A storm mane crackles with lightning from crest to tail.",
  water: "A water mane flows along the back in an endless wave.",
};
const breathCaptions = {
  fire: "Fire beats nature: every dragon breathes one of five elements, revealed when it grows up.",
  nature: "Nature beats earth, so the matchups in a race field are worth reading.",
  earth: "Earth beats storm, grounding the lightning before it lands.",
  storm: "Storm beats water, and the cycle closes when water douses fire.",
  water: "Water beats fire: five elements, each strong against one and weak against another.",
};
const metals = [
  { id: "gold", title: "Gold coat", caption: "One dragon in a thousand hatches with a metallic coat; gold flies faster." },
  { id: "silver", title: "Silver coat", caption: "A silver coat catches the light and sharpens acceleration and handling." },
  { id: "goldSilver", title: "Gold and silver", caption: "Gold scales with silver wings, a coat almost nobody will ever breed." },
  { id: "silverGold", title: "Silver and gold", caption: "Silver scales with gold wings, the rarest look in the stable." },
];

/** Every still: its file stem, the dragon, the camera and what plays. */
const stills = [
  ...elements.map((element) => ({ name: `mane-${element}`, title: `${titles[element]} mane`, caption: maneCaptions[element], dragon: { element, mane: true, ...coat(element) }, camera: STAND })),
  ...elements.map((element) => ({ name: `breath-${element}`, title: `${titles[element]} breath`, caption: breathCaptions[element], dragon: { element, mane: false, ...coat(element) }, camera: BREATH, breathe: true })),
  ...metals.map(({ id, title, caption }) => ({ name: `metal-${id}`, title, caption, dragon: { element: "fire", mane: false, metal: id, ...coat("fire") }, camera: STAND })),
  { name: "legendary", title: "Legendary", caption: "A gold coat with a fire mane: one dragon in 25,000, and you can breed for it.", dragon: { element: "fire", mane: true, metal: "gold", ...coat("fire") }, camera: STAND },
];

const clips = [
  { file: "mane-fire.mp4", dragon: stills[0].dragon, camera: STAND, orbit: 90 },
  { file: "metal.mp4", dragon: stills.find((s) => s.name === "metal-gold").dragon, camera: { turn: [-200, 80], zoom: 0 }, orbit: 500 },
];

const HIDE = `
  .topbar, .yard__head, .yard__panel, .yard__roster, .profile-sheet, .breath-reveal, .coach-marks, .dz-toasts, .dz-info-bubble, .away { visibility: hidden !important; }
  .app > .dz-nav, .yard__roster, .stable-empty { display: none !important; }
  .yard__head { top: 0 !important; height: 0 !important; overflow: hidden !important; padding: 0 !important; }
  .yard__panel { height: 0 !important; overflow: hidden !important; padding: 0 !important; margin: 0 !important; }
  .screen.stable-home { gap: 0 !important; }`;

/**
 * The virtual clock, held from the first instant on the yard's page and started at 0 there, so every shot
 * draws the same frames at the same times whatever the page's load took.
 */
const yardClock = `(${installVirtualClock
  .toString()
  .replace("let now = realNow()", 'let now = location.search.includes("talk=yard") ? 0 : realNow()')
  .replace("now = realNow() - lastReal + now;", "if (!held) now = realNow() - lastReal + now;")})(); if (location.search.includes("talk=yard")) __clock.hold();`;

let session, errors;
const js = (expression) => evaluate(session, expression);

/** Stops the page's clock where it is; from here only `step` moves it. */
const hold = () => js(`__clock.hold(), 0`);
const step = (ms) => js(`__clock.step(${ms}, ${1000 / 60}), 0`);
/** Moves the clock on to `ms` after the page started, so the idle animation is at the same beat in every shot. */
async function stepTo(ms) {
  const now = await js(`__clock.now`);
  if (now > ms) throw new Error(`The clock is already at ${Math.round(now)} ms, past ${ms}`);
  await step(ms - now);
}
/** Page time of every still, and of a breath's cue. */
const STILL_AT = 12250;
const PLUME_AT = Number(option("plume-at", "1450"));

/** Seeds the stable with the one dragon `look` describes and opens it in the yard, the UI hidden. */
async function stage(look) {
  await navigate(session, new URL(`/?talk=seed`, base).href);
  if (!(await waitFor(session, "window.__game", 30000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
  const id = await js(`(async () => {
    const { createDragon } = await import("/src/stable/createDragon.js");
    const { loadSubject, makeGenome } = await import("/src/subjects.js");
    const { needsOf } = await import("/src/stable/care.js");
    const look = ${JSON.stringify(look)};
    const genes = (await loadSubject("dragon")).genes;
    const pick = (name, id) => {
      const k = genes.find((gene) => gene.name === name).ids.indexOf(id);
      if (k < 0) throw new Error(name + " has no " + id);
      return k;
    };
    const genome = {
      ...makeGenome(genes, ${JSON.stringify(BUILD)}),
      breath: pick("breath", look.element),
      mane: pick("mane", look.mane ? "element" : "spikes"),
      metal: pick("metal", look.metal ?? "none"),
      markings: pick("markings", "none"),
      scales: pick("scales", look.scales),
      wings: pick("wings", look.wings),
      underside: pick("underside", look.underside),
    };
    const stable = window.__game.game.stable;
    const dragon = createDragon({ seed: ${JSON.stringify(BUILD)}, genome, age: "adult", now: stable.clock.game });
    for (const need of needsOf(dragon.age)) dragon.care[need.id] = 95;
    dragon.fatigue = 0;
    dragon.harness = false;
    dragon.name = ${JSON.stringify(names)}[look.element];
    stable.dragons = [dragon];
    stable.eggs = [];
    stable.wild = [];
    Object.assign(stable, { welcomed: true, careTaught: true, raceHint: "done", reinsInvited: true, reinsTaught: true });
    window.__game.save();
    return dragon.id;
  })()`);
  await navigate(session, new URL(`/?talk=yard#/stable/${encodeURIComponent(id)}`, base).href);
  for (let i = 0; !(await js(`Boolean(document.querySelector(".stable-home [data-actions] > *"))`)); i++) {
    if (i > 300) throw new Error(`No yard: ${errors.join("\n")}`);
    await sleep(300);
    await step(1000 / 60);
  }
  await js(`document.head.insertAdjacentHTML("beforeend", ${JSON.stringify(`<style id="talk-hide">${HIDE}</style>`)})`);
  await step(2500);
  return id;
}

const mouse = (type, x, y) => session.send("Input.dispatchMouseEvent", { type, x, y, button: "left", buttons: type === "mouseReleased" ? 0 : 1, clickCount: 1 });

/** Turns the yard camera by dragging `turn` CSS pixels across the canvas, zooms in `zoom` wheel ticks and pans by a two-finger drag of `pan` pixels. */
async function aim({ turn, zoom, pan = [0, 0] }) {
  const [x, y] = [VIEW.width / 2, VIEW.height / 2];
  await mouse("mousePressed", x, y);
  for (let i = 1; i <= 20; i++) {
    await mouse("mouseMoved", x + (turn[0] * i) / 20, y + (turn[1] * i) / 20);
    await step(15);
  }
  await sleep(150);
  await step(200);
  await mouse("mouseReleased", x + turn[0], y + turn[1]);
  for (let i = 0; i < zoom; i++) await js(`document.querySelector("canvas.yard-stage").dispatchEvent(new WheelEvent("wheel", { deltaY: -100, cancelable: true })), 0`);
  if (zoom) await step(600);
  if (pan[0] || pan[1]) await js(`(() => {
    const canvas = document.querySelector("canvas.yard-stage");
    canvas.setPointerCapture = () => {};
    const fire = (type, id, x, y) => canvas.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: "touch", clientX: x, clientY: y, bubbles: true }));
    const at = (k) => [[${x - 80} + ${pan[0]} * k, ${y} + ${pan[1]} * k], [${x + 80} + ${pan[0]} * k, ${y} + ${pan[1]} * k]];
    at(0).forEach(([px, py], i) => fire("pointerdown", 101 + i, px, py));
    for (let n = 1; n <= 20; n++) at(n / 20).forEach(([px, py], i) => fire("pointermove", 101 + i, px, py));
    at(1).forEach(([px, py], i) => fire("pointerup", 101 + i, px, py));
    return 0;
  })()`);
  await step(1800);
}


/** Plays the dragon's breath: the profile's Breathe button, pressed once the sheet is closed so the yard frames the plume full size; opening the sheet homes the camera, so `camera` is aimed after. */
async function breathe(id, camera) {
  await js(`location.hash = ${JSON.stringify(`#/stable/${encodeURIComponent(id)}/profile`)}`);
  await step(600);
  await js(`document.querySelector('.profile-sheet [data-tab="traits"]').click()`);
  await step(300);
  await js(`location.hash = ${JSON.stringify(`#/stable/${encodeURIComponent(id)}`)}`);
  await step(1200);
  await aim(camera);
  await stepTo(STILL_AT);
  if (!(await js(`Boolean(document.querySelector('.profile-sheet [data-sheet-action="breathe"]'))`))) throw new Error("No Breathe button");
  await js(`document.querySelector('.profile-sheet [data-sheet-action="breathe"]').click()`);
}

async function shoot(file) {
  const { data } = await session.send("Page.captureScreenshot", { format: "webp", quality: 90 });
  await writeFile(file, Buffer.from(data, "base64"));
  console.log(file);
}

async function still(shot, file) {
  const id = await stage(shot.dragon);
  if (!shot.breathe) await aim(shot.camera);
  if (shot.breathe) {
    await breathe(id, shot.camera);
    await step(PLUME_AT);
  } else await stepTo(STILL_AT);
  await shoot(file);
}

/** A 6 s clip of the yard at 30 fps; `orbit` CSS pixels of drag spread over it turn the camera slowly. */
async function clip({ file, dragon, camera, orbit }) {
  await stage(dragon);
  await aim(camera);
  const path = resolve(out, file);
  const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(FPS), path], { stdio: ["pipe", "inherit", "inherit"] });
  const exited = new Promise((done, fail) => ffmpeg.on("exit", (code) => (code ? fail(new Error(`ffmpeg exited ${code}`)) : done())));
  const frames = 6 * FPS;
  const [x, y] = [VIEW.width / 2, VIEW.height / 2];
  await hold();
  if (orbit) await mouse("mousePressed", x, y);
  for (let i = 0; i < frames; i++) {
    if (orbit) {
      const k = 0.5 - 0.5 * Math.cos((Math.PI * (i + 1)) / frames);
      await mouse("mouseMoved", x + 12 + orbit * k, y);
    }
    await step(1000 / FPS);
    const { data } = await session.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
    if (!ffmpeg.stdin.write(Buffer.from(data, "base64"))) await new Promise((done) => ffmpeg.stdin.once("drain", done));
  }
  if (orbit) await mouse("mouseReleased", x + orbit, y);
  ffmpeg.stdin.end();
  await exited;
  console.log(path);
}

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

await mkdir(trying ?? out, { recursive: true });
await acquire();
try {
  session = await launch({ url: "about:blank", width: VIEW.width, height: VIEW.height });
  errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Emulation.setDeviceMetricsOverride", { width: VIEW.width, height: VIEW.height, deviceScaleFactor: VIEW.dpr, mobile: false });
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: yardClock });
  await pinResolution(session, base);
  // The session's first yard frames a little off from every later one, so a throwaway shot goes first.
  await stage({ element: "fire", mane: false, ...coat("fire") });
  await aim(STAND);
  if (trying) {
    for (const [n, element] of option("elements", elements.join(",")).split(",").entries())
      for (let k = 0; k < (trying && option("palette") ? 1 : palettes[element].length); k++) await still({ dragon: { element, mane: true, ...coat(element, k) }, camera: STAND }, resolve(trying, `${element}-${k}${option("palette") ? `-${n}` : ""}.webp`));
  } else {
    if (!args.includes("--no-stills"))
      for (const [n, shot] of stills.entries()) if (!only || only.includes(shot.name)) await still(shot, resolve(out, `${String(n + 1).padStart(2, "0")}-${shot.name}.webp`));
    if (!args.includes("--no-clips")) for (const c of clips) if (!only || only.includes(c.file.replace(".mp4", ""))) await clip(c);
    const manifest = shotsDir("elements.json");
    const known = JSON.parse(await readFile(manifest, "utf8").catch(() => "[]"));
    const entries = stills.map((shot, n) => ({ file: `elements/${String(n + 1).padStart(2, "0")}-${shot.name}.webp`, title: shot.title, caption: shot.caption }));
    entries.push(
      { file: "elements/mane-fire.mp4", title: "Fire mane", caption: "A fire mane burns along the back of an idle dragon in the stable." },
      { file: "elements/metal.mp4", title: "Gold coat", caption: "A gold coat's sheen slides across the scales as the camera circles." },
    );
    if (JSON.stringify(known) !== JSON.stringify(entries)) await writeFile(manifest, JSON.stringify(entries, null, 2) + "\n");
  }
  if (errors.length) console.warn(errors.join("\n"));
  await session.close();
} finally {
  await rmdir(lock).catch(() => {});
}
