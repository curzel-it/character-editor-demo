import { createSceneRenderer, shotMatrix } from "../scene.js";
import { createStableYard } from "../scene/stableYard.js";
import { lowestPoint } from "../scene/groundContact.js";
import { poseOutline } from "../scene/poseOutline.js";
import { projectPoint } from "../scene/raceView.js";
import { restingMotion } from "../dragonThumbnails.js";
import { groundEgg } from "./groundEgg.js";
import { withJockey } from "../jockey/withJockey.js";
import { riderFigure } from "../jockey/riderFigure.js";
import { createStageOrbit, orbitShot } from "./stageOrbit.js";
import { renderDensity } from "../renderDensity.js";

const SPACING = 6,
  SOLE = 0.02,
  MAX_PIXELS = 2560 * 1440,
  FOV = 0.7,
  PITCH = 0.16,
  SWAY = 0.12,
  FILL = 0.92,
  ZOOM_FILL = 0.6,
  FOCUS_FILL = 0.8,
  LEAN = 0.15,
  PUSH = 1,
  SETTLE = 3,
  TURN = 4,
  TAP_REACH = 0.22,
  CLOSE = 5,
  NEAREST = 0.25;

const still = { bones: {} };
/** With no one standing, a stretch of open meadow off to one side. */
const OPEN_MEADOW = [[0.6 * SPACING, 0, -1], [1.8 * SPACING, 3.2, 1]];
const mix = (a, b, t) => a + (b - a) * t;
/** Three-quarters inwards for the ones at the ends, the one picked turned `face` from the camera; the middle one faces it while none is picked. */
const headingOf = (i, count, picked, face = 0) => (i === picked ? face : Math.sign(i - (count - 1) / 2) * -0.6 || (picked < 0 ? 0 : 0.6));

/** `points` turned `angle` radians about the upright through `spot`. */
const turned = (points, spot, angle) =>
  points.map(([x, y, z]) => {
    const [dx, dz] = [x - spot[0], z - spot[2]];
    return [spot[0] + dx * Math.cos(angle) + dz * Math.sin(angle), y, spot[2] + dz * Math.cos(angle) - dx * Math.sin(angle)];
  });

/**
 * Dragons and eggs standing side by side in an open meadow, seen from the front: the camera frames
 * all of them, leaning in on the one picked, who turns to face it, or only that one once zoomed in,
 * framed as it will stand once turned; a tap on the open meadow zooms back out. `orbit` gives it the
 * stable's camera gestures, eased back home whenever another is picked. `onTap(index)` reports the one
 * under a tap, -1 for the open meadow, and `frameArea()` the canvas band `{ top, bottom }` left free for them.
 */
export function createMeadowStage(module, { onTap, frameArea }) {
  const canvas = Object.assign(document.createElement("canvas"), { className: "meadow-stage" });
  canvas.setAttribute("aria-hidden", "true");
  const orbit = createStageOrbit(canvas, { onTap: tapped, rise: PITCH });
  let meadow = null,
    renderer = null,
    kids = [],
    picked = 0,
    face = 0,
    framed = 0,
    zoomed = false,
    style = "cozy",
    running = false,
    previous = 0,
    camera = null,
    matrix = null;

  function resize() {
    const density = renderDensity();
    let w = Math.round(canvas.clientWidth * density),
      h = Math.round(canvas.clientHeight * density);
    const cap = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
    if (cap < 1) [w, h] = [Math.round(w * cap), Math.round(h * cap)];
    if (w && h && (canvas.width !== w || canvas.height !== h)) [canvas.width, canvas.height] = [w, h];
    return w && h;
  }

  /** The shot that fits every kid in the free band, leaning towards the picked one, or the picked one alone when zoomed. */
  function goal(time) {
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    const area = frameArea?.() ?? {};
    const top = Math.max(0, area.top ?? 0),
      bottom = Math.min(h, area.bottom ?? h);
    const band = Math.max(0.2, (bottom - top) / h),
      shift = 1 - (top + bottom) / h;
    const close = zoomed && kids[picked];
    let points = close ? turned(close.outline, close.spot, headingOf(picked, kids.length, picked, face) - close.placed) : kids.length ? kids.flatMap((k) => k.outline) : OPEN_MEADOW;
    if (close && framed) {
      const ys = points.map((p) => p[1]);
      const peak = Math.max(...ys);
      points = points.filter((p) => p[1] >= peak - (peak - Math.min(...ys)) * framed);
    }
    const fill = close && framed ? FOCUS_FILL : close ? ZOOM_FILL : FILL;
    const min = [0, 1, 2].map((k) => Math.min(...points.map((p) => p[k]))),
      max = [0, 1, 2].map((k) => Math.max(...points.map((p) => p[k])));
    const centre = min.map((v, k) => (v + max[k]) / 2);
    const focus = kids[picked]?.centre ?? centre;
    const target = close ? centre : [mix(centre[0], focus[0], LEAN), centre[1], centre[2]];
    const yaw = Math.sin(time * 0.15) * SWAY;
    const toward = [Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(yaw) * Math.cos(PITCH)];
    let distance = 3 * (max[0] - min[0]);
    for (let n = 0; n < 6; n++) {
      const m = shotMatrix({ eye: target.map((v, k) => v + toward[k] * distance), target, fov: FOV, shift }, w / h);
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const p of points) {
        const [x, y, cw] = [0, 1, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
        [x0, x1, y0, y1] = [Math.min(x0, x / cw), Math.max(x1, x / cw), Math.min(y0, y / cw), Math.max(y1, y / cw)];
      }
      distance *= Math.max(Math.max(-x0, x1) / fill, (y1 - y0) / (2 * fill * band));
    }
    distance *= PUSH;
    return { eye: target.map((v, k) => v + toward[k] * distance), target, fov: FOV, shift };
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - previous) / 1000 || 0);
    previous = now;
    if (resize() && meadow) {
      const time = now / 1000;
      const shot = goal(time);
      const ease = camera ? 1 - Math.exp(-SETTLE * dt) : 1;
      camera = {
        ...shot,
        eye: shot.eye.map((v, k) => mix(camera?.eye[k] ?? v, v, ease)),
        target: shot.target.map((v, k) => mix(camera?.target[k] ?? v, v, ease)),
        shift: mix(camera?.shift ?? shot.shift, shot.shift, ease),
      };
      const turn = 1 - Math.exp(-TURN * dt);
      const racers = kids.map((kid, i) => {
        if (kid.egg) return { anatomy: kid.anatomy, pose: { bones: {} }, position: [kid.spot[0], kid.radius, kid.spot[2]], forward: [0, 0, 1] };
        kid.heading = mix(kid.heading, headingOf(i, kids.length, picked, face), turn);
        const forward = [Math.sin(kid.heading), 0, Math.cos(kid.heading)];
        const t = time + i * 0.37;
        const pose = kid.figure ? still : module.pose(kid.anatomy, t % 1, { ...restingMotion, time: t });
        const spot = kid.spot;
        const lift = SOLE - lowestPoint(kid.anatomy, pose, spot, forward);
        return { anatomy: kid.anatomy, pose, position: [spot[0], spot[1] + lift, spot[2]], forward };
      });
      renderer ??= createSceneRenderer(canvas);
      const view = orbitShot(camera, orbit.view());
      const reach = Math.hypot(...view.eye.map((v, k) => v - view.target[k]));
      if (reach < CLOSE) view.near = Math.max(NEAREST, reach * 0.4);
      renderer.render({ course: meadow.course, racers, camera: view, style });
      matrix = shotMatrix(view, canvas.clientWidth / canvas.clientHeight);
    }
    requestAnimationFrame(frame);
  }

  /** The kid nearest a canvas point, if one is close enough. */
  function kidAt(x, y) {
    if (!matrix) return -1;
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    let best = -1,
      nearest = TAP_REACH * Math.max(w, h);
    kids.forEach((kid, i) => {
      const at = projectPoint(matrix, kid.centre, w, h);
      const d = Math.hypot(at.x - x, at.y - y);
      if (d < nearest) [best, nearest] = [i, d];
    });
    return best;
  }

  /** @param {PointerEvent} e */
  function tapped(e) {
    const box = canvas.getBoundingClientRect();
    const index = kidAt(e.clientX - box.left, e.clientY - box.top);
    if (index < 0) zoomed = false;
    onTap(index);
  }

  return {
    el: canvas,
    orbit,
    /**
     * Stands `items` in the meadow, dragons and eggs (those with an `incubation`), at `places`
     * along the row: 0 is the middle, ±1 a spacing either side. They stand side by side by default;
     * a dragon with a `jockey` stands ridden by it, and `{ rider }` is that rider on foot.
     */
    setItems(items, places = items.map((_, i) => i - (items.length - 1) / 2)) {
      meadow ??= createStableYard(3, { spacing: SPACING, buildings: false });
      kids = items.map((w, i) => {
        const spot = [places[i] * SPACING, 0, 0];
        if (w.incubation !== undefined) {
          const { anatomy, radius, outline } = groundEgg(module.genes, w);
          const points = outline.map((p) => p.map((v, k) => v + spot[k]));
          const top = Math.max(...points.map((p) => p[1]));
          return { egg: true, anatomy, radius, spot, placed: 0, outline: points, centre: [spot[0], top / 2, spot[2]] };
        }
        const figure = Boolean(w.rider);
        const anatomy = figure ? riderFigure(w.rider) : withJockey(module.createAnatomy(w.genome, { age: w.age }), w.jockey ?? null, { harness: w.harness !== false });
        const heading = headingOf(i, items.length, picked, face);
        const forward = [Math.sin(heading), 0, Math.cos(heading)];
        const pose = figure ? still : module.pose(anatomy, 0, { ...restingMotion, time: 0 });
        const outline = poseOutline(anatomy, pose, [spot[0], SOLE - lowestPoint(anatomy, pose, spot, forward), spot[2]], forward);
        const min = [0, 1, 2].map((k) => Math.min(...outline.map((p) => p[k]))),
          max = [0, 1, 2].map((k) => Math.max(...outline.map((p) => p[k])));
        const centre = min.map((v, k) => (v + max[k]) / 2);
        return { age: w.age, figure, anatomy, heading, placed: heading, spot, outline, centre };
      });
    },
    /**
     * Leans in on the kid at `index`, or on none at -1, framing it alone when `zoom` is set and turned `turn` radians
     * from the camera; a zoomed `share` frames only that share of its height, from the top down.
     */
    pick(index, zoom = false, turn = 0, share = 0) {
      picked = index;
      face = turn;
      zoomed = zoom;
      framed = share;
    },
    show() {
      if (running) return;
      camera = null;
      orbit.clear();
      running = true;
      previous = performance.now();
      requestAnimationFrame(frame);
    },
    hide() {
      running = false;
    },
    setStyle(next) {
      style = next;
    },
  };
}
