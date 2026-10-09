import { addNoise, addTone, buffer, echo, finish, midiHz } from "./dsp.js";
import { playSound } from "./audioOutput.js";
import { duckMusic } from "./soundtrack.js";

/** A soft glockenspiel: overtones a little sharp that die long before the fundamental. */
const bell = Object.freeze([
  { ratio: 1, level: 1 },
  { ratio: 2.005, level: 0.3, decay: 0.24 },
  { ratio: 3.01, level: 0.1, decay: 0.12 },
  { ratio: 4.18, level: 0.05, decay: 0.05 },
]);
const wood = Object.freeze([
  { ratio: 1, level: 1 },
  { ratio: 2.76, level: 0.35, decay: 0.012 },
]);
const roomEchoes = Object.freeze([
  { delay: 0.12, level: 0.18 },
  { delay: 0.25, level: 0.08 },
]);

/** @param {readonly number[]} notes midi @param {number} step @param {number} ring */
function chime(notes, step, ring) {
  return (/** @type {number} */ rate) => {
    const mix = buffer(notes.length * step + ring * 2.2 + 0.3, rate);
    notes.forEach((midi, index) => {
      addTone(mix, { at: index * step, from: midiHz(midi), decay: ring, level: index === 0 ? 0.8 : 1, partials: bell }, rate);
    });
    return finish(echo(mix, roomEchoes, rate), 0.25);
  };
}

/** @type {Record<string, (sampleRate: number) => Float32Array>} */
const renders = {
  tap: (rate) => {
    const mix = buffer(0.09, rate);
    addTone(mix, { at: 0, from: 520, to: 470, glide: 0.03, attack: 0.0008, decay: 0.018, level: 1, partials: wood }, rate);
    addNoise(mix, { at: 0, seconds: 0.02, attack: 0.0004, decay: 0.003, level: 0.4, low: 1500, high: 6000, seed: 11 }, rate);
    return finish(mix, 0.3, 0.7);
  },
  tab: (rate) => {
    const mix = buffer(0.07, rate);
    addTone(mix, { at: 0, from: 880, to: 820, glide: 0.02, attack: 0.0006, decay: 0.012, level: 1, partials: wood }, rate);
    addNoise(mix, { at: 0, seconds: 0.015, attack: 0.0003, decay: 0.002, level: 0.35, low: 2500, high: 8000, seed: 12 }, rate);
    return finish(mix, 0.3, 0.6);
  },
  open: (rate) => {
    const mix = buffer(0.3, rate);
    addNoise(mix, { at: 0, seconds: 0.3, attack: 0.08, decay: 0.07, level: 0.7, low: 600, high: 3200, seed: 13 }, rate);
    addTone(mix, { at: 0.02, from: 330, to: 660, glide: 0.18, attack: 0.03, decay: 0.08, level: 0.3 }, rate);
    return finish(mix, 0.4, 0.5);
  },
  close: (rate) => {
    const mix = buffer(0.26, rate);
    addNoise(mix, { at: 0, seconds: 0.26, attack: 0.04, decay: 0.06, level: 0.7, low: 400, high: 2400, seed: 14 }, rate);
    addTone(mix, { at: 0.01, from: 600, to: 300, glide: 0.15, attack: 0.02, decay: 0.07, level: 0.3 }, rate);
    return finish(mix, 0.4, 0.45);
  },
  toast: chime([79, 84], 0.09, 0.4),
  nope: (rate) => {
    const mix = buffer(0.26, rate);
    addTone(mix, { at: 0, from: 220, to: 200, glide: 0.05, attack: 0.002, decay: 0.05, level: 1, partials: wood }, rate);
    addTone(mix, { at: 0.11, from: 185, to: 165, glide: 0.05, attack: 0.002, decay: 0.06, level: 1, partials: wood }, rate);
    return finish(mix, 0.3, 0.6);
  },
  reward: chime([72, 76, 79, 84], 0.075, 0.55),
  fanfare: chime([67, 72, 76, 79, 84, 88, 91], 0.07, 0.8),
};

/** @type {Readonly<Record<keyof typeof renders, number>>} */
const levels = Object.freeze({ tap: 0.4, tab: 0.35, open: 0.3, close: 0.28, toast: 0.32, nope: 0.4, reward: 0.4, fanfare: 0.45 });
/** @type {Partial<Record<keyof typeof renders, number>>} */
const ducks = Object.freeze({ reward: 0.6, fanfare: 1.2 });
const minGapMs = 40;
/** @type {Map<string, number>} */
const lastPlayed = new Map();

/** @typedef {keyof typeof renders} UiSound */

/** @param {UiSound} name */
export function playUi(name) {
  const now = performance.now();
  if (now - (lastPlayed.get(name) ?? -Infinity) < minGapMs) return;
  lastPlayed.set(name, now);
  if (playSound(`ui:${name}`, renders[name], { level: levels[name], jitter: name === "tap" || name === "tab" })) {
    const duck = ducks[name];
    if (duck) duckMusic(duck);
  }
}

/** For tools that render every sound to a file. */
export const uiRenders = renders;
