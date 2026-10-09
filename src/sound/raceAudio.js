import { countdownAt } from "../race/countdown.js";
import { playRace } from "./raceSounds.js";
import { playDragonCall } from "./stableSounds.js";

const maxJump = 0.5;
const hearing = 70;
const flapGap = 0.12;
const flapFloor = 0.15;

/**
 * @typedef {{id: string, position: number[], flap: number, speed: number, progress: number, place: number, finished: boolean, effort: number}} SoundRacer
 * @typedef {{t: number, type: string, racer: string, place?: number}} SoundEvent
 * @typedef {{eye: number[], target: number[], shot?: string, cut?: unknown}} SoundShot
 */

/** @param {number[]} a @param {number[]} b */
const minus = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
/** @param {number[]} v */
const length = (v) => Math.hypot(v[0], v[1], v[2]);

/**
 * Where a sound at `point` sits for a camera at `shot`: how loud, and how far left or right.
 * @param {SoundShot} shot @param {number[]} point
 */
function heard(shot, point) {
  const toPoint = minus(point, shot.eye);
  const distance = length(toPoint);
  const forward = minus(shot.target, shot.eye);
  const right = [-forward[2], 0, forward[0]];
  const side = length(right) && distance ? (toPoint[0] * right[0] + toPoint[2] * right[2]) / (length(right) * distance) : 0;
  return { level: 1 / (1 + (distance / hearing) ** 2), pan: side * 0.8 };
}

/**
 * The broadcast's sound: the countdown, wings beating near the camera, breath and hits, and
 * cheers at the big moments.
 */
export function createRaceAudio() {
  /** @type {number | null} */
  let lastT = null;
  /** @type {string | null} */
  let lastStep = null;
  /** @type {unknown} */
  let lastCut = null;
  /** @type {Map<string, number>} */
  const flaps = new Map();
  let lastFlap = -Infinity;

  return {
    /**
     * @param {{t: number, dt: number, racers: SoundRacer[], events: SoundEvent[], shot: SoundShot, focus: string | null, owned: Set<string>, ageOf: (id: string) => string, playing: boolean, speed: number, goal: number}} frame
     */
    update({ t, racers, events, shot, focus, owned, ageOf, playing, speed }) {
      const jumped = lastT === null || t < lastT || t - lastT > maxJump;
      const from = /** @type {number} */ (lastT);
      lastT = t;
      if (jumped) lastFlap = -Infinity;

      const step = countdownAt(t)?.id ?? null;
      if (!jumped && step && step !== lastStep && step !== "ready") playRace(step === "go" ? "go" : "tick");
      lastStep = step;

      const followed = racers.find((r) => r.id === focus) ?? racers[0];

      if (!jumped && playing && t > from) {
        for (const event of events) {
          if (event.t <= from || event.t > t) continue;
          const racer = racers.find((r) => r.id === event.racer);
          const place = racer ? heard(shot, racer.position) : { level: 0.5, pan: 0 };
          const ours = owned.has(event.racer);
          if (event.type === "breath") playRace("breath", { level: Math.max(place.level, ours ? 0.7 : 0), pan: place.pan });
          if (event.type === "hit") playRace("hit", { level: Math.max(place.level, ours ? 0.8 : 0), pan: place.pan });
          if (event.type === "overtake" && event.place === 1) {
            playRace("whoosh", { level: Math.max(0.4, place.level), pan: place.pan });
            if (ours) playDragonCall(ageOf(event.racer), 0.8);
          }
          if (event.type === "finish" && event.place === 1) {
            playRace("finish");
            playRace("cheer");
          } else if (event.type === "finish" && ours) {
            playRace("cheer", { level: 0.6 });
            if (event.place && event.place <= 3) playDragonCall(ageOf(event.racer));
          }
        }

        if (speed <= 2) {
          for (const racer of racers) {
            const previous = flaps.get(racer.id);
            if (previous === undefined || racer.flap >= previous - 0.5) continue;
            const place = heard(shot, racer.position);
            const followedOne = racer.id === followed?.id;
            const near = followedOne ? Math.max(place.level, 0.35) : place.level;
            if (!followedOne && (near < flapFloor || t - lastFlap < flapGap)) continue;
            playRace("flap", { level: near * (0.6 + 0.4 * racer.effort), pan: place.pan, rate: 0.9 + 0.2 * (1 - racer.effort) });
            if (!followedOne) lastFlap = t;
          }
        }
      }
      for (const racer of racers) flaps.set(racer.id, racer.flap);

      if (shot.cut !== lastCut && !jumped && shot.shot === "flyby") playRace("whoosh", { level: 0.8 });
      lastCut = shot.cut;
    },
    stop() {
      lastT = null;
      lastStep = null;
      flaps.clear();
    },
  };
}
