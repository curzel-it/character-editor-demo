import { icon } from "./icons.js";
import { t } from "../i18n.js";

/**
 * The stable hand's nudge towards the first race: a bubble over the stable's actions pointing at the
 * Race tile, which pulses while it shows. Tapping the bubble calls `onRace`, its close button `onDismiss`.
 * @param {{ onRace: () => void, onDismiss: () => void }} options
 */
export function createRaceHint({ onRace, onDismiss }) {
  const el = document.createElement("div");
  el.className = "race-hint";
  el.hidden = true;
  el.innerHTML = `
    <button type="button" class="race-hint__body" data-race-hint>
      <span class="dz-avatar race-hint__avatar">${icon("flagFinish")}</span>
      <span class="race-hint__words"><strong class="race-hint__title"></strong><span class="race-hint__text"></span></span>
    </button>
    <button type="button" class="race-hint__close" data-race-hint-close>${icon("close")}</button>`;
  const $ = (selector) => el.querySelector(selector);
  el.addEventListener("click", (e) => {
    if (e.target.closest("[data-race-hint-close]")) return onDismiss();
    if (e.target.closest("[data-race-hint]")) onRace();
  });
  return {
    el,
    /** Shows the hint for `name` racing in `league`, or hides it with no name; `tile` is the Race tile to pulse. */
    show(name, league, tile) {
      tile?.classList.toggle("is-hinted", Boolean(name));
      el.hidden = !name;
      if (!name) return;
      $(".race-hint__title").textContent = t("raceHint.title");
      $(".race-hint__text").textContent = t("raceHint.text", { name, league });
      $("[data-race-hint-close]").setAttribute("aria-label", t("raceHint.dismiss"));
    },
  };
}
