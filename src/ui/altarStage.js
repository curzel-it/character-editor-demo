import { createSceneRenderer } from "../scene.js";
import { createAltarPlace } from "../scene/altarPlace.js";
import { createAltarCast } from "../scene/altarCast.js";
import { createRitualShow } from "../scene/ritualShow.js";
import { lineAt } from "../scene/ritualTimeline.js";
import { renderDensity } from "../renderDensity.js";
import { playRitualBeats } from "../sound/ritualAudio.js";

const PIXELS = 1600 * 1000,
  HOLD = 2,
  PORTRAIT_SHIFT = 0.16;

/**
 * The Soul Altar's ritual show in 3D for the Altar screen. `play(ritual)` runs it (see
 * `createRitualShow`) and resolves when it reaches the result card, telling `onLine(text | null)`
 * whenever the custodian's line changes; `skip()` jumps there. `release()` stops it after the card.
 */
export function createAltarStage(module, { onLine } = {}) {
  const el = document.createElement("div");
  el.className = "altar-stage";
  const canvas = Object.assign(document.createElement("canvas"), { className: "altar-stage__canvas" });
  canvas.setAttribute("aria-hidden", "true");
  el.append(canvas);
  let renderer = null,
    place = null,
    cast = null,
    style = "cozy",
    raf = 0,
    previous = 0,
    show = null,
    line = null;

  function resize() {
    const density = renderDensity();
    let w = Math.round(canvas.clientWidth * density),
      h = Math.round(canvas.clientHeight * density);
    const cap = Math.sqrt(PIXELS / Math.max(1, w * h));
    if (cap < 1) [w, h] = [Math.round(w * cap), Math.round(h * cap)];
    if (w && h && (canvas.width !== w || canvas.height !== h)) [canvas.width, canvas.height] = [w, h];
    return w && h;
  }

  function tellLine(next) {
    if (next === line) return;
    line = next;
    onLine?.(line?.text ?? null);
  }

  function frame(now) {
    if (!show) return;
    const dt = Math.min(0.05, (now - previous) / 1000 || 0);
    previous = now;
    if (resize()) {
      const before = show.t;
      if (!show.paused) show.t = Math.min(show.t + dt, show.timeline.card + HOLD);
      const t = show.t;
      playRitualBeats(show.timeline, before, t);
      tellLine(t < show.timeline.card ? lineAt(show.timeline, t) : null);
      if (t >= show.timeline.card && show.done) {
        const done = show.done;
        show.done = null;
        done();
      }
      const { shot, camera, ...parts } = show.frame(t);
      show.shot = shot;
      const tall = canvas.height > canvas.width ? PORTRAIT_SHIFT : 0;
      renderer ??= createSceneRenderer(canvas);
      renderer.render({ course: place.course, style, time: t, ...parts, camera: { ...camera, shift: (camera.shift ?? 0) + tall } });
    }
    raf = requestAnimationFrame(frame);
  }

  return {
    el,
    /**
     * Plays the ritual show for `dragons` (the parents), the ritual's `success`, `seed` and `look`
     * (its egg's `{ shell, spots, seed }`); resolves at the result card.
     */
    play({ dragons, success, seed, look }) {
      place ??= createAltarPlace();
      cast ??= createAltarCast(module, place);
      const ritual = createRitualShow({ place, cast, dragons, success, seed, look });
      return new Promise((done) => {
        show = { ...ritual, t: 0, paused: false, shot: null, done };
        if (raf) return;
        previous = performance.now();
        raf = requestAnimationFrame(frame);
      });
    },
    /** Jumps the show to its result card. */
    skip() {
      if (show) show.t = Math.max(show.t, show.timeline.card);
    },
    /** Holds the show at `t` seconds (a dev tool), or lets it run on from there with `paused` false. */
    seek(t, paused = true) {
      if (!show) return;
      show.t = t;
      show.paused = paused;
    },
    /** The show in progress: its timeline, the time, the shot on screen and the parent in its close-ups. */
    get playing() {
      return show && { timeline: show.timeline, t: show.t, shot: show.shot, hero: show.shots.find((s) => s.id === "head").hero };
    },
    release() {
      show = null;
      cancelAnimationFrame(raf);
      raf = 0;
      tellLine(null);
    },
    setStyle(next) {
      style = next;
    },
  };
}
