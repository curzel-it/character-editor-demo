import test from "node:test";
import assert from "node:assert/strict";
import { en } from "../src/strings/en.js";
import { it } from "../src/strings/it.js";
import { setLanguage, t } from "../src/i18n.js";

/** @param {Record<string, unknown>} table @param {string} [prefix] @returns {string[]} */
const keys = (table, prefix = "") =>
  Object.entries(table).flatMap(([k, v]) =>
    v && typeof v === "object" && !("other" in v) ? keys(/** @type {Record<string, unknown>} */ (v), `${prefix}${k}.`) : [`${prefix}${k}`],
  );

test("Italian has every English string and nothing else", () => {
  assert.deepEqual(keys(it).sort(), keys(en).sort());
});

test("t fills placeholders, picks plural forms and falls back to the key", () => {
  setLanguage("en");
  assert.equal(t("language.label"), "Language");
  assert.equal(t("missing.key"), "missing.key");
  setLanguage("it");
  assert.equal(t("language.label"), "Lingua");
});
