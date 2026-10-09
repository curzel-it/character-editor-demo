import { loadSoundSettings, saveSoundSettings } from "./soundSettings.js";

const gestures = ["pointerdown", "pointerup", "touchend", "keydown"];
const rateJitter = 0.04;
const smoothing = 0.06;

/** @type {AudioContext | null} */
let context = null;
/** @type {GainNode | null} */
let effectsBus = null;
let unlocked = false;
let enabled = false;
let settings = loadSoundSettings();
/** @type {Map<string, AudioBuffer>} */
const buffers = new Map();
/** @type {Set<() => void>} */
const unlockListeners = new Set();
/** @type {Set<() => void>} */
const settingsListeners = new Set();

/**
 * Turns sound on for this page: the context is built at the first gesture, as browsers require,
 * and sleeps while the page is hidden.
 * @param {Document} doc
 */
export function installSound(doc) {
  if (enabled) return;
  enabled = true;
  const unlock = () => {
    const audio = createContext();
    if (audio?.state === "suspended" && doc.visibilityState === "visible") audio.resume().catch(() => {});
    if (unlocked || !audio) return;
    unlocked = true;
    for (const listener of unlockListeners) listener();
  };
  for (const type of gestures) doc.addEventListener(type, unlock, true);
  doc.addEventListener("visibilitychange", () => {
    if (!context) return;
    if (doc.visibilityState === "hidden") context.suspend().catch(() => {});
    else if (unlocked) context.resume().catch(() => {});
  });
}

/** The shared context once a gesture has unlocked it, else null. */
export function soundContext() {
  return enabled && unlocked ? context : null;
}

function createContext() {
  if (context) return context;
  const Ctor = globalThis.AudioContext ?? /** @type {any} */ (globalThis).webkitAudioContext;
  if (typeof Ctor !== "function") return null;
  try {
    context = new Ctor({ latencyHint: "interactive" });
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.ratio.value = 4;
    effectsBus = context.createGain();
    effectsBus.gain.value = settings.effects;
    effectsBus.connect(compressor).connect(context.destination);
  } catch {
    context = null;
  }
  return context;
}

/** @param {() => void} listener runs once the first gesture has unlocked sound */
export function onSoundUnlocked(listener) {
  unlockListeners.add(listener);
  if (unlocked) listener();
  return () => unlockListeners.delete(listener);
}

export function soundSettings() {
  return { ...settings };
}

/** @param {Partial<import("./soundSettings.js").SoundSettings>} next */
export function setSoundSettings(next) {
  settings = { ...settings, ...next };
  saveSoundSettings(settings);
  if (effectsBus && context) effectsBus.gain.setTargetAtTime(settings.effects, context.currentTime, smoothing);
  for (const listener of settingsListeners) listener();
}

/** @param {() => void} listener */
export function onSoundSettings(listener) {
  settingsListeners.add(listener);
  return () => settingsListeners.delete(listener);
}

/** @param {string} key @param {(sampleRate: number) => Float32Array} render */
function bufferFor(key, render) {
  const audio = /** @type {AudioContext} */ (context);
  let cached = buffers.get(key);
  if (!cached) {
    const samples = render(audio.sampleRate);
    cached = audio.createBuffer(1, samples.length, audio.sampleRate);
    cached.getChannelData(0).set(samples);
    buffers.set(key, cached);
  }
  return cached;
}

function ready() {
  return Boolean(context && effectsBus && unlocked && context.state === "running" && settings.effects > 0);
}

/**
 * Plays a rendered sound once; renders are cached by key.
 * @param {string} key
 * @param {(sampleRate: number) => Float32Array} render
 * @param {{level?: number, rate?: number, pan?: number, delay?: number, jitter?: boolean}} [options]
 */
export function playSound(key, render, { level = 1, rate = 1, pan = 0, delay = 0, jitter = true } = {}) {
  if (!ready()) return false;
  const audio = /** @type {AudioContext} */ (context);
  try {
    const source = audio.createBufferSource();
    source.buffer = bufferFor(key, render);
    source.playbackRate.value = rate * (jitter ? 1 + (Math.random() * 2 - 1) * rateJitter : 1);
    const gain = audio.createGain();
    gain.gain.value = level;
    const panner = audio.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, pan));
    source.connect(gain).connect(panner).connect(/** @type {GainNode} */ (effectsBus));
    source.start(audio.currentTime + Math.max(0, delay));
    return true;
  } catch {
    return false;
  }
}

/**
 * @typedef {{level?: number, rate?: number, pan?: number}} LoopMix
 * @typedef {{set: (mix: LoopMix) => void, stop: (fade?: number) => void}} SoundLoop
 */

/**
 * A looping bed whose level, rate and pan can be ridden every frame. Silent until sound unlocks,
 * then it starts on the next `set`.
 * @param {string} key
 * @param {(sampleRate: number) => Float32Array} render
 * @returns {SoundLoop}
 */
export function startLoop(key, render) {
  /** @type {{source: AudioBufferSourceNode, gain: GainNode, panner: StereoPannerNode} | null} */
  let nodes = null;
  let stopped = false;
  /** @type {Required<LoopMix>} */
  const mix = { level: 0, rate: 1, pan: 0 };

  function build() {
    if (nodes || stopped || !ready()) return;
    const audio = /** @type {AudioContext} */ (context);
    try {
      const source = audio.createBufferSource();
      source.buffer = bufferFor(key, render);
      source.loop = true;
      source.playbackRate.value = mix.rate;
      const gain = audio.createGain();
      gain.gain.value = 0;
      const panner = audio.createStereoPanner();
      source.connect(gain).connect(panner).connect(/** @type {GainNode} */ (effectsBus));
      source.start(audio.currentTime, Math.random() * source.buffer.duration);
      nodes = { source, gain, panner };
    } catch {
      nodes = null;
    }
  }

  return {
    set(next) {
      Object.assign(mix, next);
      build();
      if (!nodes || !context) return;
      const now = context.currentTime;
      nodes.gain.gain.setTargetAtTime(Math.max(0, mix.level), now, smoothing);
      nodes.source.playbackRate.setTargetAtTime(Math.max(0.05, mix.rate), now, smoothing);
      nodes.panner.pan.setTargetAtTime(Math.max(-1, Math.min(1, mix.pan)), now, smoothing);
    },
    stop(fade = 0.25) {
      stopped = true;
      if (!nodes || !context) return;
      const { source, gain } = nodes;
      const now = context.currentTime;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setTargetAtTime(0, now, fade / 4);
      try {
        source.stop(now + fade);
      } catch {
        /* Already stopped. */
      }
      nodes = null;
    },
  };
}

/**
 * Renders sounds ahead of their first use, one per idle moment once sound is unlocked, so a
 * long render never lands in the middle of play.
 * @param {Record<string, (sampleRate: number) => Float32Array>} renders keyed as they are played
 */
export function prepareSounds(renders) {
  const queue = Object.entries(renders);
  const next = () => {
    const entry = queue.shift();
    if (!entry || !context) return;
    try {
      bufferFor(entry[0], entry[1]);
    } catch {
      /* It renders on first play instead. */
    }
    setTimeout(next, 30);
  };
  onSoundUnlocked(() => setTimeout(next, 200));
}
