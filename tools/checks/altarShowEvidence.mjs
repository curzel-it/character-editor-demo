// The Soul Altar's ritual show, for review: 1080p frames of every beat for a circle of two and of five
// mixed breaths, each ending in an egg and in silence, the place at rest,
// phone-size screenshots of the Altar screen through a whole ritual in the game, and WebM clips of the
// show. Writes shots/altar/show/.
//   node tools/checks/altarShowEvidence.mjs [--url http://127.0.0.1:8094] [--case five-egg,two-silence,...]
//     [--style cozy|lowPoly] [--no-frames] [--no-phone] [--no-video]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, sleep } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const CASES = {
  "five-egg": { elements: ["fire", "water", "nature", "storm", "fire"], success: true, seed: "evidence:ritual:5" },
  "five-silence": { elements: ["storm", "nature", "water", "fire", "water"], success: false, seed: "evidence:ritual:6" },
  "two-egg": { elements: ["storm", "nature"], success: true, seed: "evidence:ritual:2" },
  "two-silence": { elements: ["fire", "water"], success: false, seed: "evidence:ritual:3" },
};
const cases = option("case", Object.keys(CASES).join(",")).split(",");
const styles = option("style") ? [option("style")] : ["cozy"];
const videos = ["five-egg", "two-silence"];
const CHUNK = 4 << 20;
const PHONE = { width: 390, height: 844, dpr: 2 };
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = resolve(root, "shots", "altar", "show");

async function save(name, data) {
  await mkdir(out, { recursive: true });
  const path = resolve(out, name);
  await writeFile(path, typeof data === "string" ? Buffer.from(data.split(",")[1], "base64") : data);
  console.log(path);
}

/** Moments worth a frame, from the show's own timeline. */
function moments(timeline, hero = 0) {
  const at = Object.fromEntries(timeline.beats.map((b) => [b.id, b.at]));
  const list = [
    ["establish", 1.4],
    ["custodian-raises", 4.6],
    ["landing", timeline.arrivals[hero].land + 0.2],
    ["crouch", at.breathe - 0.8],
    ["breath", at.breathe + 1.2],
    ["converge", at.merge - 0.3],
    ["orb", at.merge + 1],
    ["burst", at.burst + 0.6],
    ["finale", at.burst + 3.3],
    ["settle", at.settle + 1.2],
    ["reveal", at.reveal + 0.35],
    ["after", at.reveal + 2.6],
  ];
  if (!timeline.success) list.push(["console", timeline.card - 1]);
  list.push(["card", timeline.card]);
  return list;
}

/** Installs `window.__altarShow` in the check page: the place, its cast and a 1080p renderer. */
async function setup() {
  const [{ createSceneRenderer }, { createAltarPlace, altarPlaceProps }, { createAltarCast }, { createRitualShow }, { loadSubject, makeGenome }, { breathElements }, { standingStonePalette }] =
    await Promise.all([
      import("/src/scene.js"), import("/src/scene/altarPlace.js"), import("/src/scene/altarCast.js"), import("/src/scene/ritualShow.js"),
      import("/src/subjects.js"), import("/src/breath/breathElements.js"), import("/src/palette.js"),
    ]);
  const module = await loadSubject("dragon");
  const place = createAltarPlace();
  const cast = createAltarCast(module, place);
  const canvas = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 });
  document.body.append(canvas);
  const renderer = createSceneRenderer(canvas);
  const circle = (elements) =>
    elements.map((element, i) => ({ id: `p${i}`, genome: { ...makeGenome(module.genes, `altar-show:${i}`), breath: breathElements.findIndex((b) => b.id === element) } }));
  const look = { shell: [0.95, 0.66, 0.42], spots: [0.42, 0.3, 0.78], seed: "altar-show" };
  const stage = (c) => createRitualShow({ place, cast, dragons: circle(c.elements), success: c.success, seed: c.seed, look });
  const draw = (frame, style, time) => {
    renderer.render({ course: place.course, style, time, ...frame });
    renderer.finish();
  };
  const rune = standingStonePalette.rune;
  const restProps = altarPlaceProps(place, { altarGlow: 0.1, runeGlow: 0.18, colors: rune, runeColor: rune });

  window.__altarShow = {
    timeline(c) {
      const show = stage(c);
      return { timeline: show.timeline, shots: show.shots.map(({ id, from, to, hero }) => ({ id, from, to, hero })) };
    },
    frame(c, style, t) {
      const { shot, ...frame } = stage(c).frame(t);
      draw(frame, style, t);
      return { shot, png: canvas.toDataURL("image/png") };
    },
    rest(style) {
      const parents = cast.parents(circle(["fire", "water", "storm"]));
      const views = [
        ["rest", [], { eye: [-8, 7, 25.5], target: [0, 2.4, 1.5], fov: 0.7 }],
        ["rest-circle", parents, { eye: [-11, 10, 34], target: [0, 2.4, 1.5], fov: 0.7 }],
      ];
      return views.map(([name, standing, camera]) => {
        const time = 3.2;
        const racers = [cast.custodian(time), ...standing.map((p) => cast.resting(p, time))];
        draw({ racers, props: restProps, camera: { ...camera, up: [0, 1, 0] } }, style, time);
        return { name, png: canvas.toDataURL("image/png") };
      });
    },
    /** Records the show in real time at 30 fps into `window.__clip`. */
    async record(c, style) {
      const show = stage(c);
      canvas.width = 1280;
      canvas.height = 720;
      const stream = canvas.captureStream(0);
      const [track] = stream.getVideoTracks();
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 10e6 });
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise((done) => (recorder.onstop = done));
      recorder.start(1000);
      const start = performance.now();
      const count = Math.ceil((show.timeline.card + 1.5) * 30);
      let late = 0;
      for (let k = 0; k < count; k++) {
        const t = k / 30;
        const { shot, ...frame } = show.frame(t);
        draw(frame, style, t);
        track.requestFrame();
        const wait = start + ((k + 1) * 1000) / 30 - performance.now();
        if (wait > 0) await new Promise((done) => setTimeout(done, wait));
        else late++;
      }
      recorder.stop();
      await stopped;
      canvas.width = 1920;
      canvas.height = 1080;
      window.__clip = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
      return { frames: count, late, bytes: window.__clip.length, seconds: (performance.now() - start) / 1000 };
    },
  };
  return true;
}

async function download(session) {
  const size = await evaluate(session, "window.__clip.length");
  const parts = [];
  for (let offset = 0; offset < size; offset += CHUNK) {
    const text = await evaluate(
      session,
      `(() => { const b = window.__clip.subarray(${offset}, ${offset + CHUNK}); let s = ""; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); })()`,
    );
    parts.push(Buffer.from(text, "base64"));
  }
  return Buffer.concat(parts);
}

async function scenes() {
  const session = await launch({ url: "about:blank", width: 1300, height: 900 });
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
    if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
    await evaluate(session, `(${setup.toString()})()`);
    const report = {};
    if (!args.includes("--no-frames"))
      for (const style of styles) {
        for (const image of await evaluate(session, `window.__altarShow.rest(${JSON.stringify(style)})`)) await save(`${style}-${image.name}.png`, image.png);
        for (const id of style === "cozy" ? cases : cases.slice(0, 1)) {
          const c = CASES[id];
          const { timeline, shots } = await evaluate(session, `window.__altarShow.timeline(${JSON.stringify(c)})`);
          report[id] = { card: timeline.card, beats: timeline.beats, lines: timeline.lines, shots };
          const list = moments(timeline, shots.find((s) => s.id === "head").hero);
          for (const [k, [name, t]] of list.entries()) {
            const image = await evaluate(session, `window.__altarShow.frame(${JSON.stringify(c)}, ${JSON.stringify(style)}, ${t})`);
            await save(`${style}-${id}-${String(k).padStart(2, "0")}-${name}.png`, image.png);
          }
        }
      }
    if (!args.includes("--no-video"))
      for (const id of videos.filter((v) => cases.includes(v))) {
        await evaluate(session, `window.__recorded = null; window.__altarShow.record(${JSON.stringify(CASES[id])}, "cozy").then((stats) => (window.__recorded = stats)); 0`);
        if (!(await waitFor(session, "window.__recorded", 180000, 500))) throw new Error("The recording did not finish");
        const stats = await evaluate(session, "window.__recorded");
        await save(`show-${id}.webm`, await download(session));
        console.log(id, JSON.stringify(stats));
      }
    await save("report.json", Buffer.from(JSON.stringify({ createdAt: new Date().toISOString(), cases: report }, null, 2)));
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

/** A stable of five adults, one per breath and a spare, whose first ritual ends as `success` says. */
function seedStable(success) {
  return `(async () => {
    const [{ makeGenome }, { createDragon }, { breathElements }, { createStable }, { genes }, { makeRng }, { ritualOdds }] = await Promise.all([
      import("/src/subjects.js"), import("/src/stable/createDragon.js"), import("/src/breath/breathElements.js"), import("/src/stable/newStable.js"),
      import("/src/genome/dragon.js"), import("/src/rng.js"), import("/src/stable/soulAltar.js"),
    ]);
    let seed = 1;
    while ((makeRng(seed + ":ritual:1")() < ritualOdds(3)) !== ${success}) seed++;
    const stable = createStable(genes, seed, Date.now());
    stable.welcomed = true;
    ["fire", "water", "storm", "nature", "fire"].forEach((element, i) => {
      const id = "altar-phone:" + i;
      stable.dragons.push(createDragon({ seed: id, genome: { ...makeGenome(genes, id), breath: breathElements.findIndex((b) => b.id === element) }, age: "adult", now: 0 }));
    });
    window.__game.game.stable = stable;
    window.__game.save();
    location.hash = "#/stable";
    return seed;
  })()`;
}

/** The Altar screen on a phone through the picking and a whole ritual, as screenshots. */
async function phone(success) {
  const tag = success ? "egg" : "silence";
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const shot = async (name) => {
    const { data } = await session.send("Page.captureScreenshot", { format: "png" });
    await save(`phone-${tag}-${name}.png`, Buffer.from(data, "base64"));
  };
  try {
    const errors = await watchErrors(session);
    await session.send("Page.enable");
    await emulateDevice(session, PHONE);
    await session.send("Page.navigate", { url: new URL("/", base).href });
    if (!(await waitFor(session, "window.__game", 20000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
    await evaluate(session, seedStable(success));
    await sleep(800);
    await evaluate(session, `location.hash = "#/altar"`);
    await sleep(1500);
    await shot("03-rest");
    await evaluate(session, `(async () => { for (let i = 0; i < 3; i++) { document.querySelectorAll("[data-pick]")[i].click(); await new Promise((r) => setTimeout(r, 60)); } })()`);
    await sleep(2500);
    await shot("04-picked");
    await evaluate(session, `document.querySelector('[data-action="begin"]').click()`);
    await sleep(1000);
    const { timeline, hero } = await evaluate(session, "window.__game.altar().stage.playing");
    const list = moments(timeline, hero);
    for (const [k, [name, t]] of list.entries()) {
      if (name === "card") break;
      await evaluate(session, `window.__game.altar().stage.seek(${t})`);
      await sleep(600);
      await shot(`${String(k + 5).padStart(2, "0")}-${name}`);
    }
    await evaluate(session, `window.__game.altar().stage.seek(${timeline.card - 0.2}, false)`);
    await sleep(1600);
    await shot("99-card");
    if (errors.length) throw new Error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

await scenes();
if (!args.includes("--no-phone")) for (const success of [true, false]) await phone(success);
