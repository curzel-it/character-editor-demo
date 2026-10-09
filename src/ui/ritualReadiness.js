import { ageOf } from "../dragonAge.js";
import { formatDuration } from "./formatDuration.js";
import { restTime, unfitReason } from "../stable/condition.js";
import { maxParents, minParents, ritualBlock, ritualOdds, slumberLeft, slumbering } from "../stable/soulAltar.js";
import { onTheWay, timeToArrive } from "../stable/wild.js";
import { locale, t } from "../i18n.js";
import { blockText } from "./blockText.js";

export { maxParents };

/** Places around the circle: one per adult at home, at least two and at most `maxParents`. */
export const circleSize = (stable) => Math.max(minParents, Math.min(maxParents, stable.dragons.filter((w) => w.age === "adult").length));


/**
 * Whether `w` can stand in the circle now: a short line, its tone, whether it can be picked at all
 * (adults at home) and the game time until it is ready (0 when it is, null when waiting will not help).
 */
export function joinState(stable, w, now) {
  if (!stable.dragons.includes(w)) {
    if (onTheWay(w)) return { text: t("ritualReadiness.onTheWay", { time: formatDuration(timeToArrive(w, now)) }), tone: "warn", pickable: false, wait: null };
    return { text: t("ritualReadiness.inTheWild"), tone: "", pickable: false, wait: null };
  }
  if (w.age !== "adult") return { text: t("ritualReadiness.notAdult", { age: t(`dragonAge.${ageOf(w.age).id}`) }), tone: "", pickable: false, wait: null };
  if (w.injury) return { text: t("ritualReadiness.unfit", { reason: blockText(unfitReason(w)), time: formatDuration(w.injury.until - now) }), tone: "sad", pickable: true, wait: w.injury.until - now };
  if (unfitReason(w)) return { text: t("ritualReadiness.tired", { time: formatDuration(restTime(w)) }), tone: "warn", pickable: true, wait: restTime(w) };
  if (slumbering(w, now)) return { text: t("ritualReadiness.slumbering", { time: formatDuration(slumberLeft(w, now)) }), tone: "warn", pickable: true, wait: slumberLeft(w, now) };
  return { text: t("ritualReadiness.ready"), tone: "happy", pickable: true, wait: 0 };
}

const names = (list) => new Intl.ListFormat(locale(), { type: "conjunction" }).format(list);

/** The verdict on the circle `parents` as a status row: ready, or why not and for how long. */
export function ritualVerdict(stable, parents, now) {
  const block = ritualBlock(stable, parents, now);
  if (!block) return { id: "verdict", label: t("ritualReadiness.circleReady"), value: "", tone: "happy" };
  if (parents.length < minParents) return { id: "verdict", label: t("ritualReadiness.pickAtLeast", { count: minParents }), value: t("ritualReadiness.inCircle", { count: parents.length }), tone: "" };
  const waiting = parents.map((w) => ({ w, state: joinState(stable, w, now) })).filter(({ state }) => state.wait !== 0);
  if (waiting.length) {
    const wait = waiting.map(({ state }) => state.wait);
    const label = t("ritualReadiness.notReady", { count: waiting.length, names: names(waiting.map(({ w }) => w.name)) });
    return { id: "verdict", label, value: wait.includes(null) ? "" : t("ritualReadiness.readyIn", { time: formatDuration(Math.max(...wait)) }), tone: waiting.some(({ state }) => state.tone === "sad") ? "sad" : "warn" };
  }
  if (block === "stableFull") return { id: "verdict", label: t("ritualReadiness.noSlot"), value: t("ritualReadiness.freeSlotFirst"), tone: "warn" };
  return { id: "verdict", label: blockText(block), value: "", tone: "sad" };
}

/** Who slumbers after `result` and for how long, such as `Ada, Bo and Cy slumber for 6h`. */
export function slumberLine(parents, now) {
  const left = Math.max(...parents.map((w) => slumberLeft(w, now)));
  return t("ritualReadiness.slumberLine", { count: parents.length, names: names(parents.map((w) => w.name)), time: formatDuration(left) });
}
