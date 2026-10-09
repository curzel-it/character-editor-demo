import { scratchSpots } from "./scratchSpots.js";
import { spotPoints } from "./coatSpots.js";
import { createGroomFx } from "./groomFx.js";
import { modelTarget } from "../animate/dragonGroundBreath.js";
import { thumpBeat } from "../animate/dragonThump.js";

const SIDE = 1,
  INTRO = 0.9,
  TOOL_RISE = 0.35,
  FOLLOW = 18,
  TOUCH = 36,
  SPOT = 0.24,
  REACH = 26,
  SHRINK = 0.07,
  WARM = 2.2,
  NOSE = 0.17,
  BLISS = 1.6,
  FOUND = 1.5,
  SNORT = 1.2,
  SNORTS = 3,
  SPOTS = 4,
  LEAN = 0.3,
  DEPTH = 0.4;

/** Where the hand's fingertips are on its bone, the point that strokes the skin. */
const FINGERTIPS = [0.13, -0.05, 0];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (value, target, rate, dt) => value + (target - value) * (1 - Math.exp(-rate * dt));
const pulse = (since, length) => (since >= 0 && since < length ? Math.sin((Math.PI * since) / length) : 0);

/**
 * Groom as a minigame: the bare hand, following the finger, strokes the dragon's head, neck and
 * chest in search of the spot that itches (`scratchSpots`). The nearer it gets the more the dragon
 * leans into the hand, closes its eyes and purrs; held on the spot, a bliss meter fills while a hind
 * foot thumps, and once full the itch moves somewhere else, a little smaller each time. A touch on its
 * nose makes it snort and the third snort ends the session. The score is the spots found. `seed`
 * orders the spots.
 * @param {{ anatomy: object, seed: string }} options
 */
export function createGroom({ anatomy, seed }) {
  const { spots, nose, skin, itchy, size } = scratchSpots(anatomy, { side: SIDE, seed });
  const fx = createGroomFx(size);
  const pointer = { down: false, x: 0, y: 0, travel: 0 };
  /** @type {{ points: number, combo: number, x: number, y: number }[]} */
  const events = [];
  let step = "search",
    stepAt = 0,
    found = 0,
    bliss = 0,
    snorts = 0,
    heat = 0,
    on = 0,
    stroking = 0,
    snortAt = -Infinity,
    foundAt = -Infinity,
    aim = null,
    keep = null,
    hand = null,
    time = 0,
    startAt = null;

  const ahead = [nose.at[0] + 3 * size, nose.at[1] - 0.4 * size, 0];
  const spot = () => spots[found % spots.length];
  const radius = () => SPOT * size * Math.max(0.55, 1 - SHRINK * found);
  const searching = () => step === "search" || step === "warm" || step === "bliss";

  /** The skin point under the finger, among those close to the front of the dragon there, or null when it is off it. */
  function touched(view, points) {
    const near = [];
    for (const at of points) {
      const p = view.project(at);
      const off = Math.hypot(p.x - pointer.x, p.y - pointer.y);
      if (p.front && off <= TOUCH) near.push({ at, off, depth: Math.hypot(...at.map((v, k) => v - view.eye[k])) });
    }
    const front = Math.min(...near.map((n) => n.depth));
    return near.filter((n) => n.depth < front + DEPTH * size).sort((a, b) => a.off - b.off)[0]?.at ?? null;
  }

  return {
    id: "groom",
    action: "groom",
    get score() {
      return found;
    },
    get step() {
      return step;
    },
    get done() {
      return step === "done";
    },
    /** How far the grooming has gone, 0..1: the spots found, and the bliss of the one being scratched. */
    get progress() {
      return clamp01((found + bliss) / SPOTS);
    },
    /** The scores won since the last call, each where on the canvas it was won. */
    takeEvents: () => events.splice(0),
    /** Close on the dragon's flank from a little below, keeping every place it may itch, and its nose, in view as it stood when the game began. */
    camera() {
      return { side: SIDE, pitch: 0.05, zoom: 1, keep };
    },
    pointer({ type, x, y }) {
      if (type === "down") Object.assign(pointer, { down: true, x, y, travel: 0 });
      else if (type === "move") {
        if (pointer.down) pointer.travel += Math.hypot(x - pointer.x, y - pointer.y);
        Object.assign(pointer, { x, y });
      } else pointer.down = false;
    },
    /** Moves the game on to `view.time`: what the hand strokes, how warm it is and the bliss of the spot. */
    update(view) {
      const dt = Math.max(0, Math.min(0.05, view.time - time || 0));
      time = view.time;
      if (startAt === null) [startAt, stepAt, keep] = [time, time + INTRO, spotPoints([...itchy, nose], view.dragon)];
      if (step === "found" && time - stepAt > FOUND) [step, stepAt] = ["search", time];
      if (step === "snort" && time - stepAt > SNORT) [step, stepAt] = [snorts >= SNORTS ? "done" : "search", time];
      const [target, snout, ...points] = spotPoints([spot(), nose, ...skin], view.dragon);
      const touch = time >= stepAt && pointer.down && searching() ? touched(view, [target, snout, ...points]) : null;
      const moving = pointer.travel > 0;
      pointer.travel = 0;
      stroking = ease(stroking, touch ? 1 : 0, 10, dt);
      if (touch && Math.hypot(...touch.map((v, k) => v - snout[k])) < NOSE * size) {
        snorts++;
        [step, stepAt, snortAt, bliss, heat, on] = ["snort", time, time, 0, 0, 0];
        fx.snort(snout, view.dragon.forward, time);
        return;
      }
      const d = touch ? Math.hypot(...touch.map((v, k) => v - target[k])) : Infinity;
      const spotAt = view.project(target);
      const close = d < radius() || (touch !== null && Math.hypot(spotAt.x - pointer.x, spotAt.y - pointer.y) < REACH);
      heat = ease(heat, touch ? clamp01(1 - d / (WARM * size)) : 0, touch ? 4 : 1.5, dt);
      on = ease(on, close ? 1 : 0, close ? 6 : 3, dt);
      if (close) bliss += (dt / BLISS) * (moving ? 1 : 0.6);
      else bliss = Math.max(0, bliss - dt / 4);
      if (touch && heat > 0.3) fx.purr(touch, heat, time);
      const lean = touch ? modelTarget(view.dragon.anatomy, view.dragon.position, view.dragon.forward, touch.map((v, k) => v + (view.eye[k] - v) * 0.3)) : ahead;
      const goal = ahead.map((v, k) => v + (lean[k] - v) * LEAN * heat);
      aim = aim ? aim.map((v, k) => ease(v, goal[k], 3, dt)) : goal;
      if (bliss >= 1) {
        found++;
        [step, stepAt, foundAt, bliss] = ["found", time, time, 0];
        events.push({ points: 1, combo: 1, x: spotAt.x, y: spotAt.y });
        fx.burst(target, time);
        return;
      }
      if (searching()) step = close ? "bliss" : heat > 0.55 ? "warm" : heat < 0.4 ? "search" : step === "bliss" ? "warm" : step;
    },
    /** The dragon leaning into the hand with its eyes closing, thumping a foot on the spot and tossing its head at a snort. */
    motion() {
      const joy = pulse(time - foundAt, FOUND),
        huff = pulse(time - snortAt, SNORT);
      const warm = Math.max(heat, joy);
      return {
        stand: 1,
        crouch: (0.1 + 0.2 * warm) * (1 - huff),
        breathTarget: aim ?? undefined,
        gasp: 0.25 * warm * (1 - huff),
        lids: (0.35 * heat + 0.6 * Math.max(on, joy)) * (1 - huff),
        thump: Math.max(on, joy),
        impact: 0.25 * Math.max(on, joy) * (1 - thumpBeat(time)),
        thumpSide: SIDE,
        roar: 0.3 * huff,
        bank: 0.006 * warm * Math.sin(time * 47),
      };
    },
    /** The keeper's bare hand under the finger, its fingertips scratching while they touch the dragon. */
    hand(view) {
      if (step === "done") return null;
      const rest = { x: 0.72 * view.width, y: 0.72 * view.height };
      const target = pointer.down ? pointer : rest;
      hand ??= { ...rest };
      const k = 1 - Math.exp(-FOLLOW * (view.dt ?? 0.016));
      hand.x += (target.x - hand.x) * k;
      hand.y += (target.y - hand.y) * k;
      const reach = startAt === null ? 0 : clamp01((time - startAt - INTRO) / TOOL_RISE);
      const scratch = stroking * (0.5 + 0.5 * Math.sin(time * 20));
      return { screen: [hand.x, hand.y], anchor: FINGERTIPS, reach, wrist: 0.45 + 0.2 * scratch, twist: -0.6, curl: 0.2 + 0.35 * scratch, thumb: 0.25, spread: 0.3, roll: 0.1 };
    },
    /** The purr motes, glints and snorted puffs. */
    particles(out) {
      fx.draw(out, time);
    },
    /** The hearts floating off the dragon. */
    objects(view) {
      return fx.hearts(view, time);
    },
  };
}
