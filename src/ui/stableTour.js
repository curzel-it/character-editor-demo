import { createCoachMarks } from "./coachMarks.js";
import { askForNotifications, canNotify } from "../needNotifications.js";
import { cloudName } from "../stable/cloudSave.js";
import { t } from "../i18n.js";

/** Care on the dragon's care tile, then reminders in the apps, then how the stable is kept. */
function stableSteps(name, careTile) {
  const cloud = cloudName() && t(`cloudSave.${cloudName()}`);
  return [
    {
      target: careTile,
      title: t("stableTour.careTitle"),
      text: t("stableTour.careText", { name }),
    },
    ...(canNotify()
      ? [
          {
            title: t("stableTour.remindersTitle"),
            text: t("stableTour.remindersText", { name }),
            next: t("stableTour.remindMe"),
            act: askForNotifications,
            decline: t("stableTour.notNow"),
          },
        ]
      : []),
    {
      title: t("stableTour.savedTitle"),
      text: cloud ? t("stableTour.savedCloud", { cloud }) : t("stableTour.savedLocal"),
      next: t("stableTour.gotIt"),
    },
  ];
}

/**
 * The owner's first visit to the stable as coach marks over `root`: `open(name, careTile)` rings the
 * care tile (a selector) of `name`, the dragon in view, offers reminders where the app can post them
 * and says how the stable is saved.
 * @param {HTMLElement} root
 */
export function createStableTour(root) {
  const marks = createCoachMarks(root);
  marks.el.classList.add("stable-tour");
  return {
    el: marks.el,
    /** Walks the stable for `name`, ringing its care tile at `careTile`. */
    open(name, careTile) {
      marks.open(stableSteps(name, careTile));
    },
    /** Follows the care tile as the layout moves. */
    place: marks.place,
    /** Closes the tour, for when the screen goes. */
    dismiss: marks.dismiss,
  };
}
