import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Usage: custodianEvidence.mjs [--url http://127.0.0.1:8094]. Writes shots/custodian/<style>/*.png at 1080p for human review.
const args = process.argv.slice(2);
const base = args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://127.0.0.1:8094";
const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const result = await evaluate(session, `(${capture.toString()})()`);
  if (errors.length) throw new Error(errors.join("\n"));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  for (const image of result.images) {
    const directory = resolve(root, "shots", "custodian", image.style);
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `${image.name}.png`);
    await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
    console.log(path);
  }
  console.log(JSON.stringify(result.details));
} finally {
  await session.close();
}

async function capture() {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette }, { createCustodian }, { custodianPose }, { custodianPoses }, { makeSkinMesh }, math, { lowestPoint }, { restingMotion }] =
    await Promise.all([
      import("/src/render.js"),
      import("/src/subjects.js"),
      import("/src/palette.js"),
      import("/src/custodian/createCustodian.js"),
      import("/src/custodian/custodianPose.js"),
      import("/src/custodian/custodianStances.js"),
      import("/src/skinMesh.js"),
      import("/src/math3d.js"),
      import("/src/scene/groundContact.js"),
      import("/src/dragonThumbnails.js"),
    ]);
  const { boneMatrices, multiply, point, transform } = math;
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;
  const label = 22;
  const sheet = (canvas, tiles, columns) => {
    const out = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + label) * Math.ceil(tiles.length / columns) });
    const context = out.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, out.width, out.height);
    context.font = "15px system-ui";
    context.fillStyle = rgb(palette.ivory);
    tiles.forEach((draw, index) => {
      const caption = draw();
      const x = (index % columns) * canvas.width,
        y = Math.floor(index / columns) * (canvas.height + label);
      context.drawImage(canvas, x, y);
      context.fillText(caption, x + 12, y + canvas.height + 16);
    });
    return out.toDataURL("image/png");
  };
  const custodian = createCustodian();
  const framed = (pose) => ({ ...custodian, bounds: pose === "ritual" ? { center: [0.12, 1.6, 0], radius: 1.65 } : { center: [0.12, 1.0, 0], radius: 1.0 } });
  /** The posed custodian baked into one mesh at `placement`, so he can stand beside a dragon in a single draw. */
  const baked = (pose, placement) => {
    const { vertices, inverseBind } = makeSkinMesh(custodian);
    const bones = boneMatrices(custodian, pose).map((m, i) => multiply(placement, multiply(m, inverseBind[i])));
    const positions = [],
      colors = [];
    for (let v = 0; v < vertices.length; v += 12) {
      const p = [vertices[v], vertices[v + 1], vertices[v + 2]];
      const [a, b] = [point(bones[vertices[v + 9]], p), point(bones[vertices[v + 10]], p)];
      const w = vertices[v + 11];
      positions.push(...a.map((x, i) => x * w + b[i] * (1 - w)));
      colors.push(vertices[v + 6], vertices[v + 7], vertices[v + 8]);
    }
    return { vertices: positions, colors, indices: Array.from({ length: positions.length / 3 }, (_, i) => i) };
  };

  const hero = Object.assign(document.createElement("canvas"), { width: 1920, height: 1080 });
  const tileCanvas = Object.assign(document.createElement("canvas"), { width: 960, height: 540 - label });
  const frameCanvas = Object.assign(document.createElement("canvas"), { width: 320, height: 360 - label });
  const heroRenderer = createRenderer(hero),
    tile = createRenderer(tileCanvas),
    frame = createRenderer(frameCanvas);
  const images = [];
  const module = await loadSubject("dragon");
  const dragon = module.createAnatomy(makeGenome(module.genes, 2407));
  const dragonPose = module.pose(dragon, 0, restingMotion);
  const ground = lowestPoint(dragon, dragonPose, dragon.bones[0].position, [1, 0, 0]);
  try {
    for (const { id: style } of styles) {
      for (const pose of custodianPoses) {
        const posed = custodianPose(1.1, { pose });
        heroRenderer.render(framed(pose), posed, { style, yaw: -0.65, pitch: 0.12, ground: false });
        images.push({ style, name: pose, png: hero.toDataURL("image/png") });
        const views = [
          ["front three-quarter", -0.65, 0.12],
          ["side", 0.001, 0.04],
          ["front", -Math.PI / 2 + 0.001, 0.08],
          ["back three-quarter", 2.3, 0.2],
          ["other side", Math.PI - 0.001, 0.04],
          ["from above", -0.9, 0.9],
        ];
        images.push({
          style,
          name: `${pose}-angles`,
          png: sheet(tileCanvas, views.slice(0, 4).map(([caption, yaw, pitch]) => () => {
            tile.render(framed(pose), posed, { style, yaw, pitch, ground: false });
            return `${pose} · ${caption}`;
          }), 2),
        });
        images.push({
          style,
          name: `${pose}-more-angles`,
          png: sheet(tileCanvas, views.slice(2).map(([caption, yaw, pitch]) => () => {
            tile.render(framed(pose), posed, { style, yaw, pitch, ground: false });
            return `${pose} · ${caption}`;
          }), 2),
        });
      }
      images.push({
        style,
        name: "frames",
        png: sheet(frameCanvas, custodianPoses.flatMap((pose) => Array.from({ length: 6 }, (_, i) => () => {
          const time = i * (pose === "talking" ? 0.4 : 0.8);
          frame.render(framed(pose), custodianPose(time, { pose }), { style, yaw: -0.8, pitch: 0.1, ground: false });
          return `${pose} t=${time.toFixed(1)} s`;
        })), 6),
      });
      images.push({
        style,
        name: "blend",
        png: sheet(frameCanvas, [["idle", "talking"], ["idle", "ritual"], ["talking", "ritual"]].flatMap(([pose, toward]) => [0, 0.2, 0.4, 0.6, 0.8, 1].map((blend) => () => {
          frame.render(framed(toward === "ritual" ? "ritual" : pose), custodianPose(0.5, { pose, toward, blend }), { style, yaw: -0.8, pitch: 0.1, ground: false });
          return `${pose} → ${toward} ${blend}`;
        })), 6),
      });
      const scene = (placement, pose) => ({
        ...dragon,
        bones: [...dragon.bones, { id: "custodian", parent: null, position: [0, 0, 0], rotation: [0, 0, 0] }],
        parts: [...dragon.parts, { id: "custodian", bone: "custodian", shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color: [1, 1, 1], ...baked(custodianPose(1.1, { pose }), placement) }],
      });
      const beside = scene(transform([4.6, ground, 2.4], [0, -2.3, 0]), "talking");
      heroRenderer.render({ ...beside, bounds: { center: [-0.5, 4, 1], radius: 7.5 } }, dragonPose, { style, yaw: -0.55, pitch: 0.1, ground: false });
      images.push({ style, name: "scale", png: hero.toDataURL("image/png") });
      heroRenderer.render({ ...beside, bounds: { center: [3.6, ground + 1.1, 2], radius: 2.2 } }, dragonPose, { style, yaw: -0.3, pitch: 0.1, ground: false });
      images.push({ style, name: "scale-close", png: hero.toDataURL("image/png") });
    }
    return { images, details: { bones: custodian.bones.length, parts: custodian.parts.length, height: custodian.height, dragonGround: ground } };
  } finally {
    heroRenderer.dispose();
    tile.dispose();
    frame.dispose();
  }
}
