import {
  genreForSeed,
  musicPlaying,
  setIntensity,
  setMusicVolume,
  setSeedSource,
  setTrackLength,
  startMusic,
  stopMusic,
  useAudioContext,
} from "../../node_modules/musicbox/src/index.js";
import { onSoundSettings, onSoundUnlocked, soundContext, soundSettings } from "./audioOutput.js";

const genre = "lofi";
const intensity = 0.25;
const stepMs = 30;
const duckDepth = 0.35;
const duckDownS = 0.12;
const duckUpS = 0.8;

let wanted = false;
let track = 0;
let dip = 1;
/** @type {ReturnType<typeof setInterval> | null} */
let duckTimer = null;
let installed = false;

/** A seed whose song is in `genre`, different every session. @param {string} genre */
export function seedInGenre(genre, base = `${Date.now()}:${track++}`) {
  for (let attempt = 0; attempt < 2000; attempt += 1) {
    const seed = `dragons:${base}:${attempt}`;
    if (genreForSeed(seed).name === genre) return seed;
  }
  return `dragons:${base}`;
}

function applyVolume() {
  setMusicVolume(soundSettings().music * dip);
}

function install() {
  if (installed) return;
  installed = true;
  useAudioContext(() => soundContext());
  setTrackLength([120, 180]);
  setSeedSource(() => seedInGenre(genre));
  setIntensity(intensity);
  onSoundUnlocked(sync);
  onSoundSettings(sync);
}

function sync() {
  applyVolume();
  if (soundSettings().music <= 0 || !wanted) {
    if (musicPlaying()) stopMusic();
    return;
  }
  if (soundContext() && !musicPlaying()) startMusic(seedInGenre(genre));
}

/** Plays lofi from screen to screen; a song keeps going until it ends. */
export function playSoundtrack() {
  install();
  if (wanted) return;
  wanted = true;
  sync();
}

/** Lowers the music under a moment for `seconds`, then lets it back up. @param {number} seconds */
export function duckMusic(seconds) {
  if (!musicPlaying()) return;
  const start = performance.now();
  if (duckTimer) clearInterval(duckTimer);
  duckTimer = setInterval(() => {
    const elapsed = (performance.now() - start) / 1000;
    if (elapsed < duckDownS) dip = 1 - (1 - duckDepth) * (elapsed / duckDownS);
    else if (elapsed < seconds) dip = duckDepth;
    else dip = duckDepth + (1 - duckDepth) * Math.min(1, (elapsed - seconds) / duckUpS);
    applyVolume();
    if (elapsed >= seconds + duckUpS) {
      clearInterval(/** @type {ReturnType<typeof setInterval>} */ (duckTimer));
      duckTimer = null;
      dip = 1;
    }
  }, stepMs);
}
