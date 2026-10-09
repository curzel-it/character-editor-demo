import { planReminders } from "./stable/reminderPlan.js";
import { t } from "./i18n.js";

const storageKey = "dragonz-reminders";

/** Posts `message` to the app's native notifications, on iOS or Android; does nothing in a browser. */
function post(message) {
  const json = JSON.stringify(message);
  globalThis.webkit?.messageHandlers?.notifications?.postMessage(json);
  globalThis.DragonzNotifications?.post(json);
}

/** Whether the game runs in an app that can post reminders. */
export const canNotify = () => Boolean(globalThis.webkit?.messageHandlers?.notifications || globalThis.DragonzNotifications);

/** Whether the owner keeps reminders on in Settings; on unless turned off. */
export function remindersOn() {
  try {
    return localStorage.getItem(storageKey) !== "off";
  } catch {
    return true;
  }
}

/** Turns reminders on or off; off drops every pending one, on asks the system when it has not yet. */
export function setRemindersOn(on) {
  try {
    if (on) localStorage.removeItem(storageKey);
    else localStorage.setItem(storageKey, "off");
  } catch {
    /* Storage is optional. */
  }
  lastPosted = null;
  if (on) askForNotifications();
}

/** Asks the owner once whether the app may remind them; the system remembers the answer. */
export const askForNotifications = () => post({ type: "ask" });

/** Opens the app's notification settings in the system, for an owner who once said no. */
export const openNotificationSettings = () => post({ type: "openSettings" });

const listeners = new Set();
/** The app reports the system's answer here: "granted", "denied", or "ask" while it can still ask. */
globalThis.dragonzNotificationStatus = (status) => {
  for (const listener of listeners) listener(status);
};

globalThis.document?.addEventListener("visibilitychange", () => {
  if (!document.hidden && listeners.size) post({ type: "status" });
});

/** Calls `listener(status)` with the system's answer whenever the app reports it, and asks for it now; returns the unsubscribe. */
export function watchPermission(listener) {
  listeners.add(listener);
  post({ type: "status" });
  return () => listeners.delete(listener);
}

/** The words for a moment, alone in a reminder. */
function momentText(m) {
  if (m.kind === "need") return t(`needNotifications.${m.need}`, { name: m.name });
  if (m.kind === "missed") return m.name ? t("needNotifications.missed", { name: m.name }) : t("needNotifications.missedEgg");
  return t(`needNotifications.${m.kind}`);
}

const capitalise = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** One reminder's words: its most pressing moment, then whoever else needs the owner. */
export function reminderBody(moments) {
  const rank = { hatch: 0, missed: 1, need: 2, warm: 3 };
  const [first, ...rest] = [...moments].sort((a, b) => rank[a.kind] - rank[b.kind] || a.at - b.at);
  const who = (m) => m.name ?? t("needNotifications.anEgg");
  const others = [...new Set(rest.map(who))].filter((name) => name !== who(first));
  const text = momentText(first);
  if (!others.length) return text;
  const too =
    others.length === 1
      ? t("needNotifications.alsoOne", { name: others[0] })
      : others.length === 2
        ? t("needNotifications.alsoTwo", { a: others[0], b: others[1] })
        : t("needNotifications.alsoMany", { name: others[0], count: others.length - 1 });
  return `${/[.!?…]$/.test(text) ? text : `${text}.`} ${capitalise(too)}`;
}

/** The JSON last sent, so an unchanged plan is not sent again. */
let lastPosted = null;

/**
 * Plans the reminders for `stable` at real time `realNow` and hands them to the app, in place of the
 * last ones; none when the owner turned them off. Sends nothing when the plan has not changed, so it
 * can follow every save.
 */
export function scheduleReminders(stable, realNow) {
  const reminders = remindersOn()
    ? planReminders(stable, realNow).map((r, i) => ({ id: String(i), at: r.at, title: "Dragons!", body: reminderBody(r.moments) }))
    : [];
  const json = JSON.stringify(reminders);
  if (json === lastPosted) return;
  lastPosted = json;
  post({ type: "schedule", reminders });
}
