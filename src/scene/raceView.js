import { createSceneRenderer } from "../scene.js";
import { sampleRace } from "../race/sampleRace.js";
import { motionFromRacer } from "../animate/flightMotion.js";
import { mouthFromEvents } from "../animate/mouthEvents.js";
import { landingFromEvents } from "../animate/landingEvents.js";
import { launchFromEvents } from "../animate/launchEvents.js";
import { breathFromEvents, hitFromEvents } from "../animate/breathEvents.js";
import { breathCue, breathLength } from "../breath/breathCue.js";
import { breathAim } from "../breath/breathAim.js";
import { breathElements } from "../breath/breathElements.js";
import { smoothstep } from "../animate/flightMotion.js";
import { surfaceAt } from "../course/surfaceAt.js";
import { lowestPoint } from "./groundContact.js";
import { creatureScale } from "../worldScale.js";
import { onboardPose } from "./onboardPose.js";
import { createRenderScale } from "./renderScale.js";
import { renderDensity } from "../renderDensity.js";

const TRAIL_STEP = 0.05,
  TRAIL_STEPS = 12,
  SOLE = 0.02 * creatureScale,
  MAX_PIXELS = 2560 * 1440,
  BODY_TURN = 0.25;

/**
 * Draws a built race (`buildRace`) on `canvas` at a race time from a given camera. The WebGL
 * renderer is created on the first draw and kept for the canvas's lifetime. With `adaptive` the
 * render resolution drops while frames run slow (`createRenderScale`).
 */
export function createRaceView(module, canvas, { adaptive = false } = {}) {
  let renderer = null;
  const scale = adaptive ? createRenderScale() : null;

  function resize() {
    const density = renderDensity();
    let w = Math.round(canvas.clientWidth * density),
      h = Math.round(canvas.clientHeight * density);
    const cap = Math.min(1, Math.sqrt(MAX_PIXELS / Math.max(1, w * h))) * (scale?.value ?? 1);
    if (cap < 1) {
      w = Math.round(w * cap);
      h = Math.round(h * cap);
    }
    if (w && h && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  function trails(race, t) {
    const out = new Map();
    for (let k = 0; k <= TRAIL_STEPS; k++) {
      const at = t - k * TRAIL_STEP;
      if (at < 0) break;
      for (const r of sampleRace(race.recording, at).racers) {
        if (!out.has(r.id)) out.set(r.id, []);
        out.get(r.id).push({ position: r.position, forward: r.forward, bank: r.bank });
      }
    }
    return out;
  }

  /** Keeps feet out of the ground on approach and planted on it on the grid and after touchdown (wading in water). */
  function onGround(course, r, anatomy, pose, settle) {
    const [x, y, z] = r.position;
    const spot = surfaceAt(course, x, z);
    const floor = spot.surface === "water" ? Math.max(spot.ground, spot.level - 1.4 * creatureScale) : spot.ground;
    const lift = floor + SOLE - lowestPoint(anatomy, pose, r.position, r.forward, r.bank);
    return [x, y + (lift > 0 ? lift : lift * settle), z];
  }

  /**
   * A racer's breath at `t`, aimed at its rival in `byId` or straight ahead without one: the pose cue with the neck's aim, the
   * plume, and how far the body turns its heading towards the rival.
   */
  function breathing(race, r, byId, t) {
    const b = breathFromEvents(race.recording, r.id, t);
    if (!b) return null;
    const target = byId.get(b.other);
    const weight = smoothstep(0, 0.4, b.age) * (1 - smoothstep(breathLength - 0.5, breathLength, b.age));
    const aim = target ? breathAim(r.position, r.forward, r.bank, target.position) : { yaw: 0, pitch: 0 };
    const cue = breathCue(b.age);
    return {
      motion: { ...cue, breathYaw: aim.yaw * weight * (1 - BODY_TURN), breathPitch: aim.pitch * weight },
      plume: { element: breathElements.find((e) => e.id === b.element) ?? breathElements[0], strength: cue.breath },
      turn: aim.yaw * weight * BODY_TURN,
    };
  }

  /**
   * A racer flinching from a breath hit at `t`: a gasp while in the plume and a shudder of the
   * wings' roll, both easing off after the last contact.
   */
  function flinch(race, r, t) {
    const hit = hitFromEvents(race.recording, r.id, t);
    if (!hit) return null;
    const hurt = smoothstep(0, 0.15, hit.age) * (1 - smoothstep(hit.until, hit.until + 0.8, t)) * Math.min(1, 0.4 + 4 * hit.amount);
    return { gasp: hurt, shudder: 0.12 * hurt * Math.sin(t * 23) };
  }

  /** A racer's statuses at `t` as `[{ id, strength }]`, each fading out over its last half second. */
  function aura(r, t) {
    return (r.effects ?? []).filter((e) => e.until > t).map((e) => ({ id: e.id, strength: Math.min(1, (e.until - t) / 0.5) }));
  }

  /** `forward` turned by `angle` radians about the vertical, positive to the left. */
  function turned(forward, angle) {
    if (!angle) return forward;
    const l = Math.hypot(forward[0], forward[2]) || 1;
    const left = [-forward[2] / l, 0, forward[0] / l];
    const c = Math.cos(angle),
      s = Math.sin(angle);
    return forward.map((v, k) => (k === 1 ? v : v * c + left[k] * l * s));
  }

  function motionFor(previous, { blur, reducedMotion }) {
    const moving = previous ? 1 : 0;
    return {
      blur: blur ? moving * 2.4 * (reducedMotion ? 0.35 : 1) : 0,
      streaks: moving,
      trails: 1,
    };
  }

  return {
    /** The scene renderer, created on first use. */
    get renderer() {
      renderer ??= createSceneRenderer(canvas);
      return renderer;
    },
    /**
     * Renders `race` at time `t` through `shot` (`previous` is the same shot a frame earlier, or
     * null across a cut); `onboard` is the racer whose saddle the lens rides, drawn with `onboardPose`; `marker` is `{ position, size }`
     * for an arrow pointing down at a world point, `size` of the frame height tall. Returns the sample drawn and the camera's view-projection matrix.
     */
    draw(race, t, { shot, previous = null, style, blur = true, reducedMotion = false, onboard = null, marker = null }) {
      renderer ??= createSceneRenderer(canvas);
      scale?.frame(performance.now());
      resize();
      const sample = sampleRace(race.recording, t);
      const history = trails(race, t);
      const byId = new Map(sample.racers.map((r) => [r.id, r]));
      const racers = sample.racers.map((r) => {
        const entry = race.entries.get(r.id);
        const landed = landingFromEvents(race.recording, r, t);
        const launch = launchFromEvents(race.recording, r, t);
        const landing = { ...landed, stand: Math.max(landed.stand, launch.stand), impact: Math.max(landed.impact, launch.impact) };
        const breath = breathing(race, r, byId, t);
        const hurt = flinch(race, r, t);
        const statuses = aura(r, t);
        const daze = statuses.find((s) => s.id === "daze")?.strength ?? 0;
        const mouth = mouthFromEvents(race.recording, r.id, t);
        const posed = module.pose(entry.anatomy, r.flap, {
          ...(entry.motion = motionFromRacer(r, t, entry.motion)),
          ...mouth,
          ...(hurt && { gasp: Math.max(mouth.gasp, hurt.gasp) }),
          ...breath?.motion,
          ...landing,
        });
        const pose = r.id === onboard ? onboardPose(posed, landing.stand) : posed;
        const forward = turned(r.forward, breath?.turn ?? 0);
        return {
          anatomy: entry.anatomy,
          pose,
          position: r.landing > 0.6 || launch.stand > 0 ? onGround(race.course, r, entry.anatomy, pose, Math.max(Math.min(1, landed.stand * 8), launch.stand)) : r.position,
          forward,
          bank: r.bank + (hurt?.shudder ?? 0) + 0.2 * daze * Math.sin(t * 61),
          flap: r.flap,
          speed: r.speed,
          trail: history.get(r.id),
          ...(breath && { breath: breath.plume }),
          ...(statuses.length && { aura: statuses }),
          ...((breath || statuses.length) && { velocity: r.forward.map((v) => v * (r.speed ?? 0)) }),
        };
      });
      const result = renderer.render({
        course: race.course,
        racers,
        camera: shot,
        previousCamera: previous,
        motion: motionFor(previous, { blur, reducedMotion }),
        style,
        time: t,
        landings: race.landings,
        marker,
      });
      return { sample, viewProjection: result.viewProjection, result };
    },
  };
}

/**
 * Projects a world point through view-projection `m` onto a `width`×`height` canvas: pixel `x`,
 * `y`, the clip `depth`, and whether it is in front of the lens and near the frame.
 */
export function projectPoint(m, [x, y, z], width, height) {
  const w = m[3] * x + m[7] * y + m[11] * z + m[15];
  const cx = (m[0] * x + m[4] * y + m[8] * z + m[12]) / w,
    cy = (m[1] * x + m[5] * y + m[9] * z + m[13]) / w;
  return { x: ((cx + 1) / 2) * width, y: ((1 - cy) / 2) * height, depth: w, visible: w > 1 && Math.abs(cx) < 1.1 && Math.abs(cy) < 1.1 };
}
