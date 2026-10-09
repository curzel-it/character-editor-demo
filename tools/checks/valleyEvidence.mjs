import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = option("base", "http://127.0.0.1:8094");
const seeds = option("seeds", "2407,valley,91").split(",");
const styles = option("styles", "cozy").split(",");
const skipTiming = args.includes("--no-timing");
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = resolve(root, "shots", "race");

async function save(name, dataUrl) {
  const path = resolve(directory, name);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(path);
}

async function open(session, errors, query) {
  await session.send("Page.navigate", { url: new URL(`/race.html?paused&type=valley&${query}`, base).href });
  if (!(await waitFor(session, "window.__race && window.__race.ready", 60000)))
    throw new Error(`Race page did not load: ${errors.join("\n")}`);
}

// Runs in the page: named camera setups around the valley, the castle and the racers passing it.
const shotsSource = `(async () => {
  const { sampleRace } = await import("/src/race/sampleRace.js");
  const { terrainHeight } = await import("/src/course/terrainHeight.js");
  const { course, recording } = window.__race.race;
  const castle = course.features.find((f) => f.type === "castle");
  const ground = (x, z) => terrainHeight(course.terrain, x, z);
  const above = (p, h) => [p[0], Math.max(p[1], ground(p[0], p[2]) + h), p[2]];
  const xs = course.path.map((p) => p.position[0]), zs = course.path.map((p) => p.position[2]);
  const mid = [(Math.min(...xs) + Math.max(...xs)) / 2, 0, (Math.min(...zs) + Math.max(...zs)) / 2];
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs));
  const passTime = (() => {
    for (const frame of recording.frames) {
      const lead = frame.racers.find((r) => r.place === 1);
      if (lead.progress >= castle.s - 20) return frame.t;
    }
    return recording.duration / 2;
  })();
  const pack = (t) => sampleRace(recording, t).racers.filter((r) => !r.finished);
  const centroid = (racers) => [0, 1, 2].map((i) => racers.reduce((s, r) => s + r.position[i], 0) / racers.length);
  const shots = [];
  const overview = window.__race.overviews();
  shots.push({ name: "establishing", t: 0, camera: overview[0] });
  shots.push({
    name: "aerial",
    t: 0,
    camera: { eye: [mid[0] - span * 0.05, span * 0.75, mid[2] - span * 0.32], target: [mid[0], 0, mid[2]], up: [0, 1, 0], fov: 0.95, shot: "aerial" },
  });
  const c = castle.position, near = castle.near, along = castle.along;
  shots.push({
    name: "castle-approach",
    t: Math.max(0, passTime - 3),
    camera: {
      eye: above([c[0] + along[0] * 260 + near[0] * 110, c[1] + 40, c[2] + along[2] * 260 + near[2] * 110], 25),
      target: [c[0], c[1] + 20, c[2]], up: [0, 1, 0], fov: 0.75, shot: "castle",
    },
  });
  for (const [label, dt] of [["castle-pass", 0], ["castle-pass-late", 1.2]]) {
    const t = passTime + dt;
    const racers = pack(t);
    const leader = racers.reduce((a, b) => (a.progress > b.progress ? a : b));
    const eye = above([leader.position[0] + near[0] * 110 - along[0] * 90, leader.position[1] - 10, leader.position[2] + near[2] * 110 - along[2] * 90], 8);
    shots.push({ name: label, t, camera: { eye, target: [(leader.position[0] + c[0]) / 2, c[1] + 22, (leader.position[2] + c[2]) / 2], up: [0, 1, 0], fov: 0.8, shot: "castle" } });
  }
  {
    const t = passTime + 0.6;
    const k = castle.keep.position;
    const eye = [k[0] - near[0] * 30 - along[0] * 25, castle.keep.roofTop + 14, k[2] - near[2] * 30 - along[2] * 25];
    shots.push({ name: "castle-keep", t, camera: { eye, target: centroid(pack(t)), up: [0, 1, 0], fov: 0.95, shot: "castle" } });
  }
  {
    const t = passTime - 1;
    const racers = pack(t);
    const leader = racers.reduce((a, b) => (a.progress > b.progress ? a : b));
    const f = leader.forward;
    const eye = [leader.position[0] - f[0] * 70 - near[0] * 25, leader.position[1] + 14, leader.position[2] - f[2] * 70 - near[2] * 25];
    shots.push({ name: "castle-chase", t, camera: { eye, target: [c[0], c[1] + 25, c[2]], up: [0, 1, 0], fov: 0.85, shot: "castle" } });
  }
  return { passTime, duration: recording.duration, shots };
})()`;

const session = await launch({ url: "about:blank", width: 1500, height: 1100 });
const report = { createdAt: new Date().toISOString(), images: [], timing: [], checks: [] };
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  for (const style of styles) {
    for (const seed of seeds) {
      await open(session, errors, `course=${seed}&race=1&racers=12&style=${style}`);
      const plan = await evaluate(session, shotsSource);
      for (let i = 0; i < plan.shots.length; i++) {
        const png = await evaluate(
          session,
          `(async () => { const plan = await ${shotsSource}; const shot = plan.shots[${i}]; window.__race.seek(shot.t); window.__race.setCamera(shot.camera); return window.__race.capture(); })()`,
        );
        const name = `${style}/valley-${seed}-${plan.shots[i].name}.png`;
        await save(name, png);
        report.images.push(name);
      }
      const times = [1.5, plan.passTime - 1, plan.passTime + 0.5, plan.duration * 0.3, plan.duration * 0.6, plan.duration * 0.85];
      for (const t of times) {
        const png = await evaluate(session, `(window.__race.setCamera("director"), window.__race.seek(${t}), window.__race.capture())`);
        const name = `${style}/valley-${seed}-director-${t.toFixed(1).replace(".", "_")}s.png`;
        await save(name, png);
        report.images.push(name);
      }
    }
    if (skipTiming) continue;
    await open(session, errors, `course=${seeds[0]}&race=1&racers=12&style=${style}`);
    const fullHd = await evaluate(
      session,
      `(() => { const stage = document.getElementById("race-stage"); Object.assign(stage.style, { maxHeight: "none", aspectRatio: "auto", width: "1920px", height: "1080px" }); window.__race.setCamera("director"); window.__race.seek(20); window.__race.benchmark(30); return window.__race.benchmark(240); })()`,
    );
    report.timing.push({ style, racers: 12, fullHd });
    console.log(style, JSON.stringify(fullHd));
  }
  report.checks.push({
    name: "Page errors",
    status: errors.length ? "fail" : "pass",
    details: errors.length ? errors.join("\n") : "No console or runtime errors while rendering.",
  });
  report.checks.push({
    name: "Valley, castle scale and readability",
    status: "review",
    details: "Human review required: valley composition, castle scale against 16 m dragons, both styles.",
  });
  await writeFile(resolve(directory, "valley-report.json"), JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
}
