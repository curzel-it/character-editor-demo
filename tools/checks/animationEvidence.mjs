import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const base = process.argv[2] || "http://127.0.0.1:8094";
// Usage: animationEvidence.mjs [base] [strip|legs] [gene=value,...]; gene overrides suffix the file names.
const only = process.argv[3] && process.argv[3] !== "all" ? process.argv[3] : undefined;
const overrides = Object.fromEntries((process.argv[4] || "").split(",").filter(Boolean).map((pair) => {
  const [name, value] = pair.split("=");
  return [name, Number(value)];
}));
const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!await waitFor(session, "window.__checks", 10000)) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const evidence = { images: [], details: {} };
  for (const [name, run] of [["motion", capture], ["legs", captureLegs]]) {
    if (only && only !== name && !(name === "motion" && only !== "legs")) continue;
    const result = await evaluate(session, `(${run.toString()})(${JSON.stringify(only === "legs" ? null : only || null)}, ${JSON.stringify(overrides)})`);
    evidence.images.push(...result.images);
    evidence.details[name] = result.details;
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  for (const image of evidence.images) {
    const directory = resolve(root, "shots", "dragon", image.style);
    await mkdir(directory, { recursive: true });
    const suffix = Object.entries(overrides).map(([name, value]) => `-${name}${value}`).join("");
    const path = resolve(directory, image.name + suffix + ".png");
    await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
    console.log(path);
  }
  console.log(JSON.stringify(evidence.details));
} finally {
  await session.close();
}

async function capture(only, overrides = {}) {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette }, { flightStates, autoMotion }, { withAttitude }, { poseIssues }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/animate/flightStates.js"),
    import("/src/animate/flightAttitude.js"), import("/tools/checks/structure.mjs"),
  ]);
  const module = await loadSubject("dragon");
  const anatomy = module.createAnatomy({ ...makeGenome(module.genes, 2407), ...overrides });
  const canvas = Object.assign(document.createElement("canvas"), { width: 400, height: 280 });
  const renderer = createRenderer(canvas);
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const columns = 6, label = 22, frames = 12;
  const views = [["3/4", { yaw: -0.6, pitch: 0.25, zoom: 1.45 }], ["front", { yaw: -Math.PI / 2, pitch: 0.1, zoom: 1.7 }]];
  const strips = [
    ...flightStates.map((state) => ({ id: state.id, label: state.label, at: (k) => ({ t: k / frames, motion: { ...state.motion, time: 4 + k / frames / Math.max(0.35, (0.9 + 1.9 * (state.motion.effort ?? 0.5)) * (1 - (state.motion.glide ?? 0))) } }) })),
    { id: "auto", label: "Auto blend", at: (k) => { const time = k * 2.4; const { motion, label } = autoMotion(time); return { t: time * 1.4 % 1, motion, caption: label }; } },
  ].filter((strip) => !only || strip.id === only);
  const images = [], issues = [];
  try {
    for (const { id: style } of styles) {
      for (const strip of strips) {
        const rows = views.length * frames / columns;
        const sheet = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + label) * rows });
        const context = sheet.getContext("2d");
        context.fillStyle = rgb(palette.background);
        context.fillRect(0, 0, sheet.width, sheet.height);
        context.font = "13px system-ui";
        context.fillStyle = rgb(palette.ivory);
        views.forEach(([viewName, view], v) => {
          for (let k = 0; k < frames; k++) {
            const { t, motion, caption } = strip.at(k);
            const pose = module.pose(anatomy, t, motion);
            issues.push(...poseIssues(anatomy, pose).map((issue) => `${strip.id}: ${issue}`));
            renderer.render(anatomy, withAttitude(pose, motion), { style, ground: false, ...view });
            const index = v * frames + k;
            const x = index % columns * canvas.width, y = Math.floor(index / columns) * (canvas.height + label);
            context.drawImage(canvas, x, y);
            context.fillText(`${strip.label} · ${viewName} · ${caption || `phase ${t.toFixed(2)}`}`, x + 10, y + canvas.height + 16);
          }
        });
        images.push({ style, name: `motion-${strip.id}`, png: sheet.toDataURL("image/png") });
      }
    }
    return { images, details: { seed: 2407, overrides, frames, strips: strips.map((strip) => strip.id), issues } };
  } finally {
    renderer.dispose();
  }
}

/** Leg close-ups: side and front views of each flight state, then several seeds in key states. */
async function captureLegs(_only, overrides = {}) {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette }, { flightStates }, { boneMatrices, point }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/animate/flightStates.js"), import("/src/math3d.js"),
  ]);
  const module = await loadSubject("dragon");
  const canvas = Object.assign(document.createElement("canvas"), { width: 360, height: 300 });
  const renderer = createRenderer(canvas);
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const label = 22;
  const closeUp = (anatomy) => {
    const ids = anatomy.bones.map((bone) => bone.id), rest = boneMatrices(anatomy);
    const at = (id, p = [0, 0, 0]) => point(rest[ids.indexOf(id)], p);
    const hip = at("leg-hind-1"), toes = at("toes-hind-1");
    const center = hip.map((value, i) => (value + toes[i]) / 2);
    center[2] = 0;
    return { ...anatomy, bounds: { center, radius: 1.45 * Math.hypot(hip[0] - toes[0], hip[1] - toes[1]) } };
  };
  const views = [["side", { yaw: 0, pitch: 0.05, zoom: 1 }], ["front", { yaw: -Math.PI / 2, pitch: 0.12, zoom: 1 }], ["below", { yaw: -0.5, pitch: -0.55, zoom: 0.95 }]];
  const sheets = [
    { name: "legs-states", seeds: [2407], states: flightStates, views, phases: [0.1, 0.6] },
    { name: "legs-seeds", seeds: [1, 7, 42, 64, 99, 2407], states: flightStates.filter((state) => ["sprint", "glide", "exhausted"].includes(state.id)), views: views.slice(0, 2), phases: [0.35] },
  ];
  const images = [];
  try {
    for (const { id: style } of styles)
      for (const sheet of sheets) {
        const tiles = [];
        for (const seed of sheet.seeds) {
          const anatomy = module.createAnatomy({ ...makeGenome(module.genes, seed), ...overrides }), framed = closeUp(anatomy);
          for (const state of sheet.states)
            for (const phase of sheet.phases)
              for (const [viewName, view] of sheet.views)
                tiles.push({ framed, pose: module.pose(anatomy, phase, { ...state.motion, time: 6 + phase }), view, caption: `${sheet.seeds.length > 1 ? `seed ${seed} · ` : ""}${state.label} · ${viewName} · ${phase.toFixed(2)}` });
        }
        const columns = sheet.views.length * sheet.phases.length * (sheet.seeds.length > 1 ? sheet.states.length : 1);
        const out = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + label) * Math.ceil(tiles.length / columns) });
        const context = out.getContext("2d");
        context.fillStyle = rgb(palette.background);
        context.fillRect(0, 0, out.width, out.height);
        context.font = "13px system-ui";
        context.fillStyle = rgb(palette.ivory);
        tiles.forEach((tile, index) => {
          renderer.render(tile.framed, tile.pose, { style, ground: false, ...tile.view });
          const x = index % columns * canvas.width, y = Math.floor(index / columns) * (canvas.height + label);
          context.drawImage(canvas, x, y);
          context.fillText(tile.caption, x + 10, y + canvas.height + 16);
        });
        images.push({ style, name: sheet.name, png: out.toDataURL("image/png") });
      }
    return { images, details: { sheets: sheets.map((sheet) => sheet.name) } };
  } finally {
    renderer.dispose();
  }
}
