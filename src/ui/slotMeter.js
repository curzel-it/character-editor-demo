import { slotsUsed, stableSlots } from "../stable/stableSlots.js";
import { t } from "../i18n.js";

/** A status row counting the stable's used slots, one pip per slot. */
export const slotMeterHtml = () =>
  `<div class="status__row slot-meter"><span class="status__label">${t("slotMeter.label")}</span><span class="status__value" data-slots></span>
    <span class="slot-meter__pips" data-slot-pips>${Array.from({ length: stableSlots }, () => `<i></i>`).join("")}</span></div>`;

export function updateSlotMeter(root, stable) {
  const used = slotsUsed(stable);
  root.querySelector("[data-slots]").textContent = t("slotMeter.slots", { used, total: stableSlots });
  root.querySelectorAll("[data-slot-pips] i").forEach((pip, i) => pip.classList.toggle("is-on", i < used));
}
