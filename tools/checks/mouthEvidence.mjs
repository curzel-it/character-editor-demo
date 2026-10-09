import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Usage: node tools/checks/mouthEvidence.mjs [base] [expression|calibrate]
const base = process.argv[2] || "http://127.0.0.1:8094";
const only = process.argv[3] || null;
const session = await launch({ url: "about:blank", width: 1100, height: 800 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!await waitFor(session, "window.__checks", 10000)) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const evidence = await evaluate(session, `(${capture.toString()})(${JSON.stringify(only)})`);
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

/** Head close-ups: one sheet per expression, rows are head variants and views, columns are time. */
async function capture(only) {
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette }, { mouthStates }, { boneMatrices, point }, { poseIssues }] = await Promise.all([
    import("/src/render.js"), import("/src/subjects.js"), import("/src/palette.js"), import("/src/animate/flightStates.js"),
    import("/src/math3d.js"), import("/tools/checks/structure.mjs"),
  ]);
  const module = await loadSubject("dragon");
  const heads = [["toothed", 0], ["beaked", 1], ["blunt", 2]];
  const canvas = Object.assign(document.createElement("canvas"), { width: 300, height: 240 });
  const renderer = createRenderer(canvas);
  const rgb = (color) => `rgb(${color.map((value) => Math.round(value * 255)).join(" ")})`;
  const label = 20;
  const views = [["side", { yaw: 0, pitch: 0.08, zoom: 1 }], ["3/4", { yaw: -1.0, pitch: 0.18, zoom: 1 }]];
  // Framed on the chest, so the head's throw and lunge read against a steady frame.
  const closeUp = (anatomy, pose) => {
    const ids = anatomy.bones.map((bone) => bone.id), at = (matrices, id, p = [0, 0, 0]) => point(matrices[ids.indexOf(id)], p);
    const rest = boneMatrices(anatomy), posed = boneMatrices(anatomy, pose);
    const offset = at(rest, "head", [0.6, -0.15, 0]).map((v, i) => v - at(rest, "chest")[i]);
    const center = at(posed, "chest").map((v, i) => v + offset[i]);
    return { ...anatomy, bounds: { center, radius: 1.5 } };
  };
  const cruise = (effort, extra = {}) => (k) => ({ t: k / 6, motion: { effort, ...extra, time: 5 + k / 6 / (0.9 + 1.9 * effort) } });
  const expressions = [
    { id: "cruise", label: "Cruise", at: cruise(0.5) },
    { id: "sprint", label: "Sprint", at: cruise(1) },
    { id: "exhausted", label: "Exhausted", at: (k) => ({ t: k / 6, motion: { effort: 0.45, fatigue: 1, gasp: 0.6, time: 5 + k * 0.27 } }) },
    { id: "glide", label: "Glide", at: (k) => ({ t: 0.25, motion: { effort: 0.15, glide: 1, time: 5 + k * 0.5 } }) },
    { id: "flick", label: "Tongue flick", at: (k, anatomy) => {
      // Centre the strip on this individual's first tongue flick.
      const reach = (time) => module.pose(anatomy, 0, { effort: 0.5, time }).bones.tongue?.position?.[0] ?? 0;
      let peak = 0;
      for (let time = 0; time < 8; time += 0.02) if (reach(time) > reach(peak)) peak = time;
      const time = peak - 0.3 + k * 0.12;
      return { t: (time * 1.8) % 1, motion: { effort: 0.5, time } };
    } },
    ...mouthStates.map((state) => ({ id: state.id, label: state.label, at: (k) => { const time = state.preview[k]; return { t: time * 1.8 % 1, motion: state.motionAt(time) }; } })),
  ];
  const calibrate = heads.map(([name]) => ({ id: name, label: name, jaw: [-0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.4] }));
  const images = [], issues = [];
  const sheets = only === "calibrate"
    ? [{ name: "mouth-calibrate", rows: calibrate.flatMap((row, h) => views.map((view) => ({ head: heads[h], view, tiles: row.jaw.map((jaw) => ({ caption: `${row.label} jaw ${jaw}`, pose: { bones: { jaw: { rotation: [0, 0, jaw] } } } })) }))) }]
    : expressions.filter((e) => !only || e.id === only).map((expression) => ({
      name: `mouth-${expression.id}`,
      rows: heads.flatMap((head) => views.map((view) => ({ head, view, tiles: Array.from({ length: 6 }, (_, k) => ({ k, expression })) }))),
    }));
  try {
    for (const { id: style } of styles)
      for (const sheet of sheets) {
        const columns = sheet.rows[0].tiles.length;
        const out = Object.assign(document.createElement("canvas"), { width: canvas.width * columns, height: (canvas.height + label) * sheet.rows.length });
        const context = out.getContext("2d");
        context.fillStyle = rgb(palette.background);
        context.fillRect(0, 0, out.width, out.height);
        context.font = "12px system-ui";
        context.fillStyle = rgb(palette.ivory);
        sheet.rows.forEach(({ head: [headName, head], view: [viewName, view], tiles }, r) => {
          const anatomy = module.createAnatomy({ ...makeGenome(module.genes, 2407), head, headgear: 0 });
          tiles.forEach((tile, c) => {
            let pose = tile.pose, caption = tile.caption;
            if (!pose) {
              const { t, motion } = tile.expression.at(tile.k, anatomy);
              pose = module.pose(anatomy, t, motion);
              issues.push(...poseIssues(anatomy, pose).map((issue) => `${sheet.name} ${headName}: ${issue}`));
              const jaw = pose.bones.jaw?.rotation?.[2] ?? 0;
              caption = `${headName} · ${tile.expression.label} · ${viewName} · t ${motion.time.toFixed(2)} · jaw ${jaw.toFixed(2)}`;
            }
            renderer.render(closeUp(anatomy, pose), pose, { style, ground: false, ...view });
            const x = c * canvas.width, y = r * (canvas.height + label);
            context.drawImage(canvas, x, y);
            context.fillText(caption, x + 8, y + canvas.height + 14);
          });
        });
        images.push({ style, name: sheet.name, png: out.toDataURL("image/png") });
      }
    return { images, details: { sheets: sheets.map((sheet) => sheet.name), issues } };
  } finally {
    renderer.dispose();
  }
}
