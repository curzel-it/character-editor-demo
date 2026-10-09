const storageKey = "dragonz-sound";

/** @typedef {{effects: number, music: number}} SoundSettings */

/** @type {Readonly<SoundSettings>} */
export const defaultSoundSettings = Object.freeze({ effects: 0.8, music: 0.2 });

/** @param {unknown} value @param {number} fallback */
function level(value, fallback) {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : fallback;
}

/** This device's effects and music volumes, 0 to 1. @returns {SoundSettings} */
export function loadSoundSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    return {
      effects: level(saved?.effects, defaultSoundSettings.effects),
      music: level(saved?.music, defaultSoundSettings.music),
    };
  } catch {
    return { ...defaultSoundSettings };
  }
}

/** @param {SoundSettings} settings */
export function saveSoundSettings(settings) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        effects: level(settings.effects, defaultSoundSettings.effects),
        music: level(settings.music, defaultSoundSettings.music),
      }),
    );
  } catch {
    /* The volumes still apply for this visit. */
  }
}
