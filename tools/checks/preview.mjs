import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";
import { subjects, styles } from "../../src/subjects.js";

const args = process.argv.slice(2);
const option = (name, fallback) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const subject = option("--subject", "dragon");
const style = option("--style", "cozy");
const age = option("--age", "adult");
const stand = args.includes("--stand");
const frame = option("--frame", null);
const [width, height] = args.includes("--hd") ? [1920, 1080] : [1100, 800];
const settings = {
  seed: Number(option("--seed", 2407)),
  time: Number(option("--time", 0.7)),
  yaw: Number(option("--yaw", -0.6)),
  pitch: Number(option("--pitch", 0.2)),
  zoom: Number(option("--zoom", 1.25)),
};
if (args.includes("--help")) {
  console.log(
    "node tools/checks/preview.mjs --subject dragon --style cozy --seed 2407 --age adult --time 0.7 --yaw -0.6 --pitch 0.2 --zoom 1.25 [--stand] [--hd] [--frame adult]",
  );
  process.exit(0);
}
if (
  !subjects.some((item) => item.id === subject) ||
  !styles.some((item) => item.id === style)
)
  throw new Error("Unknown subject or style");
if (!Object.values(settings).every(Number.isFinite) || settings.zoom <= 0)
  throw new Error("Preview settings must be finite; zoom must be positive");
const base = option("--url", "http://127.0.0.1:8094");
if (
  !(await fetch(new URL("/status", base))
    .then((response) => response.ok)
    .catch(() => false))
)
  throw new Error(`Start npm run dev before previewing ${base}`);
const session = await launch({ url: "about:blank", width, height });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", {
    url: new URL("/tools/checks/check.html", base).href,
  });
  if (!(await waitFor(session, "window.__checks", 10000)))
    throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const result = await evaluate(
    session,
    `(async () => {
    const [{createRenderer}, {loadSubject, makeGenome}] = await Promise.all([import('/src/render.js'), import('/src/subjects.js')]);
    const module = await loadSubject(${JSON.stringify(subject)});
    const settings = ${JSON.stringify(settings)};
    const genome = makeGenome(module.genes, settings.seed);
    const anatomy = module.createAnatomy(genome, { age: ${JSON.stringify(age)} });
    const frame = ${JSON.stringify(frame)};
    if (frame) anatomy.bounds = module.createAnatomy(genome, { age: frame }).bounds;
    const canvas = Object.assign(document.createElement('canvas'), {width:${width},height:${height}});
    const renderer = createRenderer(canvas);
    try {
      const result = renderer.render(anatomy, module.pose(anatomy,settings.time,${stand ? "{stand:1,time:settings.time}" : "undefined"}), {style:${JSON.stringify(style)},yaw:settings.yaw,pitch:settings.pitch,zoom:settings.zoom,ground:false});
      const gl = canvas.getContext('webgl2');
      const error = gl.getError();
      if(error !== gl.NO_ERROR) throw new Error('WebGL error '+error);
      return {png:canvas.toDataURL('image/png'),triangles:result.triangles,bones:anatomy.bones.length,renderer:renderer.info};
    } finally {renderer.dispose();}
  })()`,
  );
  if (errors.length) throw new Error(errors.join("\n"));
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const directory = resolve(root, "shots", subject, style);
  await mkdir(directory, { recursive: true });
  const name = ["preview", age === "adult" ? null : age, args.includes("--seed") ? settings.seed : null, stand ? "stand" : null, frame ? `in-${frame}` : null, width === 1920 ? "hd" : null];
  const path = resolve(directory, `${name.filter((v) => v !== null).join("-")}.png`);
  await writeFile(path, Buffer.from(result.png.split(",")[1], "base64"));
  console.log(
    JSON.stringify({
      path,
      subject,
      style,
      age,
      stand,
      ...settings,
      triangles: result.triangles,
      bones: result.bones,
      renderer: result.renderer,
    }),
  );
} finally {
  await session.close();
}
