import { createSceneRenderer, shotMatrix } from "../scene.js";
import { createStableYard } from "../scene/stableYard.js";
import { lowestPoint } from "../scene/groundContact.js";
import { poseOutline } from "../scene/poseOutline.js";
import { breathCloseUp } from "../scene/breathCloseUp.js";
import { withTack } from "../jockey/withTack.js";
import { restingMotion } from "../dragonThumbnails.js";
import { terrainHeight } from "../course/terrainHeight.js";
import { groundEgg } from "./groundEgg.js";
import { ageOf } from "../dragonAge.js";
import { breathCue, breathLength } from "../breath/breathCue.js";
import { breathOf } from "../breath/breathElements.js";
import { careReactions } from "../scene/careReactions.js";
import { createBillboards } from "../scene/billboards.js";
import { palette } from "../palette.js";
import { yawnOf } from "../animate/dragonYawn.js";
import { individualSeed } from "../animate/flightNoise.js";
import { drawYawnPuff, yawnPuff, YAWN_PUFF_LIFE } from "../scene/yawnPuff.js";
import { createKeeperHand } from "../keeper/keeperHand.js";
import { keeperHandPose } from "../keeper/keeperHandPose.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { swapLength, swapRacers, swapTimes } from "./yardSwap.js";
import { barnMoves, glideShot, orbitShot } from "./barnMoves.js";
import { turnedBy } from "../scene/yardSet.js";
import { clearOfBlockers, hidesTarget, riseOverBlockers } from "../scene/cameraClearance.js";
import { renderDensity } from "../renderDensity.js";
import { cross, dot } from "../vec3.js";

const SOLE = 0.02,
  MOODS = ["glum", "weary", "bored"],
  MOOD_EASE = 3,
  MAX_PIXELS = 2560 * 1440,
  TAP_SLOP = 8,
  TURN = Math.PI,
  TILT = 0.75 * Math.PI,
  PITCH_MIN = -0.35,
  PITCH_MAX = 1.55,
  PITCH = 0.14,
  COAST = 4,
  RETURN = 6,
  ZOOM_MIN = 0.3,
  ZOOM_EASE = 12,
  BARN_FADE = 0.5,
  BARN_MARGIN = 1.5,
  SCREEN_MARGIN = 0.3,
  BARN_PACE = 5,
  WHEEL = 0.0015,
  PAN_REACH = 0.8,
  CAMERA_FLOOR = 0.3,
  NEAR = 0.3,
  FILL_WIDTH = 0.76,
  FILL_HEIGHT = 0.86,
  EGG_FILL = 0.6,
  EYE = 0.8,
  FOV = 0.86,
  GROWTH = 0.5,
  PORTRAIT_REACH = 1.35,
  PLUME_REACH = 2.2,
  CLOSE_UP_ASPECT = 0.8,
  CLOSE_UP_FILL = 0.65,
  CLOSE_UP_AHEAD = 0.25,
  CLOSE_UP_PITCH = 0.04,
  REVEAL = 3,
  JOLT = 1.2,
  HOP = 0.9,
  GLOW_IN = 0.9,
  FLICKER = 2.8,
  HOLD = 0.25,
  GLOW_OUT = 1,
  CLOSE = 0.78,
  ZOOM_OUT = 3.2,
  SLEEP_TIME = 1.6,
  SLEEP_FILL = 0.72,
  TAKEOFF = 3,
  TAKEOFF_LIFT = 0.5,
  TAKEOFF_TURN = 1.4,
  CLIMB = 6,
  CRUISE = 9,
  TAKEOFF_BACK = 5,
  TAKEOFF_ANGLES = [0, 0.5, -0.5, 1, -1, 1.5, -1.5, 2, -2],
  HAND_DEPTH = 0.75,
  PLAY_HAND_DEPTH = 1.3,
  PLAY_FILL = 1.2,
  KEEP_FILL = 0.85,
  PLAY_BLEND = 1.3,
  PLAY_TURN = 2.4,
  PLAY_PAN = 3;
// Each style's resting view: the orbit's pitch and the lens; Cozy looks down on its curving world like a diorama.
const VIEWS = { plain: { pitch: PITCH, fov: FOV }, cozy: { pitch: 0.24, fov: 0.76 } };

const REVEAL_AT = GLOW_IN + FLICKER + HOLD;

/**
 * Share of the frame an age fills: the body's true size to the power `GROWTH`, so kids read small
 * and each later age grows by less. Portrait screens push every age closer and let adults overflow.
 */
function ageFill(age, aspect) {
  const portrait = Math.max(0, Math.min(1, (1 - aspect) / 0.55));
  return ageOf(age).size ** GROWTH * mix(1, PORTRAIT_REACH, portrait);
}

const ease = (t) => t * t * (3 - 2 * t);
const unit = (v) => {
  const n = Math.hypot(...v) || 1;
  return v.map((x) => x / n);
};
const along = (p, ...steps) => steps.reduce((q, [d, k]) => q.map((v, i) => v + d[i] * k), p);
const mix = (a, b, t) => a + (b - a) * t;

/** A cracking egg's roll: a jolt dying away after each crack over a shiver that quickens with the cracks. */
function eggRock(entry, time) {
  const since = time - (entry.crackAt ?? -Infinity);
  const jolt = since < JOLT ? 0.35 * Math.exp(-5 * since) * Math.sin(26 * since) : 0;
  const cracks = entry.cracks ?? 0;
  return { roll: jolt + 0.04 * cracks * Math.sin(time * (8 + 4 * cracks)), lift: since < 0.3 ? 0.25 * entry.radius * Math.sin((Math.PI * since) / 0.3) : 0 };
}

/**
 * Where a change, a hatching or a growth, stands `since` seconds in: the old look glowing white, then
 * old and new trading places ever faster, a held white new look and its colour coming back.
 * `before` tells which one shows.
 */
function changePhase(since) {
  if (since < GLOW_IN) return { before: true, glow: ease(since / GLOW_IN) };
  const u = (since - GLOW_IN) / FLICKER;
  if (u < 1) return { before: Math.sin(2 * Math.PI * (2 * u + 5 * u * u)) > 0, glow: 1 };
  const out = (since - REVEAL_AT) / GLOW_OUT;
  return { before: false, glow: out < 0 ? 1 : Math.max(0, 1 - ease(Math.min(1, out))) };
}

/** A new look's bounces, lower each time, as a height over the ground. */
function hopHeight(entry, time) {
  const since = time - (entry.hopAt ?? -Infinity);
  return since >= 0 && since < HOP ? 0.35 * entry.anatomy.bounds.radius * (1 - since / HOP) * Math.abs(Math.sin((2 * Math.PI * since) / HOP)) : 0;
}

/** `outline` stretched ahead of its snout by a breath plume's reach. */
function withPlume(outline, forward, radius) {
  const snout = outline.reduce((best, p) => (p[0] * forward[0] + p[2] * forward[2] > best[0] * forward[0] + best[2] * forward[2] ? p : best));
  const tip = snout.map((v, k) => v + forward[k] * PLUME_REACH * radius);
  return [...outline, tip, [tip[0], tip[1] + 0.5 * radius, tip[2]], [tip[0], Math.max(0, tip[1] - 0.5 * radius), tip[2]]];
}

/**
 * The stable set with one egg or dragon on its spot at a time, seen through a camera that orbits it:
 * bringing on another swaps them over, the one there flying (or hopping) off as the other flies (or
 * hops) in. A drag turns the camera round freely, the barn fading out while it stands in the way, the quicker the faster the camera moves, and
 * tilts it from just under the subject to straight above it, coasting on after release. The wheel or a
 * pinch moves the camera in on it, down to `ZOOM_MIN` of its framing, and two fingers dragged together
 * pan it, until another is brought on.
 * `onFocus(index)` reports the entry on the spot as it changes, `onTap()` a tap without a drag.
 * `frameArea(index)` gives the canvas band `{ top, bottom }` left free for entry `index`.
 * A dragon for which `asleep(item)` holds lies curled up asleep, easing down and up as it changes.
 * `face(item)` gives the moods an idle dragon shows in its eyes (see `dragonExpression.js`); a `bored`
 * one yawns now and then, calling `yawned(item)` as each yawn opens, and breathes out a puff as it shuts.
 * `keeper()` gives the owner, whose hand reaches in to care for a dragon.
 */
export function createYardStage(module, slots, { onFocus, onTap, frameArea, asleep, face, keeper, yawned }) {
  const canvas = Object.assign(document.createElement("canvas"), { className: "yard-stage" });
  canvas.setAttribute("aria-hidden", "true");
  const yard = createStableYard(slots);
  let renderer = null,
    entries = [],
    style = "cozy",
    view = VIEWS.cozy,
    running = false,
    shown = 0,
    swap = null,
    /** The entry standing at the front of the barn, if any. */
    frontEntry = null,
    /** Where the entry shown stands, as the camera last framed it. */
    shownSite = null,
    pan = [0, 0],
    panTarget = [0, 0],
    reach = 1,
    focused = -1,
    yaw = 0,
    pitch = PITCH,
    spin = [0, 0],
    homing = false,
    flier = null,
    /** The id of the dragon held in its breath framing, or null. */
    wide = null,
    drag = null,
    pinch = null,
    zoom = 1,
    zoomTarget = 1,
    previous = 0,
    barnOpacity = 1,
    /** Each of the yard's screens' opacity, fading out while it stands in the camera's way. */
    screenOpacity = yard.course.screens.map(() => 1),
    lastEye = null,
    lastCamera = null,
    hand = null,
    /** The minigame being played on the dragon in view, `{ entry, game, view }`, or null. */
    playing = null,
    /** How far the camera has moved into a minigame's framing, 0..1, and the entry and free band it frames. */
    playMix = 0,
    playFrame = null,
    /** Where the camera's orbit homes to: the front view, or the side a minigame looks from. */
    home = { yaw: 0, pitch: PITCH };
  const touches = new Map();

  const sleepTarget = (entry) => (!entry.egg && asleep?.(entry.item) ? 1 : 0);

  /** Ground-level outline of an entry lying asleep, built on first need. */
  function sleepOutline(entry) {
    if (!entry.sleepOutline) {
      const pose = module.pose(entry.anatomy, 0, { ...restingMotion, time: 0, sleep: 1, sleepSide: 1 });
      const forward = yard.spots[0].forward;
      entry.sleepOutline = poseOutline(entry.anatomy, pose, [0, SOLE - lowestPoint(entry.anatomy, pose, [0, 0, 0], forward), 0], forward);
    }
    return entry.sleepOutline;
  }

  /** Whether the canvas is narrow enough that a breath is shown close on the head, from the side. */
  const closeUp = () => canvas.clientWidth / Math.max(1, canvas.clientHeight) < CLOSE_UP_ASPECT;

  /** The points a breath framing keeps: the head and the plume's first stretch on narrow screens, else the whole dragon and its plume. */
  function breathOutline(entry) {
    if (!entry?.plumeOutline || !closeUp()) return entry?.plumeOutline;
    entry.closeUpOutline ??= breathCloseUp(module, entry.anatomy, yard.spots[0].forward, SOLE, restingMotion);
    return entry.closeUpOutline;
  }

  const FRONT = { origin: [0, 0, 0], turn: 0, turned: false, key: "front" };

  /** Where `entry` stands: at the front of the barn, or, a dragon asleep, on its bed at the barn's left end. */
  function siteOf(entry) {
    if (!entry || entry.egg || !sleepTarget(entry) || !yard.beds.length) return FRONT;
    const sleepers = entries.filter((other) => !other.egg && sleepTarget(other));
    const index = sleepers.indexOf(entry) % yard.beds.length;
    const { position, turn } = yard.beds[index];
    return { origin: position, turn, turned: true, key: `bed:${index}` };
  }

  /** A point framed at the front spot carried onto `site`: turned round to face its way and set on its bed. */
  function onSite(site, p) {
    if (!site.turned) return p;
    const [x, z] = turnedBy([p[0], p[2]], site.turn);
    return [site.origin[0] + x, site.origin[1] + p[1], site.origin[2] + z];
  }
  const turnedTo = (site, v) => (site.turned ? (([x, z]) => [x, v[1], z])(turnedBy([v[0], v[2]], site.turn)) : v);
  const spotOf = (site) => ({ position: onSite(site, yard.spots[0].position), forward: turnedTo(site, yard.spots[0].forward) });
  const placed = (shot, site) => ({ ...shot, eye: onSite(site, shot.eye), target: onSite(site, shot.target) });

  const tacked = (dragon, age) => withTack(module.createAnatomy(dragon.genome, { age }), { harness: dragon.harness !== false });

  /** Unit offset from the subject towards the camera at the current orbit. */
  const orbit = () => [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];

  /**
   * Where the camera sits for an entry so its outline, seen from the current orbit, fills its age's
   * share of the free band between `frameArea(index)`'s `top` and `bottom` (canvas pixels); a minigame's
   * framing (`playShot`) fills nearly all of the band the game leaves free, or, when the game names what
   * it must keep in view, holds those points well inside it.
   */
  function framing(entry, index, look = "shot") {
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    const play = look === "playShot";
    const area = play ? playFrame?.area?.() : frameArea?.(index);
    const top = Math.max(0, area?.top ?? 0),
      bottom = Math.min(h, area?.bottom ?? h);
    const key = `${w}:${h}:${top}:${bottom}:${yaw}:${pitch}:${view.fov}`;
    if (entry?.[look]?.key === key) return entry[look];
    const band = Math.max(0.2, (bottom - top) / h);
    const shift = 1 - (top + bottom) / h;
    const breath = look === "breathShot",
      near = breath && closeUp();
    const points = (breath ? breathOutline(entry) : look === "sleepShot" ? sleepOutline(entry) : play ? playFrame?.outline : null) ?? entry?.outline ?? [[-2, 0, -2], [2, 4, 2]];
    const min = [0, 1, 2].map((k) => points.reduce((v, p) => Math.min(v, p[k]), Infinity)),
      max = [0, 1, 2].map((k) => points.reduce((v, p) => Math.max(v, p[k]), -Infinity));
    const centre = min.map((v, k) => (v + max[k]) / 2);
    const kept = (play && !!playFrame?.outline) || near;
    const height = kept ? centre[1] : centre[1] * EYE;
    const target = [centre[0], height, centre[2]];
    const toward = orbit();
    const hull = Math.hypot(...max.map((v, k) => (v - min[k]) / 2));
    const reach = hull + 1;
    let distance = 3 * Math.max(max[0] - min[0], max[1] - min[1]);
    for (let n = 0; n < 6; n++) {
      const m = shotMatrix({ eye: target.map((v, k) => v + toward[k] * distance), target, fov: view.fov, shift }, w / h);
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const p of points) {
        const [x, y, cw] = [0, 1, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
        x0 = Math.min(x0, x / cw);
        x1 = Math.max(x1, x / cw);
        y0 = Math.min(y0, y / cw);
        y1 = Math.max(y1, y / cw);
      }
      const fill = near ? CLOSE_UP_FILL : kept ? KEEP_FILL : play ? PLAY_FILL : entry?.egg ? EGG_FILL : entry ? ageFill(entry.age, w / h) * (look === "sleepShot" ? SLEEP_FILL : 1) : 1;
      distance *= Math.max((x1 - x0) / (2 * FILL_WIDTH * fill), (y1 - y0) / (2 * FILL_HEIGHT * fill * band));
      distance = Math.max(distance, reach);
    }
    const shot = { key, x: centre[0], z: centre[2], distance, hull: hull + 2 * NEAR, look: height, shift };
    if (entry) entry[look] = shot;
    return shot;
  }

  const blend = (a, b, k) => Object.fromEntries(Object.keys(a).map((name) => [name, name === "key" ? a.key : mix(a[name], b[name], k)]));

  /**
   * The entry's framing, lowered onto it as it lies down, eased out to take in its breath plume while
   * `entry.reveal` rises, held close through a change and eased into a minigame's framing as it starts.
   */
  function framed(entry, index) {
    let shot = framing(entry, index);
    if (playMix > 0 && entry && entry === playFrame?.entry) {
      const play = framing(entry, index, "playShot");
      return blend(shot, { ...play, distance: play.distance * (playFrame.zoom ?? 1) }, ease(playMix));
    }
    if (entry?.sleep) shot = blend(shot, framing(entry, index, "sleepShot"), ease(entry.sleep));
    if (entry?.change) {
      const zoom = Math.max(0, Math.min(1, (performance.now() / 1000 - entry.change.at - REVEAL_AT) / ZOOM_OUT));
      if (zoom >= 1) delete entry.change;
      else shot = { ...shot, distance: shot.distance * mix(CLOSE, 1, ease(zoom)) };
    }
    const k = ease(entry?.reveal ?? 0);
    if (!k || !entry.plumeOutline) return shot;
    return blend(shot, framing(entry, index, "breathShot"), k);
  }

  /**
   * The camera on the spot, framing entry `a` (or easing from `a`'s framing to `b`'s by `k`, drawn
   * back a little midway to take both in), turned by the orbit and moved by the pan.
   */
  function shotOf(a, b = a, k = 1) {
    const t = ease(k),
      lift = Math.sin(Math.PI * k);
    const framedAt = mix(a.distance, b.distance, t);
    const distance = Math.max(framedAt * zoom, Math.min(framedAt, mix(a.hull, b.hull, t))) * (1 + 0.3 * lift);
    const [sx, , sz] = yard.spots[0].position;
    const x = sx + mix(a.x, b.x, t),
      z = sz + mix(a.z, b.z, t),
      look = mix(a.look, b.look, t);
    const toward = orbit();
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)],
      up = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
    const moved = [0, 1, 2].map((k) => right[k] * pan[0] + up[k] * pan[1]);
    const target = [x + moved[0], look + lift * distance * 0.03 + moved[1], z + moved[2]];
    const eye = [0, 1, 2].map((k) => target[k] + toward[k] * distance);
    eye[1] = Math.max(CAMERA_FLOOR + terrainHeight(yard.course.terrain, eye[0], eye[2]), eye[1]);
    reach = Math.tan(view.fov / 2) * distance;
    return { eye, target, fov: view.fov, near: NEAR, shift: mix(a.shift, b.shift, t) };
  }

  /** The live shot framing `entry` at entry `index`'s place on `site`. */
  const shotOn = (entry, index, site) => placed(shotOf(framed(entry, index)), site);

  /** Seconds a swap lasts. */
  const swapEnd = (move) => (move.kind === "fly" ? swapLength(move.to) : barnMoves[move.kind]);

  /**
   * The camera: framing the entry shown where it stands, through a flying swap at the front easing
   * from the leaver's framing to the newcomer's, round the barn between its front and the sleeping
   * side, or gliding from one bed to another.
   */
  function shotAt(time) {
    if (!swap) return shotOn(entries[shown], shown, siteOf(entries[shown]));
    const since = time - swap.at;
    if (swap.kind === "fly") return shotOf(framed(swap.from, swap.fromIndex), framed(swap.to, swap.toIndex), Math.min(1, since / swapTimes.framed));
    const from = shotOn(swap.from, swap.fromIndex, swap.fromSite),
      to = shotOn(swap.to, swap.toIndex, swap.toSite);
    return swap.kind === "orbit" ? orbitShot(yard.blockers[0], from, to, since) : glideShot(from, to, since);
  }

  /** Starts the camera's move from `from` on `fromSite` to `to` on `toSite`: a flight at the front, a turn round the barn or a glide between beds. */
  function move(from, fromIndex, fromSite, to, toIndex, toSite) {
    const kind = fromSite.turned !== toSite.turned ? "orbit" : toSite.turned ? "glide" : "fly";
    swap = { kind, from, fromIndex, fromSite, to, toIndex, toSite, at: performance.now() / 1000 };
    shownSite = toSite;
  }

  function resize() {
    const density = renderDensity();
    let w = Math.round(canvas.clientWidth * density),
      h = Math.round(canvas.clientHeight * density);
    const cap = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
    if (cap < 1) {
      w = Math.round(w * cap);
      h = Math.round(h * cap);
    }
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
    return w && h;
  }

  /** Where the dragon leaving for the wild is `since` seconds into its take-off, and its pose. */
  function takeoffRacer({ entry, spot }, since) {
    const u = since / TAKEOFF,
      r = entry.anatomy.bounds.radius,
      stand = 1 - ease(Math.min(1, since / TAKEOFF_LIFT));
    const pose = module.pose(entry.anatomy, since % 1, { ...restingMotion, time: since, glide: 0, effort: 0.8, climb: 1, stand });
    const ground = (SOLE - lowestPoint(entry.anatomy, pose, spot.position, spot.forward)) * stand;
    const ahead = CRUISE * r * u * u,
      height = ground + CLIMB * r * u ** 1.6;
    const position = [spot.position[0] + spot.forward[0] * ahead, spot.position[1] + height, spot.position[2] + spot.forward[2] * ahead];
    return { anatomy: entry.anatomy, pose, position, forward: spot.forward };
  }

  /** Where to watch the leaving dragon from: low on the ground behind it, turned round it as little as keeps the barn out of the way of its climb. */
  function takeoffEye(flier) {
    const { entry, spot } = flier,
      r = entry.anatomy.bounds.radius;
    const aims = [0, TAKEOFF].map((since) => takeoffShot(takeoffRacer(flier, Math.min(since, TAKEOFF - 1e-3)), flier).target);
    const eyes = TAKEOFF_ANGLES.map((angle) => {
      const [dx, dz] = turnedBy([-spot.forward[0], -spot.forward[2]], angle);
      const x = spot.position[0] + dx * TAKEOFF_BACK * r,
        z = spot.position[2] + dz * TAKEOFF_BACK * r;
      return [x, CAMERA_FLOOR + terrainHeight(yard.course.terrain, x, z) + 0.3 * r, z];
    });
    const clear = (eye) => aims.every((target) => riseOverBlockers({ eye, target }, yard.blockers)?.eye === eye && !hidesTarget({ eye, target }, yard.blockers, BARN_MARGIN));
    return eyes.find(clear) ?? eyes[0];
  }

  /** The camera on the leaving dragon from `flier.eye`, tilting up to follow it. */
  function takeoffShot(racer, flier) {
    const r = flier.entry.anatomy.bounds.radius;
    return { eye: flier.eye, target: racer.position.map((v, k) => v + (k === 1 ? 0.3 * r : 0)), fov: view.fov, near: NEAR };
  }

  /** The camera `k` of the way from `flier.from` to `shot`, its eye swinging round the spot rather than through the dragon. */
  function takeoffTurn(flier, shot, k) {
    const [cx, , cz] = flier.spot.position;
    const polar = ([x, y, z]) => [Math.atan2(z - cz, x - cx), Math.hypot(x - cx, z - cz), y];
    const [a0, d0, y0] = polar(flier.from.eye),
      [a1, d1, y1] = polar(shot.eye);
    const angle = a0 + Math.atan2(Math.sin(a1 - a0), Math.cos(a1 - a0)) * k,
      distance = mix(d0, d1, k);
    const eye = [cx + Math.cos(angle) * distance, mix(y0, y1, k), cz + Math.sin(angle) * distance];
    return { ...shot, eye, target: shot.target.map((v, n) => mix(flier.from.target[n], v, k)), shift: flier.from.shift };
  }

  /** The motion of the care reaction the entry is playing, if any and awake. */
  function careMotion(entry, time) {
    const since = time - (entry.care?.at ?? -Infinity);
    if (!entry.care || since < 0 || since >= entry.care.reaction.length) return {};
    return entry.sleep ? {} : entry.care.reaction.motion(since);
  }

  /** How freely the entry idles, 1 at rest: none while a care reaction plays, easing back after it. */
  function idleOf(entry, time) {
    if (!entry.care) return 1;
    const since = time - entry.care.at,
      length = entry.care.reaction.length;
    if (since < 0) return 1;
    return since < length ? 1 - ease(Math.min(1, since / 0.3)) : ease(Math.min(1, (since - length) / 0.8));
  }

  /** Starts `reaction` on `entry` at `at` seconds, its particles in `color`. */
  function react(entry, reaction, at, color) {
    const ys = entry.outline.map((p) => p[1]);
    const xs = entry.outline.map((p) => p[0]),
      zs = entry.outline.map((p) => p[2]);
    const mid = (v) => (Math.min(...v) + Math.max(...v)) / 2;
    const centre = [mid(xs), 0.6 * Math.max(...ys), mid(zs)];
    entry.care = { at, reaction, centre, size: 0.6 * Math.max(...ys), color };
  }

  /** The keeper's hand for the owner as they look now, holding `item`, rebuilt when either changes. */
  function keeperHand(item) {
    const owner = keeper?.();
    if (!owner) return null;
    const key = `${owner.look?.skin}:${item ?? ""}`;
    if (hand?.key !== key) hand = { key, anatomy: createKeeperHand(owner, item) };
    return hand.anatomy;
  }

  /**
   * What a care reaction sees: the camera's `eye` and unit `ahead`, `right` and
   * `up`, `place([x, y], depth)`, the world point `depth` metres ahead at `x` across the view and `y`
   * up the band left free over the subject (-1..1, left to right and bottom to top), and the dragon as `dragon.position`, `forward`, `size`
   * and `bone(id)`, where bone `id` of its posed body is in the world.
   */
  function careView(entry, camera, size = entry.care.size) {
    const ahead = unit(camera.target.map((v, n) => v - camera.eye[n]));
    const right = unit([-ahead[2], 0, ahead[0]]);
    const up = [right[1] * ahead[2] - right[2] * ahead[1], right[2] * ahead[0] - right[0] * ahead[2], right[0] * ahead[1] - right[1] * ahead[0]];
    const aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight);
    const tan = Math.tan(camera.fov / 2);
    const h = Math.max(1, canvas.clientHeight);
    const area = frameArea?.(focused) ?? { top: 0, bottom: h };
    const row = (y) => 1 - (2 * (area.bottom - ((y + 1) / 2) * (area.bottom - area.top))) / h;
    const place = ([x, y], depth) => along(camera.eye, [ahead, depth], [right, x * depth * tan * aspect], [up, (row(y) - (camera.shift ?? 0)) * depth * tan]);
    const posed = entry.posed;
    const bone = (id) => {
      const index = posed.anatomy.bones.findIndex((b) => b.id === id);
      const model = multiply(orientation(posed.position, posed.forward), transform(posed.anatomy.bones[0].position.map((v) => -v)));
      return point(multiply(model, boneMatrices(posed.anatomy, posed.pose)[index]), [0, 0, 0]);
    };
    return { eye: camera.eye, ahead, right, up, aspect, place, dragon: { position: posed.position, forward: posed.forward, size, bone } };
  }

  /**
   * What a minigame sees: `careView`'s, the posed dragon in full as `dragon`, the canvas `width` and
   * `height` in CSS pixels, `project(p)` the canvas `{ x, y, front }` of world point `p` and `at(x, y, depth)`
   * the world point `depth` metres ahead under canvas point `x`, `y`, and `vista` the unit heading from
   * the dragon's spot out over the open grassland.
   */
  function playView(entry, camera, time, dt) {
    const view = careView(entry, camera, 0);
    const width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    const matrix = shotMatrix(camera, width / height);
    const tan = Math.tan(camera.fov / 2);
    const project = (p) => {
      const [x, y, w] = [0, 1, 3].map((r) => matrix[r] * p[0] + matrix[4 + r] * p[1] + matrix[8 + r] * p[2] + matrix[12 + r]);
      return { x: ((x / w + 1) / 2) * width, y: ((1 - y / w) / 2) * height, front: w > 0 };
    };
    const at = (x, y, depth) =>
      along(camera.eye, [view.ahead, depth], [view.right, (2 * x / width - 1) * depth * tan * view.aspect], [view.up, (1 - (2 * y) / height - (camera.shift ?? 0)) * depth * tan]);
    return { ...view, dragon: entry.posed, width, height, time, dt, project, at, vista: yard.vista };
  }

  /** Where point `local` of the keeper's hand bone is in the world for the hand `racer`. */
  function handPoint(racer, local) {
    const bones = boneMatrices(racer.anatomy, racer.pose);
    const index = racer.anatomy.bones.findIndex((b) => b.id === "hand");
    return point(multiply(orientation(racer.position, racer.forward, racer.bank ?? 0), bones[index]), local);
  }

  /** Turns the whole frame of the hand `racer` by `angle` about the unit `axis`. */
  function turnHand(racer, axis, angle) {
    const cos = Math.cos(angle),
      sin = Math.sin(angle);
    const turn = (v) => {
      const kv = cross(axis, v);
      return v.map((x, i) => x * cos + kv[i] * sin + axis[i] * dot(axis, v) * (1 - cos));
    };
    const frame = orientation([0, 0, 0], racer.forward, racer.bank ?? 0);
    const up = turn([frame[4], frame[5], frame[6]]);
    racer.forward = turn([frame[0], frame[1], frame[2]]);
    const level = orientation([0, 0, 0], racer.forward, 0);
    racer.bank = Math.atan2(dot(up, [level[8], level[9], level[10]]), dot(up, [level[4], level[5], level[6]]));
  }

  /**
   * Turns the hand `racer` so the `tipAxis` at its `anchor` points at `aimAt`, rolled about that line
   * to lean its fingers `rise` as far as it can.
   */
  function aimHand(racer, { anchor, tipAxis, aimAt }, rise) {
    const toward = () => {
      const tip = handPoint(racer, anchor);
      return [unit(handPoint(racer, anchor.map((v, k) => v + tipAxis[k])).map((v, k) => v - tip[k])), unit(aimAt.map((v, k) => v - tip[k]))];
    };
    for (let pass = 0; pass < 3; pass++) {
      const [from, to] = toward();
      const axis = cross(from, to);
      const sin = Math.hypot(...axis);
      if (sin > 1e-4) turnHand(racer, axis.map((v) => v / sin), Math.atan2(sin, dot(from, to)));
      if (pass) continue;
      const flat = (v) => unit(v.map((x, k) => x - to[k] * dot(v, to)));
      const [have, want] = [flat(racer.forward), flat(rise)];
      turnHand(racer, to, Math.atan2(dot(to, cross(have, want)), dot(have, want)));
    }
  }

  /**
   * The keeper's hand as a minigame holds it: its `anchor` on the hand bone (the wrist when none)
   * under canvas point `screen`, lowered out of view as `reach` falls; the anchor's world point becomes `view.tip`,
   * and the way its `tipAxis` (a direction on the hand bone) points in the world `view.tipAxis`, turned at
   * `aimAt` when given with its knuckles leaning `lean` ([right, up, ahead] in view).
   */
  function playHandRacer(pose, view) {
    const anatomy = keeperHand(pose.item);
    if (!anatomy) return null;
    const { ahead, right, up } = view;
    const forward = unit(along([0, 0, 0], [ahead, 0.55], [up, 0.75], [right, -0.3]));
    const depth = PLAY_HAND_DEPTH / Math.min(1, view.aspect / 0.75);
    const low = 0.6 * view.height * (1 - ease(Math.max(0, Math.min(1, pose.reach ?? 1))));
    const target = view.at(pose.screen[0], pose.screen[1] + low, depth);
    const racer = { anatomy, pose: keeperHandPose(pose), position: target, forward, bank: pose.roll ?? 0 };
    if (pose.anchor && pose.tipAxis && pose.aimAt) aimHand(racer, pose, pose.lean ? along([0, 0, 0], [right, pose.lean[0]], [up, pose.lean[1]], [ahead, pose.lean[2]]) : forward);
    if (pose.anchor) {
      const tip = handPoint(racer, pose.anchor);
      racer.position = target.map((v, k) => 2 * v - tip[k]);
      view.tip = handPoint(racer, pose.anchor);
      view.tipAxis = pose.tipAxis ? unit(handPoint(racer, pose.anchor.map((v, k) => v + pose.tipAxis[k])).map((v, k) => v - view.tip[k])) : null;
    } else [view.tip, view.tipAxis] = [target, null];
    return racer;
  }

  /**
   * The pan that brings `focus`, a point of the dragon at `entry` in its rest pose, to the middle of the
   * frame, held where the dragon first stood in the game however it hops or moves off its spot.
   */
  function panTo(entry, focus) {
    const racer = entry.posed;
    if (!racer) return panTarget;
    const [x, , z] = yard.spots[0].position;
    playFrame.ground ??= racer.position[1];
    const at = point(multiply(orientation([x, playFrame.ground, z], yard.spots[0].forward), transform(racer.anatomy.bones[0].position.map((v) => -v))), focus);
    const shot = framed(entry, shown);
    const d = [at[0] - yard.spots[0].position[0] - shot.x, at[1] - shot.look, at[2] - yard.spots[0].position[2] - shot.z];
    const right = [Math.cos(yaw), 0, -Math.sin(yaw)],
      up = [-Math.sin(pitch) * Math.sin(yaw), Math.cos(pitch), -Math.sin(pitch) * Math.cos(yaw)];
    return [0, 1].map((n) => [right, up][n].reduce((sum, v, k) => sum + v * d[k], 0));
  }

  /** The orbit that looks at the dragon's `side` (1 its left) from `ahead` of it, `pitch` up. */
  function sideOrbit(side, pitch, ahead = 0.55) {
    const f = yard.spots[0].forward;
    const d = [-f[2] * side * 0.85 + f[0] * ahead, f[0] * side * 0.85 + f[2] * ahead];
    return { yaw: Math.atan2(d[0], d[1]), pitch };
  }

  /**
   * The keeper's hand held up before the camera, miming the care in the air towards the dragon as
   * the reaction's `hand(since)` says, or null when it is out of view: its wrist `at` a `place` in
   * view, further off on narrow screens, the forearm leaning in from below and the palm to the dragon.
   */
  function handRacer(entry, since, view) {
    const pose = entry.care.reaction.hand?.(since);
    const anatomy = pose && keeperHand(pose.item);
    if (!anatomy) return null;
    const { ahead, right, up } = view;
    const forward = unit(along([0, 0, 0], [ahead, 0.55], [up, 0.75], [right, -0.3]));
    const depth = HAND_DEPTH / Math.min(1, view.aspect / 0.75);
    const [across = 0, rise = 0] = pose.at ?? [];
    const low = -2.4 * (1 - ease(Math.max(0, Math.min(1, pose.reach))));
    return { anatomy, pose: keeperHandPose(pose), position: view.place([across, rise + low], depth), forward, bank: pose.roll ?? 0 };
  }

  /** The particles of every care reaction playing, for the scene's `fireworks` slot. */
  const careShow = {
    build(time, eye) {
      const out = createBillboards(eye);
      if (playing?.view) playing.game.particles(out, playing.view);
      entries.forEach((entry, i) => {
        const since = time - (entry.care?.at ?? -Infinity);
        if (!entry.care || since < 0 || since >= entry.care.reaction.length) return;
        const { centre, size, color } = entry.care;
        const at = onSite(siteOf(entry), [0, 1, 2].map((k) => yard.spots[0].position[k] + centre[k]));
        entry.care.reaction.particles?.(out, since, { centre: at, size, color });
      });
      for (const entry of entries) if (entry.yawn?.puff && time - entry.yawn.puff.born < YAWN_PUFF_LIFE) drawYawnPuff(out, entry.yawn.puff, time);
      return out.result();
    },
  };

  /** Entry `entry` (the `i`th) posed at `spot`: an egg rocking, a dragon standing, breathing, cared for or asleep. */
  function posed(entry, i, spot, time) {
    if (entry.egg) {
      const { roll, lift } = eggRock(entry, time);
      const game = playing?.entry === entry ? playing.game.motion(time) : null;
      const racer = { anatomy: entry.anatomy, pose: { bones: {} }, position: [spot.position[0], entry.radius + lift + (game?.lift ?? 0) * entry.radius, spot.position[2]], forward: spot.forward, bank: roll + (game?.roll ?? 0) };
      if (game) {
        entry.posed = racer;
        Object.assign(racer, { glow: game.glow, glowColor: game.glowColor });
      }
      return racer;
    }
    const phase = entry.change ? changePhase(time - entry.change.at) : null;
    const from = entry.change?.from;
    if (phase?.before && from.egg) {
      const { roll, lift } = eggRock(from, time);
      return { anatomy: from.anatomy, pose: { bones: {} }, position: [spot.position[0], from.radius + lift, spot.position[2]], forward: spot.forward, bank: roll, glow: phase.glow };
    }
    const anatomy = phase?.before ? from.anatomy : entry.anatomy;
    const t = time + i * 0.37;
    const age = time - (entry.breathAt ?? -Infinity);
    const cue = age < breathLength && !phase?.before ? breathCue(age) : null;
    const sleep = entry.sleep && !phase?.before ? { sleep: entry.sleep, sleepSide: 1 } : null;
    const played = playing?.entry === entry;
    const { lift: hop = 0, rise = 0, ...care } = played ? playing.game.motion(time) : careMotion(entry, time);
    const idle = cue || played || phase ? 0 : idleOf(entry, time);
    const motion = { ...restingMotion, time: t, idle, ...entry.face, ...cue, ...care, ...sleep };
    const pose = module.pose(anatomy, t % 1, motion);
    const size = entry.care?.size ?? (played && hop ? 0.6 * Math.max(...entry.outline.map((p) => p[1])) : 0);
    const at = (played && playing.game.place?.(spot)) || spot;
    const lift = SOLE - lowestPoint(anatomy, pose, [at.position[0], spot.position[1], at.position[2]], at.forward) + hopHeight(entry, time) + hop * size + rise;
    const racer = { anatomy, pose, position: [at.position[0], at.position[1] + lift, at.position[2]], forward: at.forward };
    if (entry.care || played) entry.posed = racer;
    if (played) racer.coat = playing.game.coat;
    if (cue) racer.breath = { element: breathOf(entry.anatomy.genome), strength: cue.breath };
    if (phase) racer.glow = phase.glow;
    const yawn = idle > 0 ? yawnOf(anatomy, motion, t, individualSeed(anatomy.genome)) : null;
    if (yawn && yawn.gape > 0.1 && entry.yawn?.id !== yawn.id) {
      entry.yawn = { id: yawn.id };
      yawned?.(entry.item);
    }
    if (yawn?.exhale > 0 && entry.yawn && !entry.yawn.puff) entry.yawn.puff = yawnPuff(racer, 0.15 * Math.max(...entry.outline.map((p) => p[1])), time);
    return racer;
  }

  /** Every sleeping dragon on its bed, and at the front the one standing there or a flying swap's two. */
  function racers(time) {
    const since = swap ? time - swap.at : 0;
    if (swap && since >= swapEnd(swap)) swap = null;
    const flying = swap?.kind === "fly";
    const swapping = flying && !flier ? swapRacers(module, swap, spotOf(FRONT), since) : [];
    return entries
      .map((entry, i) => {
        if (flier?.entry === entry) return null;
        const site = siteOf(entry);
        if (flier && !site.turned) return null;
        if (site.turned) return posed(entry, i, spotOf(site), time);
        return !flying && entry === frontEntry ? posed(entry, i, spotOf(FRONT), time) : null;
      })
      .filter(Boolean)
      .concat(swapping);
  }

  function frame(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - previous) / 1000 || 0);
    previous = now;
    playMix = Math.max(0, Math.min(1, playMix + ((playing ? 1 : -1) * dt) / PLAY_BLEND));
    const settling = playMix > 0 && playMix < 1;
    zoom += (zoomTarget - zoom) * (1 - Math.exp(-ZOOM_EASE * dt));
    pan = pan.map((v, k) => v + (panTarget[k] - v) * (1 - Math.exp(-(settling ? PLAY_PAN : ZOOM_EASE) * dt)));
    if (playing) {
      const { side, heading, pitch: tilt, zoom: near, focus, keep } = playing.game.camera();
      if (keep && !playFrame.outline) {
        const [x, , z] = yard.spots[0].position;
        playFrame.outline = keep.map((p) => [p[0] - x, p[1], p[2] - z]);
        delete playing.entry.playShot;
      }
      home = heading ? { yaw: Math.atan2(-heading[0], -heading[2]), pitch: tilt } : sideOrbit(side, tilt);
      playFrame.zoom = near;
      [homing, zoomTarget, panTarget] = [true, 1, focus ? panTo(playing.entry, focus) : [0, 0]];
    } else if (wide !== null) home = closeUp() ? sideOrbit(-1, CLOSE_UP_PITCH, CLOSE_UP_AHEAD) : { yaw: 0, pitch: view.pitch };
    if (homing) {
      const back = 1 - Math.exp(-(settling ? PLAY_TURN : RETURN) * dt);
      const off = Math.atan2(Math.sin(yaw - home.yaw), Math.cos(yaw - home.yaw));
      yaw -= off * back;
      pitch += (home.pitch - pitch) * back;
      if (!playing && Math.abs(off) + Math.abs(pitch - home.pitch) < 1e-3) [yaw, pitch, homing] = [home.yaw, home.pitch, false];
    } else if (!drag && (spin[0] || spin[1])) {
      turn(spin[0] * dt, spin[1] * dt);
      const fade = Math.exp(-COAST * dt);
      spin = spin.map((v) => (Math.abs(v) * fade < 0.01 ? 0 : v * fade));
    }
    for (const entry of entries) {
      const cared = entry.care && now / 1000 - entry.care.at < entry.care.reaction.length;
      const mood = entry.egg || entry.change || cared || playing?.entry === entry ? null : face?.(entry.item);
      entry.face = Object.fromEntries(MOODS.map((id) => [id, (entry.face?.[id] ?? 0) + ((mood?.[id] ?? 0) - (entry.face?.[id] ?? 0)) * (1 - Math.exp(-MOOD_EASE * dt))]));
      const rest = sleepTarget(entry);
      if (entry.sleep !== rest) entry.sleep = Math.max(0, Math.min(1, (entry.sleep ?? 0) + Math.sign(rest - (entry.sleep ?? 0)) * (dt / SLEEP_TIME)));
      const breathing = entry.item.id === wide || now / 1000 - (entry.breathAt ?? -Infinity) < breathLength;
      entry.reveal = Math.max(0, Math.min(1, (entry.reveal ?? 0) + (breathing ? 1 : -0.6) * REVEAL * dt));
    }
    if (shown !== focused && entries.length) {
      focused = shown;
      onFocus(shown);
    }
    const here = siteOf(entries[shown]);
    if (!swap && entries[shown] && shownSite && here.key !== shownSite.key) move(entries[shown], shown, shownSite, entries[shown], shown, here);
    else if (!swap) shownSite = here;
    if (!here.turned && entries[shown]) frontEntry = entries[shown];
    if (resize()) {
      renderer ??= createSceneRenderer(canvas);
      const list = racers(now / 1000);
      const shot = shotAt(now / 1000);
      let camera = shot;
      const caring = entries[focused];
      const since = now / 1000 - (caring?.care?.at ?? -Infinity);
      if (playing?.entry.posed) {
        const view = playView(playing.entry, camera, now / 1000, dt);
        playing.game.update(view);
        const pose = playing.game.hand(view);
        const keeperRacer = pose && playHandRacer(pose, view);
        if (keeperRacer) list.push(keeperRacer);
        list.push(...(playing.game.objects?.(view) ?? []));
        playing.view = view;
      } else if (caring?.posed && since < caring.care.reaction.length) {
        const view = careView(caring, camera);
        const keeperRacer = handRacer(caring, since, view);
        if (keeperRacer) list.push(keeperRacer);
        list.push(...(caring.care.reaction.objects?.(since, view) ?? []));
      }
      if (flier) {
        const since = Math.max(0, now / 1000 - flier.at);
        if (since >= TAKEOFF) flier = null;
        else {
          const racer = takeoffRacer(flier, since);
          const shot = takeoffShot(racer, flier);
          camera = clearOfBlockers(takeoffTurn(flier, shot, ease(Math.min(1, since / TAKEOFF_TURN))), yard.blockers);
          list.push(racer);
        }
      }
      const pace = lastEye && dt ? Math.max(1, Math.hypot(...camera.eye.map((v, k) => v - lastEye[k])) / dt / BARN_PACE) : 1;
      lastEye = camera.eye;
      lastCamera = camera;
      const faded = (opacity, hidden) => Math.max(0, Math.min(1, opacity + ((hidden ? -dt : dt) * pace) / BARN_FADE));
      barnOpacity = faded(barnOpacity, hidesTarget(camera, yard.blockers, BARN_MARGIN));
      screenOpacity = yard.course.screens.map(({ footprint }, i) => faded(screenOpacity[i], hidesTarget(camera, [footprint], SCREEN_MARGIN)));
      renderer.render({ course: yard.course, racers: list, camera, buildingOpacity: barnOpacity, screenOpacity, style, time: now / 1000, fireworks: { show: careShow, t: now / 1000 } });
    }
    requestAnimationFrame(frame);
  }

  function turn(dYaw, dPitch) {
    yaw = (yaw + dYaw) % (2 * Math.PI);
    pitch = Math.max(PITCH_MIN, Math.min(PITCH_MAX, pitch + dPitch));
  }

  const setZoom = (next) => (zoomTarget = Math.max(ZOOM_MIN, Math.min(1, next)));
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
  };
  const middle = () => {
    const [a, b] = [...touches.values()];
    return [(a.x + b.x) / 2, (a.y + b.y) / 2];
  };
  /** Pans the camera by a two-finger drag of `dx`, `dy` pixels, keeping the subject within reach of the frame. */
  function panBy(dx, dy) {
    const perPixel = (2 * reach) / Math.max(1, canvas.clientHeight);
    const limit = PAN_REACH * reach;
    panTarget = [panTarget[0] - dx * perPixel, panTarget[1] + dy * perPixel].map((v) => Math.max(-limit, Math.min(limit, v)));
  }

  /** Hands a pointer event to the minigame being played, in canvas pixels; true when one took it. */
  function toGame(type, e) {
    if (!playing) return false;
    const box = canvas.getBoundingClientRect();
    if (type === "down") canvas.setPointerCapture(e.pointerId);
    playing.game.pointer({ type, x: e.clientX - box.left, y: e.clientY - box.top });
    return true;
  }

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    if (playing) return;
    setZoom(zoomTarget * Math.exp(e.deltaY * (e.deltaMode ? 30 : 1) * WHEEL));
  }, { passive: false });
  canvas.addEventListener("pointerdown", (e) => {
    if (toGame("down", e)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size === 2) {
      pinch = { from: spread(), zoom: zoomTarget, at: middle() };
      if (drag) drag.moved = true;
      spin = [0, 0];
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (drag) return;
    drag = { x: e.clientX, y: e.clientY, moved: false, lastX: e.clientX, lastY: e.clientY, lastT: e.timeStamp, id: e.pointerId };
    spin = [0, 0];
    homing = false;
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    if (toGame("move", e)) return;
    if (touches.has(e.pointerId)) touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch) {
      if (touches.size === 2) {
        setZoom((pinch.zoom * pinch.from) / spread());
        const at = middle();
        panBy(at[0] - pinch.at[0], at[1] - pinch.at[1]);
        pinch.at = at;
      }
      return;
    }
    if (!drag || e.pointerId !== drag.id) return;
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > TAP_SLOP) drag.moved = true;
    if (!drag.moved) return;
    const dYaw = (-(e.clientX - drag.lastX) / Math.max(1, canvas.clientWidth)) * TURN,
      dPitch = ((e.clientY - drag.lastY) / Math.max(1, canvas.clientHeight)) * TILT;
    turn(dYaw, dPitch);
    const dt = Math.max(1, e.timeStamp - drag.lastT) / 1000;
    spin = [mix(spin[0], dYaw / dt, 0.5), mix(spin[1], dPitch / dt, 0.5)];
    drag.lastX = e.clientX;
    drag.lastY = e.clientY;
    drag.lastT = e.timeStamp;
  });
  function release(e) {
    if (toGame("up", e)) return;
    touches.delete(e.pointerId);
    if (touches.size < 2) pinch = null;
    const rest = drag && touches.get(drag.id);
    if (rest) [drag.lastX, drag.lastY, drag.lastT] = [rest.x, rest.y, e.timeStamp];
    if (!drag || e.pointerId !== drag.id) return;
    const { moved, lastT } = drag;
    drag = null;
    if (!moved) return onTap?.();
    if (e.timeStamp - lastT > 80) spin = [0, 0];
  }
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  return {
    el: canvas,
    /**
     * Stands `items` at the spots in order: `{ id, egg, genes }` for an egg, a dragon otherwise.
     * Anatomy is rebuilt only for entries whose look changed; a new one starts already asleep or awake.
     */
    setItems(items, genes) {
      const known = new Map(entries.map((e) => [e.key, e]));
      entries = items.slice(0, slots).map((item) => {
        const egg = item.incubation !== undefined;
        const key = egg ? `egg:${item.id}:${item.seed}` : `${item.id}:${item.age}:${item.harness}:${JSON.stringify(item.genome)}`;
        if (known.has(key)) return Object.assign(known.get(key), { item });
        if (egg) {
          const { anatomy, radius, outline } = groundEgg(genes, item);
          return { key, item, egg: true, anatomy, radius, outline };
        }
        const anatomy = tacked(item, item.age);
        const pose = module.pose(anatomy, 0, { ...restingMotion, time: 0 });
        const forward = yard.spots[0].forward;
        const ground = SOLE - lowestPoint(anatomy, pose, [0, 0, 0], forward);
        const outline = poseOutline(anatomy, pose, [0, ground, 0], forward);
        const entry = { key, item, anatomy, age: item.age, outline, plumeOutline: withPlume(outline, forward, anatomy.bounds.radius) };
        entry.sleep = sleepTarget(entry);
        return entry;
      });
      if (swap && !entries.includes(swap.to)) swap = null;
      shown = Math.max(0, Math.min(entries.length - 1, shown));
    },
    /**
     * Brings entry `index` onto the spot: the one there flies (or hops) off as it flies (or hops) in,
     * or, when either is a sleeping dragon, the camera orbits the barn a quarter turn and finds it there; the
     * orbit, zoom and pan return to the front view on the way. `instant` cuts straight to it.
     */
    focus(index, { instant = false } = {}) {
      const next = Math.max(0, Math.min(entries.length - 1, index));
      if (flier) instant = true;
      if (next === shown && (!swap || instant)) {
        if (instant) swap = null;
        return;
      }
      [homing, spin, zoomTarget, panTarget] = [true, [0, 0], 1, [0, 0]];
      const from = swap ? swap.to : entries[shown],
        fromIndex = shown,
        fromSite = shownSite ?? siteOf(from);
      const to = entries[next],
        toSite = siteOf(to);
      shown = next;
      if (to && !toSite.turned) frontEntry = to;
      if (instant || !to || !from || from === to) {
        swap = null;
        shownSite = toSite;
        return;
      }
      move(from, fromIndex, fromSite, to, next, toSite);
    },
    /** Plays the breath attack of the dragon at spot `index`, unless it sleeps; returns its length in seconds. */
    breathe(index) {
      const entry = entries[index];
      if (!entry || entry.egg || entry.sleep || sleepTarget(entry)) return 0;
      entry.breathAt = performance.now() / 1000;
      return breathLength;
    },
    /**
     * Holds the dragon `id` in the framing that takes in its breath plume, or lets go with null; on
     * narrow screens the camera turns to its side and closes on its head and the plume leaving it.
     */
    holdWide(id) {
      if (id === wide) return;
      wide = id;
      home = { yaw: 0, pitch: view.pitch };
      [homing, spin, zoomTarget, panTarget] = [true, [0, 0], 1, [0, 0]];
    },
    /**
     * Plays the minigame `create(anatomy)` makes for the dragon at spot `index`, on the anatomy it is
     * drawn with: pointer input goes to it instead of the camera, which turns to the side `game.camera()`
     * asks for, framing the world points it lists as `keep` once it gives them, if it does. The game is driven each frame with `update(view)` (see `playView`), poses the dragon with
     * `motion(time)` (its `lift` hopping it, in body sizes as a care reaction's, or its `rise` in metres; an egg's as
     * `{ roll, lift, glow, glowColor }`) and coats it with `coat`, holds the keeper's hand as `hand(view)` says and draws
     * `particles(out, view)`; a game may also move the dragon off its spot with `place(spot)`, giving its
     * `{ position, forward }` with its height over the ground as Y, and add props with `objects(view)`. The camera eases into framing the dragon in the band `area()` gives
     * (canvas pixels). Returns the game, or null when the dragon cannot play.
     */
    play(index, create, area) {
      const entry = entries[index];
      if (!entry || entry.sleep || sleepTarget(entry) || index !== shown || swap) return null;
      drag = pinch = null;
      touches.clear();
      spin = [0, 0];
      delete entry.care;
      playing = { entry, game: create(entry.anatomy), view: null };
      playFrame = { entry, area };
      delete entry.playShot;
      return playing.game;
    },
    /** Ends the minigame being played, the camera easing back to the front view; `instant` cuts to it. */
    stopPlay({ instant = false } = {}) {
      if (instant) playMix = 0;
      if (!playing) return;
      if (playing.entry.egg) delete playing.entry.posed;
      playing = null;
      home = { yaw: 0, pitch: view.pitch };
      [homing, zoomTarget, panTarget] = [true, 1, [0, 0]];
    },
    /**
     * Plays the reaction to care action `actionId` of the dragon at spot `index`, from `from` seconds
     * in; returns its length in seconds.
     */
    care(index, actionId, from = 0) {
      const entry = entries[index];
      const reaction = careReactions[actionId];
      if (!entry || entry.egg || !reaction) return 0;
      react(entry, reaction, performance.now() / 1000 - from, palette.care[actionId]);
      return reaction.length;
    },
    /**
     * Plays `reaction`, built as a care reaction's, on the dragon at spot `index` once it has flown in;
     * returns the seconds until it starts, or null when the dragon is asleep or busy and cannot.
     */
    greet(index, reaction) {
      const entry = entries[index];
      const now = performance.now() / 1000;
      const busy = entry?.care && now - entry.care.at < entry.care.reaction.length;
      if (!entry || entry.egg || entry.change || entry.sleep || sleepTarget(entry) || busy || playing?.entry === entry) return null;
      const wait = swap?.to === entry ? Math.max(0, swapEnd(swap) - (now - swap.at)) : 0;
      react(entry, reaction, now + wait);
      return wait;
    },
    /** Jolts the egg at spot `index` as it takes its `cracks`th crack. */
    crack(index, cracks) {
      const entry = entries[index];
      if (!entry?.egg) return;
      entry.crackAt = performance.now() / 1000;
      entry.cracks = cracks;
    },
    /**
     * Hatches the egg at spot `from` into the kid of `items` at spot `to`: the camera cuts close on
     * the kid's spot, where the egg glows, trades places with the kid ever faster and lets it hop out
     * white, then slowly draws back. Returns the seconds until the kid shows.
     */
    hatch(from, to, items, genes) {
      const egg = entries[from];
      this.setItems(items, genes);
      const kid = entries[to];
      if (!egg?.egg || !kid || kid.egg) return 0;
      const at = performance.now() / 1000;
      egg.crackAt = at;
      kid.change = { at, from: egg };
      kid.hopAt = at + REVEAL_AT;
      this.focus(to, { instant: true });
      return REVEAL_AT;
    },
    /**
     * Grows `dragon`, standing at spot `index`, out of its look at `age` the way a kid hatches: the
     * camera cuts close, the old look glows, trades places with the new one ever faster and lets it
     * hop out white. Returns the seconds until the new look shows, 0 when it cannot play.
     */
    grow(index, dragon, age) {
      const entry = entries[index];
      if (!entry || entry.egg || entry.change) return 0;
      const at = performance.now() / 1000;
      entry.change = { at, from: { anatomy: tacked(dragon, age) } };
      entry.hopAt = at + REVEAL_AT;
      this.focus(index, { instant: true });
      return REVEAL_AT;
    },
    /** Sends the dragon `id` flying off from its spot while the camera tilts up after it; returns the seconds it takes. */
    takeOff(id) {
      const index = entries.findIndex((entry) => entry.item.id === id);
      const entry = entries[index];
      if (!entry || entry.egg) return 0;
      flier = { entry, spot: spotOf(siteOf(entry)), at: performance.now() / 1000 };
      flier.eye = takeoffEye(flier);
      flier.from = lastCamera ?? takeoffShot(takeoffRacer(flier, 0), flier);
      return TAKEOFF;
    },
    show() {
      if (running) return;
      running = true;
      previous = performance.now();
      requestAnimationFrame(frame);
    },
    hide() {
      running = false;
      this.stopPlay({ instant: true });
      drag = pinch = null;
      touches.clear();
    },
    setStyle(next) {
      style = next;
      const was = view;
      view = VIEWS[next] ?? VIEWS.plain;
      if (view === was || playing) return;
      if (home.pitch === was.pitch) home = { ...home, pitch: view.pitch };
      pitch += view.pitch - was.pitch;
    },
  };
}
