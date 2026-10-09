import { PLAY_BALL } from "../keeper/items/play.js";
import { playBallAnatomy } from "../scene/care/playBall.js";
import { playConfetti } from "../scene/care/playConfetti.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { makeRng } from "../rng.js";
import { palette } from "../palette.js";
import { dragonReturns, flickOf, throwAim, throwMiss, volleyReach } from "./volleyballThrow.js";

const INTRO = 1.3,
  SERVE = 0.7,
  OVER = 1.8,
  CATCH_FROM = 0.75,
  FLOAT = 0.8,
  CATCH_UNTIL = 1.2,
  CATCH_REACH = 0.13,
  TAP = 0.2,
  FOLLOW = 22,
  LOOK = 9,
  GROWN = 0.055,
  SKY = 0.1,
  NEAR = 1.6,
  HAND_DEPTH = 2,
  TARGET = 16;

/** How far back the camera stands, past the play framing, for each age: wide-winged adults fill it sooner. */
const ZOOM = { kid: 1.6, teen: 1.45, adult: 1.25 };
const HOLD_POSE = { wrist: 0.15, twist: -0.9, curl: 0.42, thumb: 0.45, roll: -0.25 };
const OPEN_POSE = { wrist: 0.35, twist: -0.6, curl: 0.12, thumb: 0.15, spread: 0.35, roll: -0.15 };
const hitBurst = playConfetti("minigame:volleyball:hit", 14);

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => t * t * (3 - 2 * t);
const bump = (t, from, to) => (t > from && t < to ? Math.sin((Math.PI * (t - from)) / (to - from)) : 0);
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const along = (p, ...steps) => steps.reduce((q, [d, k]) => q.map((v, i) => v + d[i] * k), p);
/** How far along its path a ball heading for the keeper is `t` of its flight time in, slowing as it drops into reach and speeding on past it. */
const floated = (t) => (t < 1 ? t * (1 + FLOAT * (1 - t)) : 1 + (t - 1) * 1.2);
const distance = (a, b) => Math.hypot(...a.map((v, k) => v - b[k]));

/** Where bone `id` of the posed `racer` stands in the world. */
function boneAt(racer, id) {
  const index = racer.anatomy.bones.findIndex((b) => b.id === id);
  const model = multiply(orientation(racer.position, racer.forward, racer.bank ?? 0), transform(racer.anatomy.bones[0].position.map((v) => -v)));
  return point(multiply(model, boneMatrices(racer.anatomy, racer.pose)[index]), [0, 0, 0]);
}

/**
 * Play as volleyball: the keeper serves the ball to the dragon, which heads it back towards the
 * camera; a tap or a hold on the ball as it arrives catches it and a flick sends it back, its
 * strength and direction setting where it flies, so a wild throw is harder to reach and may be
 * whiffed. The rally ends when either side misses; every touch scores. `seed` sets where the dragon
 * aims and when it fumbles.
 * @param {{ anatomy: object, age: string, seed: string }} options
 */
export function createVolleyball({ anatomy, age, seed }) {
  const random = makeRng(seed);
  const size = anatomy.bounds.radius;
  const reach = volleyReach[age] ?? volleyReach.adult;
  const pointer = { down: false, x: 0, y: 0, downAt: -Infinity, trail: [] };
  /** @type {{ points: number, combo: number, x: number, y: number }[]} */
  const events = [];
  /** @type {{ at: number[], time: number }[]} */
  const bursts = [];
  let step = "serve",
    score = 0,
    time = 0,
    startAt = null,
    /** The ball in the air: `{ from, to, start, length, height, toward, hits, high }`, null while held. */
    flight = null,
    ballAt = null,
    held = true,
    throwAt = -Infinity,
    pendingThrow = null,
    hitAt = -Infinity,
    caughtAt = -Infinity,
    missAt = -Infinity,
    head = null,
    tip = null,
    handDepth = HAND_DEPTH,
    look = { yaw: 0, pitch: 0 },
    hand = null,
    screenBall = null,
    canvasHeight = 844;

  const now = () => (typeof performance === "undefined" ? time : performance.now() / 1000);

  /** A touch of the ball, by either side, scored where it happened on the canvas. */
  function touch(at) {
    score++;
    events.push({ points: 1, combo: 1, x: at.x, y: at.y });
  }

  /** Where the ball is `u` of the way along `flight`, rising `height` at the top of its arc and past the end slowing and dropping away; never under the grass. */
  function ballOn(f, u) {
    const past = Math.max(0, u - 1);
    const p = lerp(f.from, f.to, Math.min(u, 1) + 0.5 * past);
    const w = Math.min(u, 1) ** (f.skew ?? 1);
    p[1] = Math.max(ballRadius(), p[1] + 4 * f.height * w * (1 - w) - (f.height + size) * 4 * past * past);
    return p;
  }

  const ballRadius = () => GROWN * size;

  function launch(from, to, length, height, extra = {}) {
    flight = { from, to, start: time, length, height, ...extra };
    held = false;
  }

  /** The dragon heads the ball back towards a spot near the keeper, wider and quicker the longer the rally. */
  function headBack(view) {
    const spread = Math.min(0.42, 0.16 + 0.025 * score);
    const x = view.width * (0.5 + (random() - 0.5) * 2 * spread * 0.8);
    const y = view.height * (0.6 + (random() - 0.5) * spread * 0.55);
    const to = view.at(x, y, handDepth);
    launch(head.slice(), to, Math.max(0.95, 1.45 - 0.035 * score), (0.18 + 0.12 * random()) * size, { toward: "keeper", skew: 0.5 });
  }

  /** The keeper's flick `aim` sent off from the hand towards the dragon, judged as it leaves. */
  function throwBall(view, aim) {
    const miss = throwMiss(aim);
    const wild = Math.hypot(miss.across, miss.up);
    const hits = dragonReturns({ wild, reach, rally: score, roll: random() });
    const toward = view.eye.map((v, k) => (k === 1 ? 0 : v - head[k]));
    const n = Math.hypot(...toward) || 1;
    const short = Math.max(0, 1 - aim.power) * 0.8 * size;
    const to = along(head, [view.right, miss.across * size], [[0, 1, 0], miss.up * size], [toward.map((v) => v / n), short]);
    const from = tip ?? view.at(pointer.x, pointer.y, handDepth);
    launch(from, to, 0.85 + 0.25 * aim.power, (0.15 + 0.3 * aim.power) * size, { toward: "dragon", skew: 1.4, hits, high: Math.max(0, to[1] - head[1]) });
    throwAt = time;
    step = "catch";
  }

  /** Moves the ball on, the dragon returning it or missing and the keeper catching it or letting it by. */
  function fly(view) {
    if (!flight) return;
    const t = (time - flight.start) / flight.length;
    const u = flight.toward === "keeper" ? floated(t) : t;
    if (flight.toward === "dragon" && flight.hits) {
      const k = ease(clamp01((u - 0.45) / 0.55));
      ballAt = ballOn({ ...flight, to: lerp(flight.to, head, k) }, Math.min(1, u));
    } else ballAt = ballOn(flight, u);
    const seen = view.project(ballAt);
    const edge = view.project(along(ballAt, [view.right, PLAY_BALL.radius * scaleAt(view)]));
    screenBall = { x: seen.x, y: seen.y, r: Math.hypot(edge.x - seen.x, edge.y - seen.y) };
    if (step === "dropped" || step === "whiffed") return;
    if (flight.toward === "dragon" && u >= 1) {
      if (flight.hits) {
        hitAt = time;
        bursts.splice(0, bursts.length, ...bursts.filter((b) => time - b.time < 2), { at: head.slice(), time });
        touch(seen);
        if (step === "serve") step = "catch";
        return headBack(view);
      }
      [step, missAt] = ["whiffed", time];
      return;
    }
    if (flight.toward === "keeper") {
      const tapped = pointer.down || time - pointer.downAt < TAP;
      const reachPx = Math.max(CATCH_REACH * view.width, 1.6 * screenBall.r);
      if (t >= CATCH_FROM && t <= CATCH_UNTIL && tapped && Math.hypot(pointer.x - seen.x, pointer.y - seen.y) < reachPx) {
        [held, flight, caughtAt, step] = [true, null, time, "throw"];
        hand = { x: seen.x, y: seen.y };
        pointer.trail = [];
        touch(seen);
      } else if (t > CATCH_UNTIL) [step, missAt] = ["dropped", time];
    }
  }

  /** How much bigger than in the hand the ball is drawn at `ballAt`, growing with distance so it reads by the dragon at any age. */
  function scaleAt(view) {
    if (!ballAt || !head) return 1;
    const grown = (GROWN * size) / PLAY_BALL.radius;
    const k = clamp01((distance(ballAt, view.eye) - handDepth) / (Math.max(NEAR, NEAR * (grown - 1)) * handDepth));
    return 1 + (grown - 1) * k;
  }

  return {
    id: "volleyball",
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
    /** How long the rally ran, 0..1, full after `TARGET` touches. */
    get progress() {
      return Math.min(1, score / TARGET);
    },
    /** Where the ball in flight is on the canvas, `{ x, y, r }`, or null while it is held. */
    get ball() {
      return held || !screenBall ? null : screenBall;
    },
    takeEvents: () => events.splice(0),
    /** From the keeper's place before the dragon, a little to its left, with sky above it for the ball. */
    camera() {
      const [cx, cy, cz] = anatomy.bounds.center;
      return { side: 0.22, pitch: 0.08, zoom: ZOOM[age] ?? 1.4, focus: [cx, cy + SKY * size, cz] };
    },
    pointer({ type, x, y }) {
      const at = now();
      if (type === "down") {
        Object.assign(pointer, { down: true, x, y, downAt: time });
        pointer.trail = [{ x, y, time: at }];
      } else if (type === "move") {
        Object.assign(pointer, { x, y });
        if (pointer.down) pointer.trail = [...pointer.trail.filter((s) => at - s.time < 0.3), { x, y, time: at }];
      } else {
        pointer.down = false;
        if (step === "throw" && held) {
          const aim = throwAim(flickOf([...pointer.trail, { x, y, time: at }], at), canvasHeight);
          if (aim) pendingThrow = aim;
        }
      }
    },
    /** Moves the game on to `view.time`: the serve, the ball's flight, catches, throws and misses. */
    update(view) {
      time = view.time;
      canvasHeight = view.height;
      startAt ??= time;
      head = along(boneAt(view.dragon, "head"), [[0, 1, 0], 0.12 * size]);
      if (step === "serve" && held && time - startAt > INTRO + SERVE) {
        launch(tip ?? head, along(head, [[0, 1, 0], 0.05 * size]), 1.1, 0.45 * size, { toward: "dragon", skew: 1.4, hits: true, high: 0 });
        throwAt = time;
      }
      if (pendingThrow && held) {
        throwBall(view, pendingThrow);
        pendingThrow = null;
      }
      fly(view);
      if ((step === "dropped" || step === "whiffed") && time - missAt > OVER) [step, flight] = ["done", null];
      const target = held ? (tip ?? view.eye) : (ballAt ?? view.eye);
      const d = target.map((v, k) => v - head[k]);
      const f = view.dragon.forward,
        left = [-f[2], 0, f[0]];
      const ahead = d[0] * f[0] + d[2] * f[2],
        side = d[0] * left[0] + d[2] * left[2];
      const yaw = Math.max(-0.9, Math.min(0.9, 0.8 * Math.atan2(side, Math.max(0.1, ahead))));
      const pitch = Math.max(-0.5, Math.min(0.8, 0.8 * Math.atan2(d[1], Math.hypot(ahead, side))));
      const k = 1 - Math.exp(-LOOK * (view.dt ?? 0.016));
      look = { yaw: look.yaw + (yaw - look.yaw) * k, pitch: look.pitch + (pitch - look.pitch) * k };
    },
    /** The dragon watching the ball, bobbing for it, heading it off its brow, lunging after a wild one and flopping glumly, or crowing over a drop. */
    motion() {
      const toDragon = flight?.toward === "dragon" && step !== "whiffed";
      const arrive = toDragon ? flight.start + flight.length - time : Infinity;
      const sinceHit = time - hitAt,
        sinceMiss = time - missAt;
      const eager = flight?.toward === "dragon" ? 1 : 0;
      const wind = toDragon ? bump(arrive, -0.05, 0.3) : 0;
      const header = bump(sinceHit, 0, 0.35);
      const jump = toDragon ? Math.min(0.5 * size, flight.high) * bump(arrive, -0.1, 0.45) : 0;
      const whiffed = step === "whiffed";
      const lunge = whiffed ? bump(sinceMiss, -0.35, 0.3) : 0;
      const flop = whiffed ? clamp01((sinceMiss - 0.2) / 0.2) * (1 - clamp01((sinceMiss - 1.3) / 0.5)) : 0;
      const crow = step === "dropped" ? clamp01(sinceMiss / 0.3) : 0;
      const hops = step === "dropped" ? bump(sinceMiss % 0.45, 0, 0.4) : 0;
      return {
        impact: 0.15 * eager * Math.abs(Math.sin(time * 7)) + 0.5 * wind + 0.9 * flop + 0.3 * hops,
        stand: 1 - 0.3 * wind - 0.4 * lunge - 0.35 * flop,
        flare: Math.min(1, (2 * jump) / size + 0.9 * lunge),
        roar: 0.5 * bump(sinceHit, 0.05, 0.6) + 0.6 * crow + 0.4 * lunge,
        breathYaw: look.yaw + 0.35 * flop * Math.sin(time * 26) + 0.25 * crow * Math.sin(time * 9),
        breathPitch: look.pitch - 0.35 * wind + 0.45 * header - 0.4 * flop + 0.3 * crow,
        rise: jump + 0.4 * size * lunge * (flight?.high > 0 ? 1 : 0.4) + 0.08 * size * hops,
        glum: whiffed ? clamp01((sinceMiss - 0.5) / 0.4) : 0,
        glee: crow,
      };
    },
    /** The keeper's hand: holding the ball out to serve, open under the finger to catch, the ball in it to throw, flicking forward as it lets go. */
    hand(view) {
      if (step === "done") return null;
      const rest = { x: 0.62 * view.width, y: 0.66 * view.height };
      const target = pointer.down ? pointer : held || step === "serve" ? (hand ?? rest) : rest;
      hand ??= { ...rest };
      const k = 1 - Math.exp(-FOLLOW * (view.dt ?? 0.016));
      hand.x += (target.x - hand.x) * k;
      hand.y += (target.y - hand.y) * k;
      const sinceThrow = time - throwAt;
      const flick = bump(sinceThrow, 0, 0.35);
      const missed = step === "dropped" || step === "whiffed" ? clamp01((time - missAt) / 0.6) : 0;
      const reach = clamp01((time - (startAt ?? time)) / 0.5 - (INTRO - 0.5) / 0.5) * (1 - missed);
      const settle = clamp01((time - caughtAt) / 0.15);
      const pose = held ? HOLD_POSE : OPEN_POSE;
      return {
        ...pose,
        item: held ? "ball" : undefined,
        screen: [hand.x, hand.y - 30 * flick],
        anchor: PLAY_BALL.at,
        reach,
        wrist: pose.wrist + 0.9 * flick - 0.2 * (1 - settle),
        curl: pose.curl * (held ? settle : 1),
      };
    },
    /** The ball in flight, drawn bigger the further off it is. */
    objects(view) {
      if (view.tip) [tip, handDepth] = [view.tip, distance(view.tip, view.eye)];
      if (held || !ballAt) return [];
      const spin = time - (flight?.start ?? 0);
      return [{ anatomy: playBallAnatomy(), pose: { bones: { prop: { scale: scaleAt(view) } } }, position: ballAt, forward: [Math.cos(spin * 9), 0, Math.sin(spin * 9)], bank: spin * 6 }];
    },
    /** A pop of confetti off the dragon's brow at each header. */
    particles(out) {
      for (const b of bursts) hitBurst(out, time - b.time, { centre: b.at, size: 0.45 * size, color: palette.care.play });
    },
  };
}
