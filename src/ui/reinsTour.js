import { createCoachMarks } from "./coachMarks.js";
import { t } from "../i18n.js";

/** Explaining Autopilot and Skip, then inviting the owner to take the reins with the real button. */
const autopilotSteps = (name) => [
  {
    target: "[data-mode]",
    title: t("reinsTour.autopilotTitle"),
    text: t("reinsTour.autopilotText", { name }),
  },
  {
    target: '[data-action="skip"]',
    title: t("reinsTour.skipTitle"),
    text: t("reinsTour.skipText", { name }),
  },
  {
    target: '[data-action="reins"]',
    title: t("reinsTour.reinsTitle"),
    text: t("reinsTour.reinsText", { name }),
    keys: t("reinsTour.reinsKeys"),
    watch: true,
  },
];

/** The riding controls, one at a time, ending on the Autopilot button that hands back. */
const ridingSteps = (breath) => [
  {
    target: "[data-tour-stick]",
    round: true,
    title: t("reinsTour.steerTitle"),
    text: t("reinsTour.steerText"),
    keys: t("reinsTour.steerKeys"),
  },
  ...(breath
    ? [
        {
          target: ".rider-controls__pedals",
          title: t("reinsTour.breathTitle"),
          text: t("reinsTour.breathText", { breath }),
          keys: t("reinsTour.breathKeys"),
        },
      ]
    : []),
  {
    target: ".reins__gauges",
    title: t("reinsTour.gaugesTitle"),
    text: t("reinsTour.gaugesText"),
  },
  {
    target: '[data-action="reins"]',
    title: t("reinsTour.backTitle"),
    text: t("reinsTour.backText"),
    keys: t("reinsTour.backKeys"),
    next: t("reinsTour.ride"),
  },
];

/**
 * The owner's first-race onboarding as coach marks over the broadcast in `root`: `autopilot(name)`
 * explains Autopilot and Skip and points at Take the reins; `riding(breath)` walks the stick, the Breath button
 * (for a dragon old enough), the gauges and the Autopilot button. Every step can be skipped; `onClose` is called whenever the tour closes.
 * @param {HTMLElement} root
 * @param {{ onClose: () => void }} options
 */
export function createReinsTour(root, { onClose }) {
  const stick = document.createElement("div");
  stick.className = "reins-tour__stick";
  stick.dataset.tourStick = "";
  stick.hidden = true;
  stick.innerHTML = `<span class="reins-tour__knob"></span>`;
  const marks = createCoachMarks(root, { onClose, onStep: (step) => (stick.hidden = step.target !== "[data-tour-stick]") });
  marks.el.classList.add("reins-tour");
  marks.el.prepend(stick);

  return {
    el: marks.el,
    /** Explains Autopilot and Skip for `name`, the owner's dragon, and points at Take the reins. */
    autopilot(name) {
      marks.open(autopilotSteps(name));
    },
    /** Walks the riding controls; `breath` names the dragon's breath, or is null for a kid. */
    riding(breath) {
      marks.open(ridingSteps(breath));
    },
    /** Follows the controls as the layout moves. */
    place: marks.place,
    /** Closes the tour. */
    end: marks.end,
    /** Closes the tour without calling `onClose`, for when the screen goes. */
    dismiss: marks.dismiss,
    /** Whether a tour is up, holding the race. */
    get active() {
      return marks.active;
    },
    /** Whether the tour is on the step that waits for Take the reins. */
    get inviting() {
      return marks.inviting;
    },
  };
}
