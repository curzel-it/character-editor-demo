import { createRenderer } from "../../src/render.js";
import { loadSubject, makeGenome } from "../../src/subjects.js";
import { palette, applyPalette } from "../../src/palette.js";
import {
  anatomyIssues,
  poseIssues,
  maximumPoseDifference,
} from "./structure.mjs";

const status = document.querySelector("#status");
const background = palette.background;
const css = (rgb) => `rgb(${rgb.map((v) => Math.round(v * 255)).join(" ")})`;
const surface = (width, height) =>
  Object.assign(document.createElement("canvas"), { width, height });
const samples = new Map();
applyPalette();

function glErrors(canvas) {
  const gl = canvas.getContext("webgl2");
  const errors = [];
  for (let code = gl.getError(); code !== gl.NO_ERROR; code = gl.getError()) {
    if (errors.some((error) => error.code === code)) break;
    const name =
      [
        "INVALID_ENUM",
        "INVALID_VALUE",
        "INVALID_OPERATION",
        "INVALID_FRAMEBUFFER_OPERATION",
        "OUT_OF_MEMORY",
        "CONTEXT_LOST_WEBGL",
      ].find((name) => gl[name] === code) || "UNKNOWN";
    errors.push({ code, name });
  }
  return errors;
}

function sheet(columns, rows, tileWidth, tileHeight) {
  const canvas = surface(columns * tileWidth, rows * tileHeight);
  const context = canvas.getContext("2d");
  context.fillStyle = css(background);
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.font = "12px monospace";
  context.fillStyle = css(palette.ivory);
  return { canvas, context, tileWidth, tileHeight, columns };
}

function paste(target, source, index, label) {
  const x = (index % target.columns) * target.tileWidth;
  const y = Math.floor(index / target.columns) * target.tileHeight;
  target.context.drawImage(
    source,
    x,
    y,
    target.tileWidth,
    target.tileHeight - 22,
  );
  target.context.fillText(label, x + 8, y + target.tileHeight - 7);
}

function measure(data, width, height) {
  const bg = data.slice(0, 3);
  const mask = new Uint8Array(width * height);
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1,
    area = 0;
  for (let i = 0; i < width * height; i++) {
    const offset = i * 4;
    if (
      Math.abs(data[offset] - bg[0]) +
        Math.abs(data[offset + 1] - bg[1]) +
        Math.abs(data[offset + 2] - bg[2]) <
      24
    )
      continue;
    const x = i % width,
      y = Math.floor(i / width);
    mask[i] = 1;
    area++;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  return {
    mask,
    area,
    bounds: area
      ? { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
      : null,
    clipped:
      area > 0 &&
      (minX === 0 || minY === 0 || maxX === width - 1 || maxY === height - 1),
  };
}

function signature(canvas) {
  const small = surface(48, 48);
  const context = small.getContext("2d", { willReadFrequently: true });
  context.drawImage(canvas, 0, 0, 48, 48);
  const data = context.getImageData(0, 0, 48, 48).data;
  return { data, ...measure(data, 48, 48) };
}

function distance(a, b) {
  let union = 0,
    different = 0,
    color = 0;
  for (let i = 0; i < a.mask.length; i++) {
    if (!a.mask[i] && !b.mask[i]) continue;
    union++;
    different += a.mask[i] !== b.mask[i] ? 1 : 0;
    for (let channel = 0; channel < 3; channel++)
      color += Math.abs(a.data[i * 4 + channel] - b.data[i * 4 + channel]);
  }
  return {
    silhouette: union ? different / union : 0,
    pixels: union ? color / (union * 3 * 255) : 0,
  };
}

async function hash(data) {
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest), (n) =>
    n.toString(16).padStart(2, "0"),
  ).join("");
}

function pairs(signatures, hashes) {
  const exact = [],
    near = [];
  let silhouette = 0,
    pixels = 0,
    count = 0,
    minimumSilhouette = 1,
    minimumPixels = 1;
  for (let a = 0; a < signatures.length; a++) {
    for (let b = a + 1; b < signatures.length; b++) {
      const d = distance(signatures[a], signatures[b]);
      silhouette += d.silhouette;
      pixels += d.pixels;
      count++;
      minimumSilhouette = Math.min(minimumSilhouette, d.silhouette);
      minimumPixels = Math.min(minimumPixels, d.pixels);
      if (hashes[a] === hashes[b]) exact.push([a + 1, b + 1]);
      else if (d.silhouette < 0.025 && d.pixels < 0.025)
        near.push([a + 1, b + 1]);
    }
  }
  return {
    pairs: count,
    exactDuplicates: exact,
    nearDuplicates: near,
    meanSilhouetteDistance: silhouette / count,
    minimumSilhouetteDistance: minimumSilhouette,
    meanPixelDistance: pixels / count,
    minimumPixelDistance: minimumPixels,
    nearDuplicateThreshold: 0.025,
  };
}

async function run(subject, style) {
  const module = await loadSubject(subject);
  const canvas = surface(256, 192);
  const renderer = createRenderer(canvas);
  let benchRenderer;
  const checks = [];
  const add = (name, state, details) =>
    checks.push({ name, status: state, details });
  const options = { style, ground: false, background };
  const paint = (anatomy, time = 0.2, extra = {}) =>
    renderer.render(anatomy, module.pose(anatomy, time), {
      ...options,
      ...extra,
    });
  const capture = () => {
    const pixels = renderer.readPixels();
    return { ...pixels, ...measure(pixels.data, pixels.width, pixels.height) };
  };
  const seed = (number) =>
    module.createAnatomy(makeGenome(module.genes, number));
  const anatomy = seed(1);
  const structural = [];
  const seeds = [],
    signatures = [],
    hashes = [],
    bounds = [];
  let generationMs = 0,
    maxTriangles = 0;
  const contact = sheet(8, 8, 192, 166);
  try {
    status.textContent = `${subject} × ${style}: determinism and 64 seeds`;
    paint(anatomy);
    const firstHash = await hash(renderer.readPixels().data);
    paint(seed(1));
    const repeatHash = await hash(renderer.readPixels().data);
    add("Determinism", firstHash === repeatHash ? "pass" : "fail", {
      seed: 1,
      firstHash,
      repeatHash,
      algorithm: "SHA-256 of RGBA framebuffer bytes",
      scope: "Same browser, GPU, viewport, seed, style and pose",
    });
    for (let i = 1; i <= 64; i++) {
      const started = performance.now();
      const item = seed(i);
      generationMs += performance.now() - started;
      seeds.push(item);
      structural.push(
        ...anatomyIssues(item).map((issue) => `Seed ${i}: ${issue}`),
      );
      const result = paint(item);
      maxTriangles = Math.max(maxTriangles, result.triangles);
      const shot = capture();
      bounds.push(shot.bounds);
      if (!shot.area || shot.clipped)
        structural.push(
          `Seed ${i}: ${!shot.area ? "empty render" : "clipped render"}`,
        );
      hashes.push(await hash(shot.data));
      signatures.push(signature(canvas));
      paste(contact, canvas, i - 1, `SEED ${String(i).padStart(2, "0")}`);
    }
    samples.set("contact", contact.canvas.toDataURL("image/png"));
    const variety = pairs(signatures, hashes);
    add("Variety", variety.exactDuplicates.length ? "fail" : "review", {
      seeds: 64,
      ...variety,
      interpretation:
        "Exact duplicates fail; near duplicates are flagged for inspection. Recognition and meaningful variety require human review.",
    });
    add("Structure", structural.length ? "fail" : "pass", {
      errors: structural,
      seeds: 64,
      bounds,
    });

    status.textContent = `${subject} × ${style}: broadcast silhouettes`;
    const broadcast = sheet(8, 8, 256, 134);
    const broadcastSignatures = [],
      broadcastHashes = [],
      broadcastHeights = [],
      broadcastClippedSeeds = [];
    canvas.width = 256;
    canvas.height = 112;
    const broadcastZoom = (item) => {
      let zoom = 1;
      for (let iteration = 0; iteration < 3; iteration++) {
        paint(item, 0.2, { zoom });
        const height = capture().bounds?.height || 1;
        zoom *= 64 / height;
      }
      return zoom;
    };
    for (let i = 0; i < seeds.length; i++) {
      paint(seeds[i], 0.2, { zoom: broadcastZoom(seeds[i]) });
      const shot = capture();
      broadcastHeights.push(shot.bounds?.height || 0);
      if (shot.clipped || !shot.area) broadcastClippedSeeds.push(i + 1);
      broadcastSignatures.push(signature(canvas));
      broadcastHashes.push(await hash(shot.data));
      paste(broadcast, canvas, i, `SEED ${String(i + 1).padStart(2, "0")}`);
    }
    samples.set("broadcast", broadcast.canvas.toDataURL("image/png"));
    const broadcastPairs = pairs(broadcastSignatures, broadcastHashes);
    add(
      "Broadcast distance",
      broadcastPairs.exactDuplicates.length || broadcastClippedSeeds.length
        ? "fail"
        : "review",
      {
        targetHeightPixels: 64,
        minimumHeightPixels: Math.min(...broadcastHeights),
        maximumHeightPixels: Math.max(...broadcastHeights),
        clippedOrEmptySeeds: broadcastClippedSeeds,
        ...broadcastPairs,
        interpretation:
          "Measured rendered object height is calibrated near 64 px. Distinguishability requires human review.",
      },
    );

    status.textContent = `${subject} × ${style}: gene sweeps`;
    const geneSheet = sheet(5, module.genes.length, 256, 134);
    const geneResults = [];
    const defaults = Object.fromEntries(
      module.genes.map((gene) => [gene.name, gene.default]),
    );
    const defaultAnatomy = module.createAnatomy(defaults);
    const geneZoom = broadcastZoom(defaultAnatomy);
    for (const [row, gene] of module.genes.entries()) {
      const geneHashes = [],
        geneSignatures = [],
        values = [];
      for (let step = 0; step < 5; step++) {
        const value = gene.min + ((gene.max - gene.min) * step) / 4;
        values.push(value);
        const item = module.createAnatomy({ ...defaults, [gene.name]: value });
        paint(item, 0.2, { zoom: geneZoom });
        geneHashes.push(await hash(renderer.readPixels().data));
        geneSignatures.push(signature(canvas));
        paste(
          geneSheet,
          canvas,
          row * 5 + step,
          `${gene.name} ${value.toFixed(2)}`,
        );
      }
      const adjacentDistances = geneSignatures
        .slice(1)
        .map((value, i) => distance(geneSignatures[i], value));
      geneResults.push({
        name: gene.name,
        values,
        distinctRenders: new Set(geneHashes).size,
        adjacentDistances,
        visiblyChangedSteps: adjacentDistances.filter(
          (value) => value.pixels > 0.015 || value.silhouette > 0.025,
        ).length,
      });
    }
    samples.set("genes", geneSheet.canvas.toDataURL("image/png"));
    add(
      "Gene legibility",
      geneResults.some((gene) => gene.distinctRenders === 1 && module.genes.find((g) => g.name === gene.name).visible !== false)
        ? "fail"
        : "review",
      {
        baselineSeed: "schema defaults",
        samplesPerGene: 5,
        genes: geneResults,
        candidateReadableGenes: geneResults.filter(
          (gene) => gene.visiblyChangedSteps >= 2,
        ).length,
        interpretation:
          "Pixel changes are measured at broadcast scale. Human review must confirm at least 3 readable genes. Geometric monotonicity requires gene-specific metrics; colour and categorical genes are not assumed monotonic.",
      },
    );

    status.textContent = `${subject} × ${style}: animation cycle`;
    canvas.width = 256;
    canvas.height = 192;
    const animation = sheet(4, 3, 256, 214);
    const animationErrors = [],
      animationBounds = [],
      animationHashes = [];
    for (let frame = 0; frame < 12; frame++) {
      const t = frame / 12;
      animationErrors.push(...poseIssues(anatomy, module.pose(anatomy, t)));
      paint(anatomy, t);
      const shot = capture();
      animationBounds.push(shot.bounds);
      if (!shot.area || shot.clipped)
        animationErrors.push(`Frame ${frame}: empty or clipped render`);
      animationHashes.push(await hash(shot.data));
      paste(animation, canvas, frame, `t = ${t.toFixed(3)} s`);
    }
    const loopDifference = maximumPoseDifference(
      module.pose(anatomy, 0),
      module.pose(anatomy, 1),
    );
    if (loopDifference > 1e-6)
      animationErrors.push(`Loop seam difference ${loopDifference}`);
    if (new Set(animationHashes).size === 1)
      animationErrors.push("All 12 frames are identical");
    samples.set("animation", animation.canvas.toDataURL("image/png"));
    add("Animation", animationErrors.length ? "fail" : "review", {
      errors: animationErrors,
      frames: 12,
      durationSeconds: 1,
      distinctFrames: new Set(animationHashes).size,
      loopDifference,
      bounds: animationBounds,
      interpretation:
        "Finite transforms, valid references, loop continuity and unclipped bounds are automated. Detached-looking parts, gait and wing quality need visual review.",
    });

    status.textContent = `${subject} × ${style}: 12-instance performance`;
    const bench = document.querySelector("#bench");
    benchRenderer = createRenderer(bench);
    const costs = [],
      intervals = [];
    let previous = 0,
      frame = 0;
    await new Promise((resolve, reject) => {
      const tick = (now) => {
        try {
          const started = performance.now();
          benchRenderer.renderBatch(
            seeds
              .slice(0, 12)
              .map((item) => ({
                anatomy: item,
                pose: module.pose(item, now / 1000),
              })),
            options,
          );
          if (frame >= 20) {
            costs.push(performance.now() - started);
            intervals.push(now - previous);
          }
          previous = now;
          frame++;
          if (frame < 140) requestAnimationFrame(tick);
          else resolve();
        } catch (error) {
          reject(error);
        }
      };
      requestAnimationFrame(tick);
    });
    const fps =
      1000 / (intervals.reduce((sum, n) => sum + n, 0) / intervals.length);
    costs.sort((a, b) => a - b);
    const p95 = costs[Math.floor(costs.length * 0.95)];
    document.querySelector("#benchmark-evidence")?.remove();
    const benchmarkEvidence = surface(bench.width, bench.height);
    benchmarkEvidence.id = "benchmark-evidence";
    benchmarkEvidence.style.display = "none";
    benchmarkEvidence.getContext("2d").drawImage(bench, 0, 0);
    document.body.append(benchmarkEvidence);
    samples.set("performance", benchmarkEvidence.toDataURL("image/png"));
    const renderingErrors = {
      evidence: glErrors(canvas),
      performance: glErrors(bench),
    };
    add(
      "WebGL errors",
      renderingErrors.evidence.length || renderingErrors.performance.length
        ? "fail"
        : "pass",
      renderingErrors,
    );
    add("Performance", fps >= 59.5 && p95 <= 1000 / 60 ? "pass" : "fail", {
      instances: 12,
      measuredFrames: costs.length,
      warmupFrames: 20,
      fps,
      meanFrameCpuMs: costs.reduce((sum, n) => sum + n, 0) / costs.length,
      p95FrameCpuMs: p95,
      maxTrianglesPerInstance: maxTriangles,
      meanGenerationMs: generationMs / 64,
      resolution: [1280, 720],
      instanceResolution: [320, 240],
      threshold:
        "At least 59.5 measured FPS (60 FPS scheduling tolerance) and p95 CPU frame time <= 16.667 ms",
      method:
        "12 animated individuals drawn in one WebGL canvas using 4×3 viewports; requestAnimationFrame cadence includes all rendering. Not a shared-camera race scene.",
    });
    add("Human visual review", "review", {
      recognisableSeedsRequired: 64,
      readableGenesRequired: 3,
      reviewer: null,
      interpretation:
        "Recognition, style quality, gene readability and animation quality have not yet been approved by a human.",
    });
    const failed = checks.filter((check) => check.status === "fail").length;
    const pending = checks.filter((check) => check.status === "review").length;
    status.textContent = `${subject} × ${style}: ${failed} failures, ${pending} checks need visual review`;
    return {
      subject,
      style,
      createdAt: new Date().toISOString(),
      checks,
      environment: {
        userAgent: navigator.userAgent,
        devicePixelRatio,
        hardwareConcurrency: navigator.hardwareConcurrency,
        renderer: renderer.info,
        viewport: [innerWidth, innerHeight],
        performanceResolution: [1280, 720],
      },
      summary: {
        status: failed ? "fail" : "review",
        failed,
        review: pending,
        passed: checks.length - failed - pending,
        proven: false,
      },
    };
  } finally {
    benchRenderer?.dispose();
    renderer.dispose();
  }
}

window.__checks = { run, image: (name) => samples.get(name) };
status.textContent = "Ready. Run npm run check to generate evidence.";
