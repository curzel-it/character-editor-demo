import { applyPalette, palette, pigment } from "../palette.js";
import { makeRng } from "../rng.js";
import { genes } from "../genome/dragon.js";
import { makeGenome } from "../subjects.js";
import { createCourse } from "../course/createCourse.js";
import { simulateRace } from "./simulateRace.js";
import { raceGeometry } from "./raceGeometry.js";
import { sampleRace } from "./sampleRace.js";
import { windingCourse } from "./windingCourse.js";
import { froude } from "./froude.js";

applyPalette();
const $ = (id) => document.getElementById(id);
const kmh = (v) => `${(v * 3.6).toFixed(0)} km/h`;
const clockTime = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
const css = (rgb, alpha = 1) =>
  `rgb(${rgb.map((v) => Math.round(v * 255)).join(" ")} / ${alpha})`;
const ink = {
  bg: css(palette.background),
  ground: css(palette.ground),
  edge: css([0.16, 0.2, 0.25]),
  muted: css([0.53, 0.61, 0.67]),
  text: css([0.9, 0.93, 0.95]),
  gate: css(palette.gold),
  gateFaint: css(palette.gold, 0.35),
  thermal: css([0.95, 0.4, 0.36], 0.18),
  thermalEdge: css([0.95, 0.4, 0.36], 0.6),
  corridor: css(palette.steel, 0.22),
  band: css(palette.steel, 0.16),
};
const syllables = ["ka", "ri", "vo", "sen", "dra", "mo", "tal", "ix", "ul", "zen", "fa", "ro", "gha", "le", "nyx", "or"];

let state = null;
let playing = false,
  last = 0,
  selected = null;

function nameFor(seed) {
  const random = makeRng(`name:${seed}`);
  const count = 2 + Math.floor(random() * 2);
  const name = Array.from({ length: count }, () => syllables[Math.floor(random() * syllables.length)]).join("");
  return name[0].toUpperCase() + name.slice(1);
}

function unique(name, taken) {
  let result = name;
  for (let n = 2; taken.has(result); n++) result = `${name} ${n}`;
  taken.add(result);
  return result;
}

function run() {
  const courseSeed = $("course-seed").value.trim() || "canyon-1",
    raceSeed = $("race-seed").value.trim() || "race-1",
    field = Math.max(2, Math.min(12, Number($("field").value) || 8)),
    track = $("track").value;
  const params = new URLSearchParams({ course: courseSeed, race: raceSeed, field, track });
  history.replaceState(null, "", `?${params}`);
  const course = track === "winding" ? windingCourse(courseSeed) : createCourse(courseSeed);
  const taken = new Set();
  const roster = Array.from({ length: field }, (_, i) => ({
    id: `${raceSeed}-${i}`,
    name: unique(nameFor(`${raceSeed}:${i}`), taken),
    subject: "dragon",
    genome: makeGenome(genes, `${raceSeed}:${i}`),
  }));
  const started = performance.now();
  const recording = simulateRace({ seed: raceSeed, course, roster });
  const elapsed = performance.now() - started;
  const colors = Object.fromEntries(
    recording.roster.map((r, i) => [r.id, css(pigment(i / field + 0.02, 0.75, 0.62))]),
  );
  const names = Object.fromEntries(recording.roster.map((r) => [r.id, r.name]));
  state = { course, geometry: raceGeometry(course), recording, colors, names, t: 0, trails: {} };
  selected = recording.results[0].id;
  $("scrub").max = recording.duration;
  $("scrub").value = 0;
  const winner = recording.results[0];
  $("summary").textContent =
    `${(course.length / 1000).toFixed(2)} km · ${course.gates.length} gates · ${course.thermals.length} thermals · ` +
    `won by ${names[winner.id]} in ${clockTime(winner.time ?? 0)} ` +
    `(${kmh((state.geometry.finishS - state.geometry.corridor.start) / (winner.time || 1))} average) · simulated in ${elapsed.toFixed(0)} ms`;
  prepareBounds();
  renderLog();
  seek(0);
}

function prepareBounds() {
  const { course } = state;
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity,
    minY = Infinity,
    maxY = -Infinity;
  for (const p of course.path) {
    const left = [-p.forward[2], p.forward[0]];
    for (const side of [-1, 1]) {
      const x = p.position[0] + left[0] * p.halfWidth * side,
        z = p.position[2] + left[1] * p.halfWidth * side;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minZ = Math.min(minZ, z);
      maxZ = Math.max(maxZ, z);
    }
    minY = Math.min(minY, p.floor);
    maxY = Math.max(maxY, p.ceiling);
  }
  state.bounds = { minX, maxX, minZ, maxZ, minY, maxY };
}

function fitCanvas(canvas) {
  const ratio = devicePixelRatio || 1,
    { width, height } = canvas.getBoundingClientRect();
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return { ctx, width, height };
}

function drawMap(sample) {
  const { ctx, width, height } = fitCanvas($("map"));
  const { course, bounds, colors, geometry } = state;
  ctx.fillStyle = ink.bg;
  ctx.fillRect(0, 0, width, height);
  const focus = $("follow").checked && sample.racers.find((r) => r.id === selected);
  let cx, cz, scale;
  if (focus) {
    [cx, , cz] = focus.position;
    scale = Math.min(width, height) / (420 * froude.length);
  } else {
    cx = (bounds.minX + bounds.maxX) / 2;
    cz = (bounds.minZ + bounds.maxZ) / 2;
    scale = Math.min((width - 40) / (bounds.maxX - bounds.minX), (height - 40) / (bounds.maxZ - bounds.minZ));
  }
  const X = (x) => width / 2 + (x - cx) * scale,
    Y = (z) => height / 2 - (z - cz) * scale;

  ctx.beginPath();
  course.path.forEach((p, i) => {
    const l = [-p.forward[2], p.forward[0]];
    const x = X(p.position[0] + l[0] * p.halfWidth),
      y = Y(p.position[2] + l[1] * p.halfWidth);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  for (let i = course.path.length - 1; i >= 0; i--) {
    const p = course.path[i],
      l = [-p.forward[2], p.forward[0]];
    ctx.lineTo(X(p.position[0] - l[0] * p.halfWidth), Y(p.position[2] - l[1] * p.halfWidth));
  }
  ctx.closePath();
  ctx.fillStyle = ink.corridor;
  ctx.fill();
  ctx.strokeStyle = ink.edge;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.setLineDash([4, 6]);
  ctx.beginPath();
  course.path.forEach((p, i) =>
    i ? ctx.lineTo(X(p.position[0]), Y(p.position[2])) : ctx.moveTo(X(p.position[0]), Y(p.position[2])),
  );
  ctx.strokeStyle = ink.muted;
  ctx.stroke();
  ctx.setLineDash([]);

  for (const thermal of course.thermals) {
    ctx.beginPath();
    ctx.arc(X(thermal.position[0]), Y(thermal.position[2]), thermal.radius * scale, 0, Math.PI * 2);
    ctx.fillStyle = ink.thermal;
    ctx.fill();
    ctx.strokeStyle = ink.thermalEdge;
    ctx.stroke();
  }

  const leaderGate = Math.max(...sample.racers.map((r) => r.gate));
  for (const gate of geometry.gates) {
    const f = geometry.corridor.at(gate.s),
      l = f.left,
      [gx, , gz] = gate.position;
    ctx.beginPath();
    ctx.moveTo(X(gx - l[0] * gate.radius), Y(gz - l[2] * gate.radius));
    ctx.lineTo(X(gx + l[0] * gate.radius), Y(gz + l[2] * gate.radius));
    ctx.strokeStyle = gate.index >= leaderGate ? ink.gate : ink.gateFaint;
    ctx.lineWidth = gate.index === course.gates.length - 1 ? 4 : 3;
    ctx.stroke();
    ctx.fillStyle = ink.muted;
    ctx.font = "10px Inter, sans-serif";
    const label = gate.radius + 6 * froude.length;
    ctx.fillText(String(gate.index + 1), X(gx + l[0] * label) - 3, Y(gz + l[2] * label) + 3);
  }
  ctx.lineWidth = 1;

  for (const racer of sample.racers) {
    const trail = state.trails[racer.id];
    if (trail?.length > 1) {
      ctx.beginPath();
      trail.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))));
      ctx.strokeStyle = colors[racer.id];
      ctx.globalAlpha = 0.35;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  for (const racer of [...sample.racers].sort((a, b) => b.place - a.place)) {
    const [x, , z] = racer.position,
      [fx, , fz] = racer.forward;
    const px = X(x),
      py = Y(z),
      r = racer.id === selected ? 6 : 4.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + fx * 14, py - fz * 14);
    ctx.strokeStyle = colors[racer.id];
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fillStyle = colors[racer.id];
    ctx.fill();
    ctx.strokeStyle = racer.effects?.length ? css([0.95, 0.4, 0.36]) : ink.bg;
    ctx.lineWidth = racer.effects?.length ? 2 : 1.5;
    ctx.stroke();
    if (racer.id === selected || racer.place <= 3) {
      ctx.fillStyle = ink.text;
      ctx.font = "11px Inter, sans-serif";
      ctx.fillText(`${racer.place} ${state.names[racer.id]}`, px + 8, py - 8);
    }
  }
  ctx.lineWidth = 1;
}

function drawProfile(sample) {
  const { ctx, width, height } = fitCanvas($("profile"));
  const { course, bounds, colors, geometry } = state;
  ctx.fillStyle = ink.bg;
  ctx.fillRect(0, 0, width, height);
  const pad = 14,
    start = geometry.corridor.start,
    end = course.length + 20 * froude.length;
  const X = (s) => pad + ((s - start) / (end - start)) * (width - pad * 2),
    Y = (y) => height - pad - ((y - bounds.minY) / (bounds.maxY - bounds.minY)) * (height - pad * 2);
  ctx.beginPath();
  course.path.forEach((p, i) => (i ? ctx.lineTo(X(p.s), Y(p.ceiling)) : ctx.moveTo(X(p.s), Y(p.ceiling))));
  for (let i = course.path.length - 1; i >= 0; i--) ctx.lineTo(X(course.path[i].s), Y(course.path[i].floor));
  ctx.closePath();
  ctx.fillStyle = ink.band;
  ctx.fill();
  ctx.beginPath();
  course.path.forEach((p, i) => {
    const ground = geometry.corridor.terrainHeight(p.position[0], p.position[2]);
    const y = Y(Math.max(bounds.minY, ground));
    i ? ctx.lineTo(X(p.s), y) : ctx.moveTo(X(p.s), y);
  });
  ctx.lineTo(X(course.path.at(-1).s), height);
  ctx.lineTo(X(course.path[0].s), height);
  ctx.closePath();
  ctx.fillStyle = ink.ground;
  ctx.fill();
  ctx.strokeStyle = ink.edge;
  ctx.stroke();
  for (const thermal of geometry.thermals) {
    ctx.fillStyle = ink.thermal;
    ctx.fillRect(X(thermal.s - thermal.radius), pad, X(thermal.s + thermal.radius) - X(thermal.s - thermal.radius), height - pad * 2);
  }
  for (const gate of geometry.gates) {
    ctx.beginPath();
    ctx.moveTo(X(gate.s), Y(gate.y - gate.radius));
    ctx.lineTo(X(gate.s), Y(gate.y + gate.radius));
    ctx.strokeStyle = ink.gate;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.lineWidth = 1;
  for (const racer of sample.racers) {
    ctx.beginPath();
    ctx.arc(X(racer.progress), Y(racer.position[1]), racer.id === selected ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fillStyle = colors[racer.id];
    ctx.fill();
  }
}

function renderBoard(sample) {
  const { recording, colors, names } = state;
  const results = Object.fromEntries(recording.results.map((r) => [r.id, r]));
  const rows = [...sample.racers].sort((a, b) => a.place - b.place);
  const leader = rows[0];
  $("board").innerHTML = rows
    .map((r) => {
      const gap = r.finished
        ? `${results[r.id].time?.toFixed(2)} s`
        : r === leader
          ? `${r.progress.toFixed(0)} m`
          : `−${(leader.progress - r.progress).toFixed(1)} m`;
      const tag = r.finished ? "FIN" : r.effects?.length ? r.effects.map((e) => e.id.toUpperCase()).join(" ") : "";
      return `<tr data-id="${r.id}" class="${r.id === selected ? "selected" : ""}">
        <td>${r.place}</td>
        <td><span class="swatch" style="background:${colors[r.id]}"></span>${names[r.id]}</td>
        <td class="muted">${gap}</td>
        <td>${kmh(r.speed)}</td>
        <td><div class="bar"><i style="width:${((r.effort ?? 0) * 100).toFixed(0)}%"></i></div></td>
        <td class="tag">${tag}</td></tr>`;
    })
    .join("");
  const racer = sample.racers.find((r) => r.id === selected);
  const entry = recording.roster.find((r) => r.id === selected);
  if (!racer || !entry) return;
  const s = entry.stats;
  $("details").innerHTML =
    `<strong>${names[selected]}</strong> · ${(entry.strength ?? 3).toFixed(2)} stars, ${entry.form} form<br />` +
    `top speed ${kmh(s.topSpeed)} · acceleration ${s.acceleration.toFixed(2)} m/s² · climb ${s.climb.toFixed(1)} m/s · ` +
    `handling ${s.handling.toFixed(1)} m/s² · weight ${s.weight.toFixed(2)} · breath ${s.breath.toFixed(2)}, every ${s.recharge.toFixed(1)} s<br />` +
    `effort ${(racer.effort ?? 0).toFixed(2)} · altitude ${racer.position[1].toFixed(0)} m · ` +
    `bank ${racer.bank.toFixed(2)} · next gate ${racer.gate + 1}`;
}

function describe(event) {
  const { names } = state;
  const who = names[event.racer];
  switch (event.type) {
    case "overtake":
      return `<b>${who}</b> passes ${names[event.other]} for P${event.place}`;
    case "finish":
      return `<b>${who}</b> finishes P${event.place} · ${event.detail}`;
    default:
      return `<b>${who}</b> ${event.detail ?? event.type}`;
  }
}

function renderLog() {
  const events = state.recording.events.filter((e) => e.type !== "gate");
  $("log").innerHTML = events
    .map((e, i) => `<li data-i="${i}" data-t="${e.t}" class="${e.type}" hidden><time>${e.t.toFixed(1)}</time><span>${describe(e)}</span></li>`)
    .join("");
  state.logItems = [...$("log").children];
}

function updateLog(t) {
  let newest = null;
  for (const item of state.logItems) {
    const visible = Number(item.dataset.t) <= t;
    item.hidden = !visible;
    if (visible) newest = item;
  }
  if (playing && newest) newest.scrollIntoView({ block: "nearest" });
}

function updateTrails() {
  const { recording, t } = state;
  const from = Math.max(0, Math.round((t - 6 * froude.time) * recording.hz)),
    to = Math.min(recording.frames.length - 1, Math.round(t * recording.hz));
  state.trails = {};
  for (let f = from; f <= to; f += 2)
    for (const r of recording.frames[f].racers) (state.trails[r.id] ||= []).push([r.position[0], r.position[2]]);
}

function seek(t) {
  if (!state) return;
  state.t = Math.max(0, Math.min(state.recording.duration, t));
  $("scrub").value = state.t;
  $("clock").textContent = `${clockTime(state.t)} / ${clockTime(state.recording.duration)}`;
  const sample = sampleRace(state.recording, state.t);
  updateTrails();
  drawMap(sample);
  drawProfile(sample);
  renderBoard(sample);
  updateLog(state.t);
}

function tick(now) {
  if (playing && state) {
    const dt = Math.min(0.1, (now - last) / 1000) * Number($("rate").value);
    seek(state.t + dt);
    if (state.t >= state.recording.duration) setPlaying(false);
  }
  last = now;
  requestAnimationFrame(tick);
}

function setPlaying(value) {
  playing = value;
  $("play").textContent = playing ? "Pause" : "Play";
}

$("setup").addEventListener("submit", (event) => {
  event.preventDefault();
  setPlaying(false);
  run();
});
$("play").addEventListener("click", () => {
  if (state && state.t >= state.recording.duration) seek(0);
  setPlaying(!playing);
});
$("scrub").addEventListener("input", (event) => seek(Number(event.target.value)));
$("follow").addEventListener("change", () => seek(state.t));
$("board").addEventListener("click", (event) => {
  const row = event.target.closest("tr");
  if (!row) return;
  selected = row.dataset.id;
  seek(state.t);
});
$("log").addEventListener("click", (event) => {
  const item = event.target.closest("li");
  if (item) seek(Number(item.dataset.t) - 1.5);
});
addEventListener("resize", () => state && seek(state.t));
addEventListener("keydown", (event) => {
  if (event.target.closest("input, select")) return;
  if (event.code === "Space") {
    event.preventDefault();
    setPlaying(!playing);
  }
});

const query = new URLSearchParams(location.search);
if (query.get("course")) $("course-seed").value = query.get("course");
if (query.get("race")) $("race-seed").value = query.get("race");
if (query.get("field")) $("field").value = query.get("field");
if (query.get("track")) $("track").value = query.get("track");
run();
requestAnimationFrame(tick);
