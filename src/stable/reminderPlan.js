import { needsOf, needValue } from "./care.js";
import { careAlarm } from "./awaySummary.js";
import { timeToHatch, timeToWarm } from "./egg.js";

const minute = 60_000,
  hour = 60 * minute,
  day = 24 * hour;

/** Local hours with no reminders: from `quietFrom` at night to `quietTo` in the morning. */
export const quietFrom = 23,
  quietTo = 6;
/** Reminders a day for care and warming; hatching and missing the owner may take a day to `extraCap`. */
export const careCap = 2,
  extraCap = 3;
/** How far ahead reminders are planned, and how long an absence before a dragon misses the owner. */
export const horizon = 7 * day,
  missedAfter = 7 * day;
/** The least time between two reminders, and from planning to the first. */
const minGap = 4 * hour,
  lead = hour;
/** Moments due this soon after a reminder go out with it. */
const gather = hour;
/** Planning starts from now in steps of this, so a plan made a moment later is the same plan. */
const step = 15 * minute;

/** Kinds that may take a day's extra reminder. */
const extra = new Set(["hatch", "missed"]);

/**
 * Every moment worth a reminder from real time `since` to the horizon, in real ms: each need of each
 * dragon dropping below `careAlarm` (at once for one already low), each egg ready to warm or hatch, and
 * the lead dragon missing the owner after `missedAfter`. `{ kind: "need" | "warm" | "hatch" | "missed", at, id?, name?, need? }`.
 */
export function reminderMoments(stable, since) {
  const speed = stable.clock.speed || 1;
  const moments = [];
  for (const dragon of stable.dragons) {
    for (const need of needsOf(dragon.age)) {
      const due = Math.max(0, (needValue(dragon, need.id) - careAlarm) / need.decay) * hour;
      moments.push({ kind: "need", need: need.id, id: dragon.id, name: dragon.name, at: since + due / speed });
    }
  }
  for (const egg of stable.eggs ?? []) {
    moments.push({ kind: "hatch", id: egg.id, at: since + timeToHatch(egg) / speed });
    const warm = timeToWarm(egg, stable.clock.game);
    if (warm !== null) moments.push({ kind: "warm", id: egg.id, at: since + warm / speed });
  }
  const dearest = stable.dragons.reduce((a, b) => (!a || (b.bond ?? 0) > (a.bond ?? 0) ? b : a), null);
  if (dearest || stable.eggs?.length) moments.push({ kind: "missed", id: dearest?.id ?? null, name: dearest?.name ?? null, at: since + missedAfter });
  return moments.filter((m) => m.at <= since + horizon).map((m) => ({ ...m, at: Math.round(m.at / minute) * minute }));
}

/** The first moment from `t` outside the quiet hours, in local time. */
function awake(t) {
  const date = new Date(t);
  const h = date.getHours();
  if (h >= quietTo && h < quietFrom) return t;
  if (h >= quietFrom) date.setDate(date.getDate() + 1);
  date.setHours(quietTo, 0, 0, 0);
  return date.getTime();
}

const dayKey = (t) => new Date(t).toDateString();

/** The next local morning after `t`. */
function nextMorning(t) {
  const date = new Date(t);
  date.setDate(date.getDate() + 1);
  date.setHours(quietTo, 0, 0, 0);
  return date.getTime();
}

/**
 * The reminders for `stable` planned at real time `realNow`: its moments gathered into a few, never in
 * the quiet hours, at least `minGap` apart and at most `careCap` a day, or `extraCap` with a hatch or a
 * missed owner among them. Each is `{ at, moments }`, soonest first; the first comes no sooner than `lead`.
 */
export function planReminders(stable, realNow) {
  const since = Math.floor(realNow / step) * step;
  let pending = reminderMoments(stable, since).sort((a, b) => a.at - b.at);
  const plan = [];
  const perDay = new Map();
  /** The first time from `from` a reminder may go out under `cap`. */
  const slot = (from, cap) => {
    let t = awake(Math.max(from, since + lead, (plan.at(-1)?.at ?? -Infinity) + minGap));
    while ((perDay.get(dayKey(t)) ?? 0) >= cap) t = nextMorning(t);
    return t;
  };
  while (pending.length) {
    const firstExtra = pending.find((m) => extra.has(m.kind));
    const at = Math.min(slot(pending[0].at, careCap), firstExtra ? slot(firstExtra.at, extraCap) : Infinity);
    const moments = pending.filter((m) => m.at <= at + gather);
    pending = pending.filter((m) => m.at > at + gather);
    plan.push({ at, moments });
    perDay.set(dayKey(at), (perDay.get(dayKey(at)) ?? 0) + 1);
  }
  return plan;
}
