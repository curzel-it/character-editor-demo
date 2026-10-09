import { breathOf } from "../breath/breathElements.js";
import { canBreathe } from "../dragonAge.js";
import { escapeHtml } from "../escapeHtml.js";
import { t } from "../i18n.js";
import { breathLook } from "./breathLook.js";
import { icon } from "./icons.js";

const AFTER_STAMP_MS = 2000;

/**
 * Introduces a dragon's breath the moment it grows old enough to breathe: once the growth's stamp
 * has played, a card over `screen` names its element in its colours, says how the owner uses it in
 * races, and the dragon breathes on stage through `breathe(id)`, which answers the breath's seconds,
 * held in a framing that takes in its plume through `hold(id)` until `hold(null)` lets go.
 * @param {HTMLElement} screen
 * @param {{ breathe: (id: string) => number, hold: (id: string | null) => void }} options
 */
export function createBreathReveal(screen, { breathe, hold }) {
  const el = document.createElement("div");
  el.className = "breath-reveal";
  el.hidden = true;
  screen.append(el);
  /** @type {ReturnType<typeof setTimeout>[]} */
  let timers = [];
  /** @type {string | null} */
  let shown = null;

  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function demo() {
    const seconds = shown ? breathe(shown) : 0;
    const again = el.querySelector("[data-breath-reveal=again]");
    if (!seconds || !again) return;
    again.disabled = true;
    later(seconds * 1000, () => (again.disabled = false));
  }

  function close() {
    timers.forEach(clearTimeout);
    timers = [];
    if (shown) hold(null);
    shown = null;
    el.hidden = true;
    screen.classList.remove("is-revealing-breath");
  }

  /** @param {{ id: string, name: string, genome: Record<string, number> }} dragon */
  function open(dragon) {
    const element = breathOf(dragon.genome);
    const look = breathLook[element.id] ?? breathLook.fire;
    const vars = { name: escapeHtml(dragon.name), element: t(`breathReveal.elements.${element.id}`) };
    shown = dragon.id;
    el.style.setProperty("--breath-color", look.color);
    el.innerHTML = `
      <div class="dz-card dz-card--parchment breath-reveal__card" role="dialog" aria-labelledby="breath-reveal-title">
        <div class="breath-reveal__head">
          <span class="dz-avatar breath-reveal__badge">${icon(look.icon)}</span>
          <div class="breath-reveal__titles">
            <span class="breath-reveal__eyebrow">${t("breathReveal.eyebrow", vars)}</span>
            <h2 class="breath-reveal__title" id="breath-reveal-title">${t(`breathReveal.titles.${element.id}`, vars)}</h2>
          </div>
        </div>
        <p class="breath-reveal__text">${t("breathReveal.howTo", vars)}</p>
        <p class="dz-caption breath-reveal__note">${t("breathReveal.autopilot", vars)}</p>
        <div class="breath-reveal__buttons">
          <button type="button" class="dz-btn dz-btn--surface dz-btn--sm" data-breath-reveal="again">${icon(look.icon)}<span class="dz-btn__label">${t("breathReveal.again")}</span></button>
          <button type="button" class="dz-btn dz-btn--primary dz-btn--sm" data-breath-reveal="done"><span class="dz-btn__label">${t("breathReveal.done")}</span></button>
        </div>
      </div>`;
    el.hidden = false;
    screen.classList.add("is-revealing-breath");
    hold(dragon.id);
    demo();
  }

  el.addEventListener("click", (e) => {
    const button = e.target instanceof Element ? e.target.closest("[data-breath-reveal]") : null;
    if (!button || button.disabled) return;
    if (button.dataset.breathReveal === "again") demo();
    else close();
  });

  return {
    el,
    /**
     * Opens the reveal for `dragon`, which just grew out of age `from`, after the growth's `seconds`
     * and its stamp; nothing when it could already breathe or still cannot.
     */
    play(dragon, from, seconds) {
      if (canBreathe(from) || !canBreathe(dragon.age)) return;
      close();
      screen.classList.add("is-revealing-breath");
      later(seconds * 1000 + AFTER_STAMP_MS, () => open(dragon));
    },
    close,
    /** The open card, for the yard to frame the dragon above it, or null. */
    card: () => (el.hidden ? null : el.querySelector(".breath-reveal__card")),
  };
}
