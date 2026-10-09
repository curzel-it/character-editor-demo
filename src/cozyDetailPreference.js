import { cozyDetails, styleConfig } from "./style/cozy.js";

const storageKey = "dragonz-cozy-detail";

/** The saved Cozy detail (`light` or `full`), `light` when none was saved. */
export function loadCozyDetail() {
  try {
    const saved = localStorage.getItem(storageKey);
    if (Object.hasOwn(cozyDetails, saved)) return saved;
  } catch {
    /* Storage is optional. */
  }
  return "light";
}

/** Rounds Cozy's dragons at `id`'s detail from the next frame on and remembers it. */
export function setCozyDetail(id) {
  if (!Object.hasOwn(cozyDetails, id)) return;
  styleConfig.round = cozyDetails[id];
  try {
    localStorage.setItem(storageKey, id);
  } catch {
    /* The detail still applies for this visit. */
  }
}
