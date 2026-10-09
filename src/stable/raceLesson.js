/** Whether the stable should point the owner at their first race: they have cared for a dragon, and have neither entered a race nor dismissed the hint. */
export const raceHintDue = (stable) => stable.raceHint === "due";

/** Remembers the owner's first care, which brings up the first race hint unless it has already gone. */
export function markFirstCare(stable) {
  stable.raceHint ??= "due";
}

/** Puts the first race hint away for good: the owner entered a race or dismissed it. */
export function markRaceHintDone(stable) {
  stable.raceHint = "done";
}
