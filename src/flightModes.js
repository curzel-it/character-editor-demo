import { flightStates, mouthStates, autoMotion } from "./animate/flightStates.js";
import { flapRate } from "./race/flightModel.js";

export const flightModes = [...flightStates, ...mouthStates, { id: "auto", label: "Auto" }];

/**
 * A flight-mode radio group for specimen previews. `step(delta, wingspan)` advances the clock and
 * returns the current wingbeat `phase` and `motion`.
 */
export function createFlightModes(container, initial = "cruise") {
  let mode = initial,
    time = 0,
    phase = 0,
    autoLabel = "";
  function draw() {
    container.replaceChildren(
      ...flightModes.map((entry) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.mode = entry.id;
        button.setAttribute("role", "radio");
        button.setAttribute("aria-checked", String(entry.id === mode));
        button.textContent = entry.id === "auto" && mode === "auto" && autoLabel ? `Auto · ${autoLabel}` : entry.label;
        button.onclick = () => set(entry.id);
        return button;
      }),
    );
  }
  function set(id) {
    if (!flightModes.some((entry) => entry.id === id)) return false;
    mode = id;
    autoLabel = "";
    draw();
    return true;
  }
  function motion() {
    if (mode === "auto") {
      const { motion, label } = autoMotion(time);
      if (label !== autoLabel) {
        autoLabel = label;
        const button = container.querySelector('[data-mode="auto"]');
        if (button) button.textContent = `Auto · ${label}`;
      }
      return motion;
    }
    const mouth = mouthStates.find((entry) => entry.id === mode);
    if (mouth) return mouth.motionAt(time);
    return { ...flightStates.find((entry) => entry.id === mode).motion, time };
  }
  draw();
  return {
    set,
    get mode() {
      return mode;
    },
    get phase() {
      return phase;
    },
    set phase(value) {
      phase = value;
    },
    motion,
    step(delta, wingspan) {
      time += delta;
      const current = motion();
      phase = (phase + delta * flapRate(current.effort ?? 0.5, wingspan) * (1 - (current.glide ?? 0))) % 1;
      return { phase, motion: current };
    },
  };
}
