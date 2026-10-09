import { t as text } from "../i18n.js";

const DELAY = 250;

/**
 * The card over the chase camera while the director's fork catches up after a hand-back: a line and
 * a bar of how far it has come, shown once the wait outlasts `DELAY` ms so a quick catch-up never flashes.
 * @returns {{ el: HTMLElement, update(progress: number | null, now: number): void }}
 */
export function createCatchUpCard() {
  const el = document.createElement("div");
  el.className = "dz-catch-up";
  el.hidden = true;
  el.setAttribute("role", "status");
  el.innerHTML = `<span class="dz-catch-up__label"></span><span class="dz-progress dz-catch-up__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100"></span>`;
  const label = el.querySelector(".dz-catch-up__label"),
    bar = el.querySelector(".dz-catch-up__bar");
  let since = null;
  return {
    el,
    update(progress, now) {
      if (progress === null) {
        since = null;
        el.hidden = true;
        return;
      }
      since ??= now;
      if (now - since < DELAY) return;
      const value = Math.round(progress * 100);
      if (el.hidden) {
        label.textContent = text("broadcastScreen.catchingUp");
        bar.setAttribute("aria-label", text("broadcastScreen.catchingUp"));
        el.hidden = false;
      }
      bar.style.setProperty("--value", String(value));
      bar.setAttribute("aria-valuenow", String(value));
    },
  };
}
