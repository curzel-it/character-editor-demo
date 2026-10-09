import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
if (args.includes("--help")) {
  console.log("node tools/checks/slumberEvidence.mjs --url http://127.0.0.1:8094 --style cozy|lowPoly|all --seeds 2407,11,305 --ages kid,teen,adult --only views|loop|transition|close|yard");
  process.exit(0);
}
const base = option("--url", "http://127.0.0.1:8094");
const style = option("--style", "cozy");
const settings = {
  styles: style === "all" ? ["cozy", "lowPoly"] : [style],
  seeds: option("--seeds", "2407,11,305").split(",").map(Number),
  ages: option("--ages", "kid,teen,adult").split(","),
  only: option("--only", null),
};
const session = await launch({ url: "about:blank", width: 1920, height: 1080 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const root = fileURLToPath(new URL("../../", import.meta.url));
  for (const id of settings.styles) {
    const images = await evaluate(session, `(${capture.toString()})(${JSON.stringify({ ...settings, style: id })})`);
    if (errors.length) throw new Error(errors.join("\n"));
    const directory = resolve(root, "shots", "dragon", id);
    await mkdir(directory, { recursive: true });
    for (const image of images) {
      const path = resolve(directory, `${image.name}.png`);
      await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
      console.log(path);
    }
  }
} finally {
  await session.close();
}

async function capture({ style, seeds, ages, only }) {
  const [{ createRenderer }, { createSceneRenderer }, { loadSubject, makeGenome }, { palette }, { createStableYard }, { lowestPoint }, { boneMatrices }, { slumberLoop }] =
    await Promise.all([
      import("/src/render.js"), import("/src/scene.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/scene/stableYard.js"),
      import("/src/scene/groundContact.js"), import("/src/math3d.js"), import("/src/animate/dragonSlumber.js"),
    ]);
  const module = await loadSubject("dragon");
  const W = 1920,
    H = 1080;
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const cell = Object.assign(document.createElement("canvas"), { width: W / 2, height: H / 2 });
  const renderer = createRenderer(cell);
  const views = {
    side: { yaw: 0, pitch: 0.02 },
    top: { yaw: 0, pitch: 1.5 },
    front: { yaw: -Math.PI / 2, pitch: 0.08 },
    "3/4": { yaw: -0.6, pitch: 0.3 },
  };
  const resting = (time, sleep) => ({ effort: 0, glide: 1, stand: 1, sleep, time });
  /** Lays `frames` out in a grid; with `compare`, every row is two frames and their difference. */
  const sheet = (columns, rows, frames, compare = false) => {
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const context = canvas.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, W, H);
    const w = W / columns,
      h = H / rows;
    cell.width = w;
    cell.height = h;
    const cells = compare ? frames.flatMap((frame, i) => (i % 2 ? [frame, { ...frame, difference: frames[i - 1] }] : [frame])) : frames;
    cells.forEach(({ anatomy, t = 0, motion, view, zoom, label, focus, bounds, difference }, index) => {
      const x = (index % columns) * w,
        y = Math.floor(index / columns) * h;
      if (difference) {
        context.drawImage(canvas, x - 2 * w, y, w, h, x, y, w, h);
        context.globalCompositeOperation = "difference";
        context.drawImage(canvas, x - w, y, w, h, x, y, w, h);
        context.globalCompositeOperation = "source-over";
        context.font = "22px system-ui";
        context.fillStyle = rgb(palette.ivory);
        context.fillText("difference: what the breath moves", x + 14, y + h - 16);
        return;
      }
      const pose = module.pose(anatomy, t, motion);
      anatomy.bounds = bounds ?? framing(anatomy, pose, focus);
      renderer.render(anatomy, pose, { style, ground: false, zoom, ...(view ?? faceView(anatomy, pose)) });
      context.drawImage(cell, x, y);
      context.font = "22px system-ui";
      context.fillStyle = rgb(palette.ivory);
      context.fillText(label, x + 14, y + h - 16);
    });
    return canvas.toDataURL("image/png");
  };
  /** Bounds around the posed skeleton, so a dragon lying down stays centred. */
  const framing = (anatomy, pose, focus) => {
    const matrices = boneMatrices(anatomy, pose);
    if (focus) {
      const m = matrices[anatomy.bones.findIndex((bone) => bone.id === focus)];
      return { center: [m[12], m[13], m[14]], radius: anatomy.scale * 1.2 };
    }
    const lo = [0, 1, 2].map((k) => Math.min(...matrices.map((m) => m[12 + k]))),
      hi = [0, 1, 2].map((k) => Math.max(...matrices.map((m) => m[12 + k])));
    return { center: lo.map((v, k) => (v + hi[k]) / 2), radius: 0.5 * Math.hypot(...hi.map((v, k) => v - lo[k])) };
  };
  /** A view onto the cheek that faces up, wherever the head has turned. */
  const faceView = (anatomy, pose) => {
    const m = boneMatrices(anatomy, pose)[anatomy.bones.findIndex((bone) => bone.id === "head")];
    const cheek = Math.sign(m[9]) || 1;
    const x = cheek * m[8] + 0.5 * m[0],
      z = cheek * m[10] + 0.5 * m[2];
    return { yaw: Math.atan2(-x, z), pitch: 0.55 };
  };
  const zoomOf = { kid: 1.1, teen: 1.1, adult: 1.1 };
  const images = [];
  const wants = (name) => !only || only === name;
  for (const age of ages)
    for (const seed of seeds) {
      const anatomy = module.createAnatomy(makeGenome(module.genes, seed), { age });
      const loop = slumberLoop(anatomy),
        breath = loop / 6,
        zoom = zoomOf[age];
      const tag = `${age}-${seed}`;
      if (wants("views"))
        images.push({
          name: `slumber-views-${tag}`,
          png: sheet(3, 2, [
            ...Object.entries(views).map(([name, view]) => ({ anatomy, motion: resting(0.5 * breath, 1), view, zoom, label: `${tag} asleep · ${name}` })),
            { anatomy, motion: resting(0.5 * breath, 1), view: { yaw: Math.PI + 0.6, pitch: 0.3 }, zoom, label: `${tag} asleep · 3/4 other side` },
            { anatomy, motion: resting(0.5 * breath, 1), focus: "head", zoom: 1, label: `${tag} asleep · face` },
          ]),
        });
      if (wants("loop")) {
        const bounds = framing(anatomy, module.pose(anatomy, 0, resting(0, 1)));
        const frames = [];
        for (const [name, view] of [["side", views.side], ["front", views.front]])
          for (const [label, phase] of [["breathed out", 0], ["breathed in", 0.45]])
            frames.push({ anatomy, motion: resting(phase * breath, 1), view, zoom, bounds, label: `${tag} ${name} · ${label}` });
        images.push({ name: `slumber-loop-${tag}`, png: sheet(3, 2, frames, true) });
      }
      if (wants("transition"))
        images.push({
          name: `slumber-transition-${tag}`,
          png: sheet(4, 2, [0, 0.3, 0.6, 1, 0, 0.3, 0.6, 1].map((sleep, k) => ({
            anatomy,
            motion: resting(2 * breath, sleep),
            view: k < 4 ? views["3/4"] : views.side,
            zoom,
            label: `${tag} sleep ${sleep}`,
          }))),
        });
      if (wants("close"))
        images.push({
          name: `slumber-close-${tag}`,
          png: sheet(3, 2, [0, 0.5, 0.7, 0.8, 0.9, 1].map((sleep) => ({ anatomy, motion: resting(0.5 * breath, sleep), focus: "head", zoom: 1, label: `${tag} eyes · sleep ${sleep}` }))),
        });
    }
  if (wants("lids")) {
    const frames = [];
    for (const age of ["kid", "teen", "adult"])
      for (const head of age === "kid" ? [0] : [0, 1, 2, 3, 4]) {
        const anatomy = module.createAnatomy({ ...makeGenome(module.genes, seeds[0]), head }, { age });
        frames.push({ anatomy, motion: resting(1, 0), view: { yaw: -0.9, pitch: 0.55 }, focus: "head", zoom: 1, label: `${age} head ${head} awake: no lid showing` });
      }
    images.push({ name: "slumber-lids-awake", png: sheet(4, 3, frames) });
  }
  if (wants("yard")) {
    const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
    const scene = createSceneRenderer(canvas);
    const yard = createStableYard(1);
    const spot = yard.spots[0];
    for (const seed of seeds)
      for (const age of ages)
        for (const [label, time] of [["asleep", 3], ["waking", 0]]) {
          const anatomy = module.createAnatomy(makeGenome(module.genes, seed), { age });
          const pose = module.pose(anatomy, time % 1, resting(time, label === "asleep" ? 1 : 0.45));
          const lift = 0.02 - lowestPoint(anatomy, pose, spot.position, spot.forward);
          const { radius } = framing(anatomy, pose);
          const distance = 2.4 * Math.max(radius, 2.2 * anatomy.scale);
          const target = [spot.position[0], 0.25 * radius, spot.position[2]];
          const eye = [target[0] + 0.45 * distance, 0.45 * distance, target[2] + 0.85 * distance];
          scene.render({ course: yard.course, racers: [{ anatomy, pose, position: [spot.position[0], lift, spot.position[2]], forward: spot.forward }], camera: { eye, target, fov: 0.6 }, style, time });
          images.push({ name: `slumber-yard-${age}-${seed}${label === "asleep" ? "" : "-lying-down"}`, png: canvas.toDataURL("image/png") });
        }
  }
  renderer.dispose?.();
  return images;
}
