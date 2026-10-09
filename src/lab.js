import {
  subjects,
  styles,
  loadSubject,
  makeGenome,
  restoreGenome,
} from "./subjects.js";
import { createRenderer } from "./render.js";
import { applyPalette } from "./palette.js";
import { showGenomeControls } from "./genomeControls.js";
import { withAttitude } from "./animate/flightAttitude.js";
import { createFlightModes } from "./flightModes.js";

applyPalette();
const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
let subjectId = params.get("subject") || "dragon",
  styleId = params.get("style") || "cozy";
let snapshot,
  module,
  anatomy,
  genome,
  siblings = [],
  playing = !matchMedia("(prefers-reduced-motion: reduce)").matches;
let time = 0,
  yaw = -0.6,
  pitch = 0.2,
  zoom = 1,
  lineup = false,
  revision = null,
  selectionVersion = 0;
let seed = "2407";
const flight = createFlightModes($("flight-modes"));
const errors = [];
const renderer = createRenderer($("view"));
const thumb = document.createElement("canvas");
thumb.width = 384;
thumb.height = 230;
const thumbRenderer = createRenderer(thumb);
let thumbVersion = 0;
const available = (s = subjectId, t = styleId) =>
  snapshot?.cells.some((c) => c.subject === s && c.style === t && c.available);
const cellFor = (s = subjectId, t = styleId) =>
  snapshot?.cells.find((c) => c.subject === s && c.style === t);
const stale = (cell) =>
  cell?.report &&
  (cell.report.environment?.sourceRevision !== snapshot.revision ||
    cell.report.environment?.sourceChangedDuringCheck);
const saved = {};
try {
  Object.assign(saved, JSON.parse(localStorage.getItem("dragonz-lab") || "{}"));
} catch {
  /* Ignore invalid saved settings. */
}
function remember() {
  if (!anatomy || !module || anatomy.subject !== subjectId) return;
  saved[subjectId] = {
    seed,
    genome,
    yaw,
    pitch,
    zoom,
    schema: JSON.stringify(module.genes),
  };
  try {
    localStorage.setItem("dragonz-lab", JSON.stringify(saved));
  } catch {
    /* Preview also works without storage. */
  }
}
function statusLabel(cell) {
  if (!cell.available) return "Queued";
  if (!cell.report) return "Preview";
  if (stale(cell)) return "Checks need rerun";
  return cell.report.summary?.failed ? "Checks need work" : "Review pending";
}
function navigation() {
  $("subjects").hidden = subjects.length < 2;
  $("subjects").replaceChildren(
    ...subjects.map((subject) => {
      const button = document.createElement("button");
      button.textContent = subject.label;
      button.setAttribute("aria-selected", String(subject.id === subjectId));
      if (
        !snapshot.cells.some((c) => c.subject === subject.id && c.available)
      ) {
        const small = document.createElement("small");
        small.textContent = "QUEUED";
        button.append(small);
      }
      button.onclick = () => select(subject.id, styleId);
      return button;
    }),
  );
  $("style-tabs").replaceChildren(
    ...styles.map((style) => {
      const button = document.createElement("button");
      button.textContent = style.label;
      button.setAttribute("aria-selected", String(style.id === styleId));
      button.onclick = () => select(subjectId, style.id);
      return button;
    }),
  );
}
function drawGenes() {
  showGenomeControls(module, genome, () => {
    rebuild();
    remember();
  });
}
function rebuild() {
  anatomy = module.createAnatomy(genome);
  siblings = Array.from({ length: 12 }, (_, i) =>
    i === 0
      ? anatomy
      : module.createAnatomy(makeGenome(module.genes, `${seed}-${i}`)),
  );
}
async function select(nextSubject, nextStyle) {
  const version = ++selectionVersion;
  subjectId = subjects.some((s) => s.id === nextSubject)
    ? nextSubject
    : "dragon";
  styleId = styles.some((s) => s.id === nextStyle) ? nextStyle : "cozy";
  history.replaceState(null, "", `?subject=${subjectId}&style=${styleId}`);
  navigation();
  evidence();
  for (const cell of document.querySelectorAll(".cell"))
    cell.classList.toggle(
      "selected",
      cell.dataset.subject === subjectId && cell.dataset.style === styleId,
    );
  $("subject-title").textContent = subjects.find(
    (s) => s.id === subjectId,
  ).label;
  $("specimen-label").textContent =
    `${styles.find((s) => s.id === styleId).label.toUpperCase()} / PROCEDURAL STUDY`;
  $("empty-state").hidden = available();
  $("view").hidden = !available();
  $("stage-status").textContent = available()
    ? "Preview · human review pending"
    : "Queued";
  $("genes").replaceChildren();
  anatomy = null;
  $("mesh-info").textContent = available()
    ? "Loading geometry"
    : "Not generated yet";
  if (!available()) {
    $("empty-state").textContent =
      "This style is queued. Existing previews remain available.";
    return;
  }
  try {
    const loaded = await loadSubject(subjectId);
    if (version !== selectionVersion) return;
    module = loaded;
    const previous = saved[subjectId];
    seed = previous?.seed || seed;
    let previousGenes = [];
    try {
      previousGenes = JSON.parse(previous?.schema || "[]");
    } catch {
      /* Regenerate unrecognized saved genes. */
    }
    genome = restoreGenome(
      module.genes,
      seed,
      previous?.genome,
      Array.isArray(previousGenes) ? previousGenes : [],
    );
    yaw = previous?.yaw ?? -0.6;
    pitch = previous?.pitch ?? 0.2;
    zoom = previous?.zoom ?? 1;
    $("seed").value = seed;
    $("seed-label").textContent = `SEED ${seed}`;
    rebuild();
    drawGenes();
  } catch (error) {
    errors.push(error.message);
    $("empty-state").textContent = error.message;
    $("empty-state").hidden = false;
  }
}
async function matrix() {
  const version = ++thumbVersion;
  const fragment = document.createDocumentFragment();
  fragment.append(document.createElement("span"));
  for (const style of styles) {
    const h = document.createElement("div");
    h.className = "matrix-column";
    h.textContent = style.label;
    fragment.append(h);
  }
  const previews = [];
  for (const subject of subjects) {
    const label = document.createElement("div");
    label.className = "matrix-row";
    label.textContent = subject.label;
    const note = document.createElement("span");
    note.textContent = "Seed 2407";
    label.append(note);
    fragment.append(label);
    for (const style of styles) {
      const cell = cellFor(subject.id, style.id),
        button = document.createElement("button");
      button.className = `cell ${cell.available ? "" : "pending"} ${cell.report?.summary?.failed ? "failed" : ""}`;
      button.dataset.subject = subject.id;
      button.dataset.style = style.id;
      button.classList.toggle(
        "selected",
        subject.id === subjectId && style.id === styleId,
      );
      button.setAttribute(
        "aria-label",
        `${subject.label}, ${style.label}: ${statusLabel(cell)}`,
      );
      button.onclick = () => select(subject.id, style.id);
      const placeholder = document.createElement("div");
      placeholder.className = "queued";
      placeholder.textContent = cell.available ? "Preparing…" : "COMING LATER";
      button.append(placeholder);
      const status = document.createElement("div");
      status.className = "cell-status";
      status.textContent = statusLabel(cell);
      if (cell.available) {
        const dot = document.createElement("i");
        dot.className = "status-dot";
        status.append(dot);
        previews.push({ subject, style, button, placeholder });
      }
      button.append(status);
      fragment.append(button);
    }
  }
  $("matrix").replaceChildren(fragment);
  for (const item of previews) {
    if (version !== thumbVersion) return;
    try {
      const model = await loadSubject(item.subject.id),
        body = model.createAnatomy(makeGenome(model.genes, "2407"));
      thumbRenderer.render(body, model.pose(body, 0.13), {
        style: item.style.id,
        yaw: -0.6,
        pitch: 0.22,
        zoom: 1.04,
      });
      const image = document.createElement("img");
      image.alt = `${item.subject.label} in ${item.style.label}`;
      image.src = thumb.toDataURL();
      item.placeholder.replaceWith(image);
    } catch (error) {
      item.placeholder.textContent = "Preview error";
      errors.push(error.message);
    }
    await new Promise((resolve) => requestAnimationFrame(resolve));
  }
}
function evidence() {
  const cell = cellFor(),
    report = cell?.report;
  $("check-results").replaceChildren();
  $("evidence-links").replaceChildren();
  if (!report) {
    $("evidence-state").textContent = "Awaiting checks";
    const p = document.createElement("p");
    p.className = "no-evidence";
    p.textContent =
      "This is a working preview. Automated evidence will appear here as checks finish: 64 seeds, broadcast scale, gene sweeps, animation and 12-instance performance. Recognition and visual quality still need your review.";
    $("check-results").append(p);
    return;
  }
  $("evidence-state").textContent = stale(cell)
    ? "Source changed · evidence needs rerun"
    : `${report.summary?.passed || 0} passed · ${report.summary?.failed || 0} failed · ${report.summary?.review || 0} need review`;
  for (const check of report.checks) {
    const panel = document.createElement("div");
    panel.className = "check";
    const heading = document.createElement("div");
    heading.className = "check-head";
    const name = document.createElement("span");
    name.textContent = check.name;
    const state = document.createElement("span");
    state.className = `check-status ${check.status}`;
    state.textContent = check.status;
    heading.append(name, state);
    const detail = document.createElement("p");
    detail.textContent =
      typeof check.details === "string" ? check.details : describe(check);
    panel.append(heading, detail);
    $("check-results").append(panel);
  }
  for (const [file, label] of [
    ["contact.png", "64-seed sheet"],
    ["broadcast.png", "Broadcast scale"],
    ["genes.png", "Gene sweeps"],
    ["animation.png", "Animation strip"],
    ["performance.png", "12-instance scene"],
    ["report.json", "Full report"],
  ]) {
    const link = document.createElement("a");
    link.href = `/shots/${subjectId}/${styleId}/${file}`;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = `${label} ↗`;
    $("evidence-links").append(link);
  }
}
function describe(check) {
  const data = check.details || {};
  if (data.note) return data.note;
  if (data.reason) return data.reason;
  return (
    Object.entries(data)
      .filter(
        ([, v]) =>
          typeof v === "number" ||
          typeof v === "string" ||
          typeof v === "boolean",
      )
      .slice(0, 4)
      .map(
        ([k, v]) =>
          `${k}: ${typeof v === "number" ? Math.round(v * 100) / 100 : v}`,
      )
      .join(" · ") || "See the full report and images for measurements."
  );
}
async function poll(initial = false) {
  try {
    const response = await fetch("/api/progress", { cache: "no-store" });
    if (!response.ok) throw new Error("Progress unavailable");
    const next = await response.json();
    $("connection-label").textContent = "Watching local files";
    $("connection-label").parentElement.classList.remove("offline");
    if (revision && revision !== next.revision) {
      $("reload-source").hidden = false;
      return;
    }
    const reportsChanged =
      snapshot &&
      JSON.stringify(snapshot.cells.map((c) => c.report?.createdAt)) !==
        JSON.stringify(next.cells.map((c) => c.report?.createdAt));
    snapshot = next;
    revision = next.revision;
    $("preview-count").textContent =
      `${next.cells.filter((c) => c.available).length} / ${subjects.length * styles.length}`;
    $("activity-message").textContent = next.activity.message;
    $("activity-time").textContent = next.activity.updatedAt
      ? `Updated ${new Date(next.activity.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
      : "";
    $("revision-label").textContent = `SOURCE ${revision.slice(0, 7)}`;
    if (initial) {
      if (!available() && !params.has("subject")) {
        const first = next.cells.find((c) => c.available);
        if (first) {
          subjectId = first.subject;
          styleId = first.style;
        }
      }
      await select(subjectId, styleId);
      matrix();
    } else if (reportsChanged) {
      matrix();
      evidence();
    }
  } catch (error) {
    $("connection-label").textContent = "Offline · last preview retained";
    $("connection-label").parentElement.classList.add("offline");
    if (initial) {
      $("empty-state").hidden = false;
      $("empty-state").textContent = error.message;
    }
  }
}
$("seed-form").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!module || !available()) return;
  seed = $("seed").value.trim() || "2407";
  genome = makeGenome(module.genes, seed);
  rebuild();
  drawGenes();
  remember();
  $("seed-label").textContent = `SEED ${seed}`;
});
$("reset-genes").onclick = () => {
  if (!module || !available()) return;
  genome = makeGenome(module.genes, seed);
  rebuild();
  drawGenes();
  remember();
};
function playLabel() {
  $("play").innerHTML = playing
    ? "Ⅱ <span>Pause</span>"
    : "▶ <span>Play</span>";
  $("play").setAttribute(
    "aria-label",
    playing ? "Pause animation" : "Play animation",
  );
}
$("play").onclick = () => {
  playing = !playing;
  playLabel();
};
playLabel();
$("timeline").oninput = () => {
  playing = false;
  playLabel();
  time = Number($("timeline").value);
};
$("reset-camera").onclick = () => {
  yaw = -0.6;
  pitch = 0.2;
  zoom = 1;
  remember();
};
$("lineup").onclick = () => {
  lineup = !lineup;
  $("lineup").textContent = lineup ? "Single specimen" : "12 together";
};
let drag;
$("view").onpointerdown = (event) => {
  drag = [event.clientX, event.clientY, yaw, pitch];
  $("view").setPointerCapture(event.pointerId);
};
$("view").onpointermove = (event) => {
  if (!drag) return;
  yaw = drag[2] + (event.clientX - drag[0]) * 0.008;
  pitch = Math.max(
    -1.3,
    Math.min(1.3, drag[3] + (event.clientY - drag[1]) * 0.006),
  );
};
$("view").onpointerup = () => {
  drag = null;
  remember();
};
$("view").onpointercancel = () => {
  drag = null;
};
$("view").addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    zoom = Math.max(
      0.45,
      Math.min(2.5, zoom * Math.exp(-event.deltaY * 0.001)),
    );
    remember();
  },
  { passive: false },
);
new ResizeObserver(() => {
  const rect = $("stage").getBoundingClientRect();
  $("view").width = Math.round(rect.width);
  $("view").height = Math.round(rect.height);
}).observe($("stage"));
let last = performance.now(),
  lastInfo = 0;
function frame(now) {
  const delta = Math.min(0.1, (now - last) / 1000);
  last = now;
  flight.phase = time;
  const motion = playing
    ? flight.step(delta, anatomy?.genome?.wingspan).motion
    : flight.motion();
  time = flight.phase;
  if (anatomy && available()) {
    try {
      const posed = (body, phase) =>
        withAttitude(module.pose(body, phase, motion), motion);
      const options = { style: styleId, yaw, pitch, zoom };
      const result = lineup
        ? renderer.renderBatch(
            siblings.map((body, i) => ({
              anatomy: body,
              pose: posed(body, time + i * 0.07),
            })),
            options,
          )
        : renderer.render(anatomy, posed(anatomy, time), options);
      if (now - lastInfo > 150) {
        $("mesh-info").textContent =
          `${(lineup ? result.reduce((s, r) => s + r.triangles, 0) : result.triangles).toLocaleString()} triangles · ${lineup ? 12 : 1} specimen${lineup ? "s" : ""}`;
        $("timeline").value = time;
        $("frame-label").textContent = `${time.toFixed(2)} s`;
        lastInfo = now;
      }
    } catch (error) {
      errors.push(error.message);
      anatomy = null;
      $("empty-state").hidden = false;
      $("empty-state").textContent = error.message;
    }
  }
  requestAnimationFrame(frame);
}
window.__dragonz = {
  getState: () => ({
    subject: subjectId,
    style: styleId,
    seed,
    genome,
    time,
    playing,
    lineup,
    flightMode: flight.mode,
    available: available(),
    errors,
    renderer: renderer.info,
  }),
  select,
  setFlightMode: (id) => flight.set(id),
};
$("reload-source").addEventListener("click", () => {
  remember();
  location.reload();
});
await poll(true);
requestAnimationFrame(frame);
setInterval(() => poll(), 2500);
