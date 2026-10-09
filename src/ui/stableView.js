import { escapeHtml } from "../escapeHtml.js";
import { language, t } from "../i18n.js";

/** Where an egg came from: its two parents, the first two and a count past them, or a gift egg. */
export function eggOrigin(egg) {
  const names = (egg.parents ?? []).map((p) => escapeHtml(p.name));
  if (!names.length) return t("stableView.giftEgg");
  return names.length > 2 ? `${names[0]}, ${names[1]} +${names.length - 2}` : names.join(" × ");
}

export const recordLine = ({ record }) =>
  record.starts
    ? [t("stableView.starts", { count: record.starts }), t("stableView.wins", { count: record.wins }), t("stableView.podiums", { count: record.podiums })].join(" · ")
    : t("stableView.noRaces");

/** Game time as a day and clock, counted from the stable's first day. */
export function gameDate(ms) {
  const day = Math.floor(ms / 86_400_000) + 1;
  const minutes = Math.floor((ms % 86_400_000) / 60_000);
  const two = new Intl.NumberFormat(language(), { minimumIntegerDigits: 2 });
  return t("stableView.gameDate", { day: new Intl.NumberFormat(language()).format(day), time: `${two.format(Math.floor(minutes / 60))}:${two.format(minutes % 60)}` });
}
