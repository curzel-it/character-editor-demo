import { addNoise, addTone, bandpass, buffer, echo, finish, lowpass, midiHz, noise, peakOf } from "./dsp.js";
import { playSound } from "./audioOutput.js";
import { duckMusic } from "./soundtrack.js";
import { mulberry32 } from "../rng.js";

const bell = Object.freeze([
  { ratio: 1, level: 1 },
  { ratio: 2.005, level: 0.3, decay: 0.24 },
  { ratio: 3.01, level: 0.1, decay: 0.12 },
]);
const glass = Object.freeze([
  { ratio: 1, level: 1 },
  { ratio: 2.32, level: 0.4, decay: 0.3 },
  { ratio: 4.25, level: 0.2, decay: 0.12 },
  { ratio: 6.8, level: 0.1, decay: 0.05 },
]);

/**
 * A creature's call: a buzzy fold of harmonics whose pitch rises and falls, breathed through
 * a mouth that opens and closes.
 * @param {{seconds: number, from: number, peak: number, to: number, rasp: number, mouth: number, seed: number}} voice
 * @param {number} rate
 */
function call({ seconds, from, peak, to, rasp, mouth, seed }, rate) {
  const mix = buffer(seconds, rate);
  const length = mix.length;
  const breath = bandpass(noise(length, seed), 400, 4000, rate);
  const breathPeak = peakOf(breath);
  const random = mulberry32(seed);
  let phase = 0;
  for (let n = 0; n < length; n += 1) {
    const t = n / length;
    const contour = t < 0.35 ? from + (peak - from) * Math.sin((Math.PI / 2) * (t / 0.35)) : peak + (to - peak) * ((t - 0.35) / 0.65) ** 1.5;
    const wobble = 1 + 0.03 * Math.sin(2 * Math.PI * 7 * (n / rate)) + rasp * 0.04 * (random() * 2 - 1);
    phase += (2 * Math.PI * contour * wobble) / rate;
    let tone = 0;
    for (let harmonic = 1; harmonic <= 10; harmonic += 1) tone += Math.sin(phase * harmonic) / harmonic ** 1.1;
    const envelope = Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.6;
    mix[n] = envelope * (tone * (1 - rasp * 0.5) + (rasp * breath[n]) / breathPeak);
  }
  return finish(echo(lowpass(mix, mouth, rate), [{ delay: 0.11, level: 0.12 }], rate), 0.2, 0.75);
}

/** @type {Record<string, (sampleRate: number) => Float32Array>} */
const renders = {
  chirpKid: (rate) => call({ seconds: 0.32, from: 700, peak: 1150, to: 820, rasp: 0.15, mouth: 5000, seed: 201 }, rate),
  chirpTeen: (rate) => call({ seconds: 0.5, from: 330, peak: 520, to: 300, rasp: 0.35, mouth: 3200, seed: 202 }, rate),
  roarAdult: (rate) => call({ seconds: 1.1, from: 120, peak: 190, to: 95, rasp: 0.7, mouth: 2200, seed: 203 }, rate),
  yawnKid: (rate) => call({ seconds: 1.1, from: 620, peak: 980, to: 380, rasp: 0.6, mouth: 3400, seed: 204 }, rate),
  yawnTeen: (rate) => call({ seconds: 1.4, from: 300, peak: 470, to: 200, rasp: 0.65, mouth: 2400, seed: 205 }, rate),
  yawnAdult: (rate) => call({ seconds: 1.7, from: 115, peak: 175, to: 75, rasp: 0.75, mouth: 1400, seed: 206 }, rate),
  purr: (rate) => {
    const mix = buffer(0.9, rate);
    const length = mix.length;
    const rumble = lowpass(noise(length, 211), 300, rate);
    const peak = peakOf(rumble);
    for (let n = 0; n < length; n += 1) {
      const time = n / rate;
      const flutter = 0.5 + 0.5 * Math.sin(2 * Math.PI * 24 * time);
      mix[n] = Math.sin(Math.PI * (n / length)) * flutter * (rumble[n] / peak + 0.6 * Math.sin(2 * Math.PI * 70 * time));
    }
    return finish(mix, 0.25, 0.6);
  },
  crack: (rate) => {
    const mix = buffer(0.25, rate);
    addNoise(mix, { at: 0, seconds: 0.2, attack: 0.0004, decay: 0.012, level: 1, low: 1200, high: 7000, seed: 221 }, rate);
    addNoise(mix, { at: 0.03, seconds: 0.1, attack: 0.0004, decay: 0.006, level: 0.5, low: 2000, high: 8000, seed: 222 }, rate);
    addTone(mix, { at: 0, from: 420, to: 300, glide: 0.03, attack: 0.001, decay: 0.025, level: 0.4 }, rate);
    return finish(mix, 0.3, 0.75);
  },
  hatch: (rate) => {
    const mix = buffer(1.6, rate);
    addNoise(mix, { at: 0, seconds: 0.4, attack: 0.0005, decay: 0.05, level: 1, low: 900, high: 7000, seed: 231 }, rate);
    [72, 76, 79, 84, 88].forEach((midi, index) => {
      addTone(mix, { at: 0.12 + index * 0.07, from: midiHz(midi), decay: 0.5, level: 0.5, partials: bell }, rate);
    });
    return finish(echo(mix, [{ delay: 0.13, level: 0.2 }, { delay: 0.27, level: 0.09 }], rate), 0.25, 0.8);
  },
  altarHum: (rate) => {
    const mix = buffer(3.2, rate);
    const length = mix.length;
    for (let n = 0; n < length; n += 1) {
      const time = n / rate;
      const swell = Math.sin(Math.PI * (n / length)) ** 1.5;
      const beat = 1 + 0.25 * Math.sin(2 * Math.PI * 1.5 * time);
      mix[n] = swell * beat * (Math.sin(2 * Math.PI * midiHz(45) * time) + 0.5 * Math.sin(2 * Math.PI * midiHz(52) * time * 1.002) + 0.3 * Math.sin(2 * Math.PI * midiHz(57) * time));
    }
    addNoise(mix, { at: 0.6, seconds: 2.4, attack: 0.9, decay: 0.8, level: 0.25, low: 2000, high: 7000, seed: 241 }, rate);
    return finish(mix, 0.3, 0.7);
  },
  altarBloom: (rate) => {
    const mix = buffer(3, rate);
    [60, 67, 72, 76, 79, 84, 88, 91].forEach((midi, index) => {
      addTone(mix, { at: index * 0.09, from: midiHz(midi), decay: 0.9, level: 0.55, partials: glass }, rate);
    });
    addNoise(mix, { at: 0, seconds: 2.5, attack: 0.3, decay: 0.7, level: 0.3, low: 3000, high: 9000, seed: 251 }, rate);
    return finish(echo(mix, [{ delay: 0.18, level: 0.3 }, { delay: 0.37, level: 0.15 }, { delay: 0.55, level: 0.07 }], rate), 0.3, 0.8);
  },
  sparkle: (rate) => {
    const mix = buffer(0.8, rate);
    const random = mulberry32(261);
    for (let note = 0; note < 6; note += 1) {
      addTone(mix, { at: note * 0.045 + random() * 0.02, from: midiHz(91 + Math.floor(random() * 10)), decay: 0.12, level: 0.5, partials: glass }, rate);
    }
    return finish(mix, 0.3, 0.55);
  },
  munch: (rate) => {
    const mix = buffer(0.35, rate);
    for (let bite = 0; bite < 3; bite += 1) {
      addNoise(mix, { at: bite * 0.1, seconds: 0.08, attack: 0.002, decay: 0.018, level: 1 - bite * 0.2, low: 300, high: 2600, seed: 271 + bite }, rate);
    }
    return finish(mix, 0.25, 0.6);
  },
  splash: (rate) => {
    const mix = buffer(0.6, rate);
    addNoise(mix, { at: 0, seconds: 0.55, attack: 0.004, decay: 0.14, level: 1, low: 600, high: 6000, seed: 281 }, rate);
    const random = mulberry32(282);
    for (let drop = 0; drop < 7; drop += 1) {
      const hz = 900 + random() * 1400;
      addTone(mix, { at: 0.05 + random() * 0.4, from: hz, to: hz * 1.6, glide: 0.03, attack: 0.001, decay: 0.018, level: 0.35 }, rate);
    }
    return finish(mix, 0.3, 0.6);
  },
  brush: (rate) => {
    const mix = buffer(0.22, rate);
    addNoise(mix, { at: 0, seconds: 0.22, attack: 0.05, decay: 0.06, level: 1, low: 1800, high: 7000, seed: 291 }, rate);
    return finish(mix, 0.4, 0.45);
  },
  throw: (rate) => {
    const mix = buffer(0.35, rate);
    addNoise(mix, { at: 0, seconds: 0.35, attack: 0.06, decay: 0.07, level: 1, low: 500, high: 3000, seed: 301 }, rate);
    return finish(mix, 0.35, 0.45);
  },
  bounce: (rate) => {
    const mix = buffer(0.2, rate);
    addTone(mix, { at: 0, from: 180, to: 120, glide: 0.04, attack: 0.001, decay: 0.035, level: 1 }, rate);
    addNoise(mix, { at: 0, seconds: 0.04, attack: 0.0004, decay: 0.006, level: 0.4, low: 400, high: 3000, seed: 311 }, rate);
    return finish(mix, 0.3, 0.65);
  },
  catch: (rate) => {
    const mix = buffer(0.5, rate);
    addTone(mix, { at: 0, from: midiHz(79), decay: 0.18, level: 0.8, partials: bell }, rate);
    addTone(mix, { at: 0.06, from: midiHz(84), decay: 0.25, level: 1, partials: bell }, rate);
    return finish(mix, 0.3, 0.6);
  },
  miss: (rate) => {
    const mix = buffer(0.35, rate);
    addTone(mix, { at: 0, from: 330, to: 220, glide: 0.25, attack: 0.01, decay: 0.12, level: 1, wave: "triangle" }, rate);
    return finish(mix, 0.35, 0.45);
  },
  warm: (rate) => {
    const mix = buffer(0.7, rate);
    addNoise(mix, { at: 0, seconds: 0.7, attack: 0.15, decay: 0.2, level: 0.8, low: 200, high: 1400, seed: 321 }, rate);
    addTone(mix, { at: 0.05, from: midiHz(64), to: midiHz(67), glide: 0.4, attack: 0.1, decay: 0.25, level: 0.35 }, rate);
    return finish(mix, 0.35, 0.5);
  },
  step: (rate) => {
    const mix = buffer(0.15, rate);
    addTone(mix, { at: 0, from: 90, to: 60, glide: 0.03, attack: 0.002, decay: 0.03, level: 1 }, rate);
    addNoise(mix, { at: 0, seconds: 0.06, attack: 0.001, decay: 0.012, level: 0.5, low: 200, high: 1500, seed: 331 }, rate);
    return finish(mix, 0.3, 0.55);
  },
};

/** @type {Readonly<Record<string, number>>} */
const levels = Object.freeze({
  chirpKid: 0.35,
  chirpTeen: 0.38,
  roarAdult: 0.45,
  yawnKid: 0.2,
  yawnTeen: 0.22,
  yawnAdult: 0.26,
  purr: 0.35,
  crack: 0.45,
  hatch: 0.5,
  altarHum: 0.45,
  altarBloom: 0.5,
  sparkle: 0.3,
  munch: 0.4,
  splash: 0.35,
  brush: 0.22,
  throw: 0.3,
  bounce: 0.4,
  catch: 0.38,
  miss: 0.3,
  warm: 0.32,
  step: 0.35,
});
/** @type {Readonly<Record<string, number>>} */
const ducks = Object.freeze({ hatch: 1.2, altarBloom: 2, roarAdult: 0.9 });

/** @typedef {"purr" | "crack" | "hatch" | "altarHum" | "altarBloom" | "sparkle" | "munch" | "splash" | "brush" | "throw" | "bounce" | "catch" | "miss" | "warm" | "step"} StableSound */

/** @param {StableSound | "chirpKid" | "chirpTeen" | "roarAdult" | "yawnKid" | "yawnTeen" | "yawnAdult"} name @param {{level?: number, rate?: number}} [mix] */
export function playStable(name, { level = 1, rate = 1 } = {}) {
  const played = playSound(`stable:${name}`, renders[name], { level: levels[name] * level, rate });
  if (played && ducks[name]) duckMusic(ducks[name]);
  return played;
}

/** The dragon's own call, by life stage: a kid chirps, a teen squawks, an adult roars. @param {"kid" | "teen" | "adult" | string} age */
export function playDragonCall(age, level = 1) {
  const name = age === "adult" ? "roarAdult" : age === "teen" ? "chirpTeen" : "chirpKid";
  return playStable(name, { level, rate: 0.92 + Math.random() * 0.16 });
}

/** A bored dragon's yawn, by life stage: a squeaky one for a kid, a deep slow one for an adult. @param {"kid" | "teen" | "adult" | string} age */
export function playDragonYawn(age) {
  const name = age === "adult" ? "yawnAdult" : age === "teen" ? "yawnTeen" : "yawnKid";
  return playStable(name, { rate: 0.94 + Math.random() * 0.12 });
}

/** For tools that render every sound to a file. */
export const stableRenders = renders;
