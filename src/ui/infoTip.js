import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./icons.js";
import { t } from "../i18n.js";

const GAP = 8,
  EDGE = 12;

/**
 * A small ⓘ button that explains what it sits next to; `installInfoTips` opens its `text` in a bubble.
 * @param {string} text one or two sentences
 * @param {string} [about] what it explains, for screen readers
 */
export const infoTipHtml = (text, about = "") =>
  `<button type="button" class="dz-info" data-info="${escapeHtml(text)}" aria-expanded="false" aria-label="${escapeHtml(about ? t("infoTip.about", { about }) : t("infoTip.label"))}">${icon("info")}</button>`;

/**
 * Opens every `infoTipHtml` button under `root` in one shared bubble, placed below the button (above
 * when there is no room) and kept on screen. A second tap, a tap elsewhere, scrolling or a route
 * change closes it.
 * @param {HTMLElement} root
 */
export function installInfoTips(root) {
  const bubble = document.createElement("p");
  bubble.className = "dz-info-bubble";
  bubble.setAttribute("role", "status");
  bubble.hidden = true;
  root.append(bubble);
  /** @type {HTMLElement | null} */
  let owner = null;

  function close() {
    if (!owner) return;
    owner.setAttribute("aria-expanded", "false");
    owner = null;
    bubble.hidden = true;
  }

  function open(button) {
    close();
    owner = button;
    button.setAttribute("aria-expanded", "true");
    bubble.textContent = button.dataset.info;
    bubble.hidden = false;
    const at = button.getBoundingClientRect();
    const width = bubble.offsetWidth,
      height = bubble.offsetHeight;
    const left = Math.max(EDGE, Math.min(innerWidth - width - EDGE, at.left + at.width / 2 - width / 2));
    const below = at.bottom + GAP + height <= innerHeight - EDGE;
    bubble.style.left = `${left}px`;
    bubble.style.top = `${below ? at.bottom + GAP : Math.max(EDGE, at.top - GAP - height)}px`;
    bubble.style.setProperty("--arrow", `${at.left + at.width / 2 - left}px`);
    bubble.dataset.side = below ? "below" : "above";
  }

  root.addEventListener(
    "click",
    (e) => {
      const button = e.target instanceof Element ? e.target.closest("[data-info]") : null;
      if (!button) return close();
      e.preventDefault();
      e.stopPropagation();
      if (button === owner) close();
      else open(button);
    },
    true,
  );
  addEventListener("scroll", close, true);
  addEventListener("resize", close);
  addEventListener("hashchange", close);
  return { close };
}
