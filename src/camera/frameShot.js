import { add, distance, dot, lerp, normalize, scale, sub } from "../vec3.js";
import { creatureScale as C, lengthScale as L, speedScale as V } from "../worldScale.js";
import { clamp, CLEARANCE, leftOf, legalEye, pathAt } from "./courseGeometry.js";
import { surfaceAt } from "../course/surfaceAt.js";
import { riderCam } from "./riderCam.js";
import { gridShot } from "./gridShot.js";

const UP = [0, 1, 0];
const OFFSETS = [-0.6, -0.45, -0.3, -0.15, 0, 0.15, 0.3, 0.45, 0.6];
// Reference top speed: 200 km/h. Energy rises from cruising towards a flat-out sprint.
const TOP = 35 * V;
const smoothstep = (a, b, x) => {
  const k = clamp((x - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

/**
 * Triangular-weighted average of racer state over [t - 0.6, t + 0.6], so the
 * camera is smooth, lag-free and a pure function of t.
 */
function smoother(index, t) {
  const samples = OFFSETS.map((o) => ({
    w: 1 - Math.abs(o) / 0.75,
    racers: new Map(
      index.sample(clamp(t + o, 0, index.lastT)).racers.map((r) => [r.id, r]),
    ),
  }));
  const total = samples.reduce((sum, s) => sum + s.w, 0);
  const average = (id, key) => {
    let v = [0, 0, 0];
    for (const s of samples) {
      const r = s.racers.get(id);
      if (r) v = add(v, scale(r[key], s.w / total));
    }
    return v;
  };
  const scalar = (id, key) => {
    let v = 0;
    for (const s of samples) v += (s.racers.get(id)?.[key] ?? 0) * (s.w / total);
    return v;
  };
  const current = new Map(
    index.sample(clamp(t, 0, index.lastT)).racers.map((r) => [r.id, r]),
  );
  return {
    position: (id) => average(id, "position"),
    forward: (id) => {
      const f = normalize(average(id, "forward"));
      return dot(f, f) > 0.5 ? f : [1, 0, 0];
    },
    speed: (id) => scalar(id, "speed"),
    bank: (id) => scalar(id, "bank"),
    effort: (id) => scalar(id, "effort"),
    accel: (id) => index.acceleration(id, t, 1.2),
    racer: (id) => current.get(id),
  };
}

const centroid = (points) =>
  scale(
    points.reduce((a, p) => add(a, p), [0, 0, 0]),
    1 / Math.max(1, points.length),
  );

const flat = (v) => normalize([v[0], v[1] * 0.35, v[2]]);
const hashSide = (id) => {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) | 0;
  return h & 1 ? 1 : -1;
};

/**
 * Camera for timeline entry `shot` at time t. Besides `{ eye, target, up, fov }` it reports the
 * subject's `speed` (m/s), a 0–1 `energy` for how flat out the moment is, a 0–1 `shake`
 * budget and a `roll` in radians; `applyCameraFx` turns those into handheld motion. `aspect`, the
 * canvas width over height, shapes the grid shot, which frames the `focus` racer ids when given.
 */
export function frameShot(shot, t, index, course, { aspect, focus = [] } = {}) {
  const s = smoother(index, t);
  const id = shot.subject;
  const has = id !== null && s.racer(id);
  const p = has ? s.position(id) : pathAt(course, 0).position;
  const f = has ? flat(s.forward(id)) : pathAt(course, 0).forward;
  const l = leftOf(f),
    side = shot.side || 1;
  const speed = has ? s.speed(id) : 0;
  const bank = has ? s.bank(id) : 0;
  const energy = has
    ? clamp(0.75 * smoothstep(0.62 * TOP, 1.02 * TOP, speed) + 0.35 * smoothstep(0.7, 0.95, s.effort(id)), 0, 1)
    : 0;
  let eye,
    target,
    fov,
    shake = 0,
    roll = 0,
    margin = CLEARANCE,
    ground = false,
    span;
  const near = (e, reach) => smoothstep(reach, 6 * C, distance(e, p));

  switch (shot.shot) {
    case "grid": {
      const start = index.sample(0).racers;
      const slots = start.map((r) => r.position);
      const current = start.map((r) => (s.racer(r.id) ? s.position(r.id) : r.position));
      ({ eye, target, fov, span } = gridShot(course, slots, course.start.grid[0].forward, current, side, t, {
        size: Math.max(...index.ids.map(index.size)),
        aspect,
        group: start.map((r, i) => (focus.includes(r.id) ? i : -1)).filter((i) => i >= 0),
      }));
      margin = 1 * C;
      ground = true;
      break;
    }
    case "leader":
      // Long lens from the side: the subject holds still while the far wall rushes past.
      eye = add(add(add(p, scale(l, side * 33 * C)), scale(f, 3 * C)), [0, 2.5 * C, 0]);
      target = add(p, scale(f, 1.2 * V));
      fov = 0.34;
      shake = 0.3;
      break;
    case "battle": {
      const q = shot.other !== null && s.racer(shot.other) ? s.position(shot.other) : p;
      const mid = lerp(p, q, 0.5),
        span = distance(p, q),
        d = 12 * C + span * 0.8;
      eye = add(
        add(add(mid, scale(f, -d * 0.75)), scale(l, side * d * 0.55)),
        [0, 3 * C + span * 0.12, 0],
      );
      target = add(mid, scale(f, 2 * V));
      fov = clamp(2 * Math.atan((span * 0.5 + 7 * C) / d), 0.45, 1);
      shake = 0.45;
      roll = bank * 0.15;
      break;
    }
    case "gate": {
      // Just outside the ring and a little beyond it, so the field threads the gate at the lens.
      const gate = course.gates[shot.gate] ?? course.gates.at(-1);
      const gf = flat(gate.forward),
        gl = leftOf(gf);
      eye = add(
        add(add(gate.position, scale(gf, 9 * L)), scale(gl, side * (gate.radius + 3 * L))),
        [0, -0.25 * gate.radius, 0],
      );
      target = add(p, scale(f, 0.2 * V));
      fov = 0.62 + 0.3 * near(eye, 60 * C);
      shake = 0.8 * near(eye, 28 * C);
      break;
    }
    case "trackside": {
      // Locked off where the subject will be TRACKSIDE_LEAD seconds after the cut; it whips past.
      const a = shot.anchor;
      const af = flat(a.forward),
        al = leftOf(af);
      eye = add(add(add(a.position, scale(af, 5 * C)), scale(al, side * 14 * C)), [0, 2 * C, 0]);
      target = add(p, scale(f, 0.25 * V));
      fov = 0.56 + 0.34 * near(eye, 70 * C);
      shake = near(eye, 30 * C);
      margin = CLEARANCE * 0.7;
      break;
    }
    case "flyby": {
      // Drifts forward slower than the racers, so the pack overtakes the lens.
      const a = shot.anchor;
      const c = pathAt(course, a.s + a.pace * (t - shot.start));
      const cl = leftOf(c.forward);
      eye = add(add(c.position, scale(cl, side * Math.min(c.halfWidth * 0.55, 22 * C))), [0, 0, 0]);
      eye[1] = c.floor + a.height + 2.5 * C;
      target = add(p, scale(f, 0.3 * V));
      fov = 0.78;
      shake = 0.35 + 0.65 * near(eye, 26 * C);
      break;
    }
    case "rider": {
      // Onboard, rigidly on the racer's current position so the saddle holds still in frame.
      const cam = riderCam({
        position: has ? s.racer(id).position : p,
        forward: s.forward(id),
        bank,
        size: index.size(id),
        side: hashSide(id),
      });
      ({ eye, target, fov, roll } = cam);
      shake = 0.25;
      margin = 0.5 * C;
      ground = true;
      break;
    }
    case "landing": {
      // Standing on the run-out ahead of the touchdown, so the dragon comes down towards the lens.
      const a = shot.anchor;
      const af = flat(a.forward),
        al = leftOf(af);
      const base = add(add(a.position, scale(af, 16 * C)), scale(al, side * 10 * C));
      const spot = surfaceAt(course, base[0], base[2]);
      const floorY = Number.isFinite(spot.ground) ? Math.max(spot.ground, spot.level) : a.position[1];
      eye = [base[0], floorY + 1.3 * C, base[2]];
      const touch = add(a.position, [0, 2 * C, 0]);
      target = lerp(p, touch, 0.3 * smoothstep(3, 0, Math.abs(a.t - t)));
      fov = clamp(2 * Math.atan((7 * C) / Math.max(1, distance(eye, p))), 0.34, 1);
      shake = 0.2;
      margin = 1 * C;
      ground = true;
      break;
    }
    case "aerial": {
      const group = (shot.group ?? [id]).filter((g) => s.racer(g));
      const points = group.map((g) => s.position(g));
      const c = points.length ? centroid(points) : p;
      const spread = Math.max(0, ...points.map((q) => distance(q, c)));
      eye = add(add(c, scale(f, -35 * L)), [0, 55 * L + spread * 0.6, 0]);
      target = add(c, scale(f, 15 * V));
      fov = 1;
      shake = 0.1;
      break;
    }
    case "comeback":
      eye = add(add(add(p, scale(f, 18 * C)), scale(l, side * 9 * C)), [0, 3 * C, 0]);
      target = add(p, scale(f, -4 * C));
      fov = 0.55;
      shake = 0.4;
      break;
    case "finish": {
      const gate = course.gates.at(-1);
      const gf = flat(gate.forward),
        gl = leftOf(gf);
      eye = add(
        add(add(gate.position, scale(gl, side * (gate.radius + 13 * L))), scale(gf, 12 * L)),
        [0, 0.55 * gate.radius + 3 * L, 0],
      );
      const to = has ? index.finishS - s.racer(id).progress : 0;
      const w = smoothstep(70 * V, 4 * V, to);
      // Long lens that keeps the subject big on the approach, whipping round as it crosses.
      target = lerp(p, gate.position, w * 0.3);
      fov = clamp(2 * Math.atan((9 * C + distance(p, gate.position) * 0.12) / Math.max(1, distance(eye, p))), 0.32, 0.95);
      shake = 0.2 + 0.6 * near(eye, 40 * C);
      break;
    }
    default: {
      // Chase: tucked in behind, dropping back as the subject accelerates and catching up after.
      const lag = clamp(s.accel(id), -1.5, 3.5) * 1.6 * C;
      eye = add(add(add(p, scale(f, -(14 * C + lag))), [0, 3.6 * C, 0]), scale(l, hashSide(id) * 2.5 * C));
      target = add(p, scale(f, 10 * V));
      fov = 0.7;
      shake = 0.7;
      roll = bank * 0.25;
    }
  }

  eye = legalEye(course, eye, target, {
    hint: has ? s.racer(id).progress : undefined,
    margin,
    ground,
  });
  if (distance(eye, target) < 2 * C) {
    const away = sub(eye, target);
    eye = add(target, scale(dot(away, away) > 1e-9 ? normalize(away) : [0, 1, 0], 2 * C));
  }
  const dir = normalize(sub(target, eye));
  let up = sub(UP, scale(dir, dot(UP, dir)));
  up = dot(up, up) < 1e-6 ? [1, 0, 0] : normalize(up);
  return { eye, target, up, fov, span, speed, energy, shake, roll, thud: thudAt(eye, t, index, course) };
}

/**
 * Ground shake for a camera standing on the ground near a touchdown or a launch in the last two
 * seconds: 0 in the air, up to about 1.4 a few metres from the feet, decaying within a second.
 */
function thudAt(eye, t, index, course) {
  const spot = surfaceAt(course, eye[0], eye[2]);
  const floorY = Math.max(spot.ground, spot.level);
  if (!Number.isFinite(floorY)) return 0;
  const grounded = smoothstep(9 * C, 2.5 * C, eye[1] - floorY);
  if (grounded <= 0) return 0;
  let thud = 0;
  for (const e of index.eventsBetween(t - 2, t)) {
    if (e.type !== "land" && e.type !== "launch") continue;
    const reach = clamp((40 * C) / (distance(eye, e.position) + 15 * C), 0, 1.4);
    thud = Math.max(thud, grounded * reach * Math.exp(-(t - e.t) * 3) * (e.surface === "water" ? 0.6 : 1) * (e.type === "launch" ? 0.5 : 1));
  }
  return thud;
}

