import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Usage: altarStonesEvidence.mjs [--url http://127.0.0.1:8094] [--seed soul-altar] [--trilithons 5] [--runes 0.6]
// Writes shots/altar/<style>/stones-*.png at 1080p: the ring alone on grass with a person and adults for scale,
// its runes dark, and `-lit` views with the runes glowing at `--runes`.
const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const base = option("url", "http://127.0.0.1:8094");
const settings = { seed: option("seed", "soul-altar"), trilithons: Number(option("trilithons", 5)), runes: Number(option("runes", 0.6)) };
const root = fileURLToPath(new URL("../../", import.meta.url));
const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const result = await evaluate(session, `(${capture.toString()})(${JSON.stringify(settings)})`);
  if (errors.length) throw new Error(errors.join("\n"));
  for (const image of result.images) {
    const directory = resolve(root, "shots", "altar", image.style);
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `${image.name}.png`);
    await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
    console.log(path);
  }
  console.log(JSON.stringify(result.details));
} finally {
  await session.close();
}

async function capture(settings) {
  const [{ createSceneRenderer }, { createStableYard }, { createBuilder, column, box }, ring, stones, { loadSubject, makeGenome, styles }, { lowestPoint }, { restingMotion }, { palette }] =
    await Promise.all([
      import("/src/scene.js"),
      import("/src/scene/stableYard.js"),
      import("/src/scene/meshBuilder.js"),
      import("/src/scene/stoneRing.js"),
      import("/src/scene/standingStones.js"),
      import("/src/subjects.js"),
      import("/src/scene/groundContact.js"),
      import("/src/dragonThumbnails.js"),
      import("/src/palette.js"),
    ]);
  const layout = ring.stoneRingLayout(settings.seed, { trilithons: settings.trilithons });
  const entrance = layout.stones[0];
  const person = [entrance.position[0] + 0.4, 0, entrance.position[2] + 2.2];
  const yard = createStableYard(1, { buildings: false });
  let stoneTriangles = 0;

  function courseWith(runes) {
    const builder = createBuilder();
    stones.addStoneRing(builder, layout, { runes });
    stoneTriangles = builder.triangles;
    const skin = [0.86, 0.66, 0.52];
    for (const side of [-0.13, 0.13]) column(builder, [person[0] + side, person[2]], 0.09, 0, 0.9, 6, palette.ink);
    box(builder, [person[0], person[2]], 0, 0.22, 0.13, 0.88, 1.5, palette.gold);
    for (const side of [-0.29, 0.29]) box(builder, [person[0] + side, person[2]], 0, 0.06, 0.07, 0.8, 1.46, palette.gold);
    column(builder, [person[0], person[2]], 0.11, 1.5, 1.58, 6, skin);
    column(builder, [person[0], person[2]], 0.12, 1.58, 1.8, 6, skin, { topRadius: 0.08, cap: true });
    const mesh = builder.result();
    const dressing = {};
    for (const key of Object.keys(mesh)) {
      dressing[key] = new Float32Array(yard.course.dressing[key].length + mesh[key].length);
      dressing[key].set(yard.course.dressing[key]);
      dressing[key].set(mesh[key], yard.course.dressing[key].length);
    }
    return { ...yard.course, dressing };
  }

  const module = await loadSubject("dragon");
  const dragons = (count) =>
    ring.altarFormation(count, layout).map((spot, i) => {
      const anatomy = module.createAnatomy(makeGenome(module.genes, `altar-evidence:${i + 3}`), { age: "adult" });
      const pose = module.pose(anatomy, 0.2, { ...restingMotion, time: 0.2 });
      const lift = 0.02 - lowestPoint(anatomy, pose, spot.position, spot.forward);
      return { anatomy, pose, position: [spot.position[0], spot.position[1] + lift, spot.position[2]], forward: spot.forward };
    });
  const pair = dragons(2),
    six = dragons(6);

  const e = entrance.position;
  const views = [
    { name: "stones-ground", eye: [5, 1.65, 24], target: [0, 3.2, 0], fov: 0.85 },
    { name: "stones-three-quarter", eye: [22, 12, 26], target: [0, 2, 0], fov: 0.75 },
    { name: "stones-high", eye: [5, 44, 20], target: [0, 0, 1], fov: 0.75 },
    { name: "stones-entrance", eye: [e[0] + 5, 2.2, e[2] + 9], target: [e[0] - 0.5, 2.8, e[2]], fov: 0.8 },
    { name: "stones-across", eye: [0.2, 2.4, 10], target: [0, 2.6, -6], fov: 0.9 },
    { name: "stones-formation-6", eye: [0, 58, 30], target: [0, 0, 0], fov: 0.75, racers: six },
  ];
  const lit = [
    { name: "stones-three-quarter-lit", eye: [22, 12, 26], target: [0, 2, 0], fov: 0.75 },
    { name: "stones-across-lit", eye: [0.2, 2.4, 10], target: [0, 2.6, -6], fov: 0.9 },
  ];
  const dark = courseWith(0),
    glowing = courseWith(settings.runes);
  const canvas = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 });
  const renderer = createSceneRenderer(canvas);
  const images = [];
  try {
    for (const { id: style } of styles)
      for (const [course, cameras] of [
        [dark, views],
        [glowing, lit],
      ])
        for (const { name, racers = pair, ...camera } of cameras) {
          renderer.render({ course, racers, camera: { ...camera, up: [0, 1, 0] }, style, time: 0.2 });
          images.push({ style, name, png: canvas.toDataURL("image/png") });
        }
  } finally {
    renderer.dispose();
  }
  return {
    images,
    details: {
      settings,
      radius: layout.radius,
      innerRadius: layout.innerRadius,
      outerRadius: layout.outerRadius,
      stones: layout.stones.length,
      stoneTriangles,
      formation: six.map((r) => r.position.map((v) => +v.toFixed(2))),
    },
  };
}
