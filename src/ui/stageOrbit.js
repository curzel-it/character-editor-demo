/**
 * Offsets from a stage's own framing: `yaw` and `pitch` in radians around the subject, `zoom` a
 * factor on closeness (2 is twice as close) and `pan` the target moved across the frame, in
 * half-heights of the view.
 * @typedef {{ yaw: number, pitch: number, zoom: number, pan: [number, number] }} OrbitView
 * @typedef {{ eye: number[], target: number[], fov: number }} OrbitShot
 */

const TURN = Math.PI,
  TILT = 0.75 * Math.PI,
  TAP_SLOP = 8,
  COAST = 4,
  RETURN = 6,
  ZOOM_MAX = 1 / 0.3,
  ZOOM_EASE = 12,
  WHEEL = 0.0015,
  PAN_REACH = 0.8,
  LOWEST_EYE = 0.3,
  LOWEST_PITCH = -0.35,
  HIGHEST_PITCH = 1.55;

const mix = (a, b, t) => a + (b - a) * t;

/**
 * `shot` turned by `view` around its target: yawed about the vertical, pitched up (never under the
 * ground plane nor over the top), brought `view.zoom` times closer and panned, keeping its other fields.
 * @template {OrbitShot} S
 * @param {S} shot
 * @param {OrbitView} view
 * @returns {S}
 */
export function orbitShot(shot, view) {
  const offset = shot.eye.map((v, k) => v - shot.target[k]);
  const distance = Math.hypot(...offset) / view.zoom;
  const yaw = Math.atan2(offset[0], offset[2]) + view.yaw;
  const pitch = Math.min(HIGHEST_PITCH, Math.max(LOWEST_PITCH, Math.asin(offset[1] / Math.max(1e-9, Math.hypot(...offset))) + view.pitch));
  const toward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
  const right = [Math.cos(yaw), 0, -Math.sin(yaw)],
    up = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
  const reach = Math.tan(shot.fov / 2) * distance;
  const target = shot.target.map((v, k) => v + (right[k] * view.pan[0] + up[k] * view.pan[1]) * reach);
  const eye = target.map((v, k) => v + toward[k] * distance);
  eye[1] = Math.max(LOWEST_EYE, eye[1]);
  return { ...shot, eye, target };
}

/**
 * The stable's camera gestures on a stage's `canvas`: a drag turns the camera round the subject and
 * tilts it, coasting on after release; the wheel or a pinch moves it in, down to its own framing at
 * the farthest, and two fingers dragged together pan it. `onTap(event)` reports a release that moved
 * nothing. `rise` is the stage's own pitch, so the tilt stops where the stable's does. The stage reads
 * `view()` once per frame and applies it with `orbitShot`.
 * @param {HTMLCanvasElement} canvas
 * @param {{ onTap?: (e: PointerEvent) => void, rise?: number }} [options]
 */
export function createStageOrbit(canvas, { onTap, rise = 0 } = {}) {
  let yaw = 0,
    pitch = 0,
    spin = [0, 0],
    homing = false,
    zoom = 1,
    zoomTarget = 1,
    pan = [0, 0],
    panTarget = [0, 0],
    previous = 0,
    /** @type {{ x: number, y: number, moved: boolean, lastX: number, lastY: number, lastT: number, id: number } | null} */
    drag = null,
    /** @type {{ from: number, zoom: number, at: number[] } | null} */
    pinch = null;
  /** @type {Map<number, { x: number, y: number }>} */
  const touches = new Map();

  const setZoom = (next) => (zoomTarget = Math.max(1, Math.min(ZOOM_MAX, next)));
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  };
  const middle = () => {
    const [a, b] = [...touches.values()];
    return [(a.x + b.x) / 2, (a.y + b.y) / 2];
  };

  function turn(dYaw, dPitch) {
    yaw = (yaw + dYaw) % (2 * Math.PI);
    pitch = Math.max(LOWEST_PITCH - rise, Math.min(HIGHEST_PITCH - rise, pitch + dPitch));
  }

  /** Pans by a two-finger drag of `dx`, `dy` pixels, keeping the subject within reach of the frame. */
  function panBy(dx, dy) {
    const perPixel = 2 / Math.max(1, canvas.clientHeight);
    panTarget = /** @type {[number, number]} */ ([panTarget[0] - dx * perPixel, panTarget[1] + dy * perPixel].map((v) => Math.max(-PAN_REACH, Math.min(PAN_REACH, v))));
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    setZoom(zoomTarget / Math.exp(e.deltaY * (e.deltaMode ? 30 : 1) * WHEEL));
  }, { passive: false });
  canvas.addEventListener("pointerdown", (e) => {
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      pinch = { from: spread(), zoom: zoomTarget, at: middle() };
      if (drag) drag.moved = true;
      spin = [0, 0];
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (drag) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, id: e.pointerId };
    spin = [0, 0];
    homing = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (touches.size === 2) {
        setZoom((pinch.zoom * spread()) / pinch.from);
        const at = middle();
        panBy(at[0] - pinch.at[0], at[1] - pinch.at[1]);
        pinch.at = at;
      }
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > TAP_SLOP) drag.moved = true;
    if (!drag.moved) return;
    const dYaw = (-(e.clientX - drag.lastX) / Math.max(1, canvas.clientWidth)) * TURN,
      dPitch = ((e.clientY - drag.lastY) / Math.max(1, canvas.clientHeight)) * TILT;
    turn(dYaw, dPitch);
    const dt = Math.max(1, e.timeStamp - drag.lastT) / 1000;
    spin = [mix(spin[0], dYaw / dt, 0.5), mix(spin[1], dPitch / dt, 0.5)];
    [drag.lastX, drag.lastY, drag.lastT] = [e.clientX, e.clientY, e.timeStamp];
  });
  /** @param {PointerEvent} e */
  function release(e) {
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    const rest = drag && touches.get(drag.id);
    if (rest) [drag.lastX, drag.lastY, drag.lastT] = [rest.x, rest.y, e.timeStamp];
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, lastT } = drag;
    drag = null;
    if (!moved && e.type === "pointerup") return onTap?.(e);
    if (e.timeStamp - lastT > 80) spin = [0, 0];
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  return {
    /**
     * The view to frame this frame: turned as dragged, coasting or homing, with zoom and pan easing to where the gestures put them.
     * @returns {OrbitView}
     */
    view() {
      const now = performance.now();
      const dt = Math.min(0.05, (now - previous) / 1000 || 0);
      previous = now;
      const ease = 1 - Math.exp(-ZOOM_EASE * dt);
      zoom += (zoomTarget - zoom) * ease;
      pan = [mix(pan[0], panTarget[0], ease), mix(pan[1], panTarget[1], ease)];
      if (homing) {
        const back = 1 - Math.exp(-RETURN * dt);
        yaw -= Math.atan2(Math.sin(yaw), Math.cos(yaw)) * back;
        pitch -= pitch * back;
        if (Math.abs(Math.atan2(Math.sin(yaw), Math.cos(yaw))) + Math.abs(pitch) < 1e-3) [yaw, pitch, homing] = [0, 0, false];
      } else if (!drag && (spin[0] || spin[1])) {
        turn(spin[0] * dt, spin[1] * dt);
        const fade = Math.exp(-COAST * dt);
        spin = spin.map((v) => (Math.abs(v) * fade < 0.01 ? 0 : v * fade));
      }
      return { yaw, pitch, zoom, pan: [pan[0], pan[1]] };
    },
    /** Eases back to the stage's own framing, as when another subject is picked. */
    reset() {
      [homing, spin, zoomTarget, panTarget] = [true, [0, 0], 1, [0, 0]];
    },
    /** Jumps to the stage's own framing, for a stage shown afresh. */
    clear() {
      [yaw, pitch, zoom, zoomTarget, homing, spin, pan, panTarget] = [0, 0, 1, 1, false, [0, 0], [0, 0], [0, 0]];
      drag = pinch = null;
      touches.clear();
    },
  };
}

/** @typedef {ReturnType<typeof createStageOrbit>} StageOrbit */
