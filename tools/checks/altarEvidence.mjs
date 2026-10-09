import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Usage: altarEvidence.mjs [--url http://127.0.0.1:8094] [--styles cozy,lowPoly]
// Writes shots/altar/<style>/altar-*.png at 1080p: the altar stone alone on grass beside a 1.75 m figure.
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const base = option("--url", "http://127.0.0.1:8094");
const styles = option("--styles", "cozy").split(",");
const root = fileURLToPath(new URL("../../", import.meta.url));

const views = {
  threeQuarter: { eye: [5.2, 2.6, 6.4], target: [0, 0.8, 0], fov: 0.72 },
  side: { eye: [0.4, 1.5, 7.6], target: [0, 0.75, 0], fov: 0.7 },
  end: { eye: [8.2, 1.4, 1.2], target: [0, 0.7, 0], fov: 0.66 },
  high: { eye: [3.2, 6.8, 4.4], target: [0, 0.8, 0], fov: 0.72 },
  close: { eye: [2.6, 1.55, 3.3], target: [0, 1.0, 0], fov: 0.72 },
};
const shots = [
  ["altar-three-quarter", "threeQuarter", 0, null, true],
  ["altar-three-quarter-empty", "threeQuarter", 0, null, false],
  ["altar-side", "side", 0, null, true],
  ["altar-end", "end", 0, null, false],
  ["altar-high", "high", 0, null, true],
  ["altar-fire-50", "threeQuarter", 0.5, ["fire"], true],
  ["altar-fire-100", "threeQuarter", 1, ["fire"], true],
  ["altar-ice-50", "side", 0.5, ["water"], false],
  ["altar-ice-100", "side", 1, ["water"], false],
  ["altar-poison-100-close", "close", 1, ["nature"], true],
  ["altar-storm-100-high", "high", 1, ["storm"], true],
  ["altar-mixed-100", "threeQuarter", 1, ["fire", "water", "nature", "storm"], true],
  ["altar-mixed-50-empty", "high", 0.5, ["fire", "water", "nature", "storm"], false],
];

const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  await evaluate(session, `(${setup.toString()})()`);
  for (const style of styles)
    for (const [name, view, glow, elements, egg] of shots) {
      const png = await evaluate(session, `window.__altar(${JSON.stringify({ style, view: views[view], glow, elements, egg })})`);
      if (errors.length) throw new Error(errors.join("\n"));
      const directory = resolve(root, "shots", "altar", style);
      await mkdir(directory, { recursive: true });
      const path = resolve(directory, `${name}.png`);
      await writeFile(path, Buffer.from(png.split(",")[1], "base64"));
      console.log(path);
    }
} finally {
  await session.close();
}

async function setup() {
  const [{ createSceneRenderer }, { createStableYard }, altarModule, { createBuilder, box, column }, { environmentOf, palette, tint, dragonColors, dragonPalettes }, { eggAnatomy }] =
    await Promise.all([
      import("/src/scene.js"),
      import("/src/scene/stableYard.js"),
      import("/src/scene/altarStone.js"),
      import("/src/scene/meshBuilder.js"),
      import("/src/palette.js"),
      import("/src/eggMesh.js"),
    ]);
  const { createAltarStone, addAltarStone, altarGlowMesh } = altarModule;
  const { course: meadow } = createStableYard(1, { buildings: false });
  const env = environmentOf(meadow);
  const altar = createAltarStone({ position: [0, 0, 0], yaw: 0, seed: "evidence" });
  const builder = createBuilder();
  addAltarStone(builder, altar, env);
  const figure = [-2.9, 0.5];
  for (const side of [-0.11, 0.11]) box(builder, [figure[0] + side, figure[1]], 0, 0.08, 0.1, 0, 0.86, env.timber);
  box(builder, figure, 0, 0.21, 0.13, 0.86, 1.46, env.banner);
  for (const side of [-0.27, 0.27]) box(builder, [figure[0] + side, figure[1]], 0, 0.055, 0.07, 0.8, 1.42, env.banner, { shade: 0.95 });
  column(builder, figure, 0.06, 1.46, 1.55, 6, env.plaster, {});
  column(builder, figure, 0.1, 1.55, 1.75, 7, env.plaster, { topRadius: 0.07, cap: true });
  const extra = builder.result();
  const merge = (a, b) => Object.fromEntries(["positions", "colors", "surface", "normals"].map((k) => {
    const out = new Float32Array(a[k].length + b[k].length);
    out.set(a[k]);
    out.set(b[k], a[k].length);
    return [k, out];
  }));
  const course = { ...meadow, dressing: merge(meadow.dressing, extra) };
  const coat = dragonColors(dragonPalettes.find((p) => p.id === "azure").genes);
  const full = eggAnatomy({ shell: tint(coat.skin, 1.35), spots: tint(coat.membrane, 1.2), seed: "altar-evidence" });
  const size = 0.5,
    radius = full.bounds.radius * size;
  const egg = { ...full, parts: full.parts.map((p) => ({ ...p, scale: [size, size, size] })), bounds: { center: [0, 0, 0], radius } };
  const canvas = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 });
  const renderer = createSceneRenderer(canvas);
  window.__altar = ({ style, view, glow, elements, egg: withEgg }) => {
    const colors = elements ? elements.map((id) => palette.elementGlow[id]) : undefined;
    const racers = withEgg ? [{ anatomy: egg, pose: { bones: {} }, position: altar.eggPoint.map((v, i) => (i === 1 ? v + radius : v)), forward: [0.6, 0, 0.8] }] : [];
    renderer.render({ course, racers, camera: { ...view, up: [0, 1, 0] }, style, time: 0, props: [altarGlowMesh(altar, glow, colors ?? palette.hatchGlow, env)] });
    renderer.finish();
    return canvas.toDataURL("image/png");
  };
}
