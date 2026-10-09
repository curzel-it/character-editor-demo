import { t } from "../i18n.js";
import { ordinal } from "../ordinal.js";

const elements = ["fire", "nature", "earth", "storm", "water"];
const surfaces = ["water", "mud", "sand"];
const places = ["valley", "canyon"];

/**
 * The commentator's words for an event from `commentaryAt`; `names` maps racer ids to names.
 * @param {Record<string, any>} e
 * @param {Map<string, string>} names
 * @returns {string | null}
 */
export function commentaryLine(e, names) {
  const who = names.get(e.racer) ?? e.racer;
  const other = names.get(e.other) ?? e.other;
  const element = elements.includes(e.element) ? e.element : "fire";
  switch (e.type) {
    case "grid":
      return t("commentaryLine.grid", { count: e.count });
    case "form":
      return t(`commentaryLine.form.${e.form === "perfect" ? "perfect" : "off"}`, { who });
    case "start":
      return t(`commentaryLine.start.${places.includes(e.place) ? e.place : "course"}`);
    case "finish":
      return e.place === 1 ? t("commentaryLine.wins", { who }) : t("commentaryLine.finish", { who, place: ordinal(e.place) });
    case "overtake":
      return e.place === 1 ? t("commentaryLine.takesLead", { who, other }) : t("commentaryLine.passes", { who, other, place: ordinal(e.place) });
    case "miss":
      return t("commentaryLine.miss", { who });
    case "dnf":
      return t("commentaryLine.dnf", { who });
    case "land":
      return t(`commentaryLine.land.${surfaces.includes(e.surface) ? e.surface : "dirt"}`, { who });
    case "thermal":
      return t("commentaryLine.thermal", { who });
    case "hit":
      if (e.matchup > 1) return t(`commentaryLine.superEffective.${element}`, { who, other });
      if (e.matchup < 1) return t("commentaryLine.resisted", { who, other });
      return t(`commentaryLine.hit.${element}`, { who, other });
    case "breath":
      return t(`commentaryLine.breath.${element}`, { who, other });
  }
  return null;
}
