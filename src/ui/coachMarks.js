import { icon } from "./icons.js";
import { t } from "../i18n.js";

const GAP = 14,
  MARGIN = 12,
  RING_PAD = 6;

/**
 * @typedef {object} CoachMark
 * @property {string} [target] the control to ring; without one, or while it is out of sight, the card sits in the middle over a dimmed screen
 * @property {string} title
 * @property {string} text
 * @property {string} [keys] the keyboard shortcut, in small print
 * @property {string} [next] the label of the main button, `Next` by default
 * @property {() => void} [act] what the main button does before moving on
 * @property {string} [decline] the label of a second button that moves on without `act`, in place of Skip
 * @property {boolean} [watch] waits on the real control: no main button, and the second one reads Keep watching
 * @property {boolean} [round] rings the target as a circle
 */

/**
 * The stable hand's coach marks over `root`: each step dims the screen, rings the real control it
 * explains with a pulse and says what it does in a card beside it. Every step can be skipped;
 * `onStep(step)` is called as each one shows and `onClose` whenever the marks close.
 * @param {HTMLElement} root
 * @param {{ onClose?: () => void, onStep?: (step: CoachMark) => void }} options
 */
export function createCoachMarks(root, { onClose = () => {}, onStep = () => {} } = {}) {
  const el = document.createElement("div");
  el.className = "coach-marks";
  el.hidden = true;
  el.innerHTML = `
    <div class="coach-marks__ring" data-tour-ring></div>
    <div class="dz-card dz-card--parchment coach-marks__card" role="dialog">
      <div class="coach-marks__head">
        <span class="dz-avatar coach-marks__avatar">${icon("home")}</span>
        <h2 class="coach-marks__title" data-tour-title></h2>
        <span class="coach-marks__count" data-tour-count></span>
      </div>
      <p class="coach-marks__text" data-tour-text></p>
      <p class="dz-caption coach-marks__keys" data-tour-keys></p>
      <div class="coach-marks__buttons">
        <button type="button" class="dz-btn dz-btn--surface dz-btn--sm" data-tour="skip"><span class="dz-btn__label" data-tour-skip></span></button>
        <button type="button" class="dz-btn dz-btn--primary dz-btn--sm" data-tour="next"><span class="dz-btn__label" data-tour-next></span></button>
      </div>
    </div>`;
  const $ = (selector) => el.querySelector(selector);
  const card = $(".coach-marks__card"),
    ring = $("[data-tour-ring]");
  const title = $("[data-tour-title]"),
    text = $("[data-tour-text]");
  title.id = `coach-marks-title-${Math.random().toString(36).slice(2)}`;
  text.id = `${title.id}-text`;
  card.setAttribute("aria-labelledby", title.id);
  card.setAttribute("aria-describedby", text.id);
  /** @type {CoachMark[]} */
  let steps = [],
    at = 0;

  function render() {
    const step = steps[at];
    const last = at === steps.length - 1;
    ring.classList.toggle("is-round", Boolean(step.round));
    title.textContent = step.title;
    text.textContent = step.text;
    $("[data-tour-keys]").textContent = step.keys ?? "";
    $("[data-tour-keys]").hidden = !step.keys;
    $("[data-tour-count]").textContent = steps.length > 1 ? `${at + 1}/${steps.length}` : "";
    $("[data-tour-next]").textContent = step.next ?? t("coachMarks.next");
    $('[data-tour="next"]').hidden = Boolean(step.watch);
    $("[data-tour-skip]").textContent = step.watch ? t("coachMarks.keepWatching") : (step.decline ?? t("coachMarks.skip"));
    $('[data-tour="skip"]').hidden = !step.watch && !step.decline && last;
    onStep(step);
    place();
    const focus = step.watch && step.target ? root.querySelector(step.target) : $('[data-tour="next"]');
    focus?.focus({ preventScroll: true });
  }

  /** Rings the step's control and sets the card beside it, above when the control sits low. */
  function place() {
    if (el.hidden) return;
    const step = steps[at];
    const box = root.getBoundingClientRect();
    const target = step.target ? root.querySelector(step.target) : null;
    const rect = target?.getBoundingClientRect();
    const seen = Boolean(rect && rect.width > 0 && rect.height > 0);
    ring.hidden = !seen;
    el.classList.toggle("is-plain", !seen);
    const cardRect = card.getBoundingClientRect();
    let left = (box.width - cardRect.width) / 2,
      top = (box.height - cardRect.height) / 2;
    if (seen) {
      const x = rect.left - box.left,
        y = rect.top - box.top;
      Object.assign(ring.style, {
        left: `${x - RING_PAD}px`,
        top: `${y - RING_PAD}px`,
        width: `${rect.width + RING_PAD * 2}px`,
        height: `${rect.height + RING_PAD * 2}px`,
      });
      left = x + rect.width / 2 - cardRect.width / 2;
      const below = y + rect.height + RING_PAD + GAP,
        above = y - RING_PAD - GAP - cardRect.height;
      top = y + rect.height / 2 > box.height / 2 && above >= MARGIN ? above : below;
    }
    left = Math.min(box.width - cardRect.width - MARGIN, Math.max(MARGIN, left));
    top = Math.min(box.height - cardRect.height - MARGIN, Math.max(MARGIN, top));
    card.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
  }

  function close() {
    if (el.hidden) return;
    dismiss();
    onClose();
  }

  function dismiss() {
    el.hidden = true;
    steps = [];
  }

  function advance() {
    if (at === steps.length - 1) return close();
    at++;
    render();
  }

  el.addEventListener("click", (e) => {
    const action = e.target.closest("[data-tour]")?.dataset.tour;
    if (!steps.length) return;
    if (action === "skip") return steps[at].decline ? advance() : close();
    if (action !== "next") return;
    steps[at].act?.();
    advance();
  });

  return {
    el,
    /** Shows `list` from its first step. */
    open(list) {
      steps = list;
      at = 0;
      el.hidden = false;
      render();
    },
    /** Follows the controls as the layout moves. */
    place,
    /** Closes the marks. */
    end: close,
    /** Closes the marks without calling `onClose`, for when the screen goes. */
    dismiss,
    /** Whether the marks are up. */
    get active() {
      return !el.hidden;
    },
    /** Whether the marks are on a step that waits on the real control. */
    get inviting() {
      return !el.hidden && Boolean(steps[at]?.watch);
    },
  };
}
