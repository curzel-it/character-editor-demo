import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Ground breath evidence at 1080p: the whole move per seed from the side, front and three-quarter
// views, the breath held across seeds and ages, and a WebM of the move.
//   node tools/checks/groundBreathEvidence.mjs [base] [--style cozy|lowPoly] [--no-video]
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = args.find((a) => a.startsWith("http")) || "http://127.0.0.1:8094";
const styles = option("style") ? [option("style")] : ["cozy"];
const video = !args.includes("--no-video");
const CHUNK = 4 << 20;
const root = fileURLToPath(new URL("../../", import.meta.url));

async function save(style, name, buffer) {
  const directory = resolve(root, "shots", "dragon", style);
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, name);
  await writeFile(path, buffer);
  console.log(path);
}

const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  await evaluate(session, `(${stage.toString()})()`);
  for (const style of styles) {
    const sheets = await evaluate(session, `window.__groundBreath.sheets(${JSON.stringify(style)})`);
    for (const sheet of sheets.images) await save(style, `${sheet.name}.png`, Buffer.from(sheet.png.split(",")[1], "base64"));
    if (sheets.issues.length) console.log(JSON.stringify(sheets.issues));
    if (!video) continue;
    await evaluate(session, `window.__groundBreath.record(${JSON.stringify(style)})`);
    if (!(await waitFor(session, "window.__clip && window.__clip.done", 60000))) throw new Error("MediaRecorder did not finish");
    const size = await evaluate(session, "window.__clip.bytes.length");
    const parts = [];
    for (let offset = 0; offset < size; offset += CHUNK) {
      const text = await evaluate(
        session,
        `(() => { const b = window.__clip.bytes.subarray(${offset}, ${offset + CHUNK}); let s = ""; for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768)); return btoa(s); })()`,
      );
      parts.push(Buffer.from(text, "base64"));
    }
    await save(style, "groundBreath.webm", Buffer.concat(parts));
  }
  if (errors.length) throw new Error(errors.join("\n"));
} finally {
  await session.close();
}

async function stage() {
  const [{ createRenderer }, { loadSubject, makeGenome }, { palette }, { boneMatrices }, { poseIssues }, ground, { breathEmitter }, { lowestPoint }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/math3d.js"),
    import("/tools/checks/structure.mjs"), import("/src/animate/dragonGroundBreath.js"), import("/src/scene/breathPlume.js"), import("/src/scene/groundContact.js"),
  ]);
  const module = await loadSubject("dragon");
  const { groundBreathCue, groundBreathLength, strikeDistance } = ground;
  const W = 1920, H = 1080, label = 22;
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const views = [["side", { yaw: 0, pitch: 0.06 }], ["front", { yaw: -Math.PI / 2 + 0.25, pitch: 0.12 }], ["3/4", { yaw: -0.75, pitch: 0.2 }]];
  const RAY = 14;

  /** The dragon on a stone floor with a gold mark at its breath target and a ray of dots along its plume axis. */
  function staged(seed, { age = "adult", ahead = 1, side = 0 } = {}) {
    const anatomy = module.createAnatomy(makeGenome(module.genes, seed), { age });
    const floor = lowestPoint(anatomy, module.pose(anatomy, 0, { effort: 0, glide: 1, stand: 1 }), anatomy.bones[0].position, [1, 0, 0]);
    const rootAt = anatomy.bones[0].position;
    const reach = rootAt[1] - floor;
    const target = [rootAt[0] + ahead * strikeDistance(anatomy), floor, side];
    const extra = [
      { id: "stage-floor", parent: null, position: [0.5 * (rootAt[0] + target[0]), floor - 0.03, 0], rotation: [0, 0, 0] },
      { id: "stage-mark", parent: null, position: target, rotation: [0, 0, 0] },
      { id: "stage-ray", parent: null, position: [0, 0, 0], rotation: [0, 0, 0] },
    ];
    const parts = [
      { id: "stage-floor", bone: "stage-floor", shape: "cylinder", position: [0, 0, 0], scale: [1.5 * reach, 0.03, 1.2 * reach], color: palette.steel },
      { id: "stage-mark", bone: "stage-mark", shape: "cylinder", position: [0, 0.04, 0], scale: [0.35, 0.04, 0.35], color: palette.gold },
      { id: "stage-mark-pin", bone: "stage-mark", shape: "cone", position: [0, 0.35, 0], scale: [0.08, 0.3, 0.08], color: palette.gold },
      ...Array.from({ length: RAY }, (_, i) => ({
        id: `stage-ray-${i}`, bone: "stage-ray", shape: "ellipsoid", position: [(i + 0.5) / RAY, 0, 0], scale: [0.012, 0.004, 0.004], color: palette.hatchGlow,
      })),
    ];
    const center = [0.5 * (rootAt[0] + target[0]) - 0.35 * reach, floor + 0.6 * reach, 0.3 * side];
    return {
      anatomy,
      target,
      scene: { ...anatomy, bones: [...anatomy.bones, ...extra], parts: [...anatomy.parts, ...parts], bounds: { center, radius: 1.15 * reach } },
    };
  }

  function frame(set, age) {
    const cue = groundBreathCue(age);
    const motion = { effort: 0, glide: 1, ...cue, breathTarget: set.target, time: 20 + age };
    const pose = module.pose(set.anatomy, (age * 0.5) % 1, motion);
    const matrices = boneMatrices(set.anatomy, pose);
    const e = breathEmitter({ anatomy: set.anatomy, breath: {} }, matrices, new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]));
    const d = Math.hypot(...set.target.map((v, k) => v - e.origin[k]));
    const yaw = -Math.atan2(e.direction[2], e.direction[0]), pitch = Math.asin(e.direction[1]);
    const reach = Math.max(1e-3, d * cue.breath);
    const bones = { ...pose.bones, "stage-ray": { position: e.origin, rotation: [0, yaw, pitch], scale: reach } };
    return { pose: { bones }, raw: pose, cue, mouth: e.origin };
  }

  const canvasOf = (w, h) => Object.assign(document.createElement("canvas"), { width: w, height: h });
  function sheet(tiles, columns, rows, renderer, canvas, style) {
    const out = canvasOf(W, H), context = out.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, W, H);
    context.font = "14px system-ui";
    context.fillStyle = rgb(palette.ivory);
    const w = W / columns, h = H / rows;
    tiles.forEach((tile, index) => {
      renderer.render(tile.scene, tile.pose, { style, ground: false, zoom: 1, ...tile.view });
      const x = (index % columns) * w, y = Math.floor(index / columns) * h;
      context.drawImage(canvas, x, y);
      context.fillText(tile.caption, x + 10, y + h - 7);
    });
    return out.toDataURL("image/png");
  }

  window.__groundBreath = {
    sheets(style) {
      const images = [], issues = [];
      const times = [0, 1.0, 1.9, 3.4, 5.9];
      const canvas = canvasOf(W / 3, H / times.length - label), renderer = createRenderer(canvas);
      const small = canvasOf(W / 3, H / 4 - label), grid = createRenderer(small);
      try {
        const check = (set, f, what) => issues.push(...poseIssues(set.anatomy, f.raw).map((issue) => `${what}: ${issue}`));
        for (const seed of [2407, 42, 7]) {
          const set = staged(seed);
          const tiles = times.flatMap((age) => views.map(([viewName, view]) => {
            const f = frame(set, age);
            check(set, f, `seed ${seed} t ${age}`);
            return { scene: set.scene, pose: f.pose, view, caption: `seed ${seed} · ${viewName} · t ${age.toFixed(1)} s · crouch ${f.cue.crouch.toFixed(2)} · breath ${f.cue.breath.toFixed(2)}` };
          }));
          images.push({ name: `groundBreath-seed${seed}`, png: sheet(tiles, 3, times.length, renderer, canvas, style) });
        }
        const held = (list, name) => {
          const tiles = list.flatMap(([caption, options, seed]) => views.map(([viewName, view]) => {
            const set = staged(seed, options), f = frame(set, 3.4);
            check(set, f, caption);
            return { scene: set.scene, pose: f.pose, view, caption: `${caption} · ${viewName} · breath held` };
          }));
          images.push({ name, png: sheet(tiles, 3, 4, grid, small, style) });
        };
        held([["seed 1", {}, 1], ["seed 64", {}, 64], ["seed 99", {}, 99], ["seed 5", {}, 5]], "groundBreath-seeds");
        const variety = [
          ["teen 2407", { age: "teen" }, 2407], ["teen 42 near", { age: "teen", ahead: 0.75 }, 42],
          ["adult 2407 far left", { ahead: 1.5, side: 5 }, 2407], ["adult 42 near right", { ahead: 0.75, side: -3 }, 42],
        ];
        held(variety, "groundBreath-variety");
      } finally {
        renderer.dispose();
        grid.dispose();
      }
      const big = canvasOf(W, H), hero = createRenderer(big);
      try {
        for (const [name, age] of [["stand", 0], ["crouch", 1.9], ["hold", 3.4]]) {
          const set = staged(2407), f = frame(set, age);
          hero.render(set.scene, f.pose, { style, ground: false, zoom: 1, ...views[2][1] });
          images.push({ name: `groundBreath-hero-${name}`, png: big.toDataURL("image/png") });
        }
      } finally {
        hero.dispose();
      }
      return { images, issues };
    },
    record(style) {
      const canvas = canvasOf(W, H);
      const renderer = createRenderer(canvas);
      const set = staged(2407);
      const stream = canvas.captureStream(30);
      const type = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 12e6 });
      const chunks = [];
      window.__clip = { done: false };
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = async () => {
        renderer.dispose();
        window.__clip.bytes = new Uint8Array(await new Blob(chunks, { type: "video/webm" }).arrayBuffer());
        window.__clip.done = true;
      };
      const start = performance.now();
      const draw = () => {
        const age = (performance.now() - start) / 1000;
        if (age > groundBreathLength + 0.5) return recorder.stop();
        const f = frame(set, age);
        const swing = -1.1 + 0.9 * (age / groundBreathLength);
        renderer.render(set.scene, f.pose, { style, ground: false, zoom: 1.1, yaw: swing, pitch: 0.16 });
        requestAnimationFrame(draw);
      };
      recorder.start(1000);
      requestAnimationFrame(draw);
      return 0;
    },
  };
  return 0;
}
