import { createSceneRenderer, shotMatrix } from "../scene.js";
import { createStableYard } from "../scene/stableYard.js";
import { characterPose, gestureLength } from "../character/characterPose.js";
import { styleConfig } from "../style/cozy.js";
import { renderDensity } from "../renderDensity.js";

const FOV = 0.56,
  SETTLE = 5,
  SPIN_FRICTION = 3.2,
  TURN_PER_PX = 0.011,
  ZOOM_MIN = 0.55,
  ZOOM_MAX = 2.6,
  HOME_HEADING = 0.42,
  IDLE_LOOK = 2.6,
  MAX_PIXELS = 2560 * 1600,
  PITCH = { full: 0.05, head: 0.08, face: 0.06, eyes: 0.03, upper: 0.08, lower: 0.12, feet: 0.32 };

const mix = (a, b, t) => a + (b - a) * t;
const mixed = (a, b, t) => a.map((v, k) => mix(v, b[k], t));
const rotateY = ([x, y, z], angle) => [x * Math.cos(angle) + z * Math.sin(angle), y, -x * Math.sin(angle) + z * Math.cos(angle)];

/**
 * The live 3D stage: the character standing in the game's sunny meadow, drawn by the scene renderer.
 * The camera eases between framings (`frame(focus)`: the whole figure, the head, the eyes, the feet…),
 * a drag spins the character on a turntable with a little coast, the wheel or a pinch zooms, and the
 * character's eyes and head follow the pointer, coming back to the camera when it rests.
 * `show(anatomy)` swaps in a new build with a small bounce; `play(gesture)` and `express(expression)`
 * animate it. `onReady` hears when the first character is drawn; `frameArea()` gives the band
 * `{ top, bottom }` (canvas pixels) that overlays leave free, which framings fit into.
 * @param {{ onReady?: () => void, frameArea?: () => { top: number, bottom: number } }} [options]
 */
export function createCharacterStage({ onReady, frameArea } = {}) {
  const canvas = Object.assign(document.createElement("canvas"), { className: "ce-stage__canvas" });
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", "Character preview. Drag to turn, scroll or pinch to zoom.");
  canvas.tabIndex = 0;
  const course = createStableYard(1, { buildings: false }).course;
  let renderer = null,
    anatomy = null,
    running = false,
    previous = 0,
    time = 0,
    focus = "full",
    heading = HOME_HEADING,
    spin = 0,
    zoom = 1,
    zoomGoal = 1,
    tilt = 0,
    tiltGoal = 0,
    camera = null,
    matrix = null,
    pointer = null,
    pointerAt = -99,
    drag = null,
    bounceAt = -9,
    capture = null,
    readied = false;
  /** @type {import("../character/characterPose.js").PoseState} */
  const pose = { expression: "neutral", expressionAt: -9, previousExpression: "neutral", gesture: null, gestureAt: -9 };
  let expressionUntil = 0;
  const touches = new Map();
  let pinch = null;

  function resize() {
    const density = renderDensity();
    let w = Math.round(canvas.clientWidth * density),
      h = Math.round(canvas.clientHeight * density);
    const cap = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
    if (cap < 1) [w, h] = [Math.round(w * cap), Math.round(h * cap)];
    if (w && h && (canvas.width !== w || canvas.height !== h)) [canvas.width, canvas.height] = [w, h];
    return w > 0 && h > 0;
  }

  /** The shot that frames the current focus on the character as it stands now. */
  function goal() {
    const frame = anatomy.rig.focus[focus] ?? anatomy.rig.focus.full;
    const aspect = Math.max(0.3, canvas.clientWidth / Math.max(1, canvas.clientHeight));
    const centre = rotateY(frame.center, heading - Math.PI / 2);
    const target = [centre[0] * 0.35, frame.center[1], centre[2] * 0.35];
    const h = Math.max(1, canvas.clientHeight);
    const area = frameArea?.() ?? { top: 0, bottom: h };
    const band = Math.max(0.3, (area.bottom - area.top) / h);
    const fit = Math.max(1 / band, 1 / aspect) * 1.04;
    const distance = (frame.radius / Math.tan(FOV / 2)) * fit / zoom;
    const shift = 1 - (area.top + area.bottom) / h;
    const pitch = (PITCH[focus] ?? 0.08) + tilt;
    const toward = [0, Math.sin(pitch), Math.cos(pitch)];
    const eye = target.map((v, k) => v + toward[k] * distance);
    eye[1] = Math.max(0.12, eye[1]);
    return { eye, target, fov: FOV, shift, near: Math.max(0.04, distance * 0.25) };
  }

  /** Where the character should look: the pointer projected near the camera's plane, or the camera itself when the pointer rests. */
  function lookTarget() {
    if (!camera) return null;
    const toCamera = camera.eye.map((v, k) => v - camera.target[k]);
    const distance = Math.hypot(...toCamera);
    let world = camera.eye;
    if (pointer && time - pointerAt < IDLE_LOOK) {
      const right = [1, 0, 0],
        up = [0, 1, 0];
      const reach = Math.tan(FOV / 2) * distance;
      const aspect = canvas.clientWidth / Math.max(1, canvas.clientHeight);
      world = camera.target.map((v, k) => v + toCamera[k] * 0.8 + right[k] * pointer[0] * reach * aspect + up[k] * pointer[1] * reach);
    }
    return rotateY(world, Math.PI / 2 - heading);
  }

  function frameStep(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - previous) / 1000 || 0);
    previous = now;
    time += dt;
    if (anatomy && resize()) {
      if (!drag) {
        heading += spin * dt;
        spin *= Math.exp(-SPIN_FRICTION * dt);
        if (Math.abs(spin) < 0.01) spin = 0;
      }
      zoom = mix(zoom, zoomGoal, 1 - Math.exp(-10 * dt));
      tilt = mix(tilt, tiltGoal, 1 - Math.exp(-8 * dt));
      const shot = goal();
      const ease = camera ? 1 - Math.exp(-SETTLE * dt) : 1;
      camera = { ...shot, eye: mixed(camera?.eye ?? shot.eye, shot.eye, ease), target: mixed(camera?.target ?? shot.target, shot.target, ease), shift: mix(camera?.shift ?? shot.shift, shot.shift, ease) };
      if (time > expressionUntil && pose.expression !== "neutral" && !pose.held) express("neutral", 0);
      if (pose.gesture && time - pose.gestureAt > gestureLength(pose.gesture)) pose.gesture = null;
      const posed = characterPose(anatomy, time, { ...pose, look: lookTarget() });
      const b = time - bounceAt;
      if (b < 0.45) {
        const squash = Math.sin((b / 0.45) * Math.PI) * Math.exp(-b * 4) * 0.06;
        posed.bones.root = { rotation: [0, 0, 0], scale: 1 + squash };
      }
      renderer ??= createSceneRenderer(canvas);
      const forward = [Math.sin(heading), 0, Math.cos(heading)];
      renderer.render({ course, racers: [{ anatomy, pose: posed, position: [0, 0, 0], forward }], camera, style: "cozy", time });
      matrix = shotMatrix(camera, canvas.clientWidth / canvas.clientHeight);
      if (capture) {
        const done = capture;
        capture = null;
        done(canvas.toDataURL("image/png"));
      }
      if (!readied) {
        readied = true;
        onReady?.();
      }
    }
    requestAnimationFrame(frameStep);
  }

  const local = (e) => {
    const box = canvas.getBoundingClientRect();
    return [((e.clientX - box.left) / box.width) * 2 - 1, 1 - ((e.clientY - box.top) / box.height) * 2];
  };

  canvas.addEventListener("pointerdown", (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    if (touches.size === 2) {
      const [a, b] = [...touches.values()];
      pinch = { from: Math.hypot(a.x - b.x, a.y - b.y), zoom: zoomGoal };
      drag = null;
      return;
    }
    drag = { x: e.clientX, y: e.clientY, lastX: e.clientX, lastT: performance.now(), tilt: tiltGoal, moved: false };
    spin = 0;
  });
  canvas.addEventListener("pointermove", (e) => {
    pointer = local(e);
    pointerAt = time;
    if (!touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && touches.size === 2) {
      const [a, b] = [...touches.values()];
      zoomGoal = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, (pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / pinch.from));
      return;
    }
    if (!drag) return;
    const now = performance.now();
    const dx = e.clientX - drag.lastX;
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
    heading += dx * TURN_PER_PX;
    spin = mix(spin, (dx * TURN_PER_PX) / Math.max(0.008, (now - drag.lastT) / 1000), 0.5);
    drag.lastX = e.clientX;
    drag.lastT = now;
    tiltGoal = Math.max(-0.25, Math.min(0.5, drag.tilt + (e.clientY - drag.y) * 0.004));
  });
  const release = (e) => {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    if (drag && performance.now() - drag.lastT > 90) spin = 0;
    if (drag && !drag.moved && e.type === "pointerup") poke(local(e));
    drag = null;
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
  canvas.addEventListener("pointerleave", () => (pointerAt = -99));
  canvas.addEventListener("dblclick", () => home());
  canvas.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomGoal = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomGoal * Math.exp(-e.deltaY * 0.0015)));
    },
    { passive: false },
  );
  canvas.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") (heading -= 0.2), e.preventDefault();
    if (e.key === "ArrowRight") (heading += 0.2), e.preventDefault();
    if (e.key === "+" || e.key === "=") zoomGoal = Math.min(ZOOM_MAX, zoomGoal * 1.15);
    if (e.key === "-") zoomGoal = Math.max(ZOOM_MIN, zoomGoal / 1.15);
  });

  /** A tap on the character: a giggle when it lands on the head, a wave elsewhere. */
  function poke(at) {
    if (!matrix || !anatomy) return;
    const head = rotateY(anatomy.joints.headCentre, heading - Math.PI / 2);
    const [x, y, , w] = [0, 1, 2, 3].map((r) => matrix[r] * head[0] + matrix[4 + r] * head[1] + matrix[8 + r] * head[2] + matrix[12 + r]);
    const near = Math.hypot(x / w - at[0], y / w - at[1]) < 0.25;
    if (near) express(["laugh", "wink", "surprised"][Math.floor(Math.random() * 3)], 1.4);
    else play("wave");
  }

  function home() {
    spin = 0;
    zoomGoal = 1;
    tiltGoal = 0;
    const turns = Math.round((heading - HOME_HEADING) / (Math.PI * 2));
    spinTo(HOME_HEADING + turns * Math.PI * 2);
  }

  let spinGoal = null;
  function spinTo(goal) {
    spinGoal = goal;
    const step = () => {
      if (spinGoal === null || drag) return (spinGoal = null);
      heading = mix(heading, spinGoal, 0.14);
      if (Math.abs(heading - spinGoal) < 0.002) return (spinGoal = null);
      requestAnimationFrame(step);
    };
    step();
  }

  /** Eases into `expression`, holding it for `hold` seconds (0 holds until changed). */
  function express(expression, hold = 1.6) {
    if (pose.expression === expression && hold) {
      expressionUntil = time + hold;
      return;
    }
    pose.previousExpression = pose.expression;
    pose.expression = expression;
    pose.expressionAt = time;
    pose.held = hold === 0 && expression !== "neutral";
    expressionUntil = hold ? time + hold : Infinity;
  }

  function play(gesture) {
    pose.gesture = gesture;
    pose.gestureAt = time;
  }

  return {
    el: canvas,
    /** Draws `next`, a built character, from the next frame on. */
    show(next, { bounce = true } = {}) {
      anatomy = next;
      if (bounce) bounceAt = time;
    },
    /** Eases the camera to frame `next` (a key of the character's focus framings). */
    frame(next) {
      if (focus === next) return;
      focus = next;
      zoomGoal = 1;
    },
    get focus() {
      return focus;
    },
    play,
    express,
    /** Holds `expression` until another is chosen, or lets the face rest with null. */
    hold(expression) {
      express(expression ?? "neutral", expression ? 0 : 1);
    },
    get expression() {
      return pose.held ? pose.expression : null;
    },
    /** Turns the character back to face the camera, at the framing's own zoom. */
    home,
    /** Spins the character round once, for a reveal. */
    twirl() {
      spinTo(heading + Math.PI * 2);
    },
    zoomBy(factor) {
      zoomGoal = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomGoal * factor));
    },
    /** The next frame as a PNG data URL. */
    snapshot() {
      return new Promise((resolve) => (capture = resolve));
    },
    start() {
      if (running) return;
      running = true;
      previous = performance.now();
      requestAnimationFrame(frameStep);
    },
    stop() {
      running = false;
    },
    round: () => styleConfig.round,
    debug: () => ({ camera, heading, zoom, focus, size: [canvas.clientWidth, canvas.clientHeight], rig: anatomy?.rig }),
  };
}
