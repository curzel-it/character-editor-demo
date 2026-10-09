import { createSceneRenderer } from "../scene.js";
import { createStableYard } from "../scene/stableYard.js";
import { lowestPoint } from "../scene/groundContact.js";
import { orientation, point, transform, multiply } from "../math3d.js";
import { withTack } from "../jockey/withTack.js";
import { restingMotion } from "../dragonThumbnails.js";
import { renderDensity } from "../renderDensity.js";

const SOLE = 0.02,
  MAX_PIXELS = 2560 * 1440,
  FOV = 0.5,
  PITCH = 0.12,
  TURN = Math.PI,
  SETTLE = 0.6;
/** Smaller ages are framed closer so every dragon fills the stage. */
const zoomByAge = { kid: 1.6, teen: 1.6, adult: 1.6 };
/** A previewed rider is framed closer, the camera turned from the body's centre towards the saddle. */
const riderFrame = { zoom: 1.9, towardSeat: 0.6 };

/** Where the camera aims in the anatomy's own space: the body's centre, or towards the saddle with a rider. */
function aimOf(anatomy, onSeat) {
  const { center } = anatomy.bounds;
  const seat = anatomy.tack?.seat;
  if (!onSeat || !anatomy.jockey || !seat) return center;
  return center.map((v, i) => v + (seat[i] - v) * riderFrame.towardSeat);
}

/**
 * One dragon standing in the stable yard, animated while shown and drawn by the scene renderer so it
 * is lit, shaded and graded as in the yard and the races. The app has one stage and one WebGL
 * context: `attach(parent)` moves its canvas into the screen that shows it, and with `orbit` a drag
 * turns the camera around the dragon.
 */
export function createDragonStage(module) {
  const canvas = Object.assign(document.createElement("canvas"), { className: "dragon-stage" });
  canvas.setAttribute("aria-hidden", "true");
  const yard = createStableYard(1);
  const spot = yard.spots[0];
  let renderer = null,
    dragon = null,
    anatomy = null,
    anatomyKey = null,
    rider = null,
    posed = null,
    zoomed = null,
    style = "cozy",
    running = false,
    orbit = false,
    yaw = 0,
    lift = null,
    previous = 0,
    drag = null;

  function resize() {
    const density = renderDensity();
    let w = Math.round(canvas.clientWidth * density),
      h = Math.round(canvas.clientHeight * density);
    const cap = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
    if (cap < 1) [w, h] = [Math.round(w * cap), Math.round(h * cap)];
    if (w && h && (canvas.width !== w || canvas.height !== h)) [canvas.width, canvas.height] = [w, h];
    return w && h;
  }

  /**
   * The camera on the dragon placed at `position`: aimed at its framing point and far enough back that
   * the ortho framing the stage used to have (`zoom` over the bounds) holds at the stage's lens.
   */
  function shot(position, aspect) {
    const model = multiply(orientation(position, spot.forward), transform(anatomy.bones[0].position.map((v) => -v)));
    const target = point(model, aimOf(anatomy, !zoomed));
    const zoom = zoomed ?? (zoomByAge[dragon.age] ?? 1.2) * (anatomy.jockey ? riderFrame.zoom : 1);
    const half = ((anatomy.bounds.radius * 1.12) / zoom) * Math.max(1, 1 / aspect);
    const distance = half / Math.tan(FOV / 2);
    const toward = [Math.sin(yaw) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(yaw) * Math.cos(PITCH)];
    const eye = target.map((v, k) => v + toward[k] * distance);
    eye[1] = Math.max(0.3, eye[1]);
    return { eye, target, fov: FOV };
  }

  function frame(now) {
    if (!dragon) {
      running = false;
      return;
    }
    const dt = Math.min(0.05, (now - previous) / 1000 || 0);
    previous = now;
    const key = `${dragon.id}:${dragon.age}:${dragon.harness}:${JSON.stringify(dragon.genome)}:${rider ? `${rider.seed}:${JSON.stringify(rider.silks)}` : ""}`;
    if (key !== anatomyKey) {
      anatomy = withTack(module.createAnatomy(dragon.genome, { age: dragon.age }), { harness: dragon.harness !== false, jockey: rider });
      anatomyKey = key;
      lift = null;
    }
    const time = now / 1000;
    const pose = posed ? posed(anatomy, time) : module.pose(anatomy, time % 1, { ...restingMotion, time });
    // Rises at once to keep every point above the ground, and settles back slowly so wingbeats do not bob the body.
    const ground = SOLE - lowestPoint(anatomy, pose, spot.position, spot.forward);
    lift = lift === null || ground > lift ? ground : Math.max(ground, lift - SETTLE * anatomy.bounds.radius * dt);
    if (resize()) {
      renderer ??= createSceneRenderer(canvas);
      const position = [spot.position[0], spot.position[1] + lift, spot.position[2]];
      renderer.render({
        course: yard.course,
        racers: [{ anatomy, pose, position, forward: spot.forward }],
        camera: shot(position, canvas.width / canvas.height),
        style,
        time,
      });
    }
    requestAnimationFrame(frame);
  }

  canvas.addEventListener("pointerdown", (e) => {
    if (!orbit || drag) return;
    drag = { x: e.clientX, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    yaw -= ((e.clientX - drag.x) / Math.max(1, canvas.clientWidth)) * TURN;
    drag.x = e.clientX;
  });
  for (const type of ["pointerup", "pointercancel"]) canvas.addEventListener(type, () => (drag = null));

  return {
    /** Moves the canvas into `parent`; `orbit` lets a drag turn the camera around the dragon. */
    attach(parent, { orbit: canOrbit = false } = {}) {
      if (canvas.parentElement !== parent) parent.append(canvas);
      orbit = canOrbit;
      canvas.style.touchAction = canOrbit ? "pan-y" : "";
    },
    /**
     * Shows `next`; a `jockey` sits it in the saddle, as a preview. `pose(anatomy, seconds)` replaces
     * the resting pose and `zoom` the framing, for the gene editor's flight modes.
     */
    show(next, { jockey = null, pose = null, zoom = null } = {}) {
      if (next?.id !== dragon?.id) yaw = 0;
      dragon = next;
      rider = jockey;
      posed = pose;
      zoomed = zoom;
      if (!running) {
        running = true;
        previous = performance.now();
        requestAnimationFrame(frame);
      }
    },
    hide() {
      dragon = null;
      drag = null;
    },
    setStyle(next) {
      style = next;
    },
  };
}
