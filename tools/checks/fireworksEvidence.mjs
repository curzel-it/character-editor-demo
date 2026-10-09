// The Soul Altar's fireworks over an open meadow: adult dragons breathe from a circle at a stand-in
// altar ringed by stand-in stones. Writes 1080p key frames, a contact sheet per mix and WebM clips to
// shots/altar/<style>/.
//   node tools/checks/fireworksEvidence.mjs [--url http://127.0.0.1:8094] [--style cozy|lowPoly]
//     [--mix fire,fire-ice,all-four,six] [--video all-four,six] [--no-frames]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const styles = option("style") ? [option("style")] : ["cozy"];
const MIXES = {
  fire: { elements: ["fire", "fire"], result: true },
  "fire-ice": { elements: ["fire", "water"], result: false },
  "all-four": { elements: ["fire", "water", "nature", "storm"], result: true },
  six: { elements: ["fire", "water", "nature", "storm", "fire", "storm"], result: true },
};
const mixes = option("mix", Object.keys(MIXES).join(",")).split(",");
const videos = option("video", "all-four,six").split(",").filter(Boolean);
const frames = !args.includes("--no-frames");
const MOMENTS = [
  ["breath", 1.7],
  ["merge", 4.0],
  ["hold", 4.9],
  ["burst", 5.3],
  ["shells", 6.9],
  ["finale", 8.6],
  ["settle", 10.8],
  ["reveal", 12.6],
];
const CHUNK = 4 << 20;
const root = fileURLToPath(new URL("../../", import.meta.url));

async function save(path, buffer) {
  await mkdir(resolve(path, ".."), { recursive: true });
  await writeFile(path, buffer);
  console.log(path);
}

/** Installs `window.__fireworks` in the check page: a stage that renders one mix at a time. */
async function setup() {
  const [{ createSceneRenderer }, { createStableYard }, { loadSubject, makeGenome }, math, { mouthPoint }, { lowestPoint }, { restingMotion }, { createBuilder, box, column }, { createSoulFireworks, fireworksPhases }, { breathElements }] =
    await Promise.all([
      import("/src/scene.js"), import("/src/scene/stableYard.js"), import("/src/subjects.js"), import("/src/math3d.js"), import("/src/breath/mouthPoint.js"),
      import("/src/scene/groundContact.js"), import("/src/dragonThumbnails.js"), import("/src/scene/meshBuilder.js"), import("/src/scene/soulFireworks.js"), import("/src/breath/breathElements.js"),
    ]);
  const module = await loadSubject("dragon");
  const meadow = createStableYard(3, { buildings: false });
  const RING = 14,
    ALTAR = 1.1;
  const builder = createBuilder();
  const stone = [0.52, 0.5, 0.48];
  box(builder, [0, 0], 0.3, 1.1, 0.7, 0, ALTAR, stone);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2 + 0.2;
    column(builder, [Math.cos(a) * 8, Math.sin(a) * 8], 0.55, 0, 2.6 + (k % 3) * 0.5, 5, [0.46, 0.45, 0.44], { topRadius: 0.4, cap: true, phase: k });
  }
  const extra = builder.result();
  const join = (key) => {
    const a = meadow.course.dressing[key],
      b = extra[key];
    const out = new Float32Array(a.length + b.length);
    out.set(a);
    out.set(b, a.length);
    return out;
  };
  const course = { ...meadow.course, dressing: Object.fromEntries(Object.keys(extra).map((key) => [key, key in meadow.course.dressing && ArrayBuffer.isView(extra[key]) ? join(key) : extra[key]])) };
  const canvas = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 });
  document.body.append(canvas);
  const renderer = createSceneRenderer(canvas);

  function stage(mix, seed) {
    const n = mix.elements.length;
    const offset = n % 2 ? -Math.PI / 2 : n % 4 === 0 ? Math.PI / 4 : 0;
    const dragons = mix.elements.map((element, i) => {
      const a = offset + (i / n) * Math.PI * 2;
      const breath = breathElements.findIndex((b) => b.id === element);
      const anatomy = module.createAnatomy({ ...makeGenome(module.genes, 2407 + i * 31), breath }, { age: "adult" });
      const forward = [-Math.cos(a), 0, -Math.sin(a)];
      const spot = [Math.cos(a) * RING, 0, Math.sin(a) * RING];
      const pose = module.pose(anatomy, 0, { ...restingMotion, breath: 1, breathPitch: -0.5, time: 1 + i });
      const position = [spot[0], 0.02 - lowestPoint(anatomy, pose, spot, forward), spot[2]];
      const model = math.multiply(math.orientation(position, forward, 0), math.transform(anatomy.bones[0].position.map((v) => -v)));
      const bones = math.boneMatrices(anatomy, pose);
      const jaw = anatomy.bones.findIndex((b) => b.id === "jaw");
      const origin = math.point(math.multiply(model, bones[jaw]), mouthPoint(anatomy));
      return { anatomy, pose, position, forward, origin };
    });
    const show = createSoulFireworks({
      elements: mix.elements,
      origins: dragons.map((w) => w.origin),
      altar: [0, ALTAR, 0],
      seed,
      result: mix.result,
      radius: dragons[0].anatomy.bounds.radius,
    });
    const R = show.radius;
    const camera = { eye: [R * 0.4, R * 0.5, R * 3.5], target: [0, R * 1.2, 0], fov: 0.85 };
    return { dragons, show, camera };
  }

  function draw(scene, t, style) {
    renderer.render({
      course,
      racers: scene.dragons.map(({ anatomy, pose, position, forward }) => ({ anatomy, pose, position, forward })),
      camera: scene.camera,
      style,
      time: t,
      fireworks: { show: scene.show, t },
    });
    renderer.finish();
  }

  window.__fireworks = {
    phases: fireworksPhases,
    frames(mix, style, moments) {
      const scene = stage(mix, "evidence");
      const sheet = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 });
      const context = sheet.getContext("2d");
      context.fillStyle = "#111";
      context.fillRect(0, 0, 1920, 1080);
      context.font = "22px system-ui";
      const images = moments.map(([name, t], k) => {
        draw(scene, t, style);
        const png = canvas.toDataURL("image/png");
        const x = (k % 3) * 640,
          y = Math.floor(k / 3) * 360;
        context.drawImage(canvas, x, y, 640, 360);
        context.fillStyle = "rgba(0,0,0,0.55)";
        context.fillRect(x, y, 220, 32);
        context.fillStyle = "#fff";
        context.fillText(`${name} · ${t.toFixed(1)} s`, x + 10, y + 24);
        return { name, t, png };
      });
      context.fillStyle = "#fff";
      context.fillText(`${mix.elements.join(" + ")} · result ${mix.result} · ${style} · ${scene.show.particleCount} particles`, 1290, 760);
      return { images, sheet: sheet.toDataURL("image/png") };
    },
    /** Records the whole show in real time at 30 fps into `window.__clip`. */
    async record(mix, style) {
      const scene = stage(mix, "evidence");
      canvas.width = 1280;
      canvas.height = 720;
      draw(scene, 0, style);
      const stream = canvas.captureStream(0);
      const [track] = stream.getVideoTracks();
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8e6 });
      const chunks = [];
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      const stopped = new Promise((done) => (recorder.onstop = done));
      recorder.start(1000);
      const start = performance.now();
      const count = Math.ceil((fireworksPhases.end + 0.8) * 30);
      let late = 0;
      for (let k = 0; k < count; k++) {
        draw(scene, k / 30 - 0.3, style);
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

const session = await launch({ url: "about:blank", width: 1300, height: 900 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  await evaluate(session, `(${setup.toString()})()`);
  for (const style of styles) {
    const directory = resolve(root, "shots", "altar", style);
    for (const id of mixes) {
      const mix = MIXES[id];
      if (frames) {
        const { images, sheet } = await evaluate(session, `window.__fireworks.frames(${JSON.stringify(mix)}, ${JSON.stringify(style)}, ${JSON.stringify(MOMENTS)})`);
        for (const image of images) await save(resolve(directory, `fireworks-${id}-${image.name}.png`), Buffer.from(image.png.split(",")[1], "base64"));
        await save(resolve(directory, `fireworks-${id}-sheet.png`), Buffer.from(sheet.split(",")[1], "base64"));
      }
      if (videos.includes(id)) {
        const stats = await evaluate(session, `window.__fireworks.record(${JSON.stringify(mix)}, ${JSON.stringify(style)})`);
        const parts = [];
        for (let offset = 0; offset < stats.bytes; offset += CHUNK) {
          const text = await evaluate(
            session,
            `(() => { const b = window.__clip.subarray(${offset}, ${offset + CHUNK}); let s = ""; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); })()`,
          );
          parts.push(Buffer.from(text, "base64"));
        }
        await save(resolve(directory, `fireworks-${id}.webm`), Buffer.concat(parts));
        console.log(style, id, JSON.stringify(stats));
      }
    }
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
}
