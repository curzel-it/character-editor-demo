import { palette } from "../palette.js";
import { PLAY_STICK } from "../keeper/items/play.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { playConfetti } from "../scene/care/playConfetti.js";
import { drawAimTrace } from "./aimTrace.js";
import { fetchFinds, findOf } from "./fetchFinds.js";
import { aimOf, throwFlight } from "./fetchThrow.js";
import { fetchTrip } from "./fetchTrip.js";

const INTRO = 0.9,
  RISE = 0.4,
  FOLLOW = 18,
  ROUNDS = 2,
  PLOP = 2.5,
  SULK = 1.6,
  TOSS = 0.7,
  CHASE = 0.25,
  HELD = 0.5,
  TWIST = 2.1,
  PITCH = 0.06,
  ZOOM = 2.2,
  AHEAD = 0.8,
  ACROSS = 0.8,
  LOOK = 0.3,
  TURN = 0.1,
  SIGHT = 0.035;

/** Seconds into Play's care reaction the yard picks up after a game: its cheer, once its ball has bounced away. */
export const fetchFinale = 3.5;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => t * t * (3 - 2 * t);
const rise = (since, from, to) => ease(clamp01((since - from) / (to - from)));
const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const flat = (v) => unit([v[0], 0, v[2]]);
const turned = (v, a) => [v[0] * Math.cos(a) - v[2] * Math.sin(a), 0, v[2] * Math.cos(a) + v[0] * Math.sin(a)];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cheer = playConfetti("minigame:fetch:cheer", 22);

/** Where bone `id` of the posed `racer` is in the world. */
function boneAt(racer, id) {
  const index = racer.anatomy.bones.findIndex((b) => b.id === id);
  const model = multiply(orientation(racer.position, racer.forward), transform(racer.anatomy.bones[0].position.map((v) => -v)));
  return point(multiply(model, boneMatrices(racer.anatomy, racer.pose)[index]), [0, 0, 0]);
}

/**
 * Fetch as a minigame, looking past the dragon out over the grassland: the keeper holds up a stick and
 * a drag up the screen aims a throw, a dotted arc showing its flight down to where it lands, the longer
 * the drag the harder and further, and lifting the finger throws it along that arc. The dragon watches it
 * go, flies off after it, snatches it up where it fell and comes back with it, or now and then with
 * something else (a log, a bone), tossing it back into the keeper's hand for the next throw. A throw
 * that does not carry past the dragon plops at its feet and ends the game. The score is the metres
 * fetched in all. `seed` picks what it brings back.
 * @param {{ anatomy: object, seed: string }} options
 */
export function createFetch({ anatomy, seed }) {
  const radius = anatomy.bounds.radius;
  /** @type {{ points: number, combo: number, x: number, y: number }[]} */
  const events = [];
  /** The finger aiming a throw: where it touched down and where it is now, or null. */
  let drag = null,
    /** The throw the finger aims, drawn as a dotted arc and thrown as drawn when it lifts. */
    plan = null,
    released = false;
  let step = "throw",
    time = 0,
    startAt = null,
    upAt = 0,
    score = 0,
    fetched = 0,
    round = 0,
    held = "stick",
    heldAt = null,
    hand = null,
    release = null,
    home = null,
    focus = null,
    thrown = null,
    trip = null,
    state = null,
    mouth = null,
    toss = null,
    cheerAt = -Infinity;

  /** The throw the drag aims: from what the hand holds, along the view turned by the drag's lean. */
  function planFor(view) {
    const aim = aimOf(drag.start, drag.now, view.height);
    if (!aim) return null;
    const ahead = flat(view.ahead),
      right = flat(view.right);
    const dir = unit(ahead.map((v, k) => v * Math.cos(aim.angle) + right[k] * Math.sin(aim.angle)));
    return throwFlight(heldAt, dir, aim.speed, restOf(held));
  }

  /** How high the middle of find `id` lies off the ground. */
  const restOf = (id) => fetchFinds[id].rest * fetchFinds[id].size * radius;

  /** Throws what the hand holds along `arc`; the dragon runs after it, or stares at it when it falls short. */
  function launch(view, arc) {
    const off = [arc.land[0] - home.position[0], 0, arc.land[2] - home.position[2]];
    const plop = dot(off, flat(view.ahead)) < PLOP * radius;
    const distance = plop ? 0 : Math.round(Math.hypot(...off));
    thrown = { at: time, id: held, arc, distance, plop, picked: false, spin: 6 + arc.landAt * 2, forward: flat(off) };
    release = { x: hand?.x ?? 0, y: hand?.y ?? 0 };
    held = null;
    if (plop) return (step = "plop");
    trip = fetchTrip({ from: home.position, facing: home.forward, dir: flat(off), distance, radius, arrive: arc.landAt + CHASE });
    step = "fetch";
  }

  /** The find carried in the jaws of the posed dragon, crosswise. */
  function carried(view, id) {
    const racer = view.dragon;
    const jaw = boneAt(racer, "jaw"),
      head = boneAt(racer, "head");
    const along = unit(jaw.map((v, k) => v - head[k] + racer.forward[k] * 0.15 * radius));
    mouth = jaw.map((v, k) => v + along[k] * 0.12 * radius - (k === 1 ? 0.03 * radius : 0));
    return prop(id, mouth, racer.forward);
  }

  /** Find `id` as a racer at `position`, lying across `forward`, `scale` times its length (its size by the dragon by default). */
  function prop(id, position, forward, scale = fetchFinds[id].size * radius, spin = [0, 0, 0]) {
    const find = fetchFinds[id];
    return { anatomy: find.anatomy, pose: { bones: { hand: { rotation: spin, scale: scale / find.length } } }, position, forward, bank: 0 };
  }

  /** How long find `id` is in the keeper's hand. */
  const inHand = (id) => (id === "stick" ? PLAY_STICK.length : HELD);

  /** The find lands in the keeper's hand, ready for the next throw. */
  function caught(view) {
    held = toss.id;
    score += thrown.distance;
    fetched++;
    round++;
    events.push({ points: thrown.distance, combo: 1, x: hand?.x ?? view.width / 2, y: hand?.y ?? view.height / 2 });
    [toss, upAt, step] = [null, time, "throw"];
  }

  /** The point of the dragon in its rest pose the camera centres on: ahead of it over the grass and to its right, so it stands at the left. */
  function focusFor(view) {
    const root = anatomy.bones[0].position;
    const f = flat(home.forward),
      left = [-f[2], 0, f[0]];
    const ahead = flat(view.vista ?? view.ahead),
      right = [-ahead[2], 0, ahead[0]];
    const off = ahead.map((v, k) => (v * AHEAD + right[k] * ACROSS) * radius);
    return [root[0] + dot(off, f), root[1] + LOOK * radius, root[2] + dot(off, left)];
  }

  return {
    id: "fetch",
    action: "play",
    get score() {
      return score;
    },
    get step() {
      return step;
    },
    get done() {
      return step === "done";
    },
    /** How much play there was, 0..1: a share for each throw fetched. */
    get progress() {
      return Math.min(1, fetched / ROUNDS);
    },
    takeEvents: () => events.splice(0),
    /** From behind the keeper, low, looking out over the grassland with the dragon to the left. */
    camera() {
      return { side: -1, heading: home?.vista, pitch: PITCH, zoom: ZOOM, focus };
    },
    pointer({ type, x, y }) {
      if (type === "down") drag = { start: { x, y }, now: { x, y } };
      else if (type === "move" && drag) drag.now = { x, y };
      else if (drag) {
        drag.now = { x, y };
        released = true;
      }
    },
    /** Moves the game on to `view.time`: the finger aims and throws, the dragon runs after it and tosses back its find. */
    update(view) {
      time = view.time;
      if (startAt === null) {
        [startAt, upAt] = [time, time + INTRO];
        home = { position: [view.dragon.position[0], 0, view.dragon.position[2]], forward: view.dragon.forward, vista: turned(flat(view.vista ?? view.ahead), TURN) };
        focus = focusFor(view);
      }
      const ready = step === "throw" && held && heldAt && time - upAt > 0.6 * RISE;
      plan = drag && ready ? planFor(view) : null;
      if (released) {
        if (plan) launch(view, plan);
        [drag, plan, released] = [null, null, false];
      }
      if (step === "plop" && time - thrown.at > thrown.arc.landAt + SULK) step = "done";
      if (toss && time - toss.at >= TOSS) caught(view);
      if (!trip) return;
      state = trip.at(time - thrown.at);
      const find = findOf(seed, round);
      if (step === "fetch" && state.carrying) {
        step = find;
        thrown.picked = find === thrown.id;
      }
      if (state.dropped && !toss && !held) {
        toss = { at: time, id: find, from: mouth ?? home.position };
        cheerAt = time;
      }
      if (time - thrown.at >= trip.length) trip = state = null;
    },
    /** Where the dragon is while it is off after the stick, its height over the ground as Y; null while it stands on its spot. */
    place() {
      return state ? { position: state.position, forward: state.forward } : null;
    },
    /** The dragon eager for the throw, off on its run, or staring glumly down at a stick that went nowhere. */
    motion() {
      if (state) return state.motion;
      if (step === "plop" || step === "done") {
        const k = rise(time - thrown.at, thrown.arc.landAt, thrown.arc.landAt + 0.5);
        return { breathPitch: -0.55 * k, stand: 1 - 0.12 * k, impact: 0.3 * Math.exp(-6 * Math.max(0, time - thrown.at - thrown.arc.landAt)) * k, glum: k };
      }
      const eager = startAt === null ? 0 : clamp01((time - upAt) / RISE);
      return { impact: 0.18 * eager * Math.abs(Math.sin(time * 6)), breathPitch: 0.12 * eager, roar: 0.12 * eager };
    },
    /**
     * The keeper's hand: holding up what the dragon last brought back, drawn back a little as the finger
     * aims; let go, it snaps open and drops away, and it comes back up open to catch the next find.
     */
    hand(view) {
      const rest = { x: 0.72 * view.width, y: 0.68 * view.height };
      const pull = drag && held ? { x: rest.x - 0.12 * (drag.now.x - drag.start.x), y: rest.y - 0.12 * (drag.now.y - drag.start.y) } : rest;
      const target = !held && !toss && release ? release : pull;
      hand ??= { ...rest };
      const k = 1 - Math.exp(-FOLLOW * (view.dt ?? 0.016));
      hand.x += (target.x - hand.x) * k;
      hand.y += (target.y - hand.y) * k;
      const pose = { screen: [hand.x, hand.y], anchor: PLAY_STICK.at, wrist: 0.15, twist: TWIST, curl: 0.78, thumb: 0.75, roll: -0.25 };
      if (held) return { ...pose, item: held === "stick" ? "stick" : undefined, reach: rise(time, upAt - RISE, upAt) };
      if (toss) {
        const open = 1 - rise(time - toss.at, TOSS - 0.08, TOSS);
        return { ...pose, reach: rise(time - toss.at, 0, 0.6 * TOSS), curl: 0.78 - 0.68 * open, thumb: 0.75 - 0.6 * open, spread: 0.3 * open };
      }
      if (!thrown || step === "done") return null;
      const s = time - thrown.at;
      const reach = 1 - rise(s, 0.2, 0.55);
      if (reach <= 0) return null;
      const open = rise(s, 0, 0.12);
      return { ...pose, reach, wrist: 0.15 + 0.5 * rise(s, 0, 0.08) - 0.2 * open, twist: TWIST - 0.6 * open, curl: 0.78 - 0.68 * open, thumb: 0.75 - 0.6 * open, spread: 0.3 * open };
    },
    /** What the hand holds, the throw in the air or lying where it fell, the find in the dragon's jaws and the one tossed back. */
    objects(view) {
      heldAt = view.tip ?? null;
      const out = [];
      const across = flat(view.ahead);
      if (held && held !== "stick" && heldAt) out.push(prop(held, heldAt, across, HELD));
      if (thrown && !thrown.picked) {
        const s = time - thrown.at;
        const { id, arc } = thrown;
        if (s < arc.landAt) {
          const position = arc.at(s);
          const length = fetchFinds[id].length;
          const u = s / arc.landAt;
          const far = Math.hypot(...position.map((v, k) => v - view.eye[k]));
          const size = Math.max(inHand(id), fetchFinds[id].size * radius * rise(u, 0.6, 1), SIGHT * far * (length / PLAY_STICK.length));
          const spin = thrown.spin * s;
          out.push(prop(id, position, across, size, [spin, 0, 0.6 * spin]));
        } else out.push(prop(id, thrown.arc.land, thrown.forward));
      }
      const find = findOf(seed, round);
      if (state?.carrying) out.push(carried(view, find));
      if (toss) {
        const u = clamp01((time - toss.at) / TOSS);
        const to = heldAt ?? toss.from;
        const position = toss.from.map((v, k) => v + (to[k] - v) * u + (k === 1 ? 2 * radius * u * (1 - u) : 0));
        const size = fetchFinds[toss.id].size * radius + (inHand(toss.id) - fetchFinds[toss.id].size * radius) * ease(u);
        out.push(prop(toss.id, position, across, size, [8 * u, 0, 0]));
      }
      return out;
    },
    /** A burst of confetti as the dragon tosses back its find, and the aimed throw's arc dotted down to where it lands. */
    particles(out, view) {
      if (!home) return;
      cheer(out, time - cheerAt, { centre: home.position.map((v, k) => v + home.forward[k] * 0.4 * radius + (k === 1 ? 0.9 * radius : 0)), size: 1.2 * radius, color: palette.care.play });
      if (plan) drawAimTrace(out, view, plan, plan.landAt, time);
    },
  };
}
