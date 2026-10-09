import { makeRng } from "../rng.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { smoothstep } from "../animate/flightMotion.js";
import { createBeat } from "./exerciseBeat.js";

const INTRO = 0.9,
  PERIOD = 0.95,
  COUNT = 3,
  REPS = 6,
  FULL = 20,
  FALL = 0.35,
  FLAT = 1.3,
  GET_UP = 0.6,
  REACH = 0.4,
  FOLLOW = 14;

/** The drills of a circuit per age: adults drop onto their wing hands for push-ups, teens do not. */
const DRILLS = { teen: ["squat", "jack", "crunch"], adult: ["pushup", "squat", "jack", "crunch"] };

const bump = (u) => (u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0);

/**
 * Exercise as a minigame: a circuit of drills done to a beat that quickens, `REPS` reps of each in a
 * seeded order. The dragon lowers into each rep to land on the beat and the player taps on it to
 * drive the rep; a tap off the beat makes it wobble, one way off or a beat let pass and it flops
 * face down, ending the set. The keeper's flag beats time. The score is the reps.
 * @param {{ anatomy: object, seed: string }} options
 */
export function createExercise({ anatomy, seed }) {
  const random = makeRng(seed);
  const drills = [...(DRILLS[anatomy.age] ?? DRILLS.teen)];
  for (let i = drills.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [drills[i], drills[j]] = [drills[j], drills[i]];
  }
  const head = anatomy.bones.findIndex((b) => b.id === "head");
  /** @type {{ points: number, combo: number, x: number, y: number }[]} */
  const events = [];
  const taps = [];
  let beat = null,
    time = 0,
    judged = null,
    wobbleAt = -Infinity,
    hand = null,
    view = null;

  const drillOf = (rep) => drills[Math.floor(Math.max(0, rep) / REPS) % drills.length];
  const flopAt = () => beat?.missAt ?? null;
  const step = () => {
    if (!beat || beat.countIn(time) > 0) return "ready";
    const fell = flopAt();
    if (fell === null) return drillOf(beat.reps);
    return time < fell + FALL + FLAT + GET_UP ? "flop" : "done";
  };

  /** Where on the canvas the dragon's head is, for the points it wins. */
  function headAt() {
    const racer = view.dragon;
    const model = multiply(orientation(racer.position, racer.forward, racer.bank ?? 0), transform(racer.anatomy.bones[0].position.map((v) => -v)));
    return view.project(point(multiply(model, boneMatrices(racer.anatomy, racer.pose)[head]), [0, 0, 0]));
  }

  function judge(at) {
    const kind = beat.tap(at);
    if (!kind) return;
    judged = { kind, at };
    if (kind === "miss") return;
    if (kind !== "good") wobbleAt = at;
    const { x, y } = view ? headAt() : { x: 0, y: 0 };
    events.push({ points: 1, combo: 1, x, y: y - 48 });
  }

  /** How far into the next rep the dragon has lowered, 0..1, reaching 1 on the beat. */
  function load() {
    const { due, period, tapAt, reps } = beat;
    const from = reps === 0 ? due - 0.9 * period : tapAt + Math.min(0.22, 0.35 * period);
    return smoothstep(from, due - 0.04 * period, time);
  }

  /** How far the last rep's drive has still to go, 1 at the tap to 0 once it is done. */
  const release = () => 1 - smoothstep(beat.tapAt, beat.tapAt + Math.min(0.22, 0.35 * beat.period), time);
  const kick = () => bump((time - beat.tapAt) / Math.min(0.5, 0.6 * beat.period));

  return {
    id: "exercise",
    action: "exercise",
    get score() {
      return beat?.reps ?? 0;
    },
    get step() {
      return step();
    },
    get done() {
      return step() === "done";
    },
    /** How much of a full workout is done, 0..1: `FULL` reps. */
    get progress() {
      return Math.min(1, (beat?.reps ?? 0) / FULL);
    },
    /**
     * The beat for the yard's marker while the set goes on, or null: seconds `until` the next beat
     * and the `period` between beats, the `count` of count-in beats still to come and the last tap's
     * `judged` kind with the time it was made.
     */
    get beat() {
      if (!beat || flopAt() !== null) return judged?.kind === "miss" && time - judged.at < 0.6 ? { until: 0, period: 1, count: 0, judged } : null;
      return { until: beat.due - time, period: beat.period, count: beat.countIn(time), judged };
    },
    takeEvents: () => events.splice(0),
    /** A three-quarter view from the dragon's left, taking in all of it. */
    camera() {
      return { side: 1, pitch: 0.15, zoom: 1, focus: anatomy.bounds.center.map((v, k) => v + (k ? 0 : 0.15 * anatomy.bounds.radius)) };
    },
    /** A touch anywhere is a tap for the beat. */
    pointer({ type }) {
      if (type === "down") taps.push(time);
    },
    /** Moves the set on to `view.time`, judging the taps made since the last frame. */
    update(next) {
      view = next;
      time = next.time;
      beat ??= createBeat({ start: time + INTRO, period: PERIOD, count: COUNT });
      for (const at of taps.splice(0)) if (flopAt() === null) judge(at);
      if (beat.update(time)) judged = { kind: "miss", at: time };
    },
    /** The dragon working through the drills to the beat, wobbling off it and flopping when it slips. */
    motion() {
      if (!beat) return {};
      const fell = flopAt();
      const on = fell === null ? 1 : 1 - smoothstep(fell, fell + 0.25, time);
      const next = beat.reps === 0 && beat.countIn(time) > 1 ? null : drillOf(beat.reps);
      const last = beat.reps ? drillOf(beat.reps - 1) : null;
      const lowered = next ? load() : 0;
      const drive = last ? release() : 0;
      const pop = last ? kick() : 0;
      const field = (id, rise, fall) => on * Math.max(next === id ? rise : 0, last === id ? fall : 0);
      const jack = field("jack", 0, pop);
      const strain = fell === null && time > beat.due ? Math.min(1, (time - beat.due) / 0.2) : 0;
      const wobble = Math.exp(-5 * (time - wobbleAt));
      const flop = fell === null ? 0 : smoothstep(fell, fell + FALL, time) * (1 - smoothstep(fell + FALL + FLAT, fell + FALL + FLAT + GET_UP, time));
      return {
        pushup: field("pushup", lowered, drive),
        squat: field("squat", lowered, drive),
        jack,
        crunch: field("crunch", 0, pop) - 0.5 * field("crunch", lowered, 0),
        impact: 0.5 * field("jack", lowered, 0) + 0.3 * wobble,
        wings: jack,
        spring: 0.5 * jack,
        lift: 0.12 * jack,
        flop,
        sleep: 0.5 * flop,
        bank: (0.07 * wobble * Math.sin(time * 22) + 0.025 * strain * Math.sin(time * 47)) * on,
        gasp: 0.4 * Math.min(1, (beat.reps ?? 0) / FULL) + 0.6 * flop,
        roar: 0.2 * pop * on,
      };
    },
    /** The keeper's flag beating time, down on each beat, lowered once the set is over. */
    hand(v) {
      if (step() === "done") return null;
      const rest = { x: 0.8 * v.width, y: 0.74 * v.height };
      hand ??= { ...rest };
      const k = 1 - Math.exp(-FOLLOW * (v.dt ?? 0.016));
      hand.x += (rest.x - hand.x) * k;
      hand.y += (rest.y - hand.y) * k;
      const fell = flopAt();
      const start = beat ? beat.due - COUNT * PERIOD - INTRO : time;
      const reach = Math.min(1, Math.max(0, (time - start) / REACH)) * (fell === null ? 1 : 1 - smoothstep(fell + 0.3, fell + 0.8, time));
      const phase = beat ? 1 - (beat.due - time) / beat.period : 0;
      const wave = fell === null ? Math.cos(2 * Math.PI * phase) : 0;
      return { item: "flag", screen: [hand.x, hand.y], reach, wrist: 0.35 + 0.3 * wave, twist: 0.55, curl: 0.78, thumb: 0.75, roll: 0.5 + 0.15 * wave };
    },
    particles() {},
  };
}
