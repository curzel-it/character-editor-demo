import { installSound, prepareSounds } from "./audioOutput.js";
import { raceRenders } from "./raceSounds.js";
import { stableRenders } from "./stableSounds.js";
import { playSoundtrack } from "./soundtrack.js";
import { playUi, uiRenders } from "./uiSounds.js";

const tappable = "button, a[href], [role='button'], [data-tab], label, summary";

/** @param {string} prefix @param {Record<string, (sampleRate: number) => Float32Array>} renders */
function keyed(prefix, renders) {
  return Object.fromEntries(Object.entries(renders).map(([name, render]) => [`${prefix}:${name}`, render]));
}

/**
 * Turns the game's sound on, unless a tool is driving the page on a virtual clock: a soft tap
 * under every button, and lofi playing throughout.
 * @param {Document} doc
 */
export function installGameSound(doc) {
  if (/** @type {any} */ (globalThis).__clock) return;
  installSound(doc);
  prepareSounds({ ...keyed("ui", uiRenders), ...keyed("race", raceRenders), ...keyed("stable", stableRenders) });
  doc.addEventListener(
    "click",
    (event) => {
      const target = /** @type {Element | null} */ (event.target)?.closest?.(tappable);
      if (!target || target.closest("[data-silent]") || /** @type {HTMLButtonElement} */ (target).disabled) return;
      playUi(target.closest("[data-tab]") ? "tab" : "tap");
    },
    true,
  );
  playSoundtrack();
}
