import { mulberry32 } from "../rng.js";

/** @param {number} midi */
export function midiHz(midi) {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** @param {number} seconds @param {number} sampleRate */
export function buffer(seconds, sampleRate) {
  return new Float64Array(Math.max(1, Math.round(seconds * sampleRate)));
}

/** @param {number} length @param {number} seed */
export function noise(length, seed) {
  const random = mulberry32(seed);
  return Float64Array.from({ length }, () => random() * 2 - 1);
}

/** One-pole lowpass, in place. @param {Float64Array} signal @param {number} cutoff @param {number} sampleRate */
export function lowpass(signal, cutoff, sampleRate) {
  const k = 1 - Math.exp((-2 * Math.PI * Math.min(cutoff, sampleRate * 0.45)) / sampleRate);
  let state = 0;
  for (let n = 0; n < signal.length; n += 1) signal[n] = state += k * (signal[n] - state);
  return signal;
}

/** One-pole highpass, in place. @param {Float64Array} signal @param {number} cutoff @param {number} sampleRate */
export function highpass(signal, cutoff, sampleRate) {
  const k = 1 / (1 + (2 * Math.PI * cutoff) / sampleRate);
  let previousIn = 0;
  let previousOut = 0;
  for (let n = 0; n < signal.length; n += 1) {
    const input = signal[n];
    previousOut = k * (previousOut + input - previousIn);
    previousIn = input;
    signal[n] = previousOut;
  }
  return signal;
}

/** @param {Float64Array} signal @param {number} low @param {number} high @param {number} sampleRate */
export function bandpass(signal, low, high, sampleRate) {
  return highpass(lowpass(signal, high, sampleRate), low, sampleRate);
}

/**
 * Adds a decaying tone whose pitch glides from `from` to `to` Hz into `mix`.
 * @param {Float64Array} mix
 * @param {{at: number, from: number, to?: number, glide?: number, attack?: number, decay: number, level: number, partials?: readonly {ratio: number, level: number, decay?: number}[], wave?: "sine" | "triangle", vibrato?: {hz: number, depth: number}}} tone
 * @param {number} sampleRate
 */
export function addTone(mix, tone, sampleRate) {
  const { at, from, to = from, glide = 0.1, attack = 0.004, decay, level, wave = "sine", vibrato } = tone;
  const partials = tone.partials ?? [{ ratio: 1, level: 1 }];
  const ratios = partials.map((partial) => partial.ratio);
  const levels = partials.map((partial) => partial.level);
  const fades = partials.map((partial) => Math.exp(-1 / ((partial.decay ?? decay) * sampleRate)));
  const gains = partials.map(() => 1);
  const phases = partials.map(() => 0);
  const start = Math.round(at * sampleRate);
  const end = Math.min(mix.length, start + Math.round(decay * 7 * sampleRate));
  const step = (2 * Math.PI) / sampleRate;
  for (let n = start; n < end; n += 1) {
    const time = (n - start) / sampleRate;
    const bend = glide > 0 ? Math.min(1, time / glide) : 1;
    let hz = to === from ? from : from * (to / from) ** bend;
    if (vibrato) hz *= 1 + vibrato.depth * Math.sin(2 * Math.PI * vibrato.hz * time);
    let sum = 0;
    for (let index = 0; index < ratios.length; index += 1) {
      phases[index] += step * hz * ratios[index];
      const shape = wave === "triangle" ? (2 / Math.PI) * Math.asin(Math.sin(phases[index])) : Math.sin(phases[index]);
      sum += levels[index] * gains[index] * shape;
      gains[index] *= fades[index];
    }
    mix[n] += (1 - Math.exp(-time / attack)) * level * sum;
  }
  return mix;
}

/**
 * Adds filtered noise shaped by an attack and a decay into `mix`.
 * @param {Float64Array} mix
 * @param {{at: number, seconds: number, attack?: number, decay: number, level: number, low: number, high: number, seed: number}} burst
 * @param {number} sampleRate
 */
export function addNoise(mix, burst, sampleRate) {
  const { at, seconds, attack = 0.002, decay, level, low, high, seed } = burst;
  const start = Math.round(at * sampleRate);
  const length = Math.min(mix.length - start, Math.round(seconds * sampleRate));
  if (length <= 0) return mix;
  const band = bandpass(noise(length, seed), low, high, sampleRate);
  const peak = peakOf(band);
  for (let n = 0; n < length; n += 1) {
    const time = n / sampleRate;
    mix[start + n] += (level * (1 - Math.exp(-time / attack)) * Math.exp(-time / decay) * band[n]) / peak;
  }
  return mix;
}

/** Adds `dry` delayed echoes of itself. @param {Float64Array} signal @param {readonly {delay: number, level: number}[]} echoes @param {number} sampleRate */
export function echo(signal, echoes, sampleRate) {
  const dry = Float64Array.from(signal);
  for (const { delay, level } of echoes) {
    const offset = Math.round(delay * sampleRate);
    for (let n = offset; n < signal.length; n += 1) signal[n] += level * dry[n - offset];
  }
  return signal;
}

/** @param {Float64Array} signal */
export function peakOf(signal) {
  let peak = 0;
  for (const sample of signal) peak = Math.max(peak, Math.abs(sample));
  return peak || 1;
}

/**
 * Fades out the last `fade` share, silences both ends and scales the sound to `peak`.
 * @param {Float64Array} signal @param {number} [fade] @param {number} [peak]
 */
export function finish(signal, fade = 0.2, peak = 0.8) {
  const length = signal.length;
  const fadeStart = Math.floor(length * (1 - fade));
  const span = Math.max(1, length - 1 - fadeStart);
  for (let n = fadeStart; n < length; n += 1) signal[n] *= Math.cos((Math.PI / 2) * Math.min(1, (n - fadeStart) / span)) ** 2;
  const scale = peak / peakOf(signal);
  const samples = new Float32Array(length);
  for (let n = 1; n < length - 1; n += 1) samples[n] = signal[n] * scale;
  return samples;
}

/**
 * A seamless loop: the tail is crossfaded into the head so the seam does not click.
 * @param {Float64Array} signal @param {number} crossfade seconds @param {number} sampleRate @param {number} [peak]
 */
export function finishLoop(signal, crossfade, sampleRate, peak = 0.8) {
  const overlap = Math.min(Math.floor(signal.length / 2), Math.round(crossfade * sampleRate));
  const length = signal.length - overlap;
  const loop = new Float64Array(length);
  for (let n = 0; n < length; n += 1) loop[n] = signal[n];
  for (let n = 0; n < overlap; n += 1) {
    const mix = n / overlap;
    loop[n] = signal[n] * Math.sqrt(mix) + signal[length + n] * Math.sqrt(1 - mix);
  }
  const scale = peak / peakOf(loop);
  return Float32Array.from(loop, (sample) => sample * scale);
}
