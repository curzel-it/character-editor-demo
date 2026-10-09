import { addNoise, addTone, bandpass, buffer, echo, finish, finishLoop, lowpass, midiHz, noise, peakOf } from "./dsp.js";
import { playSound } from "./audioOutput.js";
import { duckMusic } from "./soundtrack.js";
import { mulberry32 } from "../rng.js";

const bell = Object.freeze([
  { ratio: 1, level: 1 },
  { ratio: 2.005, level: 0.35, decay: 0.2 },
  { ratio: 3.01, level: 0.12, decay: 0.1 },
]);
const brass = Object.freeze([
  { ratio: 1, level: 1 },
  { ratio: 2, level: 0.6 },
  { ratio: 3, level: 0.4 },
  { ratio: 4, level: 0.25 },
  { ratio: 5, level: 0.12 },
]);

/** Many far-off voices: bands of noise each swelling at its own pace. @param {number} rate */
function crowd(rate, voices = 10) {
  const seconds = 5;
  const length = Math.round(seconds * rate);
  const random = mulberry32(31);
  const mix = new Float64Array(length);
  for (let voice = 0; voice < voices; voice += 1) {
    const centre = 300 + random() * 1500;
    const band = bandpass(noise(length, 100 + voice), centre * 0.7, centre * 1.4, rate);
    const peak = peakOf(band);
    const pace = 0.5 + random() * 2.5;
    const phase = random() * Math.PI * 2;
    for (let n = 0; n < length; n += 1) {
      const swell = Math.max(0, Math.sin(2 * Math.PI * pace * (n / rate) + phase)) ** 2;
      mix[n] += (0.4 + 0.6 * swell) * band[n] / peak;
    }
  }
  return finishLoop(lowpass(mix, 2600, rate), 0.8, rate, 0.7);
}

/** @type {Record<string, (sampleRate: number) => Float32Array>} */
const renders = {
  tick: (rate) => {
    const mix = buffer(0.5, rate);
    addTone(mix, { at: 0, from: midiHz(72), decay: 0.18, level: 1, partials: bell }, rate);
    return finish(mix, 0.3, 0.7);
  },
  go: (rate) => {
    const mix = buffer(1.2, rate);
    addTone(mix, { at: 0, from: midiHz(84), decay: 0.4, level: 1, partials: bell }, rate);
    addTone(mix, { at: 0, from: midiHz(79), decay: 0.35, level: 0.6, partials: bell }, rate);
    addNoise(mix, { at: 0, seconds: 1, attack: 0.05, decay: 0.3, level: 0.5, low: 300, high: 2500, seed: 41 }, rate);
    return finish(echo(mix, [{ delay: 0.14, level: 0.2 }], rate), 0.3, 0.8);
  },
  flap: (rate) => {
    const mix = buffer(0.32, rate);
    addNoise(mix, { at: 0, seconds: 0.3, attack: 0.025, decay: 0.06, level: 1, low: 80, high: 700, seed: 51 }, rate);
    addTone(mix, { at: 0.01, from: 95, to: 60, glide: 0.08, attack: 0.01, decay: 0.05, level: 0.6 }, rate);
    return finish(mix, 0.35, 0.8);
  },
  whoosh: (rate) => {
    const mix = buffer(0.7, rate);
    const length = mix.length;
    const air = noise(length, 61);
    let state = 0;
    for (let n = 0; n < length; n += 1) {
      const time = n / length;
      const cutoff = 300 + 2600 * Math.sin(Math.PI * time) ** 2;
      const k = 1 - Math.exp((-2 * Math.PI * cutoff) / rate);
      state += k * (air[n] - state);
      mix[n] = state * Math.sin(Math.PI * time) ** 2;
    }
    return finish(mix, 0.2, 0.7);
  },
  breath: (rate) => {
    const mix = buffer(1.1, rate);
    addNoise(mix, { at: 0, seconds: 1.1, attack: 0.06, decay: 0.35, level: 1, low: 150, high: 1800, seed: 71 }, rate);
    addNoise(mix, { at: 0.02, seconds: 0.9, attack: 0.02, decay: 0.25, level: 0.4, low: 2000, high: 6000, seed: 72 }, rate);
    const random = mulberry32(73);
    for (let crackle = 0; crackle < 18; crackle += 1) {
      addNoise(mix, { at: 0.05 + random() * 0.8, seconds: 0.02, attack: 0.0005, decay: 0.003, level: 0.5 + random() * 0.4, low: 1500, high: 7000, seed: 80 + crackle }, rate);
    }
    return finish(mix, 0.3, 0.75);
  },
  hit: (rate) => {
    const mix = buffer(0.6, rate);
    addTone(mix, { at: 0, from: 140, to: 55, glide: 0.12, attack: 0.002, decay: 0.09, level: 1 }, rate);
    addNoise(mix, { at: 0, seconds: 0.5, attack: 0.001, decay: 0.12, level: 0.6, low: 800, high: 5000, seed: 91 }, rate);
    return finish(mix, 0.3, 0.85);
  },
  cheer: (rate) => {
    const mix = buffer(2.4, rate);
    const swell = crowd(rate, 6);
    for (let n = 0; n < mix.length; n += 1) {
      const time = n / rate;
      mix[n] = swell[n % swell.length] * Math.min(1, time / 0.25) * Math.exp(-Math.max(0, time - 0.6) / 0.7);
    }
    return finish(mix, 0.2, 0.8);
  },
  finish: (rate) => {
    const mix = buffer(2.4, rate);
    const notes = [
      { at: 0, midi: 67, decay: 0.12 },
      { at: 0.14, midi: 67, decay: 0.12 },
      { at: 0.28, midi: 72, decay: 0.7 },
    ];
    for (const note of notes) {
      addTone(mix, { at: note.at, from: midiHz(note.midi), decay: note.decay, attack: 0.015, level: 0.6, partials: brass, vibrato: { hz: 5.5, depth: 0.004 } }, rate);
      addTone(mix, { at: note.at, from: midiHz(note.midi + 4), decay: note.decay, attack: 0.015, level: 0.35, partials: brass }, rate);
    }
    return finish(echo(lowpass(mix, 3500, rate), [{ delay: 0.16, level: 0.22 }, { delay: 0.33, level: 0.1 }], rate), 0.25, 0.8);
  },
};

/** @type {Readonly<Record<string, number>>} */
const levels = Object.freeze({ tick: 0.45, go: 0.55, flap: 0.5, whoosh: 0.35, breath: 0.5, hit: 0.55, cheer: 0.5, finish: 0.5 });

/** @typedef {"tick" | "go" | "flap" | "whoosh" | "breath" | "hit" | "cheer" | "finish"} RaceSound */

/** @param {RaceSound} name @param {{level?: number, pan?: number, rate?: number}} [mix] */
export function playRace(name, { level = 1, pan = 0, rate = 1 } = {}) {
  const played = playSound(`race:${name}`, renders[name], { level: levels[name] * level, pan, rate });
  if (played && name === "finish") duckMusic(1.6);
  if (played && name === "go") duckMusic(0.6);
  return played;
}

/** For tools that render every sound to a file. */
export const raceRenders = renders;
