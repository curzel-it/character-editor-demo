import { smoothstep } from "./flightMotion.js";
import { lengthScale } from "../worldScale.js";

/**
 * Smooth pulse for an event `age` seconds old: eases in over `attack`, holds, eases out over `decay`.
 * Zero before the event, so envelopes only ever look back.
 */
export function envelope(age, attack, hold, decay) {
  if (!(age >= 0)) return 0;
  if (age < attack) return smoothstep(0, attack, age);
  return 1 - smoothstep(attack + hold, attack + hold + decay, age);
}

/** Envelope shapes in seconds; `strength` scales the peak. */
export const mouthCues = {
  roar: { attack: 0.28, hold: 0.55, decay: 0.7 },
  snap: { attack: 0.09, hold: 0.03, decay: 0.16 },
  gasp: { attack: 0.35, hold: 1.4, decay: 2.2 },
};

const near = 7 * lengthScale,
  alongside = 4 * lengthScale,
  refractory = 2.5,
  lookback = 6;

const hash = (text) => {
  let h = 2166136261;
  for (const c of String(text)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

/** Per-racer cue lists. Each cue depends only on frames and events at or before its own time. */
function cuesOf(recording) {
  const cues = new Map();
  const of = (id) => {
    if (!cues.has(id)) cues.set(id, { roar: [], snap: [], gasp: [] });
    return cues.get(id);
  };
  const lastRoar = new Map();
  const roar = (id, t, strength, hold) => {
    if (t - (lastRoar.get(id) ?? -Infinity) < refractory && strength < 1) return;
    lastRoar.set(id, t);
    of(id).roar.push({ t, strength, hold });
  };
  for (const event of recording.events || []) {
    const { t, type, racer } = event;
    if (type === "overtake") roar(racer, t, 0.85, 0.35);
    else if (type === "miss") roar(racer, t, 0.5, 0);
    else if (type === "finish" && event.place === 1) roar(racer, t, 1, 1.6);
    else if (type === "finish" && event.place <= 3) roar(racer, t, 0.7, 0.4);
  }
  // Close battles: while a rival flies alongside, snap at it every period or so.
  const running = new Map();
  for (const frame of recording.frames || [])
    for (const racer of frame.racers) {
      if (racer.finished) {
        running.delete(racer.id);
        continue;
      }
      let rival = null,
        best = near;
      for (const other of frame.racers) {
        if (other === racer || other.finished) continue;
        const d = other.position.map((v, i) => v - racer.position[i]);
        const distance = Math.hypot(...d);
        if (distance < best && Math.abs((other.progress ?? 0) - (racer.progress ?? 0)) < alongside) {
          best = distance;
          const f = racer.forward || [1, 0, 0];
          rival = { id: other.id, side: -f[2] * d[0] + f[0] * d[2] >= 0 ? 1 : -1 };
        }
      }
      const state = running.get(racer.id);
      if (!rival) {
        running.delete(racer.id);
        continue;
      }
      const period = 1.3 + 0.9 * hash(`${racer.id}:${rival.id}`);
      if (!state || state.rival !== rival.id)
        running.set(racer.id, { rival: rival.id, next: frame.t + 0.25 + 0.5 * hash(racer.id), period });
      const current = running.get(racer.id);
      if (frame.t >= current.next) {
        of(racer.id).snap.push({ t: frame.t, strength: 1, hold: 0, side: rival.side });
        current.next = frame.t + current.period;
      }
    }
  return cues;
}

const cache = new WeakMap();

/**
 * Mouth expression cues for one racer at time `t`, derived from a race recording by looking back
 * only: `{ roar, snap, snapSide, gasp }`, each 0..1 except `snapSide` (±1, towards the rival).
 * Spread the result into the flight motion passed to `pose`.
 */
export function mouthFromEvents(recording, racerId, t) {
  if (!cache.has(recording)) cache.set(recording, cuesOf(recording));
  const cues = cache.get(recording).get(racerId);
  const out = { roar: 0, snap: 0, snapSide: 1, gasp: 0 };
  if (!cues || !Number.isFinite(t)) return out;
  for (const kind of ["roar", "snap", "gasp"]) {
    const { attack, hold, decay } = mouthCues[kind];
    const list = cues[kind];
    for (let i = list.length - 1; i >= 0; i--) {
      const cue = list[i],
        age = t - cue.t;
      if (age < 0) continue;
      if (age > lookback) break;
      const value = cue.strength * envelope(age, attack, hold + cue.hold, decay);
      if (value > out[kind]) {
        out[kind] = value;
        if (kind === "snap") out.snapSide = cue.side;
      }
    }
  }
  return out;
}
