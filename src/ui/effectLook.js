import { breathStatuses } from "../race/breathEffects.js";
import { t } from "../i18n.js";

const looks = { slow: { icon: "speed", color: "#8FD8FF" }, daze: { icon: "sparkle", color: "var(--dz-accent)" } };

/** How each status a breath hit leaves shows in the UI, keyed by status id: its icon and colour, its length and its label in the current language. */
export const effectLook = Object.fromEntries(
  Object.values(breathStatuses).map((status) => [
    status.id,
    {
      ...looks[status.id],
      duration: status.duration,
      get label() {
        return t(`effectLook.${status.id}`);
      },
    },
  ]),
);
