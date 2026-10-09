// Films one whole race of the game's broadcast, its own director cameras and HUD, frame by frame on the
// trailer's virtual clock into a 1080×1920 MP4: a field of `--racers` seeded dragons of `--age` over a
// `--type` course, as the exhibition race in dev mode.
//   node tools/race/raceFilm.mjs --type canyon [--course 2407] [--race 1] [--racers 8] [--age adult]
//     [--url http://127.0.0.1:8094] [--out /Volumes/SLEEPTUBE/dragons-races/<type>-<course>-<race>.mp4]
import { evaluate } from "../cdp.mjs";
import { openPhone, load, startClip, FPS } from "../trailer/001/recorder.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const type = option("type", "valley");
const courseSeed = option("course", "2407");
const raceSeed = option("race", "1");
const racers = Number(option("racers", 8));
const age = option("age", "adult");
const base = option("url", "http://127.0.0.1:8094");
const out = option("out", `/Volumes/SLEEPTUBE/dragons-races/${type}-${courseSeed}-${raceSeed}.mp4`);
const TAIL = 5;
const broadcast = "window.__game.broadcast()";

const saveField = `(async () => {
  const { defaultField } = await import("/src/raceField.js");
  const { loadSubject } = await import("/src/subjects.js");
  const field = defaultField({ genes: (await loadSubject("dragon")).genes }, ${JSON.stringify(raceSeed)}, ${racers});
  Object.assign(window.__game.game.stable, { welcomed: true, careTaught: true, raceHint: "done", reinsInvited: true, reinsTaught: true });
  window.__game.save();
  localStorage.setItem("dragonz-race-field", JSON.stringify({ version: 3, ...field, courseSeed: ${JSON.stringify(courseSeed)}, courseType: ${JSON.stringify(type)},
    participants: field.participants.map((p) => ({ ...p, age: ${JSON.stringify(age)} })) }));
  return 0;
})()`;

const { session, errors } = await openPhone();
try {
  await load(session, `${base}/`, "window.__game", errors);
  await evaluate(session, saveField);
  await load(session, `${base}/?dev=true#/dev/field/race`, `${broadcast}.race && document.getElementById("loading").hidden`, errors);
  const { LEAD_IN } = await evaluate(session, `import("/src/race/countdown.js").then((m) => ({ LEAD_IN: m.LEAD_IN }))`);
  const race = await evaluate(
    session,
    `(() => { const { course, recording } = ${broadcast}.race; ${broadcast}.script(null);
      return { type: course.type, length: Math.round(course.length), gates: course.gates.length, duration: recording.duration,
        winner: recording.results.find((r) => r.place === 1)?.time ?? null }; })()`,
  );
  if (race.type !== type) throw new Error(`Asked for a ${type} course, the broadcast built a ${race.type}`);
  const clip = await startClip(session, out);
  const from = -LEAD_IN,
    to = race.duration + TAIL;
  const n = Math.round((to - from) * FPS);
  for (let i = 0; i < n; i++) {
    await evaluate(session, `(${broadcast}.seek(${from + i / FPS}), 0)`);
    await clip.frame();
    if (i % (FPS * 10) === 0) console.log(`${(from + i / FPS).toFixed(0)} / ${to.toFixed(0)} s`);
  }
  await clip.close();
  console.log(JSON.stringify({ out, ...race }));
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
}
