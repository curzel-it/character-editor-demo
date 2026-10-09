// Race stills and clips for the talk: broadcast stills at 1920×1080 from the tool-link race page,
// phone stills of a race on air, riding and the results from the game itself, the director's cut
// and a riding clip. Writes shots/race/ and shots/race.json.
//   node tools/pitch/001/capture/raceShots.mjs [--url http://127.0.0.1:8094] [--out <media dir>] [--tmp <scratch dir>] [--only stills,phone,clips|<name>,…]
import { mkdir, readFile, writeFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate, sleep, touchAt } from "../../../cdp.mjs";
import { installVirtualClock } from "./virtualClock.js";
import { pinResolution, grab, webp, startClip } from "./shotKit.mjs";
import { base, shotsDir } from "./args.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const only = option("only", "stills,phone,clips").split(",");
const wants = (group, name) => only.includes(group) || only.includes(name);
const out = shotsDir("race");
const WIDE = { width: 1920, height: 1080 };
const PHONE = { width: 390, height: 844, dpr: 2.5 };

const VALLEY = "course=2407&race=1",
  VALLEY12 = "course=2407&race=1&racers=12",
  CANYON12 = "course=canyon&type=canyon&race=1&racers=12";

/**
 * Broadcast stills. `camera` is "director" or one of the page cameras below with its options;
 * `t` is race time (for `breath` and `castle`, an offset from their moment).
 */
const STILLS = [
  { file: "lead-in.webp", title: "The lead-in", caption: "Every race opens low on the grid, the field crouched and waiting while the countdown runs.", query: VALLEY12, t: -1.6, camera: { kind: "grid", racer: 10, back: 22, up: 3, side: -8, fov: 0.75, look: 80, lift: 6 }, countdown: true },
  { file: "takeoff.webp", title: "Go!", caption: "On Go the field leaps off the ground and beats for the sky, kicking up the sand.", query: CANYON12, t: 0.8, camera: { kind: "grid", racer: 9, back: 18, up: 2, side: -6, fov: 0.85, look: 60, lift: 5 } },
  { file: "trackside.webp", title: "Trackside", caption: "The director plants cameras along the course and cuts to them as the pack tears past.", query: CANYON12, t: 95.4, camera: "director" },
  { file: "flyby.webp", title: "Fly-by", caption: "Fly-by cameras catch the pack at full speed, close enough to feel the wind.", query: `${VALLEY}&blur=off`, t: 103.75, camera: "director" },
  { file: "rider-cam.webp", title: "Rider cam", caption: "Onboard with the rider: helmet, silks and reins, the rival a wingspan away.", query: VALLEY, t: 9.5, camera: "director" },
  { file: "valley-castle.webp", title: "Into the valley", caption: "Every course is generated from a seed: rivers, forests and a real-scale castle to race past.", query: VALLEY, t: -1, camera: { kind: "castle", before: 100, back: 30, up: 10, side: 50, fov: 0.75, mix: 0.45 } },
  { file: "canyon.webp", title: "Through the canyon", caption: "Canyon courses squeeze the field between painted walls, where every line matters.", query: CANYON12, t: 87.75, camera: "director" },
  { file: "breath-storm.webp", title: "Storm breath", caption: "A storm dragon breathes lightning, and the rival it hits is slowed, shoved and dazed.", query: VALLEY12, t: 0.2, camera: { kind: "breath", element: "storm", n: 2, side: 0.8, back: 0.25, up: 0.1, fov: 0.72 } },
  { file: "breath-fire.webp", title: "Fire breath", caption: "Five elements in a cycle, each beating the next: every rival is a matchup.", query: VALLEY12, t: 0.2, camera: { kind: "breath", element: "fire", n: 2, side: 0.8, back: 0.3, up: 0.1, fov: 0.65 } },
  { file: "pack.webp", title: "Wing to wing", caption: "Slipstream pulls a chaser up to the leader's shoulder, then slingshots it past.", query: VALLEY12, t: 154, camera: "director" },
  { file: "landing.webp", title: "Touchdown", caption: "The finish lands in slow motion, a ground camera shaken by the winner's touchdown.", query: `${VALLEY12}&blur=off`, t: 184.2, camera: "director" },
];

/** The lead-in of the director's cut: low behind the grid, creeping in, tilting up after the field on Go. */
const LEAD_IN_CAMERA = STILLS[0].camera;

/** Cameras the stills frame by hand, defined in the page; each returns the race time it is for and the shot. */
function pageCameras() {
  const avg = (ps) => [0, 1, 2].map((i) => ps.reduce((a, p) => a + p[i], 0) / ps.length);
  window.__talkCams = {
    async at(spec, t) {
      const { sampleRace } = await import("/src/race/sampleRace.js");
      const race = window.__race.race;
      const c = spec.camera;
      if (c === "director") return { t, shot: "director" };
      if (c.kind === "grid") {
        const grid = race.course.start.grid;
        const id = race.recording.roster[c.racer].id;
        const p = sampleRace(race.recording, -1).racers.find((r) => r.id === id).position;
        const f = grid[0].forward,
          left = [-f[2], 0, f[0]];
        return {
          t,
          shot: { eye: [p[0] - f[0] * c.back + left[0] * c.side, p[1] + c.up, p[2] - f[2] * c.back + left[2] * c.side], target: [p[0] + f[0] * c.look, p[1] + c.lift, p[2] + f[2] * c.look], up: [0, 1, 0], fov: c.fov, shot: "grid", reason: "Lead-in" },
        };
      }
      if (c.kind === "castle") {
        const castle = race.course.features.find((f) => f.type === "castle");
        const at = race.recording.frames.find((f) => f.racers.some((r) => r.progress >= castle.s - c.before)).t + t;
        const lead = sampleRace(race.recording, at).racers.find((r) => r.place === 1);
        const p = lead.position,
          f = lead.forward,
          n = castle.near,
          cp = castle.position;
        const target = [p[0] * (1 - c.mix) + cp[0] * c.mix, p[1] * (1 - c.mix) + (cp[1] + 45) * c.mix, p[2] * (1 - c.mix) + cp[2] * c.mix];
        return { t: at, shot: { eye: [p[0] - f[0] * c.back + n[0] * c.side, p[1] + c.up, p[2] - f[2] * c.back + n[2] * c.side], target, up: [0, 1, 0], fov: c.fov, shot: "wide", reason: "Castle" } };
      }
      if (c.kind === "breath") {
        const pair = (time, e) => {
          const rs = sampleRace(race.recording, time).racers;
          return [rs.find((r) => r.id === e.other), rs.find((r) => r.id === e.racer)];
        };
        const gap = (e) => {
          const [a, b] = pair(e.t, e);
          return Math.hypot(...[0, 1, 2].map((i) => a.position[i] - b.position[i]));
        };
        const hits = race.recording.events
          .filter((e) => e.type === "hit" && e.element === c.element && e.t > 3)
          .map((e) => ({ e, d: gap(e) }))
          .sort((x, y) => x.d - y.d);
        const hit = hits[c.n].e;
        const at = hit.t + t;
        const [a, b] = pair(at, hit);
        const d = [0, 1, 2].map((i) => b.position[i] - a.position[i]);
        const sep = Math.hypot(...d);
        const u = d.map((x) => x / sep),
          perp = [-u[2], 0, u[0]];
        const m = avg([a.position, b.position]);
        const S = Math.max(sep, 18);
        const eye = [0, 1, 2].map((i) => m[i] + perp[i] * S * c.side - u[i] * S * c.back + (i === 1 ? S * c.up : 0));
        return { t: at, shot: { eye, target: m, up: [0, 1, 0], fov: c.fov, shot: "breath", reason: c.element } };
      }
      throw new Error(`Unknown camera ${c.kind}`);
    },
    /** Plays the 1.2 s before the shot a frame at a time, so plumes, debris and blur are what playback shows. */
    async settle(spec) {
      const r = window.__race;
      r.setPlaying(false);
      for (let k = 72; k >= 0; k--) {
        const { t, shot } = await window.__talkCams.at(spec, spec.t - k / 60);
        r.seek(t);
        r.setCamera(shot);
        r.draw();
      }
      return r.state.t;
    },
  };
}

const CLEAN = `header,.intro,.inspector,footer,.transport,.stage-heading,.hud{display:none!important}
body,main{margin:0!important;padding:0!important;overflow:hidden!important}
#race-stage{position:fixed!important;inset:0;width:100vw!important;height:100vh!important;max-height:none!important;aspect-ratio:auto!important;z-index:10}`;

async function openRacePage(session, errors, query, { countdown = true } = {}) {
  await navigate(session, new URL(`/race.html?paused&motion=full&${query}`, base).href);
  if (!(await waitFor(session, "window.__race && window.__race.ready", 90000))) throw new Error(`race.html?${query} did not load: ${errors.join("\n")}`);
  await evaluate(session, `(() => { const s = document.createElement("style"); s.id = "talk-clean"; s.textContent = ${JSON.stringify(CLEAN + (countdown ? "" : ".dz-countdown{display:none!important}"))}; document.head.append(s); (${pageCameras})(); return 0; })()`);
}

const entries = [];
const note = (file, title, caption) => entries.push({ file: `race/${file}`, title, caption });

async function stills() {
  const session = await launch({ url: "about:blank", ...WIDE });
  const errors = await watchErrors(session);
  try {
    await session.send("Page.enable");
    await pinResolution(session, base);
    await session.send("Emulation.setDeviceMetricsOverride", { ...WIDE, deviceScaleFactor: 2, mobile: false });
    let loaded = null;
    for (const spec of STILLS) {
      if (!wants("stills", spec.file.replace(/\..*$/, ""))) continue;
      const key = `${spec.query}|${!!spec.countdown}`;
      if (loaded !== key) await openRacePage(session, errors, spec.query, { countdown: !!spec.countdown });
      loaded = key;
      const t = await evaluate(session, `window.__talkCams.settle(${JSON.stringify(spec)})`);
      await sleep(900);
      const file = await webp(await grab(session), resolve(out, spec.file), { quality: 90, ...WIDE });
      note(spec.file, spec.title, spec.caption);
      console.log(file, `t ${t.toFixed(2)}`);
    }
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

const seedStable = (seed) => `(async () => {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { makeGenome, loadSubject } = await import("/src/subjects.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const now = stable.clock.game;
  const dragon = createDragon({ seed: ${JSON.stringify(seed)}, genome: makeGenome(genes, ${JSON.stringify(seed)}), age: "adult", now, strength: ${Number(option("stars", 2))}, bond: 0.8 });
  for (const id of Object.keys(dragon.care)) dragon.care[id] = 95;
  stable.dragons = [dragon];
  Object.assign(stable, { welcomed: true, careTaught: true, reinsInvited: true, reinsTaught: true });
  window.__game.save();
  return dragon.id;
})()`;

const startRace = (id) => `(async () => {
  const { startLeagueRace } = await import("/src/stable/leagueRace.js");
  const stable = window.__game.game.stable;
  startLeagueRace(stable, "adults", ${JSON.stringify(id)}, stable.clock.game);
  window.__game.save();
  location.hash = "#/live/adults";
})()`;

/** Opens the game as a phone with a fresh adult on the Main Event grid, on air. */
async function phoneRace({ width, height, dpr, clock = false, seed }) {
  const session = await launch({ url: "about:blank", width, height });
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await pinResolution(session, base);
  await emulateDevice(session, { width, height, dpr, maxTouchPoints: 2 });
  const stableSeed = Number(option("stable", 6));
  await session.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `if (!localStorage.getItem("dragonz-stable")) { const random = Math.random; Math.random = () => ((Math.random = random), ${(stableSeed + 0.5) / 1e6}); }
addEventListener("DOMContentLoaded", () => { const s = document.createElement("style"); s.textContent = ".dz-fps{display:none!important}"; document.head.append(s); });`,
  });
  if (clock) await session.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installVirtualClock})()` });
  await navigate(session, new URL("/?style=cozy", base).href);
  if (!(await waitFor(session, "window.__game", 30000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
  await evaluate(session, `localStorage.setItem("dragonz-language", "en"); localStorage.setItem("dragonz-ride-camera", "chase")`);
  const id = await evaluate(session, seedStable(seed));
  await navigate(session, new URL("/?style=cozy&seeded=1#/stable", base).href);
  if (!(await waitFor(session, "window.__game && document.querySelector('[data-action]')", 30000))) throw new Error(`No stable: ${errors.join("\n")}`);
  await evaluate(session, startRace(id));
  if (!(await waitFor(session, "window.__game.broadcast().live && window.__game.broadcast().race", 60000))) throw new Error("The race did not go on air");
  return { session, errors };
}

const click = (selector) => `(() => { const n = document.querySelector(${JSON.stringify(selector)}); if (!n || n.disabled) return false; n.click(); return true; })()`;

async function phone() {
  const { session, errors } = await phoneRace({ ...PHONE, seed: option("seed", "talk-ember") });
  const shot = async (file, title, caption) => {
    const path = await webp(await grab(session), resolve(out, file), { quality: 90 });
    note(file, title, caption);
    console.log(path);
  };
  const stick = async (dx, dy) => {
    await touchAt(session, "touchStart", [[200, 600]]);
    for (let i = 1; i <= 8; i++) {
      await touchAt(session, "touchMove", [[200 + (dx * i) / 8, 600 + (dy * i) / 8]]);
      await sleep(30);
    }
  };
  try {
    if (!(await waitFor(session, "window.__game.broadcast().time > 16", 90000))) throw new Error("The race did not get going");
    await waitFor(session, `(document.querySelector(".broadcast [data-line]")?.textContent ?? "").length > 10`, 15000);
    await sleep(400);
    await shot("phone-on-air.webp", "Race on air", "Every race is live: the director calls the shots, the commentator calls the race, and the owner can take the reins.");
    await evaluate(session, click('[data-action="reins"]'));
    await sleep(2500);
    await stick(50, -40);
    await sleep(500);
    await shot("phone-riding.webp", "Take the reins", "One thumb flies the dragon: drag for the stick, tap Breath, chase the next gate.");
    await touchAt(session, "touchEnd", []);
    await evaluate(session, click('[data-action="camera"]'));
    await sleep(1500);
    await stick(-40, -20);
    await sleep(500);
    await shot("phone-rider-eye.webp", "Through the rider's eyes", "Switch to the rider's eye and fly it from the saddle.");
    await touchAt(session, "touchEnd", []);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

/** The same race left on Autopilot and skipped to its results: a photo finish for the default stable. */
async function phoneResults() {
  const { session, errors } = await phoneRace({ ...PHONE, seed: option("seed", "talk-ember") });
  try {
    await evaluate(session, click('.broadcast [data-action="skip"]'));
    if (!(await waitFor(session, `location.hash.startsWith("#/results/")`, 60000))) throw new Error("No results");
    await sleep(3000);
    const path = await webp(await grab(session), resolve(out, "phone-results.webp"), { quality: 90 });
    note("phone-results.webp", "Photo finish", "Results the moment the race ends: the podium, the photo finish, the times and the points.");
    console.log(path);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

/** The broadcast from the countdown on, at real speed with the director's slow motion, 30 fps. */
async function directorsCut() {
  const session = await launch({ url: "about:blank", ...WIDE });
  const errors = await watchErrors(session);
  try {
    await session.send("Page.enable");
    await pinResolution(session, base);
    await session.send("Emulation.setDeviceMetricsOverride", { ...WIDE, deviceScaleFactor: 1, mobile: false });
    await session.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installVirtualClock})()` });
    await openRacePage(session, errors, option("cut", VALLEY12));
    await evaluate(session, `(() => { const r = window.__race; r.setCamera("director"); r.seek(-4.5); r.setPlaying(false); return 0; })()`);
    const file = resolve(out, option("cut-file", "directors-cut.mp4"));
    const clip = await startClip(session, file, { crf: 20 });
    const handOver = 3.5;
    const lead = { ...LEAD_IN_CAMERA, racer: Number(option("lead-racer", LEAD_IN_CAMERA.racer)) };
    const leadIn = async (i) => {
      const t = -4.5 + i / 30;
      if (t > handOver) return;
      const camera = { ...lead, back: lead.back + 6 * Math.max(0, -t / 4.5), lift: lead.lift + 5 * Math.max(0, t) };
      await evaluate(session, `(async () => { const r = window.__race; const { t, shot } = await window.__talkCams.at({ camera: ${JSON.stringify(camera)} }, ${t}); r.seek(t); ${t + 1 / 30 > handOver ? `r.setCamera("director"); r.setPlaying(true);` : "r.setCamera(shot);"} r.draw(); return 0; })()`);
    };
    await clip.play(Number(option("cut-seconds", 21)), leadIn);
    console.log(file, await clip.close(), "frames", errors.length ? errors.join("\n") : "");
    note("directors-cut.mp4", "The director's cut", "From the countdown to the first breath attack, every cut chosen live by the automatic director.");
  } finally {
    await session.close();
  }
}

/** A phone riding: the stick swinging across the course and climbing, a breath, then the rider's eye. */
async function ridingClip() {
  const { session, errors } = await phoneRace({ width: 405, height: 720, dpr: 1280 / 720, clock: true, seed: option("seed", "talk-ember") });
  try {
    if (!(await waitFor(session, "window.__game.broadcast().time > 12", 90000))) throw new Error("The race did not get going");
    await evaluate(session, click('[data-action="reins"]'));
    await sleep(2500);
    const file = resolve(out, "riding.mp4");
    const clip = await startClip(session, file, { crf: 20 });
    const [x0, y0] = [205, 520];
    let down = false;
    const finger = async (i, n) => {
      const s = i / n;
      if (s > 0.06 && s < 0.9) {
        const k = (s - 0.06) / 0.84;
        const x = x0 + 70 * Math.sin(k * Math.PI * 2.2),
          y = y0 - 45 * Math.sin(k * Math.PI * 1.1);
        await touchAt(session, down ? "touchMove" : "touchStart", [[x, y]]);
        down = true;
      } else if (down) {
        await touchAt(session, "touchEnd", []);
        down = false;
      }
      if (i === Math.round(n * 0.5)) await evaluate(session, `(() => { const b = document.querySelector("[data-tap=breath]"); if (b && !b.hidden) b.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, pointerId: 9 })); return 0; })()`);
    };
    await clip.play(Number(option("ride-seconds", 8)), finger);
    console.log(file, await clip.close(), "frames", errors.length ? errors.join("\n") : "");
    note("riding.mp4", "Riding", "Take the reins and the broadcast becomes a game: steer the line, time the breath.");
  } finally {
    await session.close();
  }
}

/** Races each stable seed to the end at once and prints the winning margin, to find a photo finish. */
async function scan() {
  for (const stable of option("scan").split(",")) {
    args.push("--stable", stable);
    const { session } = await phoneRace({ width: 390, height: 844, dpr: 1, seed: option("seed", "talk-ember") });
    try {
      await evaluate(session, click('.broadcast [data-action="skip"]'));
      await waitFor(session, `location.hash.startsWith("#/results/")`, 60000);
      await sleep(1000);
      console.log(stable, await evaluate(session, `(document.querySelector(".photo-finish") ? "PHOTO " : "") + (document.querySelector("#screens")?.innerText ?? document.body.innerText).replace(/\\s+/g, " ").slice(0, 160)`));
    } finally {
      await session.close();
    }
    args.splice(args.lastIndexOf("--stable"), 2);
  }
}

await mkdir(out, { recursive: true });
if (option("scan")) {
  await scan();
  process.exit(0);
}
if (only.some((o) => o === "stills" || STILLS.some((s) => s.file.startsWith(o + ".")))) await stills();
if (wants("phone", "phone")) await phone();
if (wants("phone", "phone-results")) await phoneResults();
if (wants("clips", "directors-cut")) await directorsCut();
if (wants("clips", "riding")) await ridingClip();

const index = shotsDir("race.json");
const previous = await readFile(index, "utf8").then(JSON.parse, () => []);
const merged = [...previous.filter((p) => !entries.some((e) => e.file === p.file)), ...entries];
const order = [...STILLS.map((s) => `race/${s.file}`), "race/phone-on-air.webp", "race/phone-riding.webp", "race/phone-rider-eye.webp", "race/phone-results.webp", "race/directors-cut.mp4", "race/riding.mp4"];
merged.sort((a, b) => order.indexOf(a.file) - order.indexOf(b.file));
const present = [];
for (const e of merged) if (await stat(shotsDir(e.file)).catch(() => null)) present.push(e);
await writeFile(index, JSON.stringify(present, null, 2) + "\n");
console.log(index);
