// Stills of the Stable for the talk's deck, on a phone, and one clip of a swap in the yard. Writes
// shots/stable/<n>-<name>.webp, shots/stable/yard.mp4 and shots/stable.json.
//   node tools/pitch/001/capture/stableShots.mjs [--url http://127.0.0.1:8094] [--out <media dir>] [--tmp <scratch dir>] [--only welcome-rider,yard-adult] [--no-clip] [--gallery]
import { mkdir, readFile, writeFile, rmdir, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate, sleep } from "../../../cdp.mjs";
import { installVirtualClock } from "./virtualClock.js";
import { openPhone, load, startClip } from "./recorder.mjs";
import { base, shotsDir, tmp } from "./args.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const only = option("only", "") ? option("only").split(",") : null;
const PHONE = { width: 390, height: 844, dpr: 2.5 };
const out = shotsDir("stable");
const lock = join(tmpdir(), "dragonz-care-evidence.lock");

const EGG_SEED = option("egg", "talk-egg-a");
/** The dragons cast in the shots: a coat preset and a seed that looked good with it. */
const cast = {
  star: { kind: "amethyst", seed: "talk-amethyst-2", name: "Violet" },
  teen: { kind: "ember breath:fire", seed: "talk-ember-1", name: "Ember" },
  sleeper: { kind: "azure", seed: "talk-azure-2", name: "Nimbus" },
  kid: { kind: "emerald breath:fire", seed: "talk-emerald-1", name: "Pip" },
  sire: { kind: "copper", seed: "talk-copper-3", name: "Rufus" },
  dam: { kind: "obsidian", seed: "talk-obsidian-2", name: "Onyx" },
};

/** Page-side helpers every seeding script starts from: `make(castEntry, age)` and `fresh(stable)`. */
const prelude = `
  const { cheatDragon } = await import("/src/stable/cheats.js");
  const { genes } = await import("/src/genome/dragon.js");
  const { needsOf } = await import("/src/stable/care.js");
  const { createEgg } = await import("/src/stable/egg.js");
  const stable = window.__game.game.stable;
  const now = stable.clock.game;
  const cast = ${JSON.stringify(cast)};
  const make = (who, age, strength = 3.4) => {
    const c = typeof who === "string" ? cast[who] : who;
    const d = cheatDragon(genes, stable, c.kind, { age, strength, name: c.name, seed: c.seed });
    for (const n of needsOf(d.age)) d.care[n.id] = 88;
    d.bond = 0.8;
    return d;
  };
  const { stageDurations } = await import("/src/stable/lifeStages.js");
  const hour = 3600000;
  const honour = (d) => {
    stable.trophies = [
      { league: "adults", season: 3, division: "gold", id: d.id, name: d.name, at: now - 2 * hour },
      { league: "teens", season: 2, division: "silver", id: d.id, name: d.name, at: now - 30 * hour },
    ];
    stable.seasons = [
      { league: "teens", season: 2, division: "silver", at: now - 30 * hour, podium: [{ owned: true, rank: 1, lead: { id: d.id, name: d.name } }] },
      { league: "kids", season: 1, division: "bronze", at: now - 60 * hour, podium: [{ owned: true, rank: 2, lead: { id: d.id, name: d.name } }] },
      { league: "adults", season: 2, division: "silver", at: now - 20 * hour, podium: [{ owned: true, rank: 3, lead: { id: d.id, name: d.name } }] },
    ];
    Object.assign(d.record, { starts: 18, wins: 7, podiums: 12 });
  };
  /** The deck's stable: the star in front, a teen, a kid, a sleeper and an egg. */
  const home = () => {
    const star = make("star", "adult", 4.5), teen = make("teen", "teen", 3), kid = make("kid", "kid", 2), sleeper = make("sleeper", "adult", 3);
    sleeper.slumberUntil = now + 2 * hour + 14 * 60000;
    const egg = createEgg(${JSON.stringify(EGG_SEED)}, now - hour);
    egg.incubation = 0.55 * egg.incubationTime;
    egg.warms = 1;
    egg.warmedAt = now - 2 * hour;
    stable.dragons = [star, teen, kid, sleeper];
    stable.eggs = [egg];
    honour(star);
    return { star: star.id, teen: teen.id, kid: kid.id, sleeper: sleeper.id, egg: egg.id };
  };
  Object.assign(stable, { welcomed: true, careTaught: true, raceHint: "done", reinsInvited: true, reinsTaught: true });
  stable.wild = [];
  stable.owner.name = "Alex";
  stable.owner.silks = { pattern: "hoops", colors: ["navy", "gold", "sky"] };
`;

/** Pins the welcome's first random draw, which seeds the new stable and so its three kids. */
const KIDS_SEED = Number(option("kids", 777));
const results = [];
let session, errors;

const strip = option("strip", "");
async function shot(file, title, caption, taken = null) {
  const data = taken ?? (await session.send("Page.captureScreenshot", { format: "webp", quality: 90 })).data;
  await writeFile(resolve(strip || out, file), Buffer.from(data, "base64"));
  results.push({ file, title, caption });
  console.log(resolve(out, file));
}

let loads = 0;
/** A fresh page at `hash`, its stable seeded first by `seed` (page-side code using the prelude). */
async function stage(seed, hash, ready) {
  await navigate(session, new URL(`/?talk=${loads++}`, base).href);
  if (!(await waitFor(session, "window.__game", 30000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
  const ids = seed ? JSON.parse(await evaluate(session, `(async () => { ${prelude} ${seed} })().then((r) => { window.__game.save(); return JSON.stringify(r ?? null); })`)) : null;
  const to = typeof hash === "function" ? hash(ids) : hash;
  await navigate(session, new URL(`/?talk=${loads++}${to}`, base).href);
  if (!(await waitFor(session, ready ?? "window.__game", 30000))) throw new Error(`${to} did not get ready: ${errors.join("\n")}`);
  return ids;
}

const js = (expression) => evaluate(session, expression);
const click = (selector) => js(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n) return false; n.click(); return true; })()`);
const hideDev = () =>
  js(`document.getElementById("talk-hide") || document.head.insertAdjacentHTML("beforeend", "<style id=talk-hide>.dz-toast,.dz-float{display:none!important}</style>")`);

const yardReady = `document.querySelector(".stable-home [data-actions] > *")`;

const welcome = async () => {
  await navigate(session, new URL(`/?talk=${loads++}`, base).href);
  await waitFor(session, "window.__game", 30000);
  await js("localStorage.clear()");
  await navigate(session, new URL(`/?talk=${loads++}`, base).href);
  if (!(await waitFor(session, `window.__game && location.hash === "#/welcome"`, 30000))) throw new Error("No welcome");
  await sleep(2500);
};
const change = (selector, value) => js(`(() => {
  const node = document.querySelector(${JSON.stringify(selector)});
  if (!node || (node.options && ![...node.options].some((o) => o.value === ${JSON.stringify(value)}))) return console.warn("no", ${JSON.stringify(selector + " " + value)});
  node.value = ${JSON.stringify(value)};
  node.dispatchEvent(new Event("change", { bubbles: true }));
})()`);
/** Holds the page clock and moves it `seconds` on in frames. */
const advance = (seconds) => js(`__clock.step(${seconds * 1000}, ${1000 / 60})`);

/** The share of near-white pixels in the middle of a PNG screenshot: the glowing egg or kid. */
function glare(png) {
  const gray = execFileSync("ffmpeg", ["-loglevel", "error", "-i", "-", "-vf", "scale=78:168,format=gray", "-f", "rawvideo", "-"], { input: png });
  let bright = 0;
  for (let y = 30; y < 130; y++) for (let x = 10; x < 68; x++) if (gray[y * 78 + x] > 225) bright++;
  return bright;
}

/**
 * Steps the hatching show through its first seconds and returns the WebP of a frame where the egg
 * glows alone under the veil: the egg and the kid trade places, and the egg is the smaller glow.
 */
async function glowingEgg() {
  let best = null;
  for (let i = 0; i < 30; i++) {
    await advance(0.1);
    if (!(await js(`getComputedStyle(document.querySelector(".stable-home [data-head]")).opacity < 0.05`))) continue;
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    const bright = glare(Buffer.from(data, "base64"));
    if (bright > 40 && (!best || bright < best.bright)) best = { bright, webp: (await session.send("Page.captureScreenshot", { format: "webp", quality: 90 })).data };
  }
  if (!best) throw new Error("No glowing egg");
  return best.webp;
}

/** Moves the held clock on until the reveal's stamp shows, then lets it land. */
async function untilStamp(settle = STAMP_SETTLE) {
  for (let i = 0; i < 200 && !(await js(`Boolean(document.querySelector(".yard__stamp:not([hidden])"))`)); i++) await advance(0.05);
  await advance(settle);
}
/** Moves the held clock on until the breath card opens, then into the plume. */
async function untilCard() {
  for (let i = 0; i < 300 && !(await js(`Boolean(document.querySelector(".breath-reveal:not([hidden]) .breath-reveal__title"))`)); i++) await advance(0.05);
  await advance(PLUME_AT);
}
const PLUME_AT = Number(option("plume", 1.1));
const EVOLVE_SETTLE = Number(option("evolveSettle", 1));
const STAMP_SETTLE = Number(option("settle", 0.5));

const shots = {
  async rider() {
    await welcome();
    await change(".welcome [data-maker-name]", "Alex");
    await sleep(1500);
    await shot("01-rider-maker.webp", "Name your rider", "Every owner rides their own dragons, so first the stable hand asks your name.");
    await js(`document.querySelector(".welcome [data-greet]").requestSubmit()`);
    if (!(await waitFor(session, `document.querySelector('.welcome [data-kid="0"]')`, 10000))) throw new Error("No kids");
    await sleep(2000);
    await click('.welcome [data-kid="1"]');
    await sleep(3000);
    await shot("02-pick-a-kid.webp", "Pick your first dragon", "Three kids wait in the meadow; meet each one and choose the dragon you will raise.");
  },
  async yard() {
    await stage(`const ids = home(); const s = stable.dragons[0]; s.care.fullness = 42; return ids;`, (ids) => `#/stable/${ids.star}`, yardReady);
    await sleep(3500);
    await shot("03-stable-yard.webp", "Your stable", "Your dragon waits in front of the barn, with its name, mood, honours and today's care one tap away.");
  },
  async egg() {
    await stage(`return home();`, (ids) => `#/stable/${ids.egg}`, yardReady);
    await sleep(3500);
    await shot("04-egg.webp", "Warm your egg", "Eggs hatch on their own in time; warming one by hand speeds it up and makes a stronger dragon.");
  },
  async hatch() {
    await stage(`const ids = home(); const e = stable.eggs[0]; e.incubation = e.incubationTime; e.warms = 4; return ids;`, (ids) => `#/stable/${ids.egg}`, yardReady);
    await sleep(3500);
    await hideDev();
    for (let n = 0; n < 2; n++) {
      await click('[data-action="hatch"]');
      await sleep(400);
    }
    await js("__clock.hold()");
    await click('[data-action="hatch"]');
    for (const t of HATCH_TIMES) {
      if (t.step === "egg") {
        await shot(t.file, t.title, t.caption, await glowingEgg());
        continue;
      }
      await (t.step === "stamp" ? untilStamp() : advance(t.step));
      if (t.file) await shot(t.file, t.title, t.caption);
    }
  },
  async evolve() {
    await stage(`const ids = home(); const k = stable.dragons.find((d) => d.id === ids.kid); k.growth = stageDurations.kid; return ids;`, (ids) => `#/stable/${ids.kid}`, `document.querySelector('[data-action="evolve"]')`);
    await sleep(3500);
    await hideDev();
    await click('[data-action="evolve"]');
    await js("__clock.hold()");
    for (const t of EVOLVE_TIMES) {
      await (t.step === "stamp" ? untilStamp(EVOLVE_SETTLE) : t.step === "card" ? untilCard() : advance(t.step));
      if (t.file) await shot(t.file, t.title, t.caption);
    }
  },
  async slumber() {
    await stage(`return home();`, (ids) => `#/stable/${ids.sleeper}`, yardReady);
    await sleep(4500);
    await shot("08-slumber.webp", "Sweet dreams", "After a ritual or a hard race, dragons curl up on their straw beds in the barn until they wake.");
  },
  async profile() {
    const ids = await stage(`return home();`, (ids) => `#/stable/${ids.star}/profile`, `document.querySelector('[data-tab="traits"]')`);
    await sleep(3000);
    await shot("09-profile-overview.webp", "Know your dragon", "Each dragon's card shows its mood and needs, how far it has grown and the stars it has earned.");
    await click('[data-tab="traits"]');
    await sleep(1500);
    await shot("10-profile-traits.webp", "One of a kind", "Every dragon is born from its genes: its breath, its body parts and its colours are its own.");
    await navigate(session, new URL(`/?talk=${loads++}#/dragon/${ids.star}/details`, base).href);
    await waitFor(session, `document.querySelector(".radar__ring")`, 30000);
    await sleep(2000);
    await shot("11-details-radar.webp", "Built to race", "Five racing stats, drawn against the best the same dragon could ever become.");
  },
  async lineage() {
    const id = await stage(`
      const { hatchEgg } = await import("/src/stable/hatch.js");
      const { lineageOf } = await import("/src/stable/lineage.js");
      const sire = make("sire", "adult", 4), dam = make("dam", "adult", 4);
      stable.dragons = [sire, dam];
      stable.eggs = [];
      for (let n = 0; n < 200; n++) {
        const egg = createEgg("talk-ritual-" + n, now - 9 * hour, [sire, dam]);
        egg.incubation = egg.incubationTime;
        stable.eggs = [egg];
        const kid = hatchEgg(stable, genes, egg.id, now);
        const l = lineageOf(stable, genes, kid);
        if (l.mutations.length === 1 && l.parts.length >= 4) {
          kid.name = "Ziggy";
          for (const need of needsOf(kid.age)) kid.care[need.id] = 88;
          return kid.id;
        }
        stable.dragons = [sire, dam];
      }
      throw new Error("no mutation");
    `, (id) => `#/dragon/${id}/lineage`, `document.querySelector(".lineage-parent")`);
    await sleep(3000);
    await shot("12-lineage.webp", "Family tree", "Altar-born dragons inherit from their parents, and every surprise mutation is celebrated.");
    return id;
  },
  async away() {
    await stage(`const ids = home(); const e = stable.eggs[0]; e.incubation = e.incubationTime - 60 * 60000; const k = stable.dragons.find((d) => d.id === ids.kid); k.growth = stageDurations.kid - 60 * 60000; return ids;`, (ids) => `#/stable/${ids.star}`, yardReady);
    await sleep(3000);
    await js("window.__game.away(3 * 3600000)");
    await waitFor(session, `location.hash === "#/away"`, 10000);
    await sleep(2500);
    await shot("13-while-you-were-away.webp", "While you were away", "Dragons live on while the game is closed; coming back, a sheet tells you what happened and what needs you.");
  },
  async tour() {
    await stage(`const ids = home(); stable.careTaught = false; const s = stable.dragons[0]; s.care.fullness = 30; return ids;`, (ids) => `#/stable/${ids.star}`, `document.querySelector(".stable-tour:not([hidden])")`);
    await sleep(2500);
    await shot("14-coach-marks.webp", "A friendly stable hand", "On your first visit the stable hand shows you how to care for your dragon, a few times a day.");
  },
  async cabinet() {
    await stage(`return home();`, "#/more", `document.querySelector(".honours")`);
    await sleep(2000);
    await shot("15-trophy-cabinet.webp", "The trophy cabinet", "Every league trophy and podium medal your dragons win is kept in your cabinet.");
  },
  async gallery() {
    const kinds = ["slate", "ember", "emerald", "azure", "amethyst", "bone", "obsidian", "copper"];
    for (const kind of kinds)
      for (const n of [1, 2, 3, 4]) {
        await stage(`const d = make({ kind: "${kind}", seed: "talk-${kind}-${n}", name: "${kind} ${n}" }, "adult"); stable.dragons = [d]; stable.eggs = []; return d.id;`, (id) => `#/stable/${id}`, yardReady);
        await sleep(2500);
        const { data } = await session.send("Page.captureScreenshot", { format: "webp", quality: 70 });
        await mkdir(resolve(tmp, "gallery"), { recursive: true });
        await writeFile(resolve(tmp, "gallery", `${kind}-${n}.webp`), Buffer.from(data, "base64"));
      }
  },
};

/** The hatching show: clock steps in seconds after the last tap, and the frames kept. */
const HATCH_TIMES = [
  { step: "egg", file: "05a-hatch-glow.webp", title: "Hatching day", caption: "Tap a ready egg and it glows, trading places with the kid inside ever faster." },
  { step: "stamp", file: "05b-hatch-stamp.webp", title: "Hatched!", caption: "With a flash the kid hops out, ready to be raised." },
];
const EVOLVE_TIMES = [
  { step: "stamp", file: "06-evolve.webp", title: "Growing up", caption: "Kids grow into teens and teens into adults, each step celebrated in the yard." },
  { step: "card", file: "07-breath-reveal.webp", title: "A breath of its own", caption: "As a teen, every dragon finds its breath: fire, water, nature or storm, to use in races." },
];

if (strip) {
  const frames = (name) => Array.from({ length: 28 }, (_, i) => ({ step: 0.5, file: `${name}-${((i + 1) * 0.5).toFixed(1)}.webp` }));
  HATCH_TIMES.splice(0, Infinity, ...frames("hatch"));
  EVOLVE_TIMES.splice(0, Infinity, ...frames("evolve"));
}

/** The yard clip: Violet in front of the barn, then Ember picked in the roster flies in as Violet flies off. */
async function clip() {
  ({ session, errors } = await openPhone());
  try {
    const ids = await stage(`return home();`, (ids) => `#/stable/${ids.star}`, yardReady);
    await sleep(3500);
    await hideDev();
    const raw = resolve(tmp, "yard-raw.mp4");
    const recording = await startClip(session, raw);
    await recording.play(1.5);
    await click(`.dz-roster-card[data-id="${ids.teen}"]`);
    await recording.play(6.5);
    await recording.close();
    const file = resolve(out, "yard.mp4");
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", raw, "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-an", file]);
    await rm(raw);
    console.log(file);
  } finally {
    await session.close();
  }
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

await mkdir(out, { recursive: true });
await acquire();
try {
  session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  errors = await watchErrors(session);
  await session.send("Page.enable");
  await emulateDevice(session, { ...PHONE, maxTouchPoints: 2 });
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installVirtualClock})()` });
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (!localStorage.getItem("dragonz-stable")) { const random = Math.random; Math.random = () => ((Math.random = random), ${(KIDS_SEED + 0.5) / 1e6}); }`,
  });
  const wanted = args.includes("--gallery") ? ["gallery"] : Object.keys(shots).filter((name) => name !== "gallery" && (!only || only.includes(name)));
  for (const name of wanted) await shots[name]();
  await session.close();
  if (!args.includes("--no-clip") && !args.includes("--gallery") && (!only || only.includes("clip"))) await clip();
  if (results.length && !strip) {
    const index = shotsDir("stable.json");
    const kept = only ? JSON.parse(await readFile(index, "utf8").catch(() => "[]")).filter((r) => !results.some((n) => n.file === r.file)) : [];
    const all = [...kept, ...results].sort((a, b) => a.file.localeCompare(b.file));
    await writeFile(index, JSON.stringify(all, null, 2) + "\n");
  }
} finally {
  await rmdir(lock).catch(() => {});
}
