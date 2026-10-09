import { ageOf } from "../dragonAge.js";
import { formatDuration } from "./formatDuration.js";
import { fatigueLimit, restTime } from "../stable/condition.js";
import { readyToEvolve, stageProgress, timeToGrow, nextAge } from "../stable/lifeStages.js";
import { leagueForAge } from "../stable/leagues.js";
import { language, t } from "../i18n.js";
import { injuryName } from "./blockText.js";
import { leagueName } from "./leagueLook.js";

/** Growth towards the next age as a status row: label, detail and progress 0..100. */
export function growthRow(w) {
  const next = nextAge[w.age];
  if (!next) return { id: "growth", label: t("dragonStatus.fullyGrown"), value: "", progress: 100 };
  if (readyToEvolve(w)) return { id: "growth", label: t("dragonStatus.readyToEvolve", { age: t(`dragonAge.${next}`).toLocaleLowerCase(language()) }), value: "", progress: 100 };
  return {
    id: "growth",
    label: t("dragonStatus.growsIn", { age: t(`dragonAge.${next}`), time: formatDuration(timeToGrow(w)) }),
    value: "",
    progress: stageProgress(w) * 100,
  };
}

/** Fitness to race as a status row, toned happy, warn or sad. */
export function conditionRow(w, now) {
  if (w.injury) return { id: "condition", label: injuryName(w.injury), value: t("dragonStatus.healsIn", { time: formatDuration(w.injury.until - now) }), tone: "sad" };
  if (w.fatigue > fatigueLimit) return { id: "condition", label: t("dragonStatus.tired"), value: t("dragonStatus.restedIn", { time: formatDuration(restTime(w)) }), tone: "warn" };
  return { id: "condition", label: t(w.fatigue > 0.05 ? "dragonStatus.fitTired" : "dragonStatus.rested"), value: "", tone: "happy" };
}

/** The league a dragon's age races in, such as `Kids League`, or its age when it has none. */
export const dragonLine = (w) => {
  const league = leagueForAge(w.age);
  return league ? leagueName(league.id) : t(`dragonAge.${ageOf(w.age).id}`);
};
