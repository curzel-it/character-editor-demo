import { manePalette } from "../palette.js";
import { breathElements } from "../breath/breathElements.js";
import { multiply, point } from "../math3d.js";
import { makeRng } from "../rng.js";

const FLOATS = 11,
  MAX_PARTICLES = 4000,
  MAX_ACCELERATION = 800;

/** The breeze every mane leans into, a world heading. */
const WIND = [0.8, 0, -0.6];

/**
 * The locks the mane gathers into, the tongues inside each and the bright ones at their heart, `reach`
 * mane heights tall, living `life` times as long as fire's.
 */
const tongues = (reach, life = 1) => [
  { colors: "body", kind: 7, rate: 7, life: [0.7 * life, 1.05 * life], size: [0.85, 0.2], tail: 0.4, spread: 0.5, reach: reach * 1.2, locked: 0.75 },
  { colors: "body", kind: 7, rate: 22, life: [0.45 * life, 0.75 * life], size: [0.55, 0.14], tail: 0.35, spread: 0.8, reach, locked: 0.3 },
  { colors: "core", kind: 7, rate: 18, life: [0.25 * life, 0.45 * life], size: [0.4, 0.1], tail: 0.3, spread: 0.4, reach: reach * 0.6 },
];

/**
 * How each element's mane moves, in mane heights (the height of the spike it replaces) and seconds.
 * Every particle stays rooted where it was born on the back: it climbs its `reach` over its life,
 * curling back towards the tail like hair (`curl`), the higher it gets the more it bends with the
 * breeze (`sway`, a wave running along the mane) and, once the dragon moves, back with its own wind
 * (`trail`). A `locked` layer roots its particles that close to the middle of a lock, so the mane
 * flows in a few masses rather than a row of even spikes. Each layer spawns `rate` particles per anchor per
 * second, `size` wide at birth and at death, drawn as a `kind` of the breath shader (7 a flame tongue)
 * from where it was `tail` of its life ago. Bits fly off by `burst` and fall by `fall`.
 */
const looks = {
  fire: {
    sway: 0.55, trail: 1.1, curl: 0.9,
    layers: [...tongues(3), { colors: "bits", kind: 2, rate: 2.5, life: [0.5, 0.9], size: [0.05, 0.03], tail: 0.06, spread: 0.3, reach: 3, burst: 0.8 }],
  },
  storm: {
    sway: 0.6, trail: 1.1, curl: 0.6,
    layers: [...tongues(2.7, 0.75), { colors: "bits", kind: 2, rate: 6, life: [0.1, 0.24], size: [0.05, 0.02], tail: 0.08, spread: 0.5, reach: 0.6, burst: 1.6 }],
  },
  water: {
    sway: 0.45, trail: 1.1, curl: 0.6,
    layers: [...tongues(2.4, 1.1), { colors: "bits", kind: 5, rate: 3, life: [0.4, 0.7], size: [0.07, 0.05], spread: 0.4, reach: 1.4, burst: 0.8, fall: 3 }],
  },
  nature: {
    sway: 0.5, trail: 1.1, curl: 0.6,
    layers: [...tongues(2.4, 1.1), { colors: "bits", kind: 1, rate: 2, life: [0.8, 1.3], size: [0.12, 0.1], spread: 0.4, reach: 1.4, burst: 1, fall: 2 }],
  },
  earth: {
    sway: 0.45, trail: 1.1, curl: 0.6,
    layers: [...tongues(2.4), { colors: "bits", kind: 0, rate: 3, life: [0.5, 0.9], size: [0.08, 0.14], spread: 0.4, reach: 1.2, burst: 0.8, fall: 2.5 }],
  },
};

/** How many anchors apart the locks of a mane sit. */
const LOCK = 1.7;

/** How far each quad is drawn towards the camera, in mane heights, so the hide it grows from never hides its root. */
const LIFT_TO_EYE = 0.45;

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const lerp = (a, b, f) => a.map((v, k) => v + (b[k] - v) * f);
const wind = norm(WIND),
  across = norm(cross(wind, [0, 1, 0]));

/** Colour at `t` along a ramp, as `[r, g, b, alpha, glow]`. */
function ramp(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x)),
    f = x - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
}

/** Where along a mane of `span` anchors a particle of `layer` takes root. */
function rootAlong(layer, span, random) {
  if (!layer.locked) return random() * span;
  const lock = Math.floor(random() * Math.ceil(span / LOCK));
  return Math.max(0, Math.min(span, (lock + 0.5 + (random() - 0.5) * (1 - layer.locked)) * LOCK));
}

const joints = new WeakMap();

/** The bone indices each mane anchor of `anatomy` hangs from. */
function jointsOf(anatomy) {
  if (!joints.has(anatomy)) {
    const ids = anatomy.bones.map((bone) => bone.id);
    joints.set(anatomy, anatomy.mane.anchors.map((a) => a.joints.map((id) => ids.indexOf(id))));
  }
  return joints.get(anatomy);
}

/**
 * The posed anchors of a racer's mane: `skins` holds each bone's matrix times its inverse bind, 16
 * floats apiece, and `model` the racer's model matrix.
 * @param {{ mane: { breath: number, anchors: { p: number[], up: number[], height: number, width?: number, weight: number }[] } }} anatomy
 */
export function maneEmitter(anatomy, skins, model) {
  const cache = new Map();
  const world = (j) => {
    if (!cache.has(j)) cache.set(j, multiply(model, skins.subarray(j * 16, j * 16 + 16)));
    return cache.get(j);
  };
  const element = breathElements[Math.max(0, Math.min(breathElements.length - 1, Math.floor(anatomy.mane.breath) || 0))].id;
  const anchors = anatomy.mane.anchors.map((a, i) => {
    const [j0, j1] = jointsOf(anatomy)[i];
    const tip = a.p.map((v, k) => v + a.up[k] * a.height);
    const at = (p) => lerp(point(world(j1), p), point(world(j0), p), a.weight);
    const p = at(a.p);
    const up = at(tip).map((v, k) => v - p[k]);
    return { p, up: norm(up), height: Math.hypot(...up), width: a.width ?? 1 };
  });
  return { key: anatomy, element, anchors };
}

/**
 * Element manes as particles rooted on the dragon's back: each tongue is placed from the posed anchors
 * every frame, so its foot never leaves the hide, while its tip sways with the others in the breeze
 * and streams back as the dragon moves. Feed `update` the frame's mane emitters, then `build` the
 * quads to draw with the breath shader.
 */
export function createElementalManes() {
  const random = makeRng("elemental-mane");
  const systems = new Map();
  let clock = null,
    total = 0,
    scratch = new Float32Array(0);

  /** The mane's frame at `s` along its anchors: root, up, side, back towards the tail, height and the wind it bends with at `time`. */
  function frameAt(system, s, time) {
    const { anchors, velocities, look } = system;
    const at = Math.min(anchors.length - 2, Math.floor(s)),
      f = s - at;
    const a = anchors[at],
      b = anchors[at + 1];
    const up = norm(lerp(a.up, b.up, f));
    const forward = b.p.map((v, k) => v - a.p[k]);
    const side = norm(cross(up, forward));
    const back = norm(cross(up, side));
    const v = lerp(velocities[at], velocities[at + 1], f);
    const speed = Math.hypot(...v);
    const gust = 0.6 + 0.5 * Math.sin(time * 2.3 - s * 0.9) + 0.2 * Math.sin(time * 5.1 - s * 1.7);
    const flutter = Math.sin(time * 3.7 - s * 1.3);
    const rush = speed > 1e-3 ? (Math.min(1, speed / 20) * look.trail) / speed : 0;
    const bend = [0, 1, 2].map((k) => (wind[k] * gust + across[k] * flutter * 0.5) * look.sway - v[k] * rush);
    const along = bend[0] * up[0] + bend[1] * up[1] + bend[2] * up[2];
    return { root: lerp(a.p, b.p, f), up, side, back, curl: look.curl, height: a.height + (b.height - a.height) * f, width: a.width + (b.width - a.width) * f, bend: bend.map((x, k) => x - up[k] * along) };
  }

  /** Where particle `p` is at life fraction `f`, rooted on the mane's current pose. */
  function place(frame, p, f) {
    const { root, up, side, back, height: h, bend } = frame;
    const { layer } = p;
    const rise = layer.reach * h * f * p.stride;
    const curl = rise * f;
    const sweep = curl * (frame.curl + p.tilt);
    const fall = (layer.fall ?? 0) * h * f * f;
    return [0, 1, 2].map(
      (k) => root[k] + up[k] * rise + back[k] * sweep + bend[k] * curl + side[k] * p.offset * frame.width * h * (1 - 0.6 * f) + p.scatter[k] * (layer.burst ?? 0) * h * f - (k === 1 ? fall : 0),
    );
  }

  function update(emitters, time) {
    let dt = clock === null ? 0 : time - clock;
    clock = time;
    if (!(dt >= 0)) {
      systems.clear();
      total = 0;
      dt = 0;
    }
    dt = Math.min(dt, 0.1);
    const seen = new Set();
    for (const emitter of emitters) {
      seen.add(emitter.key);
      if (!systems.has(emitter.key)) systems.set(emitter.key, { particles: [], carry: new Map(), last: null, velocities: null });
      const system = systems.get(emitter.key);
      const fresh = !system.last || system.last.length !== emitter.anchors.length;
      system.velocities = emitter.anchors.map((a, i) => {
        const was = system.velocities?.[i] ?? [0, 0, 0];
        if (fresh || !dt) return was;
        const v = a.p.map((x, k) => (x - system.last[i][k]) / dt);
        return Math.hypot(...v.map((x, k) => x - was[k])) > MAX_ACCELERATION * dt ? was : v;
      });
      system.last = emitter.anchors.map((a) => a.p);
      system.anchors = emitter.anchors;
      system.look = looks[emitter.element];
      system.palette = manePalette[emitter.element];
      for (const p of system.particles) p.age += dt;
      const before = system.particles.length;
      system.particles = system.particles.filter((p) => p.age < p.life);
      total -= before - system.particles.length;
      for (const layer of system.look.layers) {
        const due = (system.carry.get(layer) ?? 0) + layer.rate * emitter.anchors.length * dt;
        const n = Math.floor(due);
        system.carry.set(layer, due - n);
        for (let i = 0; i < n && total < MAX_PARTICLES; i++, total++)
          system.particles.push({
            layer,
            along: rootAlong(layer, emitter.anchors.length - 1, random),
            tilt: (random() - 0.5) * 0.6,
            offset: (random() * 2 - 1) * layer.spread,
            stride: 0.75 + 0.5 * random(),
            scatter: norm([random() - 0.5, random() - 0.2, random() - 0.5]),
            age: random() * dt,
            life: layer.life[0] + (layer.life[1] - layer.life[0]) * random(),
            spin: random() * Math.PI,
          });
      }
      system.time = time;
    }
    for (const [key, system] of systems)
      if (!seen.has(key)) {
        total -= system.particles.length;
        systems.delete(key);
      }
  }

  function build(eye) {
    if (scratch.length < total * 6 * FLOATS) scratch = new Float32Array(total * 6 * FLOATS);
    let n = 0;
    const put = (p, x, y, c, kind) => {
      scratch.set([p[0], p[1], p[2], x, y, c[0], c[1], c[2], c[3], c[4], kind], n);
      n += FLOATS;
    };
    for (const system of systems.values()) {
      const frames = new Map();
      for (const p of system.particles) {
        const { layer } = p;
        const key = Math.round(p.along * 8);
        if (!frames.has(key)) frames.set(key, frameAt(system, key / 8, system.time));
        const frame = frames.get(key);
        const t = p.age / p.life;
        const size = frame.height * (0.4 + 0.6 * frame.width) * (layer.size[0] + (layer.size[1] - layer.size[0]) * t);
        const color = ramp(system.palette[layer.colors], t);
        const top = place(frame, p, t);
        const foot = layer.tail ? place(frame, p, Math.max(0, t - layer.tail)) : top;
        const along = top.map((v, k) => v - foot[k]);
        const length = Math.hypot(...along);
        const toEye = norm(eye.map((v, k) => v - top[k]));
        const lift = toEye.map((v) => v * LIFT_TO_EYE * frame.height);
        let x, y, ends;
        if (length < size * 0.25) {
          const r0 = norm(cross(toEye, Math.abs(toEye[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0])),
            u0 = cross(r0, toEye);
          const c = Math.cos(p.spin + p.age * 3),
            s = Math.sin(p.spin + p.age * 3);
          x = r0.map((v, k) => (v * c + u0[k] * s) * size);
          y = r0.map((v, k) => (u0[k] * c - v * s) * size);
          ends = [top, top];
        } else {
          const dir = along.map((v) => v / length);
          x = norm(cross(dir, toEye)).map((v) => v * size);
          y = dir.map((v) => v * size);
          ends = [foot, top];
        }
        const corner = (end, sx, sy) => ends[end].map((v, k) => v + lift[k] + x[k] * sx + y[k] * sy);
        const p00 = corner(0, -1, -1),
          p10 = corner(0, 1, -1),
          p01 = corner(1, -1, 1),
          p11 = corner(1, 1, 1);
        put(p00, -1, -1, color, layer.kind);
        put(p10, 1, -1, color, layer.kind);
        put(p11, 1, 1, color, layer.kind);
        put(p00, -1, -1, color, layer.kind);
        put(p11, 1, 1, color, layer.kind);
        put(p01, -1, 1, color, layer.kind);
      }
    }
    return { data: scratch.subarray(0, n), count: n / FLOATS };
  }

  return { update, build };
}
