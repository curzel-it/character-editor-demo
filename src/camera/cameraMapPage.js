import { applyPalette, palette, pigment } from "../palette.js";
import { createCourse } from "../course/createCourse.js";
import { simulateRace } from "../race/simulateRace.js";
import { sampleRace } from "../race/sampleRace.js";
import { loadSubject, makeGenome } from "../subjects.js";
import { cross, dot, normalize, sub } from "../vec3.js";
import { creatureScale, lengthScale, speedScale } from "../worldScale.js";
import { createDirector } from "./createDirector.js";
import { pathAt, terrainHeight } from "./courseGeometry.js";
import { shotTypes } from "./shotTypes.js";
import {
  createSyntheticCourse,
  createSyntheticRecording,
} from "./syntheticRace.js";

applyPalette();

const $ = (id) => document.getElementById(id);
const css = (rgb, alpha = 1) =>
  `rgb(${rgb.map((v) => Math.round(v * 255)).join(" ")} / ${alpha})`;
const shotColor = (shot) => pigment(shotTypes[shot]?.hue ?? 0, 0.62, 0.58);
const NAMES = [
  "Ashwing", "Emberclaw", "Skyrend", "Duskfang", "Talonfall", "Stormveil",
  "Cinderjaw", "Frostquill", "Gravelwing", "Mistral", "Sootscale", "Brightspur",
];
const ASPECT = 16 / 9;

const state = { t: 0, playing: false, last: 0, race: null };

async function buildRace() {
  const source = $("source").value,
    seed = $("seed").value || "fixture",
    count = Math.max(2, Math.min(12, Number($("count").value) || 8));
  let course, recording;
  if (source === "live") {
    course = createCourse(seed);
    let genes = [];
    try {
      genes = (await loadSubject("dragon")).genes;
    } catch {
      genes = [];
    }
    const roster = Array.from({ length: count }, (_, i) => ({
      id: `r${i}`,
      name: NAMES[i],
      subject: "dragon",
      genome: makeGenome(genes, `${seed}:${i}`),
    }));
    recording = simulateRace({ seed, course, roster });
  } else {
    course = createSyntheticCourse(
      seed,
      source === "hills" ? { hilly: 3, bend: 0.8 } : {},
    );
    recording = createSyntheticRecording(course, { seed, count });
  }
  const started = performance.now();
  const director = createDirector(recording, course);
  const ms = performance.now() - started;
  const colors = new Map(
    recording.roster.map((r, i) => [
      r.id,
      pigment(i / recording.roster.length, 0.7, 0.62),
    ]),
  );
  return {
    course,
    recording,
    director,
    colors,
    names: new Map(recording.roster.map((r) => [r.id, r.name])),
    end: (recording.frames.length - 1) / recording.hz,
    terrain: terrainImage(course.terrain),
    ms,
  };
}

function terrainImage(terrain) {
  const { columns, rows, heights } = terrain;
  const canvas = document.createElement("canvas");
  canvas.width = columns;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  const image = ctx.createImageData(columns, rows);
  let lo = Infinity,
    hi = -Infinity;
  for (const h of heights) (lo = Math.min(lo, h)), (hi = Math.max(hi, h));
  const span = hi - lo || 1;
  for (let i = 0; i < heights.length; i++) {
    const k = (heights[i] - lo) / span;
    const rgb = palette.ground.map(
      (g, c) => g + (palette.steel[c] - g) * k * 0.9,
    );
    image.data.set(
      [...rgb.map((v) => Math.round(v * 255)), 255],
      i * 4,
    );
  }
  ctx.putImageData(image, 0, 0);
  return canvas;
}

function fit(canvas) {
  const ratio = devicePixelRatio || 1,
    w = canvas.clientWidth,
    h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * ratio) || canvas.height !== Math.round(h * ratio)) {
    canvas.width = Math.round(w * ratio);
    canvas.height = Math.round(h * ratio);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, w, h };
}

function drawMap(race, camera, racers) {
  const { ctx, w, h } = fit($("map"));
  const { course } = race;
  ctx.fillStyle = css(palette.background);
  ctx.fillRect(0, 0, w, h);
  let cx, cz, scale;
  if ($("mapMode").value === "course") {
    const xs = course.path.map((p) => p.position[0]),
      zs = course.path.map((p) => p.position[2]);
    const pad = 80 * lengthScale;
    const minX = Math.min(...xs) - pad,
      maxX = Math.max(...xs) + pad,
      minZ = Math.min(...zs) - pad,
      maxZ = Math.max(...zs) + pad;
    scale = Math.min(w / (maxX - minX), h / (maxZ - minZ));
    cx = (minX + maxX) / 2;
    cz = (minZ + maxZ) / 2;
  } else {
    cx = (camera.eye[0] + camera.target[0]) / 2;
    cz = (camera.eye[2] + camera.target[2]) / 2;
    scale = Math.min(w, h) / (320 * speedScale);
  }
  const X = (x) => w / 2 + (x - cx) * scale,
    Z = (z) => h / 2 + (z - cz) * scale;
  $("mapInfo").textContent = `${(w / scale).toFixed(0)} m wide · +X right, +Z down`;

  const t = course.terrain;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    race.terrain,
    X(t.origin[0] - t.cellSize / 2),
    Z(t.origin[1] - t.cellSize / 2),
    t.columns * t.cellSize * scale,
    t.rows * t.cellSize * scale,
  );

  const edge = (sign) => {
    ctx.beginPath();
    course.path.forEach((p, i) => {
      const f = normalize([p.forward[0], 0, p.forward[2]]);
      const x = p.position[0] - f[2] * p.halfWidth * sign,
        z = p.position[2] + f[0] * p.halfWidth * sign;
      i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z));
    });
    ctx.stroke();
  };
  ctx.strokeStyle = css(palette.ivory, 0.25);
  ctx.lineWidth = 1;
  edge(1);
  edge(-1);
  ctx.setLineDash([4, 6]);
  ctx.strokeStyle = css(palette.ivory, 0.35);
  edge(0);
  ctx.setLineDash([]);

  for (const th of course.thermals ?? []) {
    ctx.strokeStyle = css(palette.glass, 0.9);
    ctx.beginPath();
    ctx.arc(X(th.position[0]), Z(th.position[2]), th.radius * scale, 0, Math.PI * 2);
    ctx.stroke();
  }
  course.gates.forEach((g, i) => {
    const f = normalize([g.forward[0], 0, g.forward[2]]);
    const last = i === course.gates.length - 1;
    ctx.strokeStyle = css(last ? palette.gold : palette.ivory, last ? 1 : 0.7);
    ctx.lineWidth = last ? 3 : 2;
    ctx.beginPath();
    ctx.moveTo(X(g.position[0] - f[2] * g.radius), Z(g.position[2] + f[0] * g.radius));
    ctx.lineTo(X(g.position[0] + f[2] * g.radius), Z(g.position[2] - f[0] * g.radius));
    ctx.stroke();
    if (scale > 0.6 / lengthScale) {
      ctx.fillStyle = css(palette.ivory, 0.6);
      ctx.font = "10px sans-serif";
      ctx.fillText(last ? "FINISH" : `G${i + 1}`, X(g.position[0]) + 4, Z(g.position[2] - g.radius) - 4);
    }
  });

  const color = shotColor(camera.shot);
  const dir = sub(camera.target, camera.eye);
  const heading = Math.atan2(dir[2], dir[0]);
  const half = Math.atan(Math.tan(camera.fov / 2) * ASPECT);
  const reach = Math.max(60 * lengthScale, Math.hypot(dir[0], dir[2]) * 1.6);
  ctx.fillStyle = css(color, 0.18);
  ctx.strokeStyle = css(color, 0.8);
  ctx.beginPath();
  ctx.moveTo(X(camera.eye[0]), Z(camera.eye[2]));
  for (const a of [heading - half, heading + half])
    ctx.lineTo(X(camera.eye[0] + Math.cos(a) * reach), Z(camera.eye[2] + Math.sin(a) * reach));
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  for (const r of racers) {
    const c = race.colors.get(r.id);
    const x = X(r.position[0]),
      z = Z(r.position[2]);
    ctx.fillStyle = css(c);
    ctx.beginPath();
    ctx.arc(x, z, r.id === camera.subject ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    if (r.id === camera.subject) {
      ctx.strokeStyle = css(palette.ivory);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, z, 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (scale > 0.8) {
      ctx.fillStyle = css(palette.ivory, 0.85);
      ctx.font = "11px sans-serif";
      ctx.fillText(`${r.place} ${race.names.get(r.id)}`, x + 7, z + 4);
    }
  }

  ctx.strokeStyle = css(palette.ivory, 0.8);
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(X(camera.eye[0]), Z(camera.eye[2]));
  ctx.lineTo(X(camera.target[0]), Z(camera.target[2]));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = css(color);
  ctx.fillRect(X(camera.eye[0]) - 5, Z(camera.eye[2]) - 5, 10, 10);
  ctx.strokeStyle = css(palette.ivory);
  ctx.lineWidth = 1.5;
  const tx = X(camera.target[0]),
    tz = Z(camera.target[2]);
  ctx.beginPath();
  ctx.moveTo(tx - 6, tz);
  ctx.lineTo(tx + 6, tz);
  ctx.moveTo(tx, tz - 6);
  ctx.lineTo(tx, tz + 6);
  ctx.stroke();
}

function projector(camera, w, h) {
  const f = normalize(sub(camera.target, camera.eye));
  const right = normalize(cross(f, camera.up)),
    up = cross(right, f);
  const k = h / 2 / Math.tan(camera.fov / 2);
  return (p) => {
    const d = sub(p, camera.eye),
      z = dot(d, f);
    if (z < 0.5) return null;
    return [w / 2 + (dot(d, right) / z) * k, h / 2 - (dot(d, up) / z) * k, z];
  };
}

function drawView(race, camera, racers) {
  const { ctx, w, h } = fit($("view"));
  ctx.fillStyle = css(palette.background);
  ctx.fillRect(0, 0, w, h);
  const project = projector(camera, w, h);
  const { course } = race;
  const line = (points, style, width = 1) => {
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    let pen = false;
    for (const p of points) {
      const q = project(p);
      if (!q) {
        pen = false;
        continue;
      }
      pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
      pen = true;
    }
    ctx.stroke();
  };
  const s0 = Math.max(0, racers.reduce((m, r) => Math.min(m, r.progress), Infinity) - 250 * lengthScale);
  const ground = [];
  for (let s = s0; s < s0 + 900 * lengthScale && s <= course.length + 100 * lengthScale; s += 10) {
    const c = pathAt(course, s);
    const f = normalize([c.forward[0], 0, c.forward[2]]);
    ground.push(
      [-1, 1].map((sign) => {
        const x = c.position[0] - f[2] * c.halfWidth * 1.4 * sign,
          z = c.position[2] + f[0] * c.halfWidth * 1.4 * sign;
        return [x, terrainHeight(course.terrain, x, z), z];
      }),
    );
  }
  line(ground.map((g) => g[0]), css(palette.steel, 0.9));
  line(ground.map((g) => g[1]), css(palette.steel, 0.9));
  for (let i = 0; i < ground.length; i += Math.round(3 * lengthScale)) line(ground[i], css(palette.steel, 0.35));
  course.gates.forEach((g, i) => {
    const f = normalize([g.forward[0], 0, g.forward[2]]);
    const ring = [];
    for (let a = 0; a <= 24; a++) {
      const u = (a / 24) * Math.PI * 2;
      ring.push([
        g.position[0] - f[2] * Math.cos(u) * g.radius,
        g.position[1] + Math.sin(u) * g.radius,
        g.position[2] + f[0] * Math.cos(u) * g.radius,
      ]);
    }
    const last = i === course.gates.length - 1;
    line(ring, css(last ? palette.gold : palette.ivory, 0.7), last ? 2.5 : 1.5);
  });
  const shown = racers
    .map((r) => ({ r, q: project(r.position) }))
    .filter((v) => v.q)
    .sort((a, b) => b.q[2] - a.q[2]);
  for (const { r, q } of shown) {
    const size = Math.max(2, Math.min(40, ((4 * creatureScale) / q[2]) * (h / 2 / Math.tan(camera.fov / 2))));
    ctx.fillStyle = css(race.colors.get(r.id));
    ctx.beginPath();
    ctx.ellipse(q[0], q[1], size, size * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    if (r.id === camera.subject) {
      ctx.strokeStyle = css(palette.ivory);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (size > 3) {
      ctx.fillStyle = css(palette.ivory, 0.8);
      ctx.font = "10px sans-serif";
      ctx.fillText(race.names.get(r.id), q[0] + size + 3, q[1] + 3);
    }
  }
  ctx.strokeStyle = css(palette.ivory, 0.25);
  ctx.strokeRect(w / 2 - 6, h / 2 - 6, 12, 12);
}

function buildStrip(race) {
  const { director, end, recording } = race;
  const strip = $("strip");
  strip.querySelectorAll("div").forEach((d) => d.remove());
  for (const s of director.timeline) {
    const d = document.createElement("div");
    d.style.left = `${(s.start / end) * 100}%`;
    d.style.width = `${((s.end - s.start) / end) * 100}%`;
    d.style.background = css(shotColor(s.shot));
    d.textContent = s.reason;
    d.title = `${s.start.toFixed(2)}–${s.end.toFixed(2)} s · ${shotTypes[s.shot].label}\n${s.reason}`;
    strip.prepend(d);
  }
  const events = $("events");
  events.replaceChildren();
  for (const e of recording.events) {
    if (e.type === "gate") continue;
    const m = document.createElement("span");
    m.style.left = `${(e.t / end) * 100}%`;
    const tone =
      e.type === "overtake" ? palette.steel : e.type === "finish" ? palette.gold : palette.ivory;
    m.style.background = css(tone, e.type === "overtake" ? 0.8 : 1);
    m.title = `${e.t.toFixed(2)} s · ${e.type} · ${race.names.get(e.racer) ?? e.racer}${
      e.other ? ` over ${race.names.get(e.other) ?? e.other}` : ""
    }`;
    events.append(m);
  }
  const edl = $("edl");
  edl.replaceChildren(
    ...director.timeline.map((s, i) => {
      const li = document.createElement("li");
      li.dataset.index = i;
      const time = document.createElement("time");
      time.textContent = `${s.start.toFixed(1)}–${s.end.toFixed(1)}`;
      const swatch = document.createElement("i");
      swatch.style.background = css(shotColor(s.shot));
      const text = document.createElement("span");
      text.textContent = `${shotTypes[s.shot].label}: ${s.reason}`;
      li.append(time, swatch, text);
      li.addEventListener("click", () => seek(s.start + 0.01));
      return li;
    }),
  );
  $("edlCount").textContent = `${director.timeline.length} shots`;
  $("scrub").max = end;
}

function legend() {
  $("legend").replaceChildren(
    ...Object.entries(shotTypes).map(([id, type]) => {
      const span = document.createElement("span");
      const i = document.createElement("i");
      i.style.background = css(shotColor(id));
      span.append(i, type.label);
      return span;
    }),
  );
}

function render() {
  const race = state.race;
  if (!race) return;
  const t = state.t;
  const camera = race.director.shotAt(t);
  const racers = sampleRace(race.recording, t).racers;
  drawMap(race, camera, racers);
  drawView(race, camera, racers);
  $("clock").textContent = `${t.toFixed(2)} / ${race.end.toFixed(1)} s`;
  $("scrub").value = t;
  $("strip").querySelector(".playhead").style.left = `${(t / race.end) * 100}%`;
  $("shotName").textContent = shotTypes[camera.shot].label;
  $("caption").textContent = camera.reason;
  const current = race.director.timeline.findIndex((s) => t >= s.start && t < s.end);
  const index = current < 0 ? race.director.timeline.length - 1 : current;
  for (const li of $("edl").children) {
    const on = Number(li.dataset.index) === index;
    if (on && !li.classList.contains("current"))
      li.scrollIntoView({ block: "nearest" });
    li.classList.toggle("current", on);
  }
  const entry = race.director.timeline[index];
  const clearance = camera.eye[1] - terrainHeight(race.course.terrain, camera.eye[0], camera.eye[2]);
  const fmt = (v) => v.map((n) => n.toFixed(1)).join(", ");
  const rows = [
    ["Shot", `${shotTypes[camera.shot].label} (${entry.start.toFixed(2)}–${entry.end.toFixed(2)} s)`],
    ["Subject", race.names.get(camera.subject) ?? "—"],
    ["Other", entry.other ? race.names.get(entry.other) : "—"],
    ["Side", entry.side ? (entry.side > 0 ? "+ side" : "− side") : "on the line"],
    ["FOV", `${((camera.fov * 180) / Math.PI).toFixed(1)}° vertical`],
    ["Eye", fmt(camera.eye)],
    ["Target", fmt(camera.target)],
    ["Clearance", `${clearance.toFixed(1)} m above terrain`],
  ];
  $("details").replaceChildren(
    ...rows.flatMap(([k, v]) => {
      const dt = document.createElement("dt"),
        dd = document.createElement("dd");
      dt.textContent = k;
      dd.textContent = v;
      return [dt, dd];
    }),
  );
}

function seek(t) {
  if (!state.race) return;
  state.t = Math.max(0, Math.min(state.race.end, t));
  render();
}

function tick(now) {
  if (state.playing && state.race) {
    const dt = Math.min(0.1, (now - state.last) / 1000) * Number($("speed").value);
    state.t += dt;
    if (state.t >= state.race.end) {
      state.t = state.race.end;
      setPlaying(false);
    }
    render();
  }
  state.last = now;
  requestAnimationFrame(tick);
}

function setPlaying(on) {
  state.playing = on;
  $("play").textContent = on ? "Pause" : "Play";
}

async function rebuild() {
  const status = $("status");
  status.className = "";
  status.textContent = "Building…";
  try {
    state.race = await buildRace();
    buildStrip(state.race);
    const r = state.race;
    status.textContent = `${r.recording.roster.length} racers · ${r.end.toFixed(1)} s · ${r.director.timeline.length} shots · directed in ${r.ms.toFixed(0)} ms`;
    seek(Math.min(state.t, r.end));
  } catch (error) {
    status.className = "error";
    status.textContent = `Could not build: ${error.message}`;
    console.error(error);
  }
}

$("play").addEventListener("click", () => {
  if (state.race && state.t >= state.race.end) state.t = 0;
  setPlaying(!state.playing);
});
$("scrub").addEventListener("input", (e) => seek(Number(e.target.value)));
for (const id of ["strip", "events"])
  $(id).addEventListener("click", (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    seek(((e.clientX - box.left) / box.width) * (state.race?.end ?? 0));
  });
$("rebuild").addEventListener("click", rebuild);
$("source").addEventListener("change", () => {
  $("seed").value = $("source").value === "live" ? "1" : $("source").value;
  rebuild();
});
$("mapMode").addEventListener("change", render);
addEventListener("resize", render);
addEventListener("keydown", (e) => {
  if (e.target.matches("input, select")) return;
  if (e.code === "Space") {
    e.preventDefault();
    $("play").click();
  } else if (e.code === "ArrowRight") seek(state.t + (e.shiftKey ? 5 : 0.5));
  else if (e.code === "ArrowLeft") seek(state.t - (e.shiftKey ? 5 : 0.5));
});

legend();
rebuild();
requestAnimationFrame(tick);
