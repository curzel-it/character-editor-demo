import { restoreGenome } from "../subjects.js";
import { ageOf } from "../dragonAge.js";
import { freshCare } from "./care.js";
import { restoreOwner } from "./owner.js";
import { hatchBond } from "./bond.js";
import { welcomed } from "./starters.js";
import { cloudCopy, onCloudChange, pushToCloud } from "./cloudSave.js";

const storageKey = "dragonz-stable";
const version = 4;

const finite = (v, fallback) => (Number.isFinite(v) ? v : fallback);
// Babies are gone: eggs hatch into kids, so a saved baby wakes up a kid from the start of its stage.
const restoreAge = (w) => (w.age === "baby" ? { age: "kid", growth: 0 } : { age: ageOf(w.age).id, growth: finite(w.growth, 0) });

function restoreDragon(genes, w) {
  return {
    ...w,
    genome: restoreGenome(genes, w.seed, w.genome),
    ...restoreAge(w),
    care: { ...freshCare(), ...w.care },
    bond: Math.max(0, Math.min(1, finite(w.bond, hatchBond))),
    strength: Math.max(1, Math.min(5, finite(w.strength, 1))),
    fatigue: finite(w.fatigue, 0),
    record: { starts: 0, wins: 0, podiums: 0, ...w.record },
    history: Array.isArray(w.history) ? w.history : [],
  };
}

const parse = (raw) => {
  try {
    const saved = JSON.parse(raw || "null");
    return saved?.version === version && Array.isArray(saved.dragons) && Array.isArray(saved.eggs) ? saved : null;
  } catch {
    return null;
  }
};
const localCopy = () => {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
};
const lastPlayed = (saved) => finite(saved.clock?.real, -Infinity);
/** Of two saves, the one to keep: a welcomed stable beats a fresh one, then the one played last. */
const keeper = (a, b) => {
  if (!a || !b) return a ?? b;
  if (welcomed(a) !== welcomed(b)) return welcomed(a) ? a : b;
  return lastPlayed(b) > lastPlayed(a) ? b : a;
};

/** The saved stable, from this device or the cloud, or null when there is none or it cannot be read. */
export function loadStable(genes) {
  try {
    const saved = keeper(parse(localCopy()), parse(cloudCopy()));
    if (!saved) return null;
    return {
      ...saved,
      owner: restoreOwner(saved.owner, saved.seed),
      dragons: saved.dragons.filter((w) => typeof w?.id === "string" && w.seed).map((w) => restoreDragon(genes, w)),
      wild: (Array.isArray(saved.wild) ? saved.wild : []).filter((w) => typeof w?.id === "string" && w.seed).map((w) => restoreDragon(genes, w)),
      trophies: Array.isArray(saved.trophies) ? saved.trophies : [],
      seasons: Array.isArray(saved.seasons) ? saved.seasons : [],
    };
  } catch {
    return null;
  }
}

let replaced = false;

/** Saves the stable, and a welcomed one to the cloud too; false when storage refused it (full or blocked), and the stable lives on for this visit only. */
export function saveStable(stable) {
  if (replaced) return true;
  const raw = JSON.stringify({ ...stable, version });
  if (welcomed(stable)) pushToCloud(raw);
  try {
    localStorage.setItem(storageKey, raw);
    return true;
  } catch {
    return false;
  }
}

/**
 * Reloads the game onto a newer stable another device saved to the cloud, when it arrives as the game opens
 * or comes back, or any time before the welcome is done; while both devices are in play the one saved last
 * wins at the next launch instead. Call it before the first save.
 */
export function followCloud() {
  let shown = Date.now();
  let left = keeper(parse(localCopy()), parse(cloudCopy()));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    shown = Date.now();
    left = parse(localCopy());
  });
  onCloudChange((raw) => {
    const cloud = parse(raw);
    const late = left && welcomed(left) && Date.now() - shown > 30_000;
    if (replaced || !cloud || late || keeper(left, cloud) !== cloud) return;
    try {
      localStorage.setItem(storageKey, raw);
    } catch {
      return;
    }
    replaced = true;
    location.reload();
  });
}
