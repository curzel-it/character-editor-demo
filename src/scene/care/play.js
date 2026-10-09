import { PLAY_BALL } from "../../keeper/items/play.js";
import { multiply, orientation, point, transform } from "../../math3d.js";
import { playBallAnatomy } from "./playBall.js";
import { playConfetti } from "./playConfetti.js";

const RELEASE = 1,
  LAND = 1.6,
  SETTLE = 1.95,
  POUNCE = 2.25,
  BOUNCE = 2.8,
  GONE = 3.5,
  LENGTH = 4.1,
  LOOK = -1.4,
  HAND_DEPTH = 0.75,
  GROWN = 0.11,
  FLOOR = 0;

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => t * t * (3 - 2 * t);
const rise = (since, from, to) => ease(clamp01((since - from) / (to - from)));
const bump = (since, from, to) => (since > from && since < to ? Math.sin((Math.PI * (since - from)) / (to - from)) : 0);
const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const lerp = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const flat = (v) => unit([v[0], 0, v[2]]);
const along = (p, ...steps) => steps.reduce((q, [d, k]) => q.map((v, i) => v + d[i] * k), p);

const pounceBurst = playConfetti("care:play:pounce", 36);
const cheerBurst = playConfetti("care:play:cheer", 16);

/** The keeper's hand `since` seconds in: it shows the ball, winds back and throws it, then drops away. */
function handAt(since) {
  const reach = rise(since, 0, 0.4) * (1 - rise(since, 1.15, 1.6));
  if (reach <= 0) return null;
  const wind = rise(since, 0.4, 0.85),
    flick = rise(since, 0.85, 1),
    open = rise(since, 0.95, 1.08);
  const tease = 0.025 * Math.sin(since * 13) * (1 - wind);
  return {
    reach,
    item: since < RELEASE ? "ball" : undefined,
    at: [0.42 + tease + 0.1 * wind - 0.2 * flick, -0.72 - 0.16 * wind + 0.34 * flick],
    wrist: 0.15 - 0.65 * wind + 1.1 * flick,
    twist: -0.9,
    curl: 0.42 - 0.34 * open,
    thumb: 0.45 - 0.3 * open,
    spread: 0.3 * open,
    roll: -0.25,
  };
}

/** Where the ball in the keeper's hand is in the world, placed the way the yard places the hand. */
function heldBall(since, view) {
  const pose = handAt(since);
  const { ahead, right, up } = view;
  const forward = unit([0, 1, 2].map((k) => ahead[k] * 0.55 + up[k] * 0.75 - right[k] * 0.3));
  const depth = HAND_DEPTH / Math.min(1, view.aspect / 0.75);
  const low = -2.4 * (1 - ease(clamp01(pose.reach)));
  const wrist = view.place([pose.at[0], pose.at[1] + low], depth);
  const model = multiply(orientation(wrist, forward, pose.roll), transform([0, 0, 0], [pose.twist, 0, pose.wrist]));
  return point(model, PLAY_BALL.at);
}

/** A ball hopping from `from` to `to`, `u` of the way, `height` metres up at the middle. */
const hop = (from, to, u, height) => lerp(from, to, u).map((v, k) => (k === 1 ? v + 4 * height * u * (1 - u) : v));

/** A ball lobbed from `from` to `to`, `u` of the way, pulled up `height` metres past the middle. */
function lob(from, to, u, height) {
  const pull = lerp(from, to, 0.6).map((v, k) => (k === 1 ? v + height : v));
  return from.map((v, k) => (1 - u) ** 2 * v + 2 * u * (1 - u) * pull[k] + u * u * to[k]);
}

/**
 * Play: the keeper shows the dragon a ball and lobs it onto the ground before its chest; the dragon,
 * wings fluttering, turns to watch it, wiggles down and pounces on it with its wings flared in a
 * burst of confetti, the ball squirts out and bounces off past the camera and the dragon hops after it.
 */
export const play = {
  length: LENGTH,
  hand: handAt,
  motion(since) {
    const eager = rise(since, 0.1, 0.45) * (1 - rise(since, 1.4, 1.6));
    const wiggle = bump(since, 1.6, 2);
    const leap = bump(since, 1.95, 2.35);
    const thud = bump(since, 2.25, 2.7);
    const happy = rise(since, 2.6, 2.8) * (1 - rise(since, 3.6, 3.9));
    const hops = bump(since, 2.85, 3.2) + bump(since, 3.3, 3.65);
    return {
      impact: 0.25 * eager * Math.abs(Math.sin(since * 7)) + 0.85 * wiggle + 0.9 * thud + 0.35 * hops,
      stand: 1 - 0.4 * eager - 0.55 * leap - 0.2 * thud - 0.4 * happy,
      flare: 0.9 * leap,
      roar: 0.3 * eager + 0.6 * leap + 0.5 * bump(since, 2.9, 3.6),
      breathYaw: LOOK * (eager + happy * (0.6 + 0.3 * Math.sin(2 * Math.PI * 2.5 * (since - 2.6)))) + 0.25 * wiggle * Math.sin(since * 30),
      breathPitch: -0.5 * wiggle - 0.3 * thud,
      lift: 0.2 * leap + 0.07 * hops,
    };
  },
  objects(since, view) {
    if (since < RELEASE || since >= GONE) return [];
    const { dragon, eye } = view;
    const size = dragon.size;
    const grown = (GROWN * size) / PLAY_BALL.radius;
    const radius = GROWN * size;
    const toward = flat(eye.map((v, k) => v - dragon.position[k]));
    const chest = dragon.bone("chest");
    const floor = (p) => [p[0], FLOOR + radius, p[2]];
    const landing = floor(along(chest, [dragon.forward, 0.45 * size], [toward, 0.3 * size]));
    const rest = floor(along(chest, [dragon.forward, 0.38 * size], [toward, 0.18 * size]));
    const bounce = floor(along(rest, [dragon.forward, 0.9 * size], [toward, 0.5 * size]));
    const out = floor(along(bounce, [dragon.forward, 1.6 * size], [toward, 0.8 * size]));
    let position, scale, spin;
    if (since < LAND) {
      const u = (since - RELEASE) / (LAND - RELEASE);
      position = lob(heldBall(RELEASE - 1e-3, view), landing, u * u * 0.4 + u * 0.6, 0.45 * size);
      scale = 1 + (grown - 1) * Math.min(1, 1.5 * u);
      spin = since;
    } else if (since < SETTLE) {
      position = hop(landing, rest, (since - LAND) / (SETTLE - LAND), 0.25 * size);
      [scale, spin] = [grown, since];
    } else if (since < POUNCE) {
      position = rest;
      [scale, spin] = [grown, SETTLE];
    } else if (since < BOUNCE) {
      position = hop(rest, bounce, (since - POUNCE) / (BOUNCE - POUNCE), 0.4 * size);
      [scale, spin] = [grown, since - POUNCE + SETTLE];
    } else {
      position = hop(bounce, out, (since - BOUNCE) / (GONE - BOUNCE), 0.22 * size);
      [scale, spin] = [grown, since - POUNCE + SETTLE];
    }
    const squash = since >= POUNCE && since < POUNCE + 0.12 ? 1 - 0.3 * Math.sin((Math.PI * (since - POUNCE)) / 0.12) : 1;
    return [{ anatomy: playBallAnatomy(), pose: { bones: { prop: { scale: scale * squash } } }, position, forward: [Math.cos(spin * 9), 0, Math.sin(spin * 9)], bank: spin * 6 }];
  },
  particles(out, since, { centre, size, color }) {
    pounceBurst(out, since - POUNCE, { centre: [centre[0], centre[1] + 0.1 * size, centre[2]], size, color });
    cheerBurst(out, since - 2.9, { centre: [centre[0], centre[1] + 0.3 * size, centre[2]], size: 0.8 * size, color });
  },
};
