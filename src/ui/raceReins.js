import { createRiderControls } from "./riderControls.js";
import { loadRideCamera, saveRideCamera } from "./rideCameraPreference.js";
import { icon } from "./icons.js";
import { t as text } from "../i18n.js";
import { createChaseCam } from "../camera/chaseCam.js";
import { createLiveRiderCam } from "../camera/liveRiderCam.js";
import { riderEye } from "../jockey/riderEye.js";
import { breathOf } from "../breath/breathElements.js";
import { canBreathe, grownWingspan } from "../dragonAge.js";

const MARK_SIZE = 30;

/** A gate through view-projection `m`: clip-space `x`, `y` (mirrored when behind the lens) and whether it sits well inside the frame. */
function onScreen(gate, m) {
  const [x, y, z] = gate.position;
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const s = w < 0 ? -1 : 1;
  const cx = (s * (m[0] * x + m[4] * y + m[8] * z + m[12])) / w,
    cy = (s * (m[1] * x + m[5] * y + m[9] * z + m[13])) / w;
  return { x: cx, y: cy, inside: w > 0 && Math.abs(cx) < 0.9 && Math.abs(cy) < 0.9 };
}

/**
 * What a race screen shows while the owner holds the reins: the chase or rider camera (the choice
 * kept per device), the stick and Breath, the speed and the next gate,
 * marked in the scene or pointed at from the screen edge.
 * @param {HTMLCanvasElement} canvas the surface the stick is dragged on
 * @param {{ onCommand: (command: import("../race/riderPilot.js").RiderCommand) => void }} options
 */
export function createRaceReins(canvas, { onCommand }) {
  const el = document.createElement("div");
  el.className = "reins";
  el.innerHTML = `
    <div class="reins__gauges" aria-live="off">
      <span class="reins__speed"><b data-reins-speed>0</b><small>km/h</small></span>
      <span class="reins__gate" data-reins-gate></span>
    </div>
    <div class="reins__mark" data-reins-mark hidden>${icon("arrowUp")}</div>
`;
  const $ = (selector) => el.querySelector(selector);
  const controls = createRiderControls(canvas, { onCommand });
  el.prepend(controls.el);
  let camera = loadRideCamera(),
    cameras = null;

  /** Points at the next gate from the screen edge when it is out of view; in view, the scene draws the arrow over it. */
  function mark(gate, m) {
    const node = $("[data-reins-mark]");
    const at = gate && m && onScreen(gate, m);
    if (!at || at.inside) return (node.hidden = true);
    const k = 0.9 / Math.max(Math.abs(at.x), Math.abs(at.y), 1e-6);
    const cx = at.x * k,
      cy = at.y * k;
    const width = canvas.clientWidth,
      height = canvas.clientHeight;
    const angle = (Math.atan2(cx * width, cy * height) * 180) / Math.PI;
    node.hidden = false;
    node.style.transform = `translate(${((cx + 1) / 2) * width}px, ${((1 - cy) / 2) * height}px) translate(-50%, -50%) rotate(${angle}deg)`;
  }

  return {
    el,
    /** The live camera ridden with, "chase" or "rider". */
    get camera() {
      return camera;
    },
    /** Switches between the chase and the rider camera and remembers it. */
    toggleCamera() {
      camera = camera === "chase" ? "rider" : "chase";
      saveRideCamera(camera);
      return camera;
    },
    /** Readies the cameras and controls for riding `entry` (a built race entry, with its tacked anatomy), whose breath recharges in `recharge` s. */
    start(entry, recharge) {
      cameras = { chase: createChaseCam({ span: grownWingspan(entry.genome, entry.age) }), rider: createLiveRiderCam({ eye: riderEye(entry.anatomy) }) };
      const breath = canBreathe(entry.age) ? breathOf(entry.genome) : null;
      controls.reset();
      controls.setBreath(breath, recharge);
      return breath;
    },
    /** Shows the riding chrome (`shown`) and turns the controls on or off, letting go of whatever is held. */
    enable(on, shown = on) {
      controls.enable(on);
      el.classList.toggle("is-on", shown);
    },
    /** The live camera's shot of sampled racer `r` (`chase` while the broadcast catches up, else the camera ridden with). */
    shot(r, t, dt, { motion = 1, chase = false } = {}) {
      const lenses = cameras;
      if (!lenses) return null;
      const framed = Object.fromEntries(Object.entries(lenses).map(([id, lens]) => [id, lens.shot(r, t, dt, { motion })]));
      return framed[chase ? "chase" : camera];
    },
    /** The scene marker over the next gate while it is well in view through `m`. */
    marker(gate, m) {
      return gate && m && onScreen(gate, m).inside ? { position: gate.position, size: MARK_SIZE / canvas.clientHeight } : null;
    },
    /** Draws the gauges, the gate pointer and the controls for sampled racer `r` at race time `t`. */
    update(r, t, { gate, gates, viewProjection, state }) {
      $("[data-reins-speed]").textContent = Math.round(r.speed * 3.6);
      $("[data-reins-gate]").textContent = r.finished ? text("raceReins.finished") : text("raceReins.gate", { gate: Math.min(gates, r.gate + 1), gates });
      mark(r.finished ? null : gate, viewProjection);
      if (state) controls.show(state, t);
    },
    /** Hides the gate pointer, for when the broadcast is on. */
    clear() {
      $("[data-reins-mark]").hidden = true;
    },
  };
}
