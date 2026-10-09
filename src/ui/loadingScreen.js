import { logoHtml } from "./logo.js";
import { t } from "../i18n.js";

/**
 * The full screen splash over the app: shown by the page at launch and again while a slow step
 * (building a race) holds the main thread.
 * @param {HTMLElement} el
 */
export function createLoadingScreen(el) {
  el.querySelector(".dz-logo").innerHTML = logoHtml();
  const label = el.querySelector(".loading__label");
  label.textContent = t("loadingScreen.waking");
  let leaving = 0;
  return {
    /** @param {string} text */
    show(text) {
      clearTimeout(leaving);
      label.textContent = text;
      el.classList.remove("is-leaving");
      el.hidden = false;
    },
    hide() {
      if (el.hidden) return;
      el.classList.add("is-leaving");
      leaving = setTimeout(() => (el.hidden = true), 240);
    },
  };
}
