import { makeRng } from "../rng.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { add, dot, lerp, normalize, scale, sub } from "../vec3.js";
import { MEAT_AT } from "../keeper/items/feed.js";
import { meatAnatomy } from "../scene/care/feedMeat.js";
import { catchOutcome, catchSkill } from "./feedCatch.js";
import { createFeedSparks } from "./feedSparks.js";
import { throwArc } from "./throwArc.js";
import { drawAimTrace } from "./aimTrace.js";

const INTRO = 0.9,
  RISE = 0.35,
  FOLLOW = 18,
  MIN_DRAG = 24,
  PULL = 2.4,
  GRAVITY = 1.1,
  EAT = 1.1,
  REACH = 0.9,
  LEAP = { catch: 1, bonk: 0.75, head: 0.6, late: 0.85, short: 0.5, spin: 0.6 },
  FLOOR = 0,
  MISSES = 3,
  PIECES = 24,
  TARGET = 8,
  GRASS = 0.4,
  SWALLOW = 0.2,
  PICK = 0.15,
  CHEWED = 0.75,
  BOUNCE = 0.7,
  SIT = 0.8,
  SLIDE = 0.4,
  FALL = 0.4,
  ROLL = 0.3,
  DIP = 0.35,
  CHEW = 0.45,
  TWIST = 2.1;

/** How far the camera draws back from its play framing for each age, to leave air for the throw. */
const ZOOM = { kid: 2.3, teen: 2.1, adult: 1.9 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const ease = (t) => t * t * (3 - 2 * t);
const rise = (since, from, to) => ease(clamp((since - from) / (to - from), 0, 1));
const bump = (since, from, to) => (since > from && since < to ? Math.sin((Math.PI * (since - from)) / (to - from)) : 0);
const flat = (v) => normalize([v[0], 0, v[2]]);
const hop = (from, to, u, height) => lerp(from, to, u).map((v, k) => (k === 1 ? v + 4 * height * u * (1 - u) : v));
const chewing = (s) => (s > 0 ? 0.5 - 0.5 * Math.cos(2 * Math.PI * s / 0.24) : 0);

/** The posed dragon's mouth, nose, head top and chest in the world, its `left` and the rest-pose `focus` between its chest and head. */
function bodyOf(racer, size) {
  const { anatomy } = racer;
  const index = (id) => anatomy.bones.findIndex((b) => b.id === id);
  const model = multiply(orientation(racer.position, racer.forward, racer.bank ?? 0), transform(anatomy.bones[0].position.map((v) => -v)));
  const bones = boneMatrices(anatomy, racer.pose);
  const at = (id, local = [0, 0, 0]) => point(multiply(model, bones[index(id)]), local);
  const local = (id) => point(bones[index(id)], [0, 0, 0]);
  const forward = flat(racer.forward);
  const head = at("head");
  return {
    mouth: at("jaw", [0.06 * size, 0, 0]),
    nose: at("head", [0.12 * size, 0.02 * size, 0]),
    top: add(head, [0, 0.22 * size, 0]),
    head,
    chest: at("chest"),
    forward,
    left: [-forward[2], 0, forward[0]],
    focus: lerp(local("chest"), local("head"), 0.9),
  };
}

/**
 * Feed as a minigame: the keeper holds up a drumstick and a flick of the finger throws it, its
 * direction and strength setting where the arc meets the dragon, which snaps at it. A catch scores,
 * the chance of one falling off away from the mouth and lower for younger dragons (`age`); a miss
 * (bonked on the nose, a late chomp, the meat landing on its head or flying wide for a spin)
 * ends the streak and the meat is eaten off the grass instead, for less. The game ends at the
 * `MISSES`th miss or once `PIECES` have gone; `seed` decides the dragon's fumbles.
 * @param {{ age: string, seed: string }} options
 */
export function createFeed({ age, seed }) {
  const random = makeRng(seed);
  const skill = catchSkill[age] ?? catchSkill.adult;
  const sparks = createFeedSparks();
  /** The finger aiming a throw: where it touched down and where it is now, or null. */
  let drag = null,
    /** The throw the finger aims, drawn as a dotted arc and thrown as drawn when it lifts. */
    plan = null,
    released = false;
  /** @type {{ points: number, combo: number, x: number, y: number }[]} */
  const events = [];
  /** @type {any[]} */
  const throws = [];
  let step = "throw",
    phase = "intro",
    readyAt = 0,
    score = 0,
    streak = 0,
    misses = 0,
    grass = 0,
    pieces = 0,
    size = 0,
    body = null,
    heldAt = null,
    hand = null,
    release = null,
    time = 0,
    startAt = null;

  const current = () => throws.at(-1);

  /**
   * The throw the finger aims: from the meat in the hand along the drag from where it touched down,
   * scaled up, to a point as far off as the dragon's mouth, arcing there in a flight that grows with
   * the distance and carrying on down to the ground.
   */
  function planFor(view) {
    const tip = view.project(heldAt);
    const x = tip.x + PULL * (drag.now.x - drag.start.x),
      y = tip.y + PULL * (drag.now.y - drag.start.y);
    const aim = view.at(x, y, dot(sub(body.mouth, view.eye), view.ahead));
    const flight = clamp(0.7 + (0.12 * Math.hypot(...sub(aim, heldAt))) / size, 0.8, 1.3);
    return { aim, flight, arc: throwArc(heldAt, aim, flight, GRAVITY * size, FLOOR + 0.05 * size) };
  }

  /**
   * Throws the drumstick as `plan` says. Within reach of the mouth the dragon springs for it and
   * snaps it up or fumbles it; out of reach it comes down where its arc meets the ground, eaten off
   * the grass when it falls near enough and lost otherwise.
   */
  function launch(view, { aim, flight, arc }) {
    const reach = REACH * size;
    const off = sub(aim, body.mouth);
    const kind = catchOutcome({ lateral: dot(off, view.right) / reach, rise: off[1] / reach, skill, roll: random(), pick: random() });
    const side = Math.sign(dot(off, body.left)) || 1;
    const groundAt = (p) => [p[0], FLOOR + 0.05 * size, p[2]];
    const home = groundAt(lerp(body.chest, body.mouth, 0.8));
    const toward = flat(sub(view.eye, body.mouth));
    const falls = kind === "short" || kind === "spin";
    const lost = falls && Math.hypot(arc.land[0] - home[0], arc.land[2] - home[2]) > EAT * size;
    const land = falls ? arc.land : kind === "late" ? add(groundAt(aim), scale(toward, 0.2 * size)) : home;
    const rest = falls ? land : add(home, scale(body.left, clamp(dot(sub(land, home), body.left), -0.3 * size, 0.3 * size)));
    const landed = lost ? Infinity : falls ? arc.landAt : { catch: flight, bonk: flight + BOUNCE, head: flight + SIT + SLIDE }[kind] ?? flight + FALL + ROLL;
    const t = {
      at: time,
      from: heldAt,
      aim,
      kind,
      flight,
      arc,
      falls,
      lost,
      side,
      look: [0.9 * clamp(dot(off, body.left) / (0.5 * size), -1, 1), 0.7 * clamp(off[1] / (0.5 * size), -1, 1)],
      land,
      rest,
      landed,
      bite: landed + DIP,
      end: kind === "catch" ? flight + CHEWED : lost ? Math.max(flight, Math.min(arc.landAt, 2.5)) + 0.6 : landed + DIP + CHEW,
      wrist: hand?.wrist ?? 0.15,
      leap: leapFor(off, reach, LEAP[kind], view),
      scored: false,
    };
    throws.push(t);
    if (throws.length > 3) throws.shift();
    pieces++;
    phase = "flight";
  }

  /**
   * How far the dragon springs to meet a piece passing `off` from its mouth: across the view and up,
   * never down nor towards the camera, `share` of the way and at most its `reach`.
   */
  function leapFor(off, reach, share, view) {
    const across = scale(view.right, dot(off, view.right) * share);
    const up = Math.max(0, off[1]) * share;
    const shift = [across[0], up, across[2]];
    const length = Math.hypot(...shift);
    return length > reach ? scale(shift, reach / length) : shift;
  }

  /** How far into its spring the dragon is for throw `t`, `s` seconds in: up to it as the piece nears, back down after. */
  const leapOf = (t, s) => rise(s, 0.35 * t.flight, 0.95 * t.flight) * (1 - rise(s, t.flight + 0.2, t.flight + 0.8));

  /** Settles the current throw as it reaches its moments: the catch, the bite off the grass and the end. */
  function settle(view) {
    const t = current();
    if (!t) return;
    const s = time - t.at;
    if (t.kind === "catch" && s >= t.flight && !t.scored) {
      t.scored = true;
      score++;
      streak++;
      sparks.burst("crumbs", time, body.mouth, size);
      sparks.burst("glints", time, body.mouth, size);
      const at = view.project(body.mouth);
      events.push({ points: 1, combo: 1, x: at.x, y: at.y });
    }
    if (t.kind === "bonk" && s >= t.flight && !t.bonked) {
      t.bonked = true;
      sparks.burst("stars", time, () => body.top, size);
    }
    if (t.kind !== "catch" && s >= t.flight && !t.missed) {
      t.missed = true;
      streak = 0;
      misses++;
      step = t.lost ? "lost" : "grass";
    }
    if (t.kind !== "catch" && s >= t.bite && !t.scored) {
      t.scored = true;
      grass++;
      sparks.burst("crumbs", time, body.mouth, size);
    }
    if (phase === "flight" && s >= (t.kind === "catch" ? t.flight + 0.35 : t.end)) {
      if (misses >= MISSES || pieces >= PIECES) [phase, step] = ["over", "done"];
      else [phase, readyAt, step] = ["ready", time, misses === MISSES - 1 ? "last" : "throw"];
    }
  }

  /** Where the drumstick of throw `t` is at `s` seconds in, with how far it has grown towards the dragon, or null once eaten. */
  function meatAt(t, s, view) {
    const along = clamp(s / t.flight, 0, 1);
    if (s < t.flight) {
      const position = t.arc.at(s);
      const goal = { catch: body.mouth, bonk: body.nose, head: body.top }[t.kind];
      const k = goal ? rise(along, 0.5, 1) : 0;
      return { position: goal ? lerp(position, goal, k) : position, grow: along, swallow: 0 };
    }
    if (t.falls && (s < t.arc.landAt || t.lost)) return { position: t.arc.at(Math.min(s, t.arc.landAt)), grow: 1, swallow: 0 };
    const u = s - t.flight;
    if (t.kind === "catch") return u < SWALLOW ? { position: add(body.mouth, scale(body.forward, -0.1 * size * u / SWALLOW)), grow: 1, swallow: u / SWALLOW } : null;
    if (s >= t.bite + SWALLOW) return null;
    if (s >= t.bite - PICK) return { position: lerp(t.rest, body.mouth, rise(s, t.bite - PICK, t.bite)), grow: 1, swallow: clamp((s - t.bite) / SWALLOW, 0, 1) };
    if (s >= t.landed) return { position: t.rest, grow: 1, swallow: 0 };
    if (t.kind === "bonk") return { position: hop(t.hit ??= body.nose, t.rest, u / BOUNCE, 0.45 * size), grow: 1, swallow: 0 };
    if (t.kind === "head") return { position: u < SIT ? body.top : hop(t.perch ??= body.top, t.rest, (u - SIT) / SLIDE, 0.1 * size), grow: 1, swallow: 0 };
    if (t.falls) return { position: t.land, grow: 1, swallow: 0 };
    if (u < FALL) return { position: hop(t.aim, t.land, (u / FALL) ** 1.5, 0.08 * size), grow: 1, swallow: 0 };
    return { position: hop(t.land, t.rest, (u - FALL) / ROLL, 0.12 * size), grow: 1, swallow: 0 };
  }

  /** How throw `t` moves the dragon `s` seconds in. */
  function moves(t, s) {
    const f = t.flight;
    const [yaw, pitch] = t.look;
    const out = { lookYaw: 0, lookPitch: 0, roar: 0, impact: 0, stand: 0, bank: 0, crouch: 0, glum: 0, glee: 0, flare: 0.8 * leapOf(t, s) * Math.min(1, t.leap[1] / (0.3 * size)) };
    const track = rise(s, 0.1 * f, 0.9 * f) * (1 - rise(s, f + 0.15, f + 0.6));
    if (t.kind === "catch") {
      out.lookYaw = yaw * track;
      out.lookPitch = pitch * track;
      out.roar = 0.8 * rise(s, 0.45 * f, 0.92 * f) * (1 - rise(s, f - 0.02, f + 0.06)) + 0.18 * chewing(s - f - 0.12) * (s < f + CHEWED ? 1 : 0);
      out.impact = 0.5 * bump(s, f - 0.02, f + 0.3);
      out.stand = 0.2 * bump(s, 0.5 * f, f + 0.2);
      out.glee = rise(s, f, f + 0.15) * (1 - rise(s, f + CHEWED, f + CHEWED + 0.6));
      return out;
    }
    const after = s - f;
    const cheer = t.lost ? t.end : t.bite - PICK;
    out.glum = rise(s, f + 0.15, f + 0.5) * (1 - rise(s, cheer - 0.3, cheer + 0.3));
    if (t.kind === "bonk") {
      const daze = after > 0 ? Math.exp(-2.5 * after) : 0;
      out.lookYaw = yaw * track + 0.3 * daze * Math.sin(14 * after);
      out.lookPitch = pitch * track + 0.6 * (after > 0 ? Math.exp(-6 * after) * Math.min(1, after * 30) : 0);
      out.roar = 0.6 * rise(s, 0.85 * f, f) * (1 - rise(s, f, f + 0.05));
      out.impact = 0.9 * bump(s, f, f + 0.35);
    } else if (t.kind === "late") {
      const lunge = bump(s, f + 0.1, f + 0.5);
      out.lookYaw = yaw * (track + 0.5 * lunge);
      out.lookPitch = pitch * track;
      out.roar = 0.8 * rise(s, 0.6 * f, f) * (1 - rise(s, f + 0.18, f + 0.24));
      out.impact = 0.5 * bump(s, f + 0.18, f + 0.5);
      out.stand = 0.25 * lunge;
    } else if (t.kind === "head") {
      const up = rise(s, f, f + 0.15) * (1 - rise(s, f + SIT, f + SIT + 0.3));
      out.lookYaw = yaw * track + 0.12 * up * Math.sin(9 * after);
      out.lookPitch = pitch * track + 0.7 * up;
      out.roar = 0.35 * up;
      out.impact = 0.6 * bump(s, f, f + 0.25);
    } else if (t.kind === "spin") {
      const whip = rise(s, 0.5 * f, f + 0.25) * (1 - rise(s, f + 0.6, f + 1));
      out.lookYaw = yaw * track + t.side * 1.3 * whip;
      out.lookPitch = pitch * track;
      out.bank = 0.18 * t.side * bump(s, f, f + 0.8);
      out.impact = 0.8 * bump(s, f + 0.15, f + 0.6);
      out.stand = 0.3 * bump(s, f, f + 0.7);
      out.roar = 0.5 * bump(s, 0.6 * f, f + 0.2);
    } else {
      out.lookYaw = yaw * track;
      out.lookPitch = pitch * track - 0.5 * bump(s, f - 0.2, f + 0.6);
      out.roar = 0.3 * bump(s, 0.5 * f, f + 0.3);
    }
    const dip = rise(s, t.landed - 0.15, t.bite) * (1 - rise(s, t.bite + 0.15, t.end));
    const keep = 1 - dip;
    out.lookYaw = out.lookYaw * keep + dip * 0.6 * clamp(dot(sub(t.rest, body.mouth), body.left) / (0.5 * size), -1, 1);
    out.lookPitch = out.lookPitch * keep - 0.75 * dip;
    out.crouch = 0.55 * dip;
    out.roar = out.roar * keep + 0.6 * bump(s, t.landed, t.bite + 0.05) + 0.2 * chewing(s - t.bite - 0.1) * (s < t.end ? 1 : 0);
    return out;
  }

  return {
    id: "feed",
    action: "feed",
    get score() {
      return score;
    },
    get step() {
      return step;
    },
    get done() {
      return phase === "over" && time - (current()?.at ?? time) >= (current()?.end ?? 0);
    },
    /** How full the dragon is, 0..1: each catch counts, each piece eaten off the grass a little. */
    get progress() {
      return Math.min(1, (score + GRASS * grass) / TARGET);
    },
    takeEvents: () => events.splice(0),
    /** A three-quarter view from in front of the dragon, framing its head and the air before it. */
    camera() {
      return { side: 0.35, pitch: 0.12, zoom: ZOOM[age] ?? 1.2, focus: body?.focus };
    },
    pointer({ type, x, y }) {
      if (type === "down") drag = { start: { x, y }, now: { x, y } };
      else if (type === "move" && drag) drag.now = { x, y };
      else if (drag) {
        drag.now = { x, y };
        released = true;
      }
    },
    /** Moves the game on to `view.time`: the finger aims a throw and lifting it throws, and the throw in the air plays out. */
    update(view) {
      time = view.time;
      if (startAt === null) [startAt, readyAt] = [time, time + INTRO];
      if (!size) size = Math.max(0.5, bodyOf(view.dragon, 1).head[1] - FLOOR);
      const posed = bodyOf(view.dragon, size);
      body = { ...posed, focus: body?.focus ?? posed.focus };
      if (phase === "intro" && time >= readyAt) phase = "ready";
      const aiming = drag && phase === "ready" && heldAt && time - readyAt > RISE * 0.6 && Math.hypot(drag.now.x - drag.start.x, drag.now.y - drag.start.y) > MIN_DRAG;
      plan = aiming ? planFor(view) : null;
      if (released) {
        if (plan) {
          release = { x: hand?.x ?? 0, y: hand?.y ?? 0, at: time };
          launch(view, plan);
        }
        [drag, plan, released] = [null, null, false];
      }
      settle(view);
      sparks.update(time);
    },
    /** The dragon's spot shifted by its spring towards the pieces in the air. */
    place(spot) {
      const shift = throws.reduce((sum, t) => add(sum, scale(t.leap, leapOf(t, time - t.at))), [0, 0, 0]);
      return { position: add(spot.position, shift), forward: spot.forward };
    },
    /** The dragon tracking the meat, snapping at it, beaming over a catch, crestfallen at a fumble and eating it off the grass. */
    motion() {
      const sum = { lookYaw: 0, lookPitch: 0, roar: 0, impact: 0, stand: 1, bank: 0, crouch: 0, flare: 0, glum: 0, glee: 0 };
      for (const t of throws) {
        const m = moves(t, time - t.at);
        sum.lookYaw += m.lookYaw;
        sum.lookPitch += m.lookPitch;
        sum.roar = Math.max(sum.roar, m.roar);
        sum.impact = Math.min(1, sum.impact + m.impact);
        sum.stand -= m.stand;
        sum.bank += m.bank;
        sum.crouch = Math.max(sum.crouch, m.crouch);
        sum.flare = Math.max(sum.flare, m.flare);
        sum.glum = Math.max(sum.glum, m.glum);
        sum.glee = Math.max(sum.glee, m.glee);
      }
      sum.stand = clamp(sum.stand, 0.5, 1);
      return sum;
    },
    /**
     * The keeper's hand: a drumstick held up at rest, following the finger while it is down; let go
     * with a flick, the hand snaps open and drops away, and comes back up with the next piece.
     */
    hand(view) {
      if (phase === "over" && time - (current()?.at ?? 0) > 0.5) return null;
      const rest = { x: 0.72 * view.width, y: 0.66 * view.height };
      const holding = phase === "ready" || phase === "intro";
      const pull = drag && holding ? { x: rest.x - 0.12 * (drag.now.x - drag.start.x), y: rest.y - 0.12 * (drag.now.y - drag.start.y) } : rest;
      const target = !holding && release ? release : pull;
      hand ??= { ...rest, vy: 0, wrist: 0.15 };
      const k = 1 - Math.exp(-FOLLOW * (view.dt ?? 0.016));
      const dy = (target.y - hand.y) * k;
      hand.x += (target.x - hand.x) * k;
      hand.y += dy;
      hand.vy += (dy / Math.max(1e-3, view.dt ?? 0.016) - hand.vy) * 0.3;
      if (holding) {
        const reach = rise(time - readyAt, 0, RISE);
        hand.wrist = 0.15 + clamp(hand.vy / 2500, -0.6, 0.5);
        return { item: "drumstick", screen: [hand.x, hand.y], anchor: MEAT_AT, reach, wrist: hand.wrist, twist: TWIST, curl: 0.78, thumb: 0.75, roll: -0.25 };
      }
      const s = time - (current()?.at ?? time);
      const open = rise(s, 0, 0.12);
      return { screen: [hand.x, hand.y], anchor: MEAT_AT, reach: 1 - rise(s, 0.2, 0.55), wrist: 0.15 + 0.5 * rise(s, 0, 0.08) - 0.2 * open, twist: TWIST - 0.6 * open, curl: 0.78 - 0.68 * open, thumb: 0.75 - 0.6 * open, spread: 0.3 * open, roll: -0.25 };
    },
    /** The drumsticks in the air or on the grass and the crumbs of bites; reads where the hand holds the meat, `view.tip`. */
    objects(view) {
      if ((phase === "ready" || phase === "intro") && view.tip) heldAt = view.tip;
      const forward = normalize(add(add(scale(view.ahead, 0.55), scale(view.up, 0.75)), scale(view.right, -0.3)));
      const meat = throws.flatMap((t) => {
        const s = time - t.at;
        const m = body && meatAt(t, s, view);
        if (!m) return [];
        const grow = 1 + Math.max(0, (0.17 * size) / 0.14 - 1) * m.grow;
        const turn = 9 * Math.min(s, t.flight) + (s > t.flight && s < t.landed ? 6 * (s - t.flight) : 0);
        return [{ anatomy: meatAnatomy, pose: { bones: { hand: { rotation: [TWIST + 0.4 * turn, 0, t.wrist + turn], scale: grow * (1 - m.swallow * m.swallow) } } }, position: m.position, forward, bank: -0.25 }];
      });
      return [...meat, ...sparks.objects(time, view.dragon.forward)];
    },
    /** The sparks of bites and bonks, and the aimed throw's arc dotted down to where it lands. */
    particles(out, view) {
      sparks.draw(out, time);
      if (plan) drawAimTrace(out, view, plan.arc, Math.min(plan.arc.landAt, 3 * plan.flight), time);
    },
  };
}
