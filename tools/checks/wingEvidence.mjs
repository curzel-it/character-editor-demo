import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const base = process.argv[2] || "http://127.0.0.1:8094";
const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!await waitFor(session, "window.__checks", 10000)) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const evidence = await evaluate(session, `(${capture.toString()})()`);
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
  const baseGenome = makeGenome(module.genes, 2407);
  const canvas = Object.assign(document.createElement("canvas"), { width: 448, height: 326 });
  const renderer = createRenderer(canvas);
  const images = [];
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const sheet = (count, columns) => {
    const result = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + 26) * Math.ceil(count / columns) });
    const context = result.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, result.width, result.height);
    context.font = "15px system-ui";
    context.fillStyle = rgb(palette.ivory);
    return { result, context, columns };
  };
  const tile = (target, index, label) => {
    const x = index % target.columns * canvas.width, y = Math.floor(index / target.columns) * (canvas.height + 26);
    target.context.drawImage(canvas, x, y);
    target.context.fillText(label, x + 12, y + canvas.height + 18);
  };
  try {
    for (const { id: style } of styles) {
      const options = { style, yaw: -0.6, pitch: 0.2, zoom: 1.25, ground: false };
      const presets = sheet(dragonPalettes.length, 4);
      for (const [index, preset] of dragonPalettes.entries()) {
        const anatomy = module.createAnatomy({ ...baseGenome, ...preset.genes });
        renderer.render(anatomy, module.pose(anatomy, 0.75), options);
        tile(presets, index, preset.label);
      }
      images.push({ style, name: "palettes", png: presets.result.toDataURL("image/png") });
      const cycle = sheet(24, 6);
      const anatomy = module.createAnatomy({ ...baseGenome, ...dragonPalettes[0].genes });
      for (let frame = 0; frame < 24; frame++) {
        renderer.render(anatomy, module.pose(anatomy, frame / 24), options);
        tile(cycle, frame, `t = ${(frame / 24).toFixed(3)} s`);
      }
      images.push({ style, name: "wingCycle", png: cycle.result.toDataURL("image/png") });
    }
    const gl = canvas.getContext("webgl2");
    const code = gl.getError();
    if (code !== gl.NO_ERROR) throw new Error(`WebGL error ${code}`);
    return { images, details: { seed: 2407, paletteCount: dragonPalettes.length, framesPerCycle: 24, styles: styles.map((style) => style.id), renderer: renderer.info } };
  } finally {
    renderer.dispose();
  }
}
