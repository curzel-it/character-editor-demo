import { makeRng } from "../rng.js";
import { fireworksPhases } from "./soulFireworks.js";
import { t as text } from "../i18n.js";

// Seconds into the show: the custodian raises his staff, the parents glide in one after another and
// land, then crouch and breathe at the altar together at `BREATH`, where the fireworks start.
const RAISE = [0.8, 2.3],
  ARRIVE = 3,
  FLIGHT = 4.4,
  STAGGER = 0.28,
  CUE_LEAD = 2,
  BREATH = 11,
  CARD_AFTER = { true: 4.8, false: 5.6 };

/** How many lines the custodian has for each moment, in `ritualTimeline` of the strings. */
const LINES = 3;

/**
 * @typedef {{ id: string, at: number }} Beat
 * @typedef {{ at: number, until: number, text: string }} Line
 * @typedef {{ count: number, success: boolean, seed: string, breath: number, fireworks: typeof fireworksPhases,
 *   beats: Beat[], lines: Line[], arrivals: { start: number, land: number }[], cueStart: number, card: number,
 *   length: number }} RitualTimeline
 */

/**
 * When everything in the ritual show happens, in seconds, for `count` parents (2 to 6), the ritual's
 * `success` and its `seed` (which picks the custodian's lines). Beats run in order: `raise` (the
 * custodian lifts his staff), `arrive` (the parents glide in), `breathe` (together, at the altar), then
 * the fireworks' `merge`, `burst` and `settle`, the `reveal` (an egg or an empty stone), and `card`,
 * when the show ends on the result card. `fireworks` are the offsets of `fireworksPhases` from `breath`.
 * @param {{ count: number, success: boolean, seed: string }} options
 * @returns {RitualTimeline}
 */
export function ritualTimeline({ count, success, seed }) {
  const n = Math.max(2, Math.min(6, Math.round(count)));
  const random = makeRng(`${seed}:ritual-show`);
  const pick = (moment) => text(`ritualTimeline.${moment}.${Math.floor(random() * LINES)}`);
  const arrivals = Array.from({ length: n }, (_, i) => {
    const start = ARRIVE + i * STAGGER;
    return { start, land: start + FLIGHT };
  });
  const F = fireworksPhases;
  const reveal = BREATH + F.reveal;
  const card = reveal + CARD_AFTER[success];
  const beats = [
    { id: "raise", at: RAISE[0] },
    { id: "arrive", at: ARRIVE },
    { id: "breathe", at: BREATH },
    { id: "merge", at: BREATH + F.merge },
    { id: "burst", at: BREATH + F.burst },
    { id: "settle", at: BREATH + F.settle },
    { id: "reveal", at: reveal },
    { id: "card", at: card },
  ];
  const lines = [
    { at: 0.5, until: 4.4, text: pick("raise") },
    { at: BREATH - 1.6, until: BREATH + 1.4, text: pick("breath") },
    success ? { at: reveal + 1.2, until: card, text: pick("success") } : { at: reveal + 1.4, until: card, text: pick("failure") },
  ];
  return { count: n, success, seed, breath: BREATH, fireworks: F, beats, lines, arrivals, cueStart: BREATH - CUE_LEAD, card, length: card };
}

/** The id of the last beat started by `t`, or null before the first. */
export function beatAt(timeline, t) {
  let current = null;
  for (const beat of timeline.beats) if (t >= beat.at) current = beat.id;
  return current;
}

/** The custodian's line showing at `t`, or null. */
export const lineAt = (timeline, t) => timeline.lines.find((line) => t >= line.at && t < line.until) ?? null;

/** How far the custodian has raised his staff `t` seconds in: 0 idle, 1 held high. */
export const raiseShare = (t) => Math.max(0, Math.min(1, (t - RAISE[0]) / (RAISE[1] - RAISE[0])));
