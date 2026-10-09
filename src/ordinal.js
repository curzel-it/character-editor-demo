import { language } from "./i18n.js";

/** A place in the current language: 1 → "1st", 11 → "11th", 23 → "23rd"; in Italian 1 → "1º". */
export function ordinal(n) {
  if (language() === "it") return `${n}º`;
  const teen = n % 100 >= 11 && n % 100 <= 13;
  return `${n}${teen ? "th" : (["th", "st", "nd", "rd"][n % 10] ?? "th")}`;
}
