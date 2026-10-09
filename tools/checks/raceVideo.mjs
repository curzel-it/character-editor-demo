// Records short WebM clips of key race moments from the broadcast director, plus HUD key frames,
// by driving the race tool page (race.html) in headless Chrome. The canvas is
// captured with captureStream and MediaRecorder in the page; the blob comes back as base64 in chunks.
//   node tools/checks/raceVideo.mjs [base] [--style cozy|lowPoly] [--course 2407] [--type valley] [--only start,finish]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const base = args.find((a) => a.startsWith("http")) || "http://127.0.0.1:8094";
const styles = option("style") ? [option("style")] : ["cozy"];
const course = option("course", "2407");
const only = option("only")?.split(",");
const type = option("type");
const WIDTH = 1280,
  HEIGHT = 720,
  CHUNK = 4 << 20;
const root = fileURLToPath(new URL("../../", import.meta.url));
const directory = resolve(root, "shots", "race");

/** Key moments, chosen from the recording, course and director timeline in the page. */
const MOMENTS = `(() => {
  const { recording, course, director } = window.__race.race;
  const duration = recording.duration;
  const clamp = (t, length) => Math.max(0, Math.min(duration - length, t));
  const lead = (s) => {
    for (const f of recording.frames) if (f.racers.some((r) => r.progress >= s)) return f.t;
    return duration / 2;
  };
  const middle = director.timeline.filter((e) => e.start > duration * 0.3 && e.start < duration * 0.7);
  const battle = middle.find((e) => e.shot === "battle" && /lead/.test(e.reason)) ?? middle.find((e) => e.shot === "battle") ?? middle[0];
  const thermal = recording.events.find((e) => e.type === "thermal");
  const rider = middle.find((e) => e.shot === "rider" && /alongside/.test(e.reason)) ?? director.timeline.find((e) => e.shot === "rider" && e.start > 5);
  const inner = course.path.filter((p) => p.s > course.length * 0.15 && p.s < course.length * 0.85);
  const gorge = inner.reduce((a, b) => (b.halfWidth < a.halfWidth ? b : a), inner[0]);
  const winner = recording.results.find((r) => r.time !== null);
  const moments = [
    { name: "start", t: 0, length: 14, why: "Grid and launch" },
    { name: "battle", t: clamp(battle.start - 1, 13), length: 13, why: battle.reason },
    thermal
      ? { name: "thermal", t: clamp(thermal.t - 5, 12), length: 12, why: "First thermal of the race" }
      : null,
    rider ? { name: "rider", t: clamp(rider.start - 2, 8), length: 8, why: "Rider cam: " + rider.reason } : null,
    { name: "gorge", t: clamp(lead(gorge.s) - 6, 12), length: 12, why: "Leaders reach the narrowest gorge (" + Math.round(gorge.halfWidth * 2) + " m)" },
    { name: "finish", t: clamp((winner?.time ?? duration) - 10, 14), length: 14, why: "Run to the line" },
  ];
  return moments.filter(Boolean);
})()`;

async function save(path, buffer) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, buffer);
  console.log(path);
}

async function record(session, moment) {
  await evaluate(
    session,
    `(() => {
      const r = window.__race;
      r.setPlaying(false);
      r.setCamera("director");
      r.state.speed = 1;
      r.seek(${moment.t});
      r.draw();
      const canvas = document.getElementById("race-view");
      const stream = canvas.captureStream(60);
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10e6 });
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      window.__clip = { recorder, chunks, frames: 0, done: false, type };
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        window.__clip.bytes = new Uint8Array(await blob.arrayBuffer());
        window.__clip.done = true;
      };
      const count = () => { if (!window.__clip.done) { window.__clip.frames++; requestAnimationFrame(count); } };
      requestAnimationFrame(count);
      recorder.start(1000);
      window.__clip.started = performance.now();
      r.setPlaying(true);
      return 0;
    })()`,
  );
  await new Promise((done) => setTimeout(done, moment.length * 1000));
  const stats = await evaluate(
    session,
    `(() => { const c = window.__clip; window.__race.setPlaying(false); c.recorder.stop(); c.seconds = (performance.now() - c.started) / 1000; return { frames: c.frames, seconds: c.seconds, type: c.type, reached: window.__race.state.t }; })()`,
  );
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
  return { ...stats, fps: stats.frames / stats.seconds, video: Buffer.concat(parts) };
}

let tag = "";

async function keyFrames(session, style, moment) {
  const names = [];
  for (let k = 0; k < 5; k++) {
    const t = moment.t + ((k + 0.5) * moment.length) / 5;
    await evaluate(session, `(window.__race.setPlaying(false), window.__race.seek(${t}), window.__race.draw(), 0)`);
    await new Promise((done) => setTimeout(done, 150));
    const clip = await evaluate(
      session,
      `(() => { const r = document.getElementById("race-stage").getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, scale: 1 }; })()`,
    );
    const { data } = await session.send("Page.captureScreenshot", { format: "png", clip });
    const name = `${style}/clip-${tag}${moment.name}-${k + 1}.png`;
    await save(resolve(directory, name), Buffer.from(data, "base64"));
    names.push({ name, t: Number(t.toFixed(2)) });
  }
  return names;
}

const session = await launch({ url: "about:blank", width: WIDTH + 400, height: HEIGHT + 500 });
const report = { createdAt: new Date().toISOString(), course, type: type ?? "default", types: {}, clips: [], checks: [] };
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  for (const style of styles) {
    await session.send("Page.navigate", {
      url: new URL(`/race.html?paused&course=${course}&race=1&racers=12&style=${style}&motion=full${type ? `&type=${type}` : ""}`, base).href,
    });
    if (!(await waitFor(session, "window.__race && window.__race.ready", 30000)))
      throw new Error(`Race page did not load: ${errors.join("\n")}`);
    await evaluate(
      session,
      `(() => { document.querySelector("#race-screen .workspace").style.gridTemplateColumns = "1fr"; const stage = document.getElementById("race-stage"); Object.assign(stage.style, { maxHeight: "none", aspectRatio: "auto", width: "${WIDTH}px", height: "${HEIGHT}px" }); window.__race.draw(); return 0; })()`,
    );
    const kind = await evaluate(session, "window.__race.race.course.type ?? 'canyon'");
    tag = kind === "canyon" ? "" : `${kind}-`;
    report.types[style] = kind;
    const moments = (await evaluate(session, MOMENTS)).filter((m) => !only || only.includes(m.name));
    for (const moment of moments) {
      const { video, ...stats } = await record(session, moment);
      const name = `${style}/clip-${tag}${moment.name}.webm`;
      await save(resolve(directory, name), video);
      const frames = await keyFrames(session, style, moment);
      const entry = { style, ...moment, file: name, bytes: video.length, ...stats, fps: Number(stats.fps.toFixed(1)), frames };
      report.clips.push(entry);
      console.log(style, moment.name, `${moment.t.toFixed(1)}–${(moment.t + moment.length).toFixed(1)} s`, `${entry.fps} fps`, moment.why);
    }
  }
  report.checks.push({
    name: "Page errors",
    status: errors.length ? "fail" : "pass",
    details: errors.length ? errors.join("\n") : "No console or runtime errors while recording.",
  });
  report.checks.push({
    name: "Speed and scale read on screen",
    status: "review",
    details: "Human review required: watch the clips; stills cannot prove the sense of speed.",
  });
  await save(resolve(directory, `video${type ? `-${type}` : ""}.json`), JSON.stringify(report, null, 2));
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
}
