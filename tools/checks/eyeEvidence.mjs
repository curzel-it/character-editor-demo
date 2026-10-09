import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Usage: node tools/checks/eyeEvidence.mjs [base]
const base = process.argv[2] || "http://127.0.0.1:8094";
const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const images = await evaluate(session, `(${capture.toString()})()`);
  if (errors.length) throw new Error(errors.join("\n"));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  for (const image of images) {
    const directory = resolve(root, "shots", "dragon", image.style);
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `eyes-${image.coat}.png`);
    await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
    console.log(path);
  }
} finally {
  await session.close();
}

/** Head close-ups per style and coat: columns are eye colours, rows are every head and the kid's. */
async function capture() {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette, dragonEyes, dragonPalettes }, { boneMatrices, point }, { creatureScale }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/math3d.js"), import("/src/worldScale.js"),
  ]);
  const module = await loadSubject("dragon");
  const canvas = Object.assign(document.createElement("canvas"), { width: 220, height: 170 });
  const renderer = createRenderer(canvas);
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const label = 18;
  const coats = ["slate", "bone", "ember"].map((id) => dragonPalettes.find((p) => p.id === id));
  const heads = [["toothed", 0, "adult"], ["beaked", 1, "adult"], ["blunt", 2, "adult"], ["needle", 3, "adult"], ["viper", 4, "adult"], ["kid", 0, "kid"]];
    const closeUp = (anatomy, pose) => {
    const ids = anatomy.bones.map((bone) => bone.id);
    const center = point(boneMatrices(anatomy, pose)[ids.indexOf("head")], [0.25, 0.05, 0].map((v) => v * anatomy.scale));
    return { ...anatomy, bounds: { center, radius: 0.55 * creatureScale } };
  };
  const images = [];
  try {
    for (const { id: style } of styles)
      for (const coat of coats) {
      const out = Object.assign(document.createElement("canvas"), { width: canvas.width * dragonEyes.length, height: (canvas.height + label) * heads.length });
      const context = out.getContext("2d");
      context.fillStyle = rgb(palette.background);
      context.fillRect(0, 0, out.width, out.height);
      context.font = "12px system-ui";
      context.fillStyle = rgb(palette.ivory);
      heads.forEach(([headName, head, age], r) =>
        dragonEyes.forEach((eye, c) => {
          const anatomy = module.createAnatomy({ ...makeGenome(module.genes, 2407), ...coat.genes, head, headgear: 0, eyes: c }, { age });
          const pose = module.pose(anatomy, 0, { stand: 1, time: 0 });
          renderer.render(closeUp(anatomy, pose), pose, { style, ground: false, yaw: -0.55, pitch: 0.12, zoom: 1 });
          const x = c * canvas.width, y = r * (canvas.height + label);
          context.drawImage(canvas, x, y);
          context.fillText(`${headName} · ${coat.label} · ${eye.label}`, x + 8, y + canvas.height + 13);
        }),
      );
      images.push({ style, coat: coat.id, png: out.toDataURL("image/png") });
      }
    return images;
  } finally {
    renderer.dispose();
  }
}
