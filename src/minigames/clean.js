import { coatSpots, spotPoints } from "./coatSpots.js";
import { NOZZLE } from "../keeper/items/clean.js";
import { createCleanSpray } from "./cleanSpray.js";

const SCRUB = 5,
  RINSE = 0.6,
  SWING = 1.2,
  COMBO = 1.6,
  REACH = 1.4,
  FOLLOW = 18,
  TOOL_RISE = 0.35,
  INTRO = 0.9,
  MUD_IN = 0.8,
  MAX_SPOTS = 12,
  LOB = 0.12;

const HOSE_LEAN = [-0.34, -0.94, 0],
  SPONGE_ANCHOR = [0.075, -0.09, 0];

const points = { sponge: 10, rinse: 5 };

/**
 * Clean as a minigame: mud on both sides of the dragon, `dirt` (0..1) setting how much. On each side
 * in turn the sponge, following the finger, lathers the mud off while it wiggles over it, then the
 * hose, aimed by the finger, rinses the lather away; the camera swings round for the other side.
 * Each spot cleared scores, more in quick succession. `seed` places the mud.
 * @param {{ anatomy: object, dirt: number, seed: string }} options
 */
export function createClean({ anatomy, dirt, seed }) {
  const count = Math.max(2, Math.min(MAX_SPOTS, Math.round(2 + 10 * dirt)));
  const sides = [1, -1]
    .map((side, i) => coatSpots(anatomy, { count: i ? Math.floor(count / 2) : Math.ceil(count / 2), side, seed: `${seed}:${side}` }))
    .filter((spots) => spots.length);
  const spots = sides.flat();
  const spray = createCleanSpray();
  const pointer = { down: false, x: 0, y: 0, travel: 0 };
  /** @type {{ points: number, combo: number, x: number, y: number }[]} */
  const events = [];
  let side = 0,
    step = "sponge",
    stepAt = 0,
    score = 0,
    combo = 0,
    lastClear = -Infinity,
    scrubbedAt = -Infinity,
    hosedAt = -Infinity,
    hand = null,
    aim = null,
    aimed = null,
    time = 0,
    startAt = null;

  const facing = () => sides[side]?.[0]?.side ?? 1;
  const tool = () => (step === "rinse" ? "hose" : "sponge");

  function clear(kind, at) {
    combo = time - lastClear < COMBO ? Math.min(4, combo + 1) : 1;
    lastClear = time;
    const gained = points[kind] * combo;
    score += gained;
    events.push({ points: gained, combo, x: at.x, y: at.y });
  }

  function advance() {
    const here = sides[side];
    if (step === "sponge" && here.every((s) => s.mud <= 0)) [step, stepAt] = ["rinse", time];
    else if (step === "rinse" && here.every((s) => s.foam <= 0)) {
      side++;
      [step, stepAt] = side < sides.length ? ["swing", time] : ["done", time];
    }
  }

  return {
    id: "clean",
    action: "clean",
    /** The mud and lather, the mud fading in as the game opens. */
    get coat() {
      const appear = startAt === null ? 0 : Math.min(1, (time - startAt) / MUD_IN);
      return appear < 1 ? spots.map((s) => ({ ...s, mud: s.mud * appear })) : spots;
    },
    get score() {
      return score;
    },
    get step() {
      return step;
    },
    get done() {
      return step === "done";
    },
    /** How much of the work is done, 0..1: mud lifted and lather rinsed, a spot at a time. */
    get progress() {
      const work = spots.reduce((sum, s) => sum + (1 - s.mud) + (s.mud <= 0 ? 1 - s.foam : 0), 0);
      return spots.length ? work / (2 * spots.length) : 1;
    },
    /** The scores won since the last call, each where on the canvas it was won. */
    takeEvents: () => events.splice(0),
    /** Where the camera looks from, the dragon's side being cleaned, and what it frames, the middle of that side's mud. */
    camera() {
      const here = sides[Math.min(side, sides.length - 1)];
      const focus = [0, 1, 2].map((k) => here.reduce((sum, s) => sum + s.at[k], 0) / here.length);
      return { side: facing(), pitch: 0.2, zoom: 1, focus };
    },
    pointer({ type, x, y }) {
      if (type === "down") Object.assign(pointer, { down: true, x, y, travel: 0 });
      else if (type === "move") {
        if (pointer.down) pointer.travel += Math.hypot(x - pointer.x, y - pointer.y);
        Object.assign(pointer, { x, y });
      } else pointer.down = false;
    },
    /** Moves the game on to `view.time`, scrubbing or rinsing what lies under the finger. */
    update(view) {
      const dt = Math.max(0, Math.min(0.05, view.time - time || 0));
      time = view.time;
      if (startAt === null) [startAt, stepAt] = [time, time + INTRO];
      if (step === "swing" && time - stepAt > SWING) [step, stepAt] = ["sponge", time];
      aim = null;
      if (time < stepAt) {
        pointer.travel = 0;
        return spray.update(view, time, null);
      }
      if (step !== "sponge" && step !== "rinse") return spray.update(view, time, null);
      const here = sides[side];
      const at = spotPoints(here, view.dragon);
      const near = here.map((s, i) => {
        const centre = view.project(at[i]);
        const edge = view.project(at[i].map((v, k) => v + view.right[k] * s.radius));
        const r = Math.max(8, Math.hypot(edge.x - centre.x, edge.y - centre.y));
        return { s, i, centre, r, close: pointer.down && centre.front && Math.hypot(pointer.x - centre.x, pointer.y - centre.y) < REACH * r };
      });
      if (step === "sponge" && pointer.down && pointer.travel > 0) {
        for (const n of near) {
          if (!n.close || n.s.mud <= 0) continue;
          scrubbedAt = time;
          n.s.mud = Math.max(0, n.s.mud - pointer.travel / (SCRUB * n.r));
          n.s.foam = Math.max(n.s.foam, 1 - n.s.mud);
          spray.lather(at[n.i], n.s.radius, time, pointer.travel / n.r);
          if (n.s.mud <= 0) clear("sponge", n.centre);
        }
      }
      if (step === "rinse" && pointer.down) {
        hosedAt = time;
        const hit = near.filter((n) => n.close && n.s.foam > 0).sort((a, b) => Math.hypot(pointer.x - a.centre.x, pointer.y - a.centre.y) - Math.hypot(pointer.x - b.centre.x, pointer.y - b.centre.y))[0];
        aim = hit ? at[hit.i] : view.at(pointer.x, pointer.y, Math.hypot(...view.dragon.position.map((v, k) => v - view.eye[k])));
        if (hit) {
          hit.s.foam = Math.max(0, hit.s.foam - dt / RINSE);
          if (hit.s.foam <= 0) {
            clear("rinse", hit.centre);
            spray.sparkle(at[hit.i], hit.s.radius, time);
          }
        }
      }
      pointer.travel = 0;
      spray.update(view, time, aim && { to: aim, size: here[0].radius });
      advance();
    },
    /** The dragon leaning into the sponge and shying from the water. */
    motion() {
      const scrub = Math.exp(-4 * (time - scrubbedAt)),
        wet = Math.exp(-5 * (time - hosedAt));
      return { impact: 0.3 * scrub + 0.15 * wet, bank: 0.04 * wet * Math.sin(time * 31), stand: 1 - 0.06 * wet };
    },
    /**
     * The keeper's hand: the sponge under the finger, or the hose held low with its nozzle turned to it, rising
     * again with each new tool; `screen` is where its `anchor` (a point on the hand) stands on the canvas.
     */
    hand(view) {
      if (step === "done") return null;
      const rest = { x: 0.75 * view.width, y: 0.7 * view.height };
      const target = tool() === "hose" ? { x: rest.x + 0.3 * ((pointer.down ? pointer.x : rest.x) - rest.x), y: rest.y } : pointer.down ? pointer : rest;
      hand ??= { ...rest };
      const k = 1 - Math.exp(-FOLLOW * (view.dt ?? 0.016));
      hand.x += (target.x - hand.x) * k;
      hand.y += (target.y - hand.y) * k;
      const reach = step === "swing" ? 0 : Math.max(0, Math.min(1, (time - stepAt) / TOOL_RISE));
      if (tool() === "hose") {
        const reachOut = Math.hypot(...view.dragon.position.map((v, i) => v - view.eye[i]));
        const toward = aim ?? view.at(0.5 * view.width, 0.45 * view.height, reachOut);
        aimed ??= toward;
        aimed = aimed.map((v, i) => v + (toward[i] - v) * k);
        const aimAt = [aimed[0], aimed[1] + LOB * reachOut, aimed[2]];
        return { item: "hose", screen: [hand.x, hand.y], anchor: NOZZLE.tip, tipAxis: NOZZLE.axis, aimAt, lean: HOSE_LEAN, reach, wrist: 0.15, twist: -1.2, curl: 0.8, thumb: 0.75, roll: -0.35 };
      }
      const wobble = Math.exp(-4 * (time - scrubbedAt));
      return { item: "sponge", screen: [hand.x, hand.y], anchor: SPONGE_ANCHOR, reach, wrist: 0.2, twist: 0.1 * wobble * Math.sin(time * 24), curl: 0.4, thumb: 0.35, roll: 0.15 * wobble * Math.sin(time * 19) };
    },
    /** Bubbles, the hose's water and the sparkle of rinsed spots; `view.tip` is the nozzle and `view.tipAxis` the way it points. */
    particles(out, view) {
      spray.draw(out, view, time, step === "rinse" && pointer.down ? view.tip : null, view.tipAxis);
    },
  };
}
