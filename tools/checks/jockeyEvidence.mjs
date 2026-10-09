import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

// Usage: jockeyEvidence.mjs [base]. Writes shots/dragon/<style>/jockey-*.png for human review.
const base = process.argv[2] || "http://127.0.0.1:8094";
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
    const directory = resolve(root, "shots", "dragon", image.style);
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
  const [{ createRenderer }, { loadSubject, makeGenome, styles }, { palette }, jockeyModule, riderModule, silksModule, { withTack }, { riderFigure }, { riderBuilds }] = await Promise.all([
    import("/src/render.js"),
    import("/src/subjects.js"),
    import("/src/palette.js"),
    import("/src/jockey/createJockey.js"),
    import("/src/jockey/withJockey.js"),
    import("/src/jockey/jockeySilks.js"),
    import("/src/jockey/withTack.js"),
    import("/src/jockey/riderFigure.js"),
    import("/src/jockey/riderLook.js"),
  ]);
  const { createJockey } = jockeyModule,
    { withJockey } = riderModule,
    { silkPatterns } = silksModule;
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
  const close = (anatomy, radius = 1.5) => ({
    ...anatomy,
    bounds: { center: [anatomy.jockey.saddle[0] + 0.25, anatomy.jockey.saddle[1] + 0.45, anatomy.jockey.saddle[2]], radius },
  });
  const tileCanvas = Object.assign(document.createElement("canvas"), { width: 420, height: 320 });
  const wideCanvas = Object.assign(document.createElement("canvas"), { width: 900, height: 520 });
  const tile = createRenderer(tileCanvas),
    wide = createRenderer(wideCanvas);
  const images = [],
    riders = [];
  try {
    const mounts = Array.from({ length: 8 }, (_, i) => {
      const jockey = createJockey(`evidence:${i}`);
      if (i < silkPatterns.length) jockey.silks = { ...jockey.silks, pattern: silkPatterns[i].id };
      const anatomy = withJockey(module.createAnatomy(makeGenome(module.genes, `jockey-evidence:${i}`)), jockey);
      riders.push({ name: jockey.name, silks: jockey.silks });
      return { jockey, anatomy };
    });
    for (const { id: style } of styles) {
      images.push({
        style,
        name: "jockey-silks",
        png: sheet(tileCanvas, mounts.map(({ jockey, anatomy }) => () => {
          tile.render(close(anatomy, 1.1), module.pose(anatomy, 0.3), { style, yaw: -0.75, pitch: 0.22, ground: false });
          return `${jockey.name} · ${jockey.silks.pattern} ${jockey.silks.colors.join("/")}`;
        }), 4),
      });
      const patternBase = module.createAnatomy(makeGenome(module.genes, "jockey-evidence:patterns"));
      images.push({
        style,
        name: "jockey-patterns",
        png: sheet(tileCanvas, silkPatterns.flatMap((pattern, i) => [-0.9, -2.3].map((yaw) => () => {
          const jockey = createJockey(`pattern:${i}`);
          jockey.silks = { pattern: pattern.id, colors: [["scarlet", "white", "navy"], ["royal", "gold"], ["emerald", "white"], ["black", "yellow", "white"], ["purple", "white"], ["navy", "gold"], ["orange", "black", "white"]][i % 7] };
          const anatomy = withJockey(patternBase, jockey);
          const c = anatomy.jockey.saddle;
          tile.render({ ...anatomy, bounds: { center: [c[0] + 0.15, c[1] + 0.6, c[2]], radius: 0.8 } }, module.pose(anatomy, 0.3), { style, yaw, pitch: 0.45, ground: false });
          return `${pattern.id} · ${jockey.silks.colors.join("/")}`;
        })), 4),
      });
      const [{ anatomy }] = mounts;
      const views = [
        ["side", 0.001, 0.05],
        ["three-quarter front", -0.7, 0.2],
        ["head-on", -Math.PI / 2 + 0.001, 0.12],
        ["rear three-quarter", -2.4, 0.3],
        ["above", -0.9, 1.05],
        ["below", -0.9, -0.5],
      ];
      images.push({
        style,
        name: "jockey-closeup",
        png: sheet(tileCanvas, views.map(([label, yaw, pitch]) => () => {
          tile.render(close(anatomy, 1.35), module.pose(anatomy, 0.3), { style, yaw, pitch, ground: false });
          return label;
        }), 3),
      });
      const naked = module.createAnatomy(makeGenome(module.genes, "jockey-evidence:0"));
      const layers = [
        ["naked", {}],
        ["harness only", { harness: true }],
        ["saddle only", { saddle: true }],
        ["harness + saddle", { harness: true, saddle: true }],
        ["rider, no harness", { jockey: mounts[0].jockey }],
        ["rider in full tack", { harness: true, jockey: mounts[0].jockey }],
      ];
      images.push({
        style,
        name: "jockey-layers",
        png: sheet(tileCanvas, layers.map(([label, options]) => () => {
          const dressed = withTack(naked, options);
          const c = withTack(naked, { saddle: true }).tack.seat;
          tile.render({ ...dressed, bounds: { center: [c[0] - 0.3, c[1] + 0.1, c[2]], radius: 1.9 } }, module.pose(dressed, 0.3), { style, yaw: -0.7, pitch: 0.45, ground: false });
          return label;
        }), 3),
      });
      const tackViews = [
        ["side", 0.001, 0.1, 0.3, 0],
        ["rear three-quarter, high", -2.3, 0.6, 0.3, 0],
        ["above", -1.2, 1.2, 0.3, 0],
        ["three-quarter, low", -0.6, -0.25, 0.3, 0],
        ["downstroke, sprint", -2.6, 0.45, 0.45, 1],
        ["upstroke, sprint", -0.5, 0.35, 0.85, 1],
      ];
      images.push({
        style,
        name: "jockey-harness",
        png: sheet(tileCanvas, tackViews.map(([label, yaw, pitch, t, effort]) => () => {
          const c = anatomy.jockey.saddle;
          const pose = module.pose(anatomy, t, { effort, time: t });
          tile.render({ ...anatomy, bounds: { center: [c[0] - 0.4, c[1], c[2]], radius: 2.2 } }, pose, { style, yaw, pitch, ground: false });
          return label;
        }), 3),
      });
      images.push({
        style,
        name: "jockey-flaps",
        png: sheet(tileCanvas, [-0.5, Math.PI / 2].flatMap((yaw) => [0, 0.25, 0.5, 0.75].map((t) => () => {
          tile.render(close(anatomy, 2.6), module.pose(anatomy, t, { effort: 1, time: t }), { style, yaw, pitch: 0.3, ground: false });
          return `wingbeat ${t}, sprint, ${yaw > 0 ? "head-on" : "three-quarter"}`;
        })), 4),
      });
      const buildRider = (build) => {
        const jockey = createJockey("builds");
        return { ...jockey, silks: { pattern: "sash", colors: ["royal", "gold"] }, look: { ...jockey.look, build, hair: "short", hat: "cap" } };
      };
      images.push({
        style,
        name: "jockey-builds",
        png: sheet(tileCanvas, [[-Math.PI / 2 + 0.001, "front"], [-0.7, "three-quarter"], [0.001, "side"]].flatMap(([yaw, view]) => riderBuilds.map((build) => () => {
          const figure = riderFigure(buildRider(build.id));
          tile.render({ ...figure, bounds: { center: [0, 1.15, 0], radius: 0.7 } }, { bones: {} }, { style, yaw, pitch: 0.08, ground: false });
          return `${build.id}, ${view}`;
        })), riderBuilds.length),
      });
      images.push({
        style,
        name: "jockey-builds-mounted",
        png: sheet(tileCanvas, riderBuilds.map((build) => () => {
          const mounted = withJockey(mounts[0].anatomy, buildRider(build.id));
          const c = mounted.jockey.saddle;
          tile.render({ ...mounted, bounds: { center: [c[0] + 0.2, c[1] + 0.5, c[2]], radius: 0.75 } }, module.pose(mounted, 0.3), { style, yaw: -1.1, pitch: 0.3, ground: false });
          return `${build.id}, mounted`;
        }), riderBuilds.length),
      });
      images.push({
        style,
        name: "jockey-scale",
        png: sheet(wideCanvas, [
          () => {
            wide.render(anatomy, module.pose(anatomy, 0.3), { style, yaw: 0.001, pitch: 0.05, zoom: 1.5, ground: false });
            return "1.75 m rider on a 16 m dragon, side";
          },
          () => {
            wide.render(anatomy, module.pose(anatomy, 0.3), { style, yaw: -0.6, pitch: 0.35, zoom: 1.5, ground: false });
            return "three-quarter";
          },
        ], 1),
      });
    }
    return { images, details: { riders } };
  } finally {
    tile.dispose();
    wide.dispose();
  }
}
