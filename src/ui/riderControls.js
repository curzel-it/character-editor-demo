import { icon } from "./icons.js";
import { breathLength } from "../breath/breathCue.js";
import { breathLook } from "./breathLook.js";
import { t as text } from "../i18n.js";

const RADIUS = 56;
const KEYS = {
  left: ["ArrowLeft", "KeyA"],
  right: ["ArrowRight", "KeyD"],
  up: ["ArrowUp", "KeyW"],
  down: ["ArrowDown", "KeyS"],
  breath: ["KeyF", "KeyE", "Space"],
};

/**
 * Touch, mouse and keyboard controls for flying: drag anywhere on `surface` for a floating stick
 * (sideways steers, up climbs, down dives) and tap Breath (shown once `setBreath` names the
 * element). Arrows or WASD steer and Space, F or E breathes on a keyboard. Every change goes to
 * `onCommand` as a `RiderCommand`.
 * @param {HTMLElement} surface
 * @param {{ onCommand: (command: import("../race/riderPilot.js").RiderCommand) => void }} options
 */
export function createRiderControls(surface, { onCommand }) {
  const el = document.createElement("div");
  el.className = "rider-controls is-off";
  el.innerHTML = `
    <div class="rider-controls__stick" hidden><span class="rider-controls__knob"></span></div>
    <p class="rider-controls__hint"></p>
    <div class="rider-controls__pedals">
      <button type="button" class="dz-btn rider-controls__pedal rider-controls__pedal--breath" data-tap="breath" hidden></button>
    </div>`;
  const $ = (selector) => el.querySelector(selector);
  const stick = $(".rider-controls__stick"),
    knob = $(".rider-controls__knob"),
    hint = $(".rider-controls__hint"),
    breathButton = $("[data-tap=breath]");
  const keys = new Set();
  const sent = { x: 0, y: 0 };
  let enabled = false,
    steering = null,
    recharge = 1;

  /** Words the hint in the current language. */
  function relabel() {
    hint.textContent = text("riderControls.hint");
  }
  relabel();

  const held = (name) => KEYS[name].some((k) => keys.has(k));

  function steer(x, y) {
    if (x === sent.x && y === sent.y) return;
    Object.assign(sent, { x, y });
    if (x || y) hint.hidden = true;
    onCommand({ type: "stick", x, y });
  }

  function steerFromKeys() {
    if (steering) return;
    steer((held("right") ? 1 : 0) - (held("left") ? 1 : 0), (held("up") ? 1 : 0) - (held("down") ? 1 : 0));
  }

  function breathe() {
    if (!enabled || breathButton.hidden || breathButton.classList.contains("is-cooling")) return;
    onCommand({ type: "breath" });
  }

  surface.addEventListener("pointerdown", (e) => {
    if (!enabled || steering) return;
    steering = { id: e.pointerId, x: e.clientX, y: e.clientY };
    surface.setPointerCapture(e.pointerId);
    const box = el.getBoundingClientRect();
    stick.style.transform = `translate(${e.clientX - box.left}px, ${e.clientY - box.top}px)`;
    knob.style.transform = "";
    stick.hidden = false;
    hint.hidden = true;
  });
  surface.addEventListener("pointermove", (e) => {
    if (steering?.id !== e.pointerId) return;
    let dx = e.clientX - steering.x,
      dy = e.clientY - steering.y;
    const d = Math.hypot(dx, dy);
    if (d > RADIUS) {
      dx *= RADIUS / d;
      dy *= RADIUS / d;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    steer(Math.round((dx / RADIUS) * 100) / 100, Math.round((-dy / RADIUS) * 100) / 100);
  });
  for (const type of ["pointerup", "pointercancel"])
    surface.addEventListener(type, (e) => {
      if (steering?.id !== e.pointerId) return;
      steering = null;
      stick.hidden = true;
      steer(0, 0);
      steerFromKeys();
    });

  breathButton.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    breathe();
  });
  breathButton.addEventListener("contextmenu", (e) => e.preventDefault());

  const onKey = (e) => {
    if (!enabled || !Object.values(KEYS).flat().includes(e.code)) return;
    e.preventDefault();
    if (e.type === "keyup") keys.delete(e.code);
    else if (!e.repeat) {
      keys.add(e.code);
      if (KEYS.breath.includes(e.code)) breathe();
    }
    steerFromKeys();
  };
  addEventListener("keydown", onKey);
  addEventListener("keyup", onKey);
  addEventListener("blur", () => {
    keys.clear();
    steerFromKeys();
  });

  function release() {
    keys.clear();
    steering = null;
    stick.hidden = true;
    steer(0, 0);
  }

  return {
    el,
    /** Turns the controls on (the flight is live) or off, letting go of whatever is held. */
    enable(on) {
      if (on === enabled) return;
      enabled = on;
      el.classList.toggle("is-off", !on);
      if (!on) release();
    },
    /** Readies the controls for a new flight. */
    reset() {
      release();
      relabel();
      Object.assign(sent, { x: 0, y: 0 });
      hint.hidden = false;
    },
    /** Shows the Breath button for breath `element` (from `breathElements`), recharging in `seconds`, or hides it for null. */
    setBreath(element, seconds = 1) {
      recharge = seconds;
      breathButton.hidden = !element;
      if (!element) return;
      const look = breathLook[element.id] ?? breathLook.fire;
      breathButton.className = `dz-btn dz-btn--${look.variant} rider-controls__pedal rider-controls__pedal--breath`;
      const name = text(`breathReveal.elements.${element.id}`);
      breathButton.setAttribute("aria-label", text("riderControls.breathe", { element: name.toLowerCase() }));
      breathButton.innerHTML = `${icon(look.icon)}<span class="dz-btn__label">${name}</span><i class="rider-controls__cool"></i>`;
    },
    /** Draws the rider pilot's `state` at race time `t`: the breath recharging. */
    show(state, t) {
      const cooling = Math.max(0, state.breathReady - t);
      breathButton.classList.toggle("is-cooling", cooling > 0);
      breathButton.style.setProperty("--cool", String(Math.min(1, cooling / (breathLength + recharge))));
    },
  };
}
