// The rider on foot, for review: full-body turnarounds and head close-ups across looks, and the
// rider in the saddle. Writes shots/rider/<style>/.
//   node tools/checks/riderEvidence.mjs [--url http://127.0.0.1:8094]
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const args = process.argv.slice(2);
const base = args.includes("--url") ? args[args.indexOf("--url") + 1] : "http://127.0.0.1:8094";
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
    const directory = resolve(root, "shots", "rider", image.style);
    await mkdir(directory, { recursive: true });
    const path = resolve(directory, `${image.name}.png`);
    await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
    console.log(path);
  }
} finally {
  await session.close();
}

async function capture() {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette }, { createJockey }, { withJockey }, { riderFigure }, look] = await Promise.all([
    import("/src/render.js"),
    import("/src/subjects.js"),
    import("/src/palette.js"),
    import("/src/jockey/createJockey.js"),
    import("/src/jockey/withJockey.js"),
    import("/src/jockey/riderFigure.js"),
    import("/src/jockey/riderLook.js"),
  ]);
  const module = await loadSubject("dragon");
  const rgb = (c) => `rgb(${c.map((v) => Math.round(v * 255)).join(" ")})`;
  const sheet = (canvas, tiles, columns) => {
    const label = 22;
    const out = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + label) * Math.ceil(tiles.length / columns) });
    const context = out.getContext("2d");
    context.fillStyle = rgb(palette.background);
    context.fillRect(0, 0, out.width, out.height);
    context.font = "13px system-ui";
    context.fillStyle = rgb(palette.ivory);
    tiles.forEach((draw, index) => {
      const caption = draw();
      const x = (index % columns) * canvas.width,
        y = Math.floor(index / columns) * (canvas.height + label);
      context.drawImage(canvas, x, y);
      context.fillText(caption, x + 10, y + canvas.height + 16);
    });
    return out.toDataURL("image/png");
  };
  const tall = Object.assign(document.createElement("canvas"), { width: 420, height: 600 });
  const square = Object.assign(document.createElement("canvas"), { width: 300, height: 300 });
  const wide = Object.assign(document.createElement("canvas"), { width: 420, height: 320 });
  const body = createRenderer(tall),
    head = createRenderer(square),
    mount = createRenderer(wide);
  const front = -Math.PI / 2 + 0.001;
  const views = [["front", front], ["three-quarter", -0.7], ["side", 0.001], ["back", Math.PI / 2 - 0.001]];
  const fieldOptions = Object.fromEntries(look.riderLookFields.map((f) => [f.key, f.options.map((o) => o.id)]));
  const rider = (seed, change = {}) => {
    const jockey = createJockey(seed);
    return { ...jockey, look: { ...jockey.look, ...change } };
  };
  const full = (jockey, yaw, style) => body.render({ ...riderFigure(jockey), bounds: { center: [0, 0.92, 0], radius: 0.98 } }, { bones: {} }, { style, yaw, pitch: 0.08, ground: false });
  const face = (jockey, yaw, style) => head.render({ ...riderFigure(jockey), bounds: { center: [0, 1.6, 0], radius: 0.3 } }, { bones: {} }, { style, yaw, pitch: 0.1, ground: false });
  const images = [];
  try {
    for (const { id: style } of styles) {
      const seeds = ["fede", "a", "b", "c"];
      images.push({
        style,
        name: "rider-turnaround",
        png: sheet(tall, seeds.flatMap((seed) => views.map(([label, yaw]) => () => {
          const jockey = rider(seed);
          full(jockey, yaw, style);
          return `${label} · ${Object.values(jockey.look).join(" ")}`.slice(0, 44);
        })), 4),
      });
      images.push({
        style,
        name: "rider-faces",
        png: sheet(square, seeds.flatMap((seed) => [front, -0.7, 0.001].map((yaw) => () => {
          const jockey = rider(seed, { hat: "none" });
          face(jockey, yaw, style);
          return `${jockey.look.hair} ${jockey.look.hairColor} ${jockey.look.skin}`;
        })), 3),
      });
      for (const key of ["hair", "hat", "facialHair", "build"].filter((k) => fieldOptions[k]))
        images.push({
          style,
          name: `rider-${key}`,
          png: sheet(key === "build" ? tall : square, fieldOptions[key].flatMap((id) => [front, -0.9].map((yaw) => () => {
            const jockey = { ...rider("fede", { skin: "fair", hairColor: "auburn", hair: "short", facialHair: "none", [key]: id, ...(key === "hair" || key === "facialHair" ? { hat: "none" } : {}) }), silks: { pattern: "sash", colors: ["navy", "gold"] } };
            if (key === "build") full(jockey, yaw, style);
            else face(jockey, key === "hair" && yaw !== front ? 2.2 : yaw, style);
            return `${key} ${id}`;
          })), key === "build" ? 6 : 6),
        });
      const anatomy = module.createAnatomy(makeGenome(module.genes, "jockey-evidence:0"));
      const kneeRider = { ...rider("fede", { build: "average" }), silks: { pattern: "sash", colors: ["navy", "gold"] } };
      images.push({
        style,
        name: "rider-hips",
        png: sheet(square, [front, -0.7, 0.001, Math.PI / 2 - 0.001, 2.3].flatMap((yaw) =>
          ["hourglass", "average", "stocky"].map((build) => () => {
            const jockey = { ...kneeRider, look: { ...kneeRider.look, build, gloves: "white" } };
            head.render({ ...riderFigure(jockey), bounds: { center: [0, 0.95, 0], radius: 0.3 } }, { bones: {} }, { style, yaw, pitch: 0.05, ground: false });
            return `hips ${build}`;
          }),
        ), 6),
      });
      images.push({
        style,
        name: "rider-knees",
        png: sheet(square, [
          ...[front, -0.7, 0.001].map((yaw) => () => {
            head.render({ ...riderFigure(kneeRider), bounds: { center: [0, 0.5, 0.05], radius: 0.32 } }, { bones: {} }, { style, yaw, pitch: 0.1, ground: false });
            return "standing knee";
          }),
          ...[0.001, -0.9, -2.3].map((yaw) => () => {
            const mounted = withJockey(anatomy, kneeRider);
            const c = mounted.jockey.saddle;
            head.render({ ...mounted, bounds: { center: [c[0], c[1] + 0.1, c[2]], radius: 0.6 } }, module.pose(mounted, 0.3), { style, yaw, pitch: 0.2, ground: false });
            return "mounted knee";
          }),
        ], 3),
      });
      images.push({
        style,
        name: "rider-mounted",
        png: sheet(wide, seeds.flatMap((seed) => [-0.9, -2.3].map((yaw) => () => {
          const mounted = withJockey(anatomy, rider(seed));
          const c = mounted.jockey.saddle;
          mount.render({ ...mounted, bounds: { center: [c[0] + 0.2, c[1] + 0.5, c[2]], radius: 0.8 } }, module.pose(mounted, 0.3), { style, yaw, pitch: 0.3, ground: false });
          return `${seed} mounted`;
        })), 4),
      });
    }
    return images;
  } finally {
    body.dispose();
    head.dispose();
    mount.dispose();
  }
}
