import { neediest, needValue } from "../stable/care.js";
import { careAlarm } from "../stable/awaySummary.js";
import { fatigueLimit } from "../stable/condition.js";
import { eggReady } from "../stable/egg.js";
import { readyToEvolve } from "../stable/lifeStages.js";
import { formatDuration } from "./formatDuration.js";
import { slumberLeft, slumbering } from "../stable/soulAltar.js";
import { onTheWay } from "../stable/wild.js";
import { onAirBlock } from "../stable/onAir.js";
import { t } from "../i18n.js";
import { injuryName } from "./blockText.js";

const needIcons = { fullness: "meat", happiness: "sad", cleanliness: "drop", exercise: "stamina", affection: "heart" };

/** What a dragon asks for once its neediest need runs low, or null when it is looked after. */
export function careMood(w) {
  const need = neediest(w);
  return needValue(w, need.id) < careAlarm ? { text: t(`mood.needs.${need.id}`), icon: needIcons[need.id], tone: "warn" } : null;
}

/**
 * What the selected egg or dragon "says" at game time `now`: `tone` is happy, warn or sad; null when it has nothing to say.
 * A wild dragon tells where it is, a slumbering one when it wakes, one flying a race of `stable` that it is on air.
 */
export function moodOf(item, kind, now, stable) {
  if (kind === "egg") return eggReady(item) ? { text: t("mood.readyToHatch"), icon: "sparkle", tone: "happy" } : null;
  if (item.wild) return onTheWay(item) ? { text: t("mood.onTheWayHome"), icon: "home", tone: "warn" } : { text: t("mood.inTheWild"), icon: "mountain", tone: "warn" };
  if (stable && onAirBlock(stable, item.id)) return { text: t("mood.onAir"), icon: "playCircle", tone: "happy" };
  if (item.injury) return { text: injuryName(item.injury), icon: "sad", tone: "sad" };
  if (now !== undefined && slumbering(item, now)) return { text: t("mood.slumbering", { time: formatDuration(slumberLeft(item, now)) }), icon: "moon", tone: "warn" };
  if (readyToEvolve(item)) return { text: t("mood.readyToEvolve"), icon: "evolveColor", tone: "happy" };
  const care = careMood(item);
  if (care) return care;
  if (item.fatigue > fatigueLimit) return { text: t("mood.tired"), icon: "moon", tone: "warn" };
  return { text: t("mood.readyToRace"), icon: "smile", tone: "happy", calm: true };
}

/** The icon to badge a roster card with at game time `now`, or null when all is well. */
export function badgeOf(item, kind, now, stable) {
  if (kind === "egg") return eggReady(item) ? "sparkle" : null;
  if (stable && onAirBlock(stable, item.id)) return "playCircle";
  if (now !== undefined && slumbering(item, now) && !item.injury) return "bedColor";
  if (readyToEvolve(item) && !item.injury) return "evolveColor";
  const mood = moodOf(item, kind, now, stable);
  return mood && mood.tone !== "happy" ? mood.icon : null;
}
