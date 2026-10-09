import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const base = process.argv[2] || "http://127.0.0.1:8094";
const courseSeeds = ["2407", "canyon", "91"];
const directorTimes = [1.5, 12, 30, 55, 80];
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = resolve(root, "shots", "race");

async function save(name, dataUrl) {
  const path = resolve(directory, name);
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, Buffer.from(dataUrl.split(",")[1], "base64"));
  console.log(path);
}

async function open(session, errors, query) {
  await session.send("Page.navigate", { url: new URL(`/race.html?paused&${query}`, base).href });
  if (!(await waitFor(session, "window.__race && window.__race.ready", 30000)))
    throw new Error(`Race page did not load: ${errors.join("\n")}`);
}

const session = await launch({ url: "about:blank", width: 1500, height: 1100 });
const report = { createdAt: new Date().toISOString(), images: [], timing: [], checks: [] };
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  for (const style of ["cozy"]) {
    for (const seed of courseSeeds) {
      await open(session, errors, `course=${seed}&race=1&style=${style}`);
      const count = await evaluate(session, "window.__race.overviews().length");
      for (let i = 0; i < count; i++) {
        const shot = await evaluate(session, `window.__race.overviews()[${i}].shot`);
        const png = await evaluate(session, `(window.__race.setCamera(window.__race.overviews()[${i}]), window.__race.capture())`);
        const name = `${style}/course-${seed}-${shot}.png`;
        await save(name, png);
        report.images.push(name);
      }
    }
    await open(session, errors, `course=${courseSeeds[0]}&race=1&style=${style}`);
    const duration = await evaluate(session, "window.__race.race.recording.duration");
    for (const t of directorTimes.filter((t) => t < duration)) {
      const png = await evaluate(session, `(window.__race.setCamera("director"), window.__race.seek(${t}), window.__race.capture())`);
      const name = `${style}/director-${String(t).replace(".", "_")}s.png`;
      await save(name, png);
      report.images.push(name);
    }
    const riders = await evaluate(
      session,
      `(() => {
        const shots = window.__race.race.director.timeline.filter((e) => e.shot === "rider");
        const kinds = [/alongside/, /front|leader/, /kicks/, /hunting|shoulder/];
        const picked = kinds.map((k) => shots.find((e) => k.test(e.reason))).filter(Boolean);
        return [...new Set(picked)].map((e) => ({ t: Number(((e.start + e.end) / 2).toFixed(2)), reason: e.reason }));
      })()`,
    );
    for (const { t, reason } of riders) {
      const png = await evaluate(session, `(window.__race.setCamera("director"), window.__race.seek(${t}), window.__race.capture())`);
      const name = `${style}/rider-${String(t).replace(".", "_")}s.png`;
      await save(name, png);
      report.images.push(name);
      report.riderCam = [...(report.riderCam ?? []), { style, name, t, reason }];
    }
    for (const t of [8, 40]) {
      const png = await evaluate(session, `(async () => {
        const { sampleRace } = await import("/src/race/sampleRace.js");
        const { creatureScale: k } = await import("/src/worldScale.js");
        const racers = sampleRace(window.__race.race.recording, ${t}).racers;
        const lead = racers.find((r) => r.place === 1);
        const f = lead.forward;
        const eye = [lead.position[0] - (f[0] * 240 + f[2] * 60) * k, lead.position[1] + 55 * k, lead.position[2] - (f[2] * 240 - f[0] * 60) * k];
        window.__race.seek(${t});
        window.__race.setCamera({ eye, target: lead.position, up: [0, 1, 0], fov: 0.6, shot: "broadcast", reason: "readability" });
        const png = window.__race.capture();
        window.__race.setCamera("director");
        return png;
      })()`);
      const name = `${style}/broadcast-${t}s.png`;
      await save(name, png);
      report.images.push(name);
    }
    await evaluate(session, `(window.__race.seek(${directorTimes[2]}), window.__race.draw(), 0)`);
    await new Promise((r) => setTimeout(r, 300));
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    await save(`${style}/page.png`, `data:image/png;base64,${data}`);
    report.images.push(`${style}/page.png`);

    await open(session, errors, `course=${courseSeeds[0]}&race=1&racers=12&style=${style}`);
    await evaluate(session, `(window.__race.setCamera("director"), window.__race.seek(20), window.__race.benchmark(20), 0)`);
    const timing = await evaluate(session, "window.__race.benchmark(180)");
    const wide = await evaluate(
      session,
      `(window.__race.setCamera(window.__race.overviews()[1]), window.__race.benchmark(90))`,
    );
    const rafFps = await evaluate(
      session,
      `new Promise((done) => { window.__race.setCamera("director"); window.__race.setPlaying(true); let n = 0; const t0 = performance.now(); const tick = () => { if (++n < 120) requestAnimationFrame(tick); else done(Math.round(n * 1000 / (performance.now() - t0))); }; requestAnimationFrame(tick); })`,
    );
    const fullHd = await evaluate(
      session,
      `(() => { const stage = document.getElementById("race-stage"); Object.assign(stage.style, { maxHeight: "none", aspectRatio: "auto", width: "1920px", height: "1080px" }); window.__race.setCamera("director"); window.__race.benchmark(20); return window.__race.benchmark(180); })()`,
    );
    const qhd = await evaluate(
      session,
      `(() => { const stage = document.getElementById("race-stage"); Object.assign(stage.style, { width: "2560px", height: "1440px" }); window.__race.benchmark(20); return window.__race.benchmark(180); })()`,
    );
    report.timing.push({ style, racers: 12, director: timing, aerial: wide, fullHd, qhd, rafFps });
    console.log(style, JSON.stringify({ director: timing, aerial: wide, fullHd, qhd, rafFps }));
  }
  report.environment = {
    renderer: await evaluate(session, "document.getElementById('renderer-label').textContent"),
    userAgent: await evaluate(session, "navigator.userAgent"),
  };
  report.checks.push({
    name: "Page errors",
    status: errors.length ? "fail" : "pass",
    details: errors.length ? errors.join("\n") : "No console or runtime errors while rendering.",
  });
  report.checks.push({
    name: "Visual quality and readability",
    status: "review",
    details: "Human review required: canyon, gates, racers and both styles.",
  });
  await writeFile(resolve(directory, "report.json"), JSON.stringify(report, null, 2));
  console.log(resolve(directory, "report.json"));
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
}
