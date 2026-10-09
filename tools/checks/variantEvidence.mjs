import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Usage: variantEvidence.mjs [base] [heads|legs|feet|wingfingers|addons|all]
const base = process.argv[2] || "http://127.0.0.1:8094";
const mode = process.argv[3] || "all";
const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!await waitFor(session, "window.__checks", 10000)) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const evidence = { images: [], details: {} };
  for (const [name, run] of [["heads", capture], ["legs", captureLegs], ["feet", captureFeet], ["wingfingers", captureWingFingers], ["addons", captureAddons]]) {
    if (mode !== "all" && mode !== name) continue;
    const result = await evaluate(session, `(${run.toString()})(${sheetTools.toString()})`);
    evidence.images.push(...result.images);
    evidence.details[name] = result.details;
  }
  if (errors.length) throw new Error(errors.join("\n"));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  for (const image of evidence.images) {
    const directory = resolve(root, "shots", "dragon", image.style);
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, image.name + ".png");
    await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
    console.log(path);
  }
  console.log(JSON.stringify(evidence.details));
} finally {
  await session.close();
}

async function capture() {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette, dragonPalettes }] = await Promise.all([import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js")]);
  const module = await loadSubject("dragon");
  const choices = (name) => module.genes.find((gene) => gene.name === name).choices;
  const heads = choices("head"), headgear = choices("headgear");
  const baseGenome = { ...makeGenome(module.genes, 2407), ...dragonPalettes[0].genes, tailTip: 0, hindWings: 0 };
  const images = [];
  const headCenter = ({ bones }) => {
    const byId = new Map(bones.map((bone) => [bone.id, bone]));
    let position = [0.75, 0.05, 0];
    for (let bone = byId.get("head"); bone; bone = byId.get(bone.parent)) position = position.map((value, i) => value + bone.position[i]);
    return position;
  };
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const sheet = (canvas, count, columns) => {
    const result = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + 24) * Math.ceil(count / columns) });
    const context = result.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, result.width, result.height);
    context.font = "14px system-ui";
    context.fillStyle = rgb(palette.ivory);
    return { result, context, columns, canvas };
  };
  const tile = (target, index, label) => {
    const { canvas } = target;
    const x = index % target.columns * canvas.width, y = Math.floor(index / target.columns) * (canvas.height + 24);
    target.context.drawImage(canvas, x, y);
    target.context.fillText(label, x + 10, y + canvas.height + 17);
  };
  const close = Object.assign(document.createElement("canvas"), { width: 420, height: 320 });
  const small = Object.assign(document.createElement("canvas"), { width: 120, height: 90 });
  const closeRenderer = createRenderer(close), smallRenderer = createRenderer(small);
  try {
    for (const { id: style } of styles) {
      const headOn = { style, yaw: -0.95, pitch: 0.18, zoom: 1, ground: false };
      const profile = { style, yaw: -0.6, pitch: 0.2, zoom: 1.25, ground: false };
      const count = heads.length * headgear.length, columns = headgear.length;
      const grid = sheet(close, count, columns), portraits = sheet(close, count, columns);
      heads.forEach((head, h) => headgear.forEach((gear, k) => {
        const anatomy = module.createAnatomy({ ...baseGenome, head: h, headgear: k });
        closeRenderer.render(anatomy, module.pose(anatomy, 0.75), profile);
        tile(grid, h * columns + k, `${head} + ${gear}`);
        closeRenderer.render({ ...anatomy, bounds: { center: headCenter(anatomy), radius: 1.25 } }, module.pose(anatomy, 0.75), headOn);
        tile(portraits, h * columns + k, `${head} + ${gear}`);
      }));
      images.push({ style, name: "variants", png: grid.result.toDataURL("image/png") });
      images.push({ style, name: "variantHeads", png: portraits.result.toDataURL("image/png") });
      const crowd = sheet(small, 100, 10);
      for (let seed = 1; seed <= 100; seed++) {
        const anatomy = module.createAnatomy(makeGenome(module.genes, seed));
        smallRenderer.render(anatomy, module.pose(anatomy, 0.2), { style, ground: false, background: palette.background });
        tile(crowd, seed - 1, String(seed));
      }
      images.push({ style, name: "hundred", png: crowd.result.toDataURL("image/png") });
    }
    return { images, details: { seed: 2407, heads, headgear, styles: styles.map((style) => style.id) } };
  } finally {
    closeRenderer.dispose();
    smallRenderer.dispose();
  }
}

/** Shared sheet drawing for the part-variant captures (serialised into the page with each capture). */
function sheetTools(palette) {
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  return (canvas, tiles, columns, label = 22) => {
    const out = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + label) * Math.ceil(tiles.length / columns) });
    const context = out.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, out.width, out.height);
    context.font = "13px system-ui";
    context.fillStyle = rgb(palette.ivory);
    tiles.forEach((draw, index) => {
      const caption = draw();
      const x = index % columns * canvas.width, y = Math.floor(index / columns) * (canvas.height + label);
      context.drawImage(canvas, x, y);
      context.fillText(caption, x + 10, y + canvas.height + 16);
    });
    return out.toDataURL("image/png");
  };
}

/** Leg shapes: side, front and below close-ups in sprint, glide and exhausted flight. */
async function captureLegs(sheetTools) {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette, dragonPalettes }, { flightStates }, { boneMatrices, point }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/animate/flightStates.js"), import("/src/math3d.js"),
  ]);
  const module = await loadSubject("dragon");
  const shapes = module.genes.find((gene) => gene.name === "legShape").choices;
  const genome = { ...makeGenome(module.genes, 2407), ...dragonPalettes[0].genes, tailTip: 0, hindWings: 0 };
  const canvas = Object.assign(document.createElement("canvas"), { width: 340, height: 300 });
  const renderer = createRenderer(canvas);
  const draw = sheetTools(palette);
  const views = [["side", { yaw: 0.05, pitch: -0.3, zoom: 1 }], ["front", { yaw: -Math.PI / 2, pitch: -0.95, zoom: 1 }], ["rear", { yaw: Math.PI / 2, pitch: -0.15, zoom: 1 }], ["below", { yaw: -0.5, pitch: -0.7, zoom: 1 }]];
  const states = flightStates.filter((state) => ["sprint", "glide", "exhausted"].includes(state.id));
  const images = [];
  try {
    for (const { id: style } of styles) {
      const tiles = [];
      shapes.forEach((shape, legShape) => {
        const anatomy = module.createAnatomy({ ...genome, legShape, feet: 0 });
        const ids = anatomy.bones.map((bone) => bone.id);
        for (const state of states)
          for (const [viewName, view] of views)
            tiles.push(() => {
              const pose = module.pose(anatomy, 0.2, { ...state.motion, time: 6.2 });
              const posed = boneMatrices(anatomy, pose);
              const at = (id) => point(posed[ids.indexOf(id)], [0, 0, 0]);
              const hip = at("leg-hind-1"), toes = at("toes-hind-1");
              const center = hip.map((value, i) => (value + toes[i]) / 2);
              center[2] = 0;
              renderer.render({ ...anatomy, bounds: { center, radius: 2.1 } }, pose, { style, ground: false, ...view });
              return `${shape} · ${state.label} · ${viewName}`;
            });
      });
      images.push({ style, name: "variant-legs", png: draw(canvas, tiles, views.length * states.length) });
    }
    return { images, details: { seed: 2407, shapes } };
  } finally {
    renderer.dispose();
  }
}

/** Feet: close-ups of the right foot open in a glide, gripping at a sprint, tucked in a dive and dangling when exhausted. */
async function captureFeet(sheetTools) {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette, dragonPalettes }, { boneMatrices, point }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/math3d.js"),
  ]);
  const module = await loadSubject("dragon");
  const types = module.genes.find((gene) => gene.name === "feet").choices;
  const genome = { ...makeGenome(module.genes, 2407), ...dragonPalettes[0].genes, legShape: 0, tailTip: 0, hindWings: 0 };
  const canvas = Object.assign(document.createElement("canvas"), { width: 320, height: 270 });
  const renderer = createRenderer(canvas);
  const draw = sheetTools(palette);
  const glide = { effort: 0.15, glide: 1, time: 6 };
  const frames = [
    { label: "open · side", t: 0.2, motion: glide, view: { yaw: 0.05, pitch: -0.1 } },
    { label: "open · below", t: 0.2, motion: glide, view: { yaw: -0.4, pitch: -1.1 } },
    { label: "open · rear", t: 0.2, motion: glide, view: { yaw: Math.PI / 2 + 0.3, pitch: -0.2 } },
    { label: "gripping · sprint", t: 0.45, motion: { effort: 1, time: 6.45 }, view: { yaw: 0.25, pitch: -0.35 } },
    { label: "tucked · dive", t: 0.3, motion: { effort: 0.6, climb: -0.8, time: 6.3 }, view: { yaw: 0.25, pitch: -0.35 } },
    { label: "dangling · exhausted", t: 0.6, motion: { effort: 0.45, fatigue: 1, time: 6.6 }, view: { yaw: -0.3, pitch: -0.2 } },
  ];
  const images = [];
  try {
    for (const { id: style } of styles) {
      const tiles = [];
      types.forEach((type, feet) => {
        const anatomy = module.createAnatomy({ ...genome, feet });
        const ids = anatomy.bones.map((bone) => bone.id);
        for (const frame of frames)
          tiles.push(() => {
            const pose = module.pose(anatomy, frame.t, frame.motion);
            const posed = boneMatrices(anatomy, pose);
            const center = point(posed[ids.indexOf("toes-hind-1")], [-0.25, -0.2, 0]);
            renderer.render({ ...anatomy, bounds: { center, radius: 1.05 } }, pose, { style, ground: false, zoom: 1, ...frame.view });
            return `${type} · ${frame.label}`;
          });
      });
      images.push({ style, name: "variant-feet", png: draw(canvas, tiles, frames.length) });
    }
    return { images, details: { seed: 2407, types } };
  } finally {
    renderer.dispose();
  }
}

/** Wing fingers: close-ups of the right wrist spread in a glide, folded on the upstroke and tucked in a dive. */
async function captureWingFingers(sheetTools) {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette, dragonPalettes }, { boneMatrices, point }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/math3d.js"),
  ]);
  const module = await loadSubject("dragon");
  const joints = module.genes.find((gene) => gene.name === "wingFingers").choices;
  const genome = { ...makeGenome(module.genes, 2407), ...dragonPalettes[0].genes, tailTip: 0, hindWings: 0 };
  const canvas = Object.assign(document.createElement("canvas"), { width: 320, height: 260 });
  const renderer = createRenderer(canvas);
  const draw = sheetTools(palette);
  const frames = [
    { label: "open · above", t: 0.1, motion: { effort: 0.15, glide: 1, time: 6 }, view: { yaw: -0.9, pitch: 0.75 } },
    { label: "open · front", t: 0.1, motion: { effort: 0.15, glide: 1, time: 6 }, view: { yaw: -1.35, pitch: 0.1 } },
    { label: "open · below", t: 0.1, motion: { effort: 0.15, glide: 1, time: 6 }, view: { yaw: -0.6, pitch: -0.6 } },
    { label: "upstroke fold", t: 0.62, motion: { effort: 1 }, view: { yaw: -0.9, pitch: 0.35 } },
    { label: "dive tuck", t: 0.3, motion: { effort: 0.6, climb: -0.8 }, view: { yaw: -0.4, pitch: 0.3 } },
  ];
  const images = [];
  try {
    for (const { id: style } of styles) {
      const tiles = [];
      joints.forEach((joint, wingFingers) => {
        const anatomy = module.createAnatomy({ ...genome, wingFingers });
        const index = anatomy.bones.findIndex((bone) => bone.id === "wing-wrist-1");
        for (const frame of frames)
          tiles.push(() => {
            const pose = module.pose(anatomy, frame.t, frame.motion);
            const center = point(boneMatrices(anatomy, pose)[index], [0, 0, 0]);
            renderer.render({ ...anatomy, bounds: { center, radius: 1.3 } }, pose, { style, ground: false, zoom: 1, ...frame.view });
            return `${joint} · ${frame.label}`;
          });
      });
      images.push({ style, name: "variant-wingfingers", png: draw(canvas, tiles, frames.length) });
    }
    return { images, details: { seed: 2407, joints } };
  } finally {
    renderer.dispose();
  }
}

/** Addon slots: tail tips close up, and hind wings on the whole dragon through the stroke. */
async function captureAddons(sheetTools) {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette, dragonPalettes }, { boneMatrices, point }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/math3d.js"),
  ]);
  const module = await loadSubject("dragon");
  const tips = module.genes.find((gene) => gene.name === "tailTip").choices;
  const wings = module.genes.find((gene) => gene.name === "hindWings").choices;
  const genome = { ...makeGenome(module.genes, 2407), ...dragonPalettes[0].genes, tailTip: 0, hindWings: 0 };
  const canvas = Object.assign(document.createElement("canvas"), { width: 320, height: 260 });
  const renderer = createRenderer(canvas);
  const draw = sheetTools(palette);
  const glide = { effort: 0.15, glide: 1, time: 6 };
  const tipViews = [
    { label: "side", view: { yaw: 0.05, pitch: 0.05 } },
    { label: "above", view: { yaw: -0.5, pitch: 0.9 } },
    { label: "below", view: { yaw: -0.5, pitch: -0.9 } },
  ];
  const wingFrames = [
    { label: "glide · above", t: 0.1, motion: glide, view: { yaw: -0.7, pitch: 0.8 } },
    { label: "downstroke", t: 0.25, motion: { effort: 1, time: 6.25 }, view: { yaw: -0.4, pitch: 0.25 } },
    { label: "upstroke", t: 0.7, motion: { effort: 1, time: 6.7 }, view: { yaw: -0.4, pitch: 0.25 } },
    { label: "dive", t: 0.3, motion: { effort: 0.6, climb: -0.8, time: 6.3 }, view: { yaw: -0.4, pitch: 0.3 } },
    { label: "rear", t: 0.1, motion: glide, view: { yaw: Math.PI / 2 + 0.3, pitch: 0.15 } },
  ];
  const images = [];
  try {
    for (const { id: style } of styles) {
      const tipTiles = [];
      tips.forEach((tip, tailTip) => {
        const anatomy = module.createAnatomy({ ...genome, tailTip });
        const index = anatomy.bones.findIndex((bone) => bone.id === "tail-6");
        for (const { label, view } of tipViews)
          tipTiles.push(() => {
            const pose = module.pose(anatomy, 0.1, glide);
            const center = point(boneMatrices(anatomy, pose)[index], [-0.9, 0, 0]);
            renderer.render({ ...anatomy, bounds: { center, radius: 1.5 } }, pose, { style, ground: false, zoom: 1, ...view });
            return `${tip} · ${label}`;
          });
      });
      images.push({ style, name: "variant-tailtips", png: draw(canvas, tipTiles, tipViews.length) });
      const wingTiles = [];
      wings.forEach((wing, hindWings) => {
        const anatomy = module.createAnatomy({ ...genome, hindWings, tailTip: hindWings ? 1 : 0 });
        const index = anatomy.bones.findIndex((bone) => bone.id === "tail-0");
        for (const frame of wingFrames)
          for (const close of [false, true])
            wingTiles.push(() => {
              const pose = module.pose(anatomy, frame.t, frame.motion);
              const bounds = close ? { center: point(boneMatrices(anatomy, pose)[index], [-1, 0, 0]), radius: 4.2 } : anatomy.bounds;
              renderer.render({ ...anatomy, bounds }, pose, { style, ground: false, zoom: 1.1, ...frame.view });
              return `${wing} · ${frame.label}${close ? " · close" : ""}`;
            });
      });
      images.push({ style, name: "variant-hindwings", png: draw(canvas, wingTiles, wingFrames.length * 2) });
    }
    return { images, details: { seed: 2407, tips, wings } };
  } finally {
    renderer.dispose();
  }
}
