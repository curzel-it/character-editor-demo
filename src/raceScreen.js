import { courseType } from "./course/createCourse.js";
import { sampleRace } from "./race/sampleRace.js";
import { buildRace, raceKey } from "./race/buildRace.js";
import { raceShot } from "./camera/raceShot.js";
import { createRaceView, projectPoint } from "./scene/raceView.js";
import { createFrameLoop } from "./scene/frameLoop.js";
import { createFreeCamera } from "./scene/freeCamera.js";
import { defaultField } from "./raceField.js";
import { creatureScale, speedScale } from "./worldScale.js";
import { LEAD_IN } from "./race/countdown.js";
import { createCountdown } from "./ui/countdownOverlay.js";
import { t as text } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const escape = (text) =>
  String(text).replace(/[&<>"]/g, (c) => `&${{ "&": "amp", "<": "lt", ">": "gt", '"': "quot" }[c]};`);
const clock = (time) => {
  const t = Math.max(0, time);
  return `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, "0")}`;
};
const courseNames = { slot: "slot canyon", arch: "stone arch", spires: "spire field", castle: "castle", spurs: "forest spurs", gorge: "gorge", lake: "lake", col: "col" };

/**
 * The race screen: builds a race from a field and plays the broadcast. Rendering and playback run
 * only while the screen is shown. `params` are the page's query parameters (tool links);
 * `onStyle(id)` asks the page to change the art style.
 */
export function createRaceScreen(module, { params, style, blur = true, onStyle }) {
  let blurOn = blur;
  const reducedMotion =
    params.get("motion") === "reduce" ||
    (params.get("motion") !== "full" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  // Reduced motion keeps the cues that read as speed but calms shake, roll, blur and FOV kicks.
  const MOTION = reducedMotion ? 0.25 : 1;
  const SPRINT_EFFORT = 0.85;
  const state = {
    field: null,
    courseSeed: params.get("course") || "2407",
    courseType: courseType(params.get("type")),
    raceSeed: params.get("race") || "1",
    racerCount: Math.max(2, Math.min(12, Number(params.get("racers")) || 8)),
    style,
    camera: params.get("camera") === "free" ? "free" : "director",
    playing: params.get("paused") === null && !matchMedia("(prefers-reduced-motion: reduce)").matches,
    speed: 1,
    t: params.has("t") ? Number(params.get("t")) || 0 : -LEAD_IN,
    fixedShot: null,
  };
  let race = null,
    builtKey = null,
    visible = false,
    resumePlaying = false,
    lastBoard = 0,
    lastShot = null,
    buildVersion = 0;
  const canvas = $("race-view");
  const view = createRaceView(module, canvas);
  const free = createFreeCamera();
  const keys = new Set();
  const tags = new Map();
  const countdown = createCountdown();
  $("race-stage").append(countdown.el);

  async function build() {
    const version = ++buildVersion;
    $("renderer-label").textContent = view.renderer.info?.renderer ?? "";
    $("loading").hidden = false;
    $("loading").textContent = text(`broadcastScreen.loading.${(state.field?.courseType ?? state.courseType) === "canyon" ? "canyon" : "valley"}`);
    await new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve));
      setTimeout(resolve, 100);
    });
    state.field ??= {
      ...defaultField(module, state.raceSeed, state.racerCount),
      courseSeed: state.courseSeed,
      courseType: state.courseType,
    };
    state.courseSeed = state.field.courseSeed;
    state.courseType = state.field.courseType;
    state.raceSeed = state.field.raceSeed;
    const built = buildRace(module, state.field);
    if (version !== buildVersion) return;
    race = built;
    builtKey = raceKey(state.field);
    state.t = Math.min(state.t, race.recording.duration);
    $("race-timeline").min = -LEAD_IN;
    $("race-timeline").max = race.recording.duration;
    showCourse();
    resetTags();
    $("loading").hidden = true;
    draw();
  }

  function showCourse() {
    const { course, recording, entries } = race;
    $("course-length").textContent = `${(course.length / 1000).toFixed(2)} km`;
    const signature = (course.signature || []).map((s) => courseNames[s] || s);
    $("course-signature").textContent = signature.length ? signature.join(" · ") : "open canyon";
    $("race-label").textContent = `COURSE ${course.seed} · RACE ${recording.seed}`;
    $("race-title").textContent = `${course.type === "canyon" ? "Canyon" : "Valley"} Cup · ${entries.size} dragons`;
    $("race-headline").textContent = `Into the ${course.type === "canyon" ? "canyon" : "valley"}.`;
    const narrowest = Math.min(...course.path.map((p) => p.halfWidth * 2));
    const climb = Math.max(...course.path.map((p) => p.floor)) - Math.min(...course.path.map((p) => p.floor));
    $("facts").innerHTML = [
      ["GATES", course.gates.length],
      ["THERMALS", course.thermals.length],
      ["NARROWEST", `${Math.round(narrowest)} m`],
      ["ALTITUDE Δ", `${Math.round(climb)} m`],
    ]
      .map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`)
      .join("");
    lastResults = null;
  }

  let lastResults = null;
  function updateResults() {
    const { recording, entries } = race;
    const crossed = recording.results.filter((r) => r.time !== null && r.time <= state.t);
    const over = state.t >= recording.duration;
    const key = `${crossed.length}:${over}`;
    if (key === lastResults) return;
    lastResults = key;
    const shown = over ? recording.results : crossed;
    $("results").innerHTML = shown.length
      ? shown
          .map((r) => `<li><strong>${r.place}. ${escape(entries.get(r.id)?.name ?? r.id)}</strong><span>${r.time === null ? "DNF" : clock(r.time)}</span></li>`)
          .join("")
      : `<li><span>Revealed as racers cross the line</span></li>`;
  }

  function resetTags() {
    $("tags").replaceChildren();
    tags.clear();
    for (const [id, entry] of race.entries) {
      const el = document.createElement("div");
      el.className = "tag";
      el.style.color = entry.color;
      $("tags").append(el);
      tags.set(id, el);
    }
  }

  function currentShot() {
    const followed = state.camera === "free" ? sampleRace(race.recording, state.t).racers.find((r) => r.place === 1) : null;
    return raceShot(race, state.t, {
      camera: state.camera,
      free,
      follow: followed?.position,
      fixed: state.fixedShot,
      motion: MOTION,
      aspect: canvas.clientWidth / Math.max(1, canvas.clientHeight),
      focus: params.get("focus")?.split(",") ?? [],
    });
  }

  function draw() {
    if (!race) return null;
    const { shot, previous } = currentShot();
    const drawn = view.draw(race, state.t, { shot, previous, style: state.style, blur: blurOn, reducedMotion });
    const { sample, viewProjection } = drawn;
    countdown.update(state.t);
    updateTags(sample, shot, viewProjection);
    const now = performance.now();
    if (now - lastBoard > 120 || shot !== lastShot) {
      updateBoard(sample, shot);
      lastBoard = now;
    }
    lastShot = shot;
    return drawn.result;
  }

  function updateTags(sample, shot, m) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    for (const r of sample.racers) {
      const el = tags.get(r.id);
      if (!el) continue;
      const lift = 5 * (race.entries.get(r.id)?.anatomy.scale ?? creatureScale);
      const at = projectPoint(m, [r.position[0], r.position[1] + lift, r.position[2]], w, h);
      const visible = at.visible && !(shot.shot === "rider" && shot.subject === r.id);
      el.style.display = visible ? "" : "none";
      if (!visible) continue;
      const subject = shot.subject === r.id;
      const featured = subject || shot.other === r.id;
      const status = !r.finished && r.effort >= SPRINT_EFFORT ? `<i class="state sprint">SPRINT</i>` : "";
      const label = `${r.place}${featured ? `<em>${escape(race.entries.get(r.id).name)}</em><small>${Math.round(r.speed * 3.6)} km/h</small>` : ""}${featured ? status : ""}`;
      if (el.dataset.label !== label) {
        el.innerHTML = label;
        el.dataset.label = label;
      }
      el.style.opacity = subject ? 1 : Math.max(0.35, Math.min(0.9, (400 * creatureScale) / at.depth));
      countdown.place(el, at.x, at.y, projectPoint(m, [r.position[0], r.position[1] - lift / 2, r.position[2]], w, h).y);
    }
  }

  function updateBoard(sample, shot) {
    const { recording, entries, course } = race;
    const ordered = [...sample.racers].sort((a, b) => a.place - b.place);
    const leader = ordered[0];
    const finished = new Map(recording.results.map((r) => [r.id, r]));
    updateResults();
    $("board").innerHTML = ordered
      .map((r) => {
        const entry = entries.get(r.id);
        const result = r.finished ? finished.get(r.id) : null;
        const gap = result
          ? clock(result.time)
          : r === leader
            ? `${Math.round(r.progress)} m`
            : state.t <= 0
              ? ""
            : `+${Math.max(0, (leader.progress - r.progress) / Math.max(12, r.speed || 30)).toFixed(1)} s`;
        return `<li class="${shot.subject === r.id ? "subject" : ""} ${result ? "done" : ""}"><span class="place">${r.place}</span><i class="swatch" style="background:${entry.color}"></i><span>${escape(entry.name)}</span><span class="gap">${gap}</span></li>`;
      })
      .join("");
    $("clock").textContent = clock(state.t);
    const focus = sample.racers.find((r) => r.id === shot.subject);
    $("speed-chip").hidden = !focus;
    if (focus) {
      const ahead = ordered[focus.place - 2],
        behind = ordered[focus.place];
      const pace = Math.max(12 * speedScale, focus.speed || 0);
      $("speed-name").textContent = entries.get(focus.id)?.name ?? focus.id;
      $("speed-value").textContent = Math.round(focus.speed * 3.6);
      $("speed-gap").textContent = focus.finished
        ? "FINISHED"
        : state.t <= 0
          ? "ON THE GRID"
          : ahead
            ? `+${Math.max(0, (ahead.progress - focus.progress) / pace).toFixed(2)} s to P${ahead.place}`
            : behind
              ? `LEADS BY ${Math.max(0, (focus.progress - behind.progress) / Math.max(12 * speedScale, behind.speed || 0)).toFixed(2)} s`
              : "";
      $("speed-chip").dataset.state = focus.finished ? "" : focus.effort >= SPRINT_EFFORT ? "sprint" : "";
    }
    $("gate-count").textContent = `${Math.min(course.gates.length, leader.gate)} / ${course.gates.length}`;
    $("shot-kind").textContent = shot.shot || "camera";
    $("shot-reason").textContent = shot.reason || "";
    $("race-timeline").value = state.t;
    $("race-frame-label").textContent = `${state.t.toFixed(1)} / ${recording.duration.toFixed(1)} s`;
    const recent = recording.events.filter((e) => e.t <= state.t && e.t > state.t - 5).slice(-4);
    $("feed").innerHTML = recent
      .map((e) => {
        const who = escape(entries.get(e.racer)?.name ?? e.racer);
        const other = e.other ? ` → ${escape(entries.get(e.other)?.name ?? e.other)}` : "";
        return `<div>${e.type.toUpperCase()} · ${who}${other}${e.detail ? ` · ${e.detail}` : ""}</div>`;
      })
      .join("");
  }

  let frames = 0,
    fpsStart = performance.now();
  const loop = createFrameLoop((dt, now) => {
    if (race && state.playing && !state.fixedShot) {
      const pace = state.camera === "director" ? race.director.pace(state.t) : 1;
      state.t = Math.min(race.recording.duration, state.t + dt * state.speed * pace);
      if (state.t >= race.recording.duration) setPlaying(false);
    }
    const f = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0),
      r = (keys.has("KeyD") ? 1 : 0) - (keys.has("KeyA") ? 1 : 0),
      u = (keys.has("KeyE") ? 1 : 0) - (keys.has("KeyQ") ? 1 : 0);
    if (state.camera === "free") free.move(f, r, u, dt);
    try {
      draw();
    } catch (error) {
      $("loading").hidden = false;
      $("loading").textContent = error.message;
      throw error;
    }
    frames++;
    if (now - fpsStart > 1000) {
      $("fps").textContent = `${Math.round((frames * 1000) / (now - fpsStart))} fps · ${canvas.width}×${canvas.height}`;
      frames = 0;
      fpsStart = now;
    }
  });

  function startLoop() {
    if (loop.running || !visible) return;
    fpsStart = performance.now();
    frames = 0;
    loop.start();
  }
  function setPlaying(value) {
    state.playing = value;
    $("race-play").innerHTML = value ? "Ⅱ <span>Pause</span>" : "▶ <span>Play</span>";
    $("race-play").setAttribute("aria-label", value ? "Pause" : "Play");
  }
  function setCamera(mode) {
    state.camera = mode;
    $("race-stage").classList.toggle("free", mode === "free");
    for (const b of $("camera-toggle").querySelectorAll("button"))
      b.setAttribute("aria-pressed", String(b.dataset.camera === mode));
    if (mode === "free" && race && lastShot) {
      const [dx, dy, dz] = lastShot.eye.map((v, i) => v - lastShot.target[i]);
      const d = Math.hypot(dx, dy, dz);
      Object.assign(free.state, { yaw: Math.atan2(dz, dx), pitch: Math.asin(dy / d), distance: d, follow: true });
    }
  }
  function setStyle(id) {
    state.style = id;
  }
  function setBlur(on) {
    blurOn = on;
  }
  function seek(t) {
    if (!race) return;
    state.t = Math.max(-LEAD_IN, Math.min(race.recording.duration, t));
  }

  $("camera-toggle").addEventListener("click", (e) => e.target.dataset.camera && setCamera(e.target.dataset.camera));
  $("race-play").addEventListener("click", () => {
    if (race && state.t >= race.recording.duration) state.t = -LEAD_IN;
    setPlaying(!state.playing);
  });
  $("race-restart").addEventListener("click", () => seek(-LEAD_IN));
  $("race-timeline").addEventListener("input", (e) => seek(Number(e.target.value)));
  $("race-speed").addEventListener("change", (e) => (state.speed = Number(e.target.value)));
  let dragging = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (state.camera !== "free") return;
    dragging = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    free.orbit(e.clientX - dragging[0], e.clientY - dragging[1]);
    dragging = [e.clientX, e.clientY];
  });
  canvas.addEventListener("pointerup", () => (dragging = null));
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (state.camera !== "free") return;
      e.preventDefault();
      free.zoom(Math.exp(e.deltaY * 0.0015));
    },
    { passive: false },
  );
  addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (!visible) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "KeyQ", "KeyE"].includes(e.code)) keys.add(e.code);
    if (e.code === "Space") {
      e.preventDefault();
      $("race-play").click();
    }
    if (e.code === "ArrowRight") seek(state.t + 5);
    if (e.code === "ArrowLeft") seek(state.t - 5);
    if (e.code === "KeyC") setCamera(state.camera === "free" ? "director" : "free");
    if (e.code === "KeyV") onStyle(state.style === "lowPoly" ? "cozy" : "lowPoly");
    if (e.code === "KeyF") free.refollow();
  });
  addEventListener("keyup", (e) => keys.delete(e.code));
  addEventListener("blur", () => keys.clear());

  setCamera(state.camera);
  setPlaying(state.playing);

  const api = {
    ready: false,
    state,
    get race() {
      return race;
    },
    async load(options = {}) {
      Object.assign(state, options);
      state.field = null;
      await build();
    },
    setStyle: onStyle,
    setBlur,
    setCamera(mode) {
      state.fixedShot = typeof mode === "object" ? mode : null;
      if (typeof mode === "string") setCamera(mode);
    },
    seek,
    setPlaying,
    draw,
    overviews: () => race.overviews,
    capture() {
      draw();
      return canvas.toDataURL("image/png");
    },
    benchmark(count = 120) {
      const start = performance.now();
      let cpu = 0;
      for (let i = 0; i < count; i++) {
        state.t = Math.max(0, state.t + 1 / 60) % race.recording.duration;
        const a = performance.now();
        draw();
        cpu += performance.now() - a;
        view.renderer.finish();
      }
      return { frames: count, msPerFrame: (performance.now() - start) / count, cpuMsPerFrame: cpu / count, width: canvas.width, height: canvas.height };
    },
  };

  return {
    api,
    setStyle,
    setBlur,
    /** Shows the race for `field`: rebuilt from the start when the field changed or `restart`. */
    async show(field, { restart = false } = {}) {
      visible = true;
      const fresh = field && (restart || raceKey(field) !== builtKey);
      if (fresh) {
        state.field = field;
        state.t = -LEAD_IN;
        state.fixedShot = null;
        setPlaying(false);
      }
      startLoop();
      if (fresh) {
        await build();
        if (visible) setPlaying(true);
      } else if (!race) await build();
      else if (resumePlaying) setPlaying(true);
      resumePlaying = false;
    },
    hide() {
      if (!visible) return;
      resumePlaying = state.playing;
      setPlaying(false);
      visible = false;
      loop.stop();
      keys.clear();
    },
  };
}
