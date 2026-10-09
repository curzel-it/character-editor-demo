import { flightHome, onTheWay } from "../stable/wild.js";
import { callable, slotsBooked, slotsFree } from "../stable/stableSlots.js";
import { t } from "../i18n.js";

const hour = 3_600_000;

/** The flight home as the owner reads it, such as `2 h`. */
export const flightLabel = () => (flightHome % hour ? `${Math.round(flightHome / 60_000)} min` : `${flightHome / hour} h`);

/** Why no wild dragon can be called home, counting every dragon already on its way and every egg; null while a slot is free. */
export function noRoomLine(stable) {
  if (slotsFree(stable)) return null;
  const booked = slotsBooked(stable),
    eggs = stable.eggs.length;
  const bookedText = t("wildLines.booked", { count: booked }),
    eggsText = t("wildLines.eggs", { count: eggs });
  if (booked && eggs) return t("wildLines.heldBoth", { booked: bookedText, eggs: eggsText });
  if (booked || eggs) return t("wildLines.heldOne", { held: booked ? bookedText : eggsText });
  return t("wildLines.full");
}

/** Wild dragons not yet called home. */
export const waitingInWild = (stable) => (stable.wild ?? []).filter((w) => !onTheWay(w));

/** How many of the waiting wild dragons a Call all home would bring back, as `{ fit, of, line }`; null with fewer than two waiting. */
export function callAllNote(stable) {
  const waiting = waitingInWild(stable);
  if (waiting.length < 2) return null;
  const fit = callable(
    stable,
    waiting.map((w) => w.id),
  );
  const line = fit === waiting.length ? t("wildLines.allFit", { count: fit }) : fit ? t("wildLines.someFit", { fit, count: waiting.length }) : null;
  return { fit, of: waiting.length, line };
}

/** The first ask before `w` leaves for the wild. */
export const sendAwayQuestion = (w) => t("wildLines.sendAway", { name: w.name, time: flightLabel() });

/** Whether sending `id` to the wild would leave no dragon at home at all; eggs and dragons on their way do not count. */
export const leavesEmpty = (stable, id) => stable.dragons.every((w) => w.id === id);
