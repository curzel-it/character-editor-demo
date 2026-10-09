import { createSceneRenderer, shotMatrix } from "../scene.js";
import { createStableYard } from "../scene/stableYard.js";
import { lowestPoint } from "../scene/groundContact.js";
import { poseOutline } from "../scene/poseOutline.js";
import { projectPoint } from "../scene/raceView.js";
import { podiumAnatomy, podiumFrame, stepTop } from "../scene/podiumMesh.js";
import { trophyAnatomy } from "../scene/trophyMesh.js";
import { createConfetti } from "../scene/confetti.js";
import { withTack } from "../jockey/withTack.js";
import { restingMotion } from "../dragonThumbnails.js";
import { medalOf } from "../stable/honours.js";
import { renderDensity } from "../renderDensity.js";

const SOLE = 0.02,
  MAX_PIXELS = 2560 * 1440,
  FOV = 0.62,
  PITCH = 0.3,
  SWAY = 0.1,
  FILL = 0.94,
  INTRO = 3.2,
  INTRO_PULL = 0.9,
  INTRO_YAW = 0.55,
  INTRO_RISE = 0.25,
  TROPHY_AT = 2.4,
  TROPHY_FALL = 1.3,
  TROPHY_SPIN = 0.6,
  INWARD = 0.75,
  CHAMPION_TURN = 0.45,
  STEP_HEIGHTS = { 1: 0.55, 2: 0.36, 3: 0.2 };

const mix = (a, b, t) => a + (b - a) * t;
const ease = (t) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;
const boundsOf = (points) => [0, 1, 2].map((k) => [Math.min(...points.map((p) => p[k])), Math.max(...points.map((p) => p[k]))]);

/** When the cup lands over the champion, in seconds from the start of the show. */
export const trophyLands = TROPHY_AT + TROPHY_FALL;

/**
 * The awards ceremony's scene: the season's top three dragons on a podium, each with its rider in
 * its silks, the owner's dragon on the grass in front when it finished lower, and the cup coming
 * down over the champion while confetti falls. The camera swoops in and then sways gently, framing
 * all of it in the canvas band `frameArea()` leaves free; `onFrame({ time, tags })` reports the show's
 * time and where each dragon's name tag goes on the canvas: at the foot of its step, or at the
 * feet of the owner's dragon in front of the podium.
 */
export function createPodiumStage(module, { frameArea, onFrame }) {
  const canvas = Object.assign(document.createElement("canvas"), { className: "podium-stage" });
  canvas.setAttribute("aria-hidden", "true");
  let meadow = null,
    renderer = null,
    cast = [],
    podium = null,
    trophy = null,
    confetti = null,
    points = [],
    style = "cozy",
    running = false,
    started = 0,
    camera = null;

  function resize() {
    const density = renderDensity();
    let w = Math.round(canvas.clientWidth * density),
      h = Math.round(canvas.clientHeight * density);
    const cap = Math.sqrt(MAX_PIXELS / Math.max(1, w * h));
    if (cap < 1) [w, h] = [Math.round(w * cap), Math.round(h * cap)];
    if (w && h && (canvas.width !== w || canvas.height !== h)) [canvas.width, canvas.height] = [w, h];
    return w && h;
  }

  /** The framing shot at show time `time`: swooping in from wide and low, then swaying. */
  function goal(time) {
    const w = Math.max(1, canvas.clientWidth),
      h = Math.max(1, canvas.clientHeight);
    const area = frameArea?.() ?? {};
    const top = Math.max(0, area.top ?? 0),
      bottom = Math.min(h, area.bottom ?? h);
    const band = Math.max(0.2, (bottom - top) / h),
      shift = 1 - (top + bottom) / h;
    const [x, y, z] = boundsOf(points);
    const target = [(x[0] + x[1]) / 2, (y[0] + y[1]) / 2, (z[0] + z[1]) / 2];
    const intro = 1 - ease(time / INTRO);
    const yaw = Math.sin(time * 0.17) * SWAY + intro * INTRO_YAW;
    const pitch = PITCH + intro * INTRO_RISE;
    const toward = [Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)];
    let distance = 2 * (x[1] - x[0]);
    for (let n = 0; n < 6; n++) {
      const m = shotMatrix({ eye: target.map((v, k) => v + toward[k] * distance), target, fov: FOV, shift }, w / h);
      let x0 = Infinity,
        x1 = -Infinity,
        y0 = Infinity,
        y1 = -Infinity;
      for (const p of points) {
        const [px, py, pw] = [0, 1, 3].map((r) => m[r] * p[0] + m[4 + r] * p[1] + m[8 + r] * p[2] + m[12 + r]);
        [x0, x1, y0, y1] = [Math.min(x0, px / pw), Math.max(x1, px / pw), Math.min(y0, py / pw), Math.max(y1, py / pw)];
      }
      distance *= Math.max(Math.max(-x0, x1) / FILL, (y1 - y0) / (2 * FILL * band));
    }
    distance *= 1 + intro * INTRO_PULL;
    return { eye: target.map((v, k) => v + toward[k] * distance), target, fov: FOV, shift };
  }

  function trophyAt(time) {
    const champion = cast.find((c) => c.place === 1);
    if (!trophy || !champion) return null;
    const fall = ease((time - TROPHY_AT) / TROPHY_FALL);
    const rest = champion.top + trophy.size * 0.25 + Math.sin(time * 1.6) * trophy.size * 0.05 * fall;
    const y = mix(rest + champion.height * 2.5, rest, fall);
    const spin = time * TROPHY_SPIN;
    return { anatomy: trophy.anatomy, pose: { bones: {} }, position: [champion.spot[0], y, champion.spot[2] + champion.front], forward: [Math.cos(spin), 0, Math.sin(spin)], glow: 0.08 };
  }

  function frame(now) {
    if (!running) return;
    if (resize() && cast.length) {
      const time = (now - started) / 1000;
      camera = goal(time);
      const racers = cast.map((c, i) => {
        const t = time + i * 0.37;
        const pose = module.pose(c.anatomy, t % 1, { ...restingMotion, time: t });
        const lift = c.floor + SOLE - lowestPoint(c.anatomy, pose, [c.spot[0], 0, c.spot[2]], c.forward);
        return { anatomy: c.anatomy, pose, position: [c.spot[0], lift, c.spot[2]], forward: c.forward };
      });
      const cup = time > TROPHY_AT ? trophyAt(time) : null;
      confetti.setSparkle(cup && time > trophyLands ? { position: [cup.position[0], cup.position[1] + trophy.size * 0.7, cup.position[2]], radius: trophy.size * 0.7 } : null);
      renderer ??= createSceneRenderer(canvas);
      renderer.render({
        course: meadow.course,
        racers: [podium, ...racers, ...(cup ? [cup] : [])],
        camera,
        style,
        time,
        fireworks: { show: confetti, t: time },
      });
      const matrix = shotMatrix(camera, canvas.clientWidth / canvas.clientHeight);
      onFrame?.({ time, tags: cast.map((c) => ({ id: c.id, ...projectPoint(matrix, c.label, canvas.clientWidth, canvas.clientHeight) })) });
    }
    requestAnimationFrame(frame);
  }

  /** A dragon standing at `spot` on a floor `floor` metres up, its outline placed there and its name tag at `label`. */
  function stand(row, spot, floor, heading, label) {
    const look = row.look;
    const anatomy = withTack(module.createAnatomy(look.genome, { age: look.age }), { harness: look.harness, jockey: look.jockey });
    const forward = [Math.sin(heading), 0, Math.cos(heading)];
    const pose = module.pose(anatomy, 0, { ...restingMotion, time: 0 });
    const lift = floor + SOLE - lowestPoint(anatomy, pose, [spot[0], 0, spot[2]], forward);
    const outline = poseOutline(anatomy, pose, [spot[0], lift, spot[2]], forward);
    const [, y, z] = boundsOf(outline);
    return {
      id: row.id,
      place: row.rank,
      anatomy,
      forward,
      spot,
      floor,
      outline,
      top: y[1],
      height: y[1] - y[0],
      front: (z[1] - spot[2]) * 0.35,
      label,
    };
  }

  /** The bare size of a dragon facing the camera: width, height and length. */
  function sizeOf(look) {
    const anatomy = withTack(module.createAnatomy(look.genome, { age: look.age }), { harness: look.harness, jockey: look.jockey });
    const outline = poseOutline(anatomy, module.pose(anatomy, 0, { ...restingMotion, time: 0 }), [0, 0, 0], [0, 0, 1], 11);
    const [x, y, z] = boundsOf(outline);
    return { width: x[1] - x[0], height: y[1] - y[0], length: z[1] - z[0] };
  }

  return {
    el: canvas,
    /**
     * Stages a season's end: its podium rows (with their `look`), the owner's row when it finished
     * off the podium, the division for the cup and pennants, and `seed` for the confetti.
     */
    setCeremony({ podium: rows, owner = null, division, seed }) {
      meadow ??= createStableYard(3, { spacing: 6, buildings: false });
      const dressed = rows.filter((r) => r.look);
      const offPodium = owner?.look && owner.rank > 3 ? owner : null;
      const sizes = [...dressed, ...(offPodium ? [offPodium] : [])].map((r) => sizeOf(r.look));
      const width = Math.max(...sizes.map((s) => s.width)),
        height = Math.max(...sizes.map((s) => s.height)),
        length = Math.max(...sizes.map((s) => s.length));
      const halfWidth = width * 0.5,
        spacing = width * 1.12;
      const slots = { 1: 0, 2: -1, 3: 1 };
      const steps = dressed.map((r) => ({ x: slots[r.rank] * spacing, height: STEP_HEIGHTS[r.rank] * height, halfWidth, halfDepth: length * 0.2, medal: medalOf(r.rank).id }));
      podium = { anatomy: podiumAnatomy(steps, division), pose: { bones: {} }, position: [0, 0, 0], forward: [1, 0, 0] };
      cast = dressed.map((r, i) => stand(r, [steps[i].x, 0, 0], stepTop(steps[i]), r.rank === 1 ? CHAMPION_TURN : -slots[r.rank] * INWARD, [steps[i].x, 0, steps[i].halfDepth * 1.25]));
      if (offPodium) {
        const spot = [spacing * 0.55, 0, length * 0.95];
        cast.push(stand(offPodium, spot, 0, -CHAMPION_TURN, [spot[0], 0, spot[2] + length * 0.25]));
      }
      trophy = { size: height * 0.42, anatomy: trophyAnatomy(division, height * 0.42) };
      const champion = cast.find((c) => c.place === 1);
      const cupTop = champion ? [[champion.spot[0], champion.top + trophy.size * 1.3, champion.spot[2] + champion.front]] : [];
      points = [...cast.flatMap((c) => c.outline), ...cupTop, ...podiumFrame(steps)];
      const [x, y] = boundsOf(points);
      confetti = createConfetti({
        centre: [(x[0] + x[1]) / 2, 0, length * 0.1],
        halfWidth: (x[1] - x[0]) * 0.6,
        halfDepth: length * 0.5,
        height: (y[1] - y[0]) * 1.6,
        size: height * 0.035,
        start: trophyLands - 0.2,
        seed,
      });
    },
    show() {
      started = performance.now();
      camera = null;
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    },
    hide() {
      running = false;
    },
    /** Moves the show to `seconds` from its start, for the evidence tools. */
    seek(seconds) {
      started = performance.now() - seconds * 1000;
    },
    setStyle(next) {
      style = next;
    },
  };
}
