import { playDragonCall, playStable } from "../sound/stableSounds.js";

const STAMP_MS = 1600;

/**
 * The yard's reveal of a hatching or a growth: `play` dims the stable around the change and greets
 * the result with a flash and a stamp. `layers` go over the yard, under its UI.
 */
export function createYardReveal() {
  const veil = Object.assign(document.createElement("div"), { className: "yard__veil" }),
    flash = Object.assign(document.createElement("div"), { className: "yard__flash" }),
    stamp = Object.assign(document.createElement("span"), { className: "dz-stamp yard__stamp", hidden: true });
  let timers = [];

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  return {
    layers: [veil, flash, stamp],
    /** Hides `screen`'s UI under the veil for `seconds`, then flashes, stamps `text`, greets the `age` dragon and brings it back. */
    play(screen, seconds, text, age) {
      timers.forEach(clearTimeout);
      timers = [];
      screen.classList.add("is-hatching");
      later(seconds * 1000, () => {
        screen.classList.remove("is-hatching");
        flash.classList.remove("is-flashing");
        void flash.offsetWidth;
        flash.classList.add("is-flashing");
        playStable("hatch");
        later(450, () => playDragonCall(age));
        stamp.textContent = text;
        stamp.hidden = false;
        stamp.classList.remove("is-leaving");
        later(STAMP_MS, () => stamp.classList.add("is-leaving"));
        later(STAMP_MS + 400, () => (stamp.hidden = true));
      });
    },
  };
}
