import { en } from "./strings/en.js";
import { it } from "./strings/it.js";

const storageKey = "dragonz-language";

/** @type {Record<string, Record<string, unknown>>} */
const tables = { en, it };

export const languages = [
  { id: "en", label: "English" },
  { id: "it", label: "Italiano" },
];

/** @type {string | null} */
let current = null;

/** The saved language, else the device's when it is one we have, else English. */
function initialLanguage() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved && tables[saved]) return saved;
  } catch {
    /* Storage is optional. */
  }
  const device = (globalThis.navigator?.languages ?? [globalThis.navigator?.language ?? ""]).map((l) => String(l).slice(0, 2));
  return device.find((l) => tables[l]) ?? "en";
}

export function language() {
  return (current ??= initialLanguage());
}

/** The locale for Intl formatting: British English, as the game spells, or the language itself. */
export const locale = () => (language() === "en" ? "en-GB" : language());

/** @param {string} id */
export function setLanguage(id) {
  if (!tables[id]) return;
  current = id;
  try {
    localStorage.setItem(storageKey, id);
  } catch {
    /* The language still applies for this visit. */
  }
}

/** @param {Record<string, unknown>} table @param {string} key */
const lookup = (table, key) => key.split(".").reduce((node, part) => (node && typeof node === "object" ? node[part] : undefined), table);

/**
 * The string for `key` in the current language (English when missing), with `{name}` placeholders
 * filled from `vars`. An entry may be an object of plural forms (`one`, `other`, …) chosen by `vars.count`,
 * or a function of `vars`.
 * @param {string} key
 * @param {Record<string, unknown>} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const lang = language();
  let entry = lookup(tables[lang], key) ?? lookup(en, key);
  if (entry === undefined) return key;
  if (typeof entry === "function") return String(entry(vars));
  if (typeof entry === "object") {
    const form = new Intl.PluralRules(lang).select(Number(vars.count ?? 0));
    entry = entry[form] ?? entry.other;
  }
  return String(entry).replace(/\{(\w+)\}/g, (m, name) => (name in vars ? String(vars[name]) : m));
}
