import { breathPalette } from "../palette.js";
import { multiply, point } from "../math3d.js";
import { makeRng } from "../rng.js";
import { mouthPoint } from "../breath/mouthPoint.js";

const FLOATS = 11,
  MAX_PARTICLES = 2400,
  STEP_LIMIT = 0.25,
  KINDS = { puff: 0, shard: 1, spark: 2, bolt: 2 };

const norm = (v) => {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
};
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Two unit vectors square to `d` and each other. */
function basis(d) {
  const u = norm(cross(d, Math.abs(d[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]));
  return [u, cross(d, u)];
}

/** Colour at `t` along a `breathPalette` ramp, as `[r, g, b, alpha, glow]`. */
function ramp(stops, t) {
  const x = Math.max(0, Math.min(1, t)) * (stops.length - 1);
  const i = Math.min(stops.length - 2, Math.floor(x)),
    f = x - i;
  return stops[i].map((v, k) => v + (stops[i + 1][k] - v) * f);
}

/**
 * Where a posed racer breathes from: `origin` in the mouth and `direction` split between the head
 * and the open jaw. `bones` are its bone matrices, `model` its model matrix.
 */
export function breathEmitter(racer, bones, model) {
  const ids = racer.anatomy.bones.map((bone) => bone.id);
  const jaw = multiply(model, bones[ids.indexOf("jaw")]),
    head = multiply(model, bones[ids.indexOf("head")]);
  return {
    key: racer.anatomy,
    element: racer.breath.element,
    strength: racer.breath.strength,
    origin: point(jaw, mouthPoint(racer.anatomy)),
    direction: norm([0, 1, 2].map((k) => 5 * head[k] + jaw[k])),
    radius: racer.anatomy.bounds?.radius ?? 8,
    velocity: racer.velocity ?? [0, 0, 0],
  };
}

/**
 * Breath plumes as world-space particles that outlive the breath that made them and keep the
 * velocity of the racer that breathed them. Feed `update` the breathing racers' emitters each frame,
 * then `build` the quads to draw. An emitter with `origins` spawns each particle at one of those points
 * instead of its `origin`, so a status can smoulder all over a body.
 */
export function createBreathPlume() {
  const random = makeRng("breath-plume");
  const systems = new Map();
  let clock = null,
    total = 0,
    scratch = new Float32Array(0);

  function spawn(system, layer, emitter, dt, n) {
    const { direction, radius: r, origins } = emitter;
    const [u, w] = basis(direction);
    for (let i = 0; i < n && total < MAX_PARTICLES; i++) {
      const origin = origins ? origins[Math.floor(random() * origins.length)] : emitter.origin;
      const angle = layer.spread * Math.sqrt(random()),
        turn = 2 * Math.PI * random();
      const side = [0, 1, 2].map((k) => u[k] * Math.cos(turn) + w[k] * Math.sin(turn));
      const d = [0, 1, 2].map((k) => direction[k] * Math.cos(angle) + side[k] * Math.sin(angle));
      const speed = layer.speed * r * (0.8 + 0.4 * random()) * (0.6 + 0.4 * emitter.strength);
      const lead = random() * dt;
      const velocity = d.map((v) => v * speed);
      system.particles.push({
        layer,
        position: origin.map((v, k) => v + (velocity[k] + emitter.velocity[k]) * lead),
        velocity,
        carry: emitter.velocity,
        age: lead,
        life: layer.life[0] + (layer.life[1] - layer.life[0]) * random(),
        radius: r,
        spin: random() * Math.PI,
        phase: random() * 6.28,
        side,
      });
      total++;
    }
  }

  /** Jagged bolts in the mouth's frame, as (along, sideways, up) offsets in body radii. */
  function strike(layer) {
    const paths = [];
    for (let b = 0; b < (layer.bolts ?? 1); b++) paths.push(...branch(layer));
    return paths;
  }

  function branch(layer) {
    const paths = [];
    const trunk = [[0, 0, 0]];
    const steps = 9;
    for (let i = 1; i <= steps; i++) {
      const along = (layer.reach * i) / steps;
      const j = layer.jitter * layer.reach * Math.sqrt(i / steps);
      trunk.push([along, (random() * 2 - 1) * j, (random() * 2 - 1) * j]);
    }
    paths.push(trunk);
    for (let f = 0; f < layer.forks; f++) {
      const from = trunk[2 + Math.floor(random() * (steps - 4))];
      const heading = norm([1, random() * 1.6 - 0.8, random() * 1.6 - 0.8]);
      const fork = [from];
      for (let i = 1; i <= 3; i++) {
        const p = fork[i - 1];
        const j = layer.jitter * layer.reach * 0.3;
        fork.push(p.map((v, k) => v + heading[k] * layer.reach * 0.08 + (k ? (random() * 2 - 1) * j : 0)));
      }
      paths.push(fork);
    }
    return paths;
  }

  function update(emitters, time) {
    let dt = clock === null ? 0 : time - clock;
    clock = time;
    if (!(dt >= 0)) {
      systems.clear();
      total = 0;
      dt = 0;
    }
    dt = Math.min(dt, STEP_LIMIT);
    for (const emitter of emitters) {
      if (!systems.has(emitter.key)) systems.set(emitter.key, { particles: [], carry: new Map(), bolts: new Map(), emitter });
      const system = systems.get(emitter.key);
      system.emitter = emitter;
      system.live = true;
      for (const layer of emitter.element.layers) {
        if (layer.kind === "bolt") {
          const bolt = system.bolts.get(layer);
          if (emitter.strength > 0.15 && (!bolt || time - bolt.at >= layer.flicker || time < bolt.at))
            system.bolts.set(layer, { at: time, paths: strike(layer) });
          continue;
        }
        const due = (system.carry.get(layer) ?? 0) + layer.rate * emitter.strength * dt;
        const n = Math.floor(due);
        system.carry.set(layer, due - n);
        spawn(system, layer, emitter, dt, n);
      }
    }
    for (const [key, system] of systems) {
      if (!system.live) {
        system.bolts.clear();
        system.emitter = null;
      }
      system.live = false;
      for (const p of system.particles) {
        const { layer } = p;
        p.age += dt;
        const damp = Math.exp(-layer.drag * dt);
        p.velocity = p.velocity.map((v, k) => v * damp + (k === 1 ? layer.lift * p.radius * dt : 0));
        const swirl = (layer.swirl ?? 0) * p.radius * Math.sin(p.age * 9 + p.phase) * dt;
        p.position = p.position.map((v, k) => v + (p.velocity[k] + p.carry[k]) * dt + p.side[k] * swirl);
      }
      const before = system.particles.length;
      system.particles = system.particles.filter((p) => p.age < p.life);
      total -= before - system.particles.length;
      if (!system.particles.length && !system.emitter) systems.delete(key);
    }
  }

  function build(eye) {
    let quads = total;
    for (const system of systems.values()) for (const paths of system.bolts.values()) for (const path of paths.paths) quads += 2 * (path.length - 1);
    if (scratch.length < quads * 6 * FLOATS) scratch = new Float32Array(quads * 6 * FLOATS);
    let n = 0;
    const put = (p, x, y, c, kind) => {
      scratch.set([p[0], p[1], p[2], x, y, c[0], c[1], c[2], c[3], c[4], kind], n);
      n += FLOATS;
    };
    /** A quad from `a` to `b` of half-width `size`; a point when they meet, turned by `spin`. */
    const quad = (a, b, size, color, kind, spin = 0) => {
      const mid = a.map((v, k) => (v + b[k]) / 2);
      const view = norm(eye.map((v, k) => v - mid[k]));
      const along = b.map((v, k) => v - a[k]);
      const length = Math.hypot(...along);
      let x, y, ends;
      if (length < size * 0.5) {
        const [r0, u0] = basis(view);
        const c = Math.cos(spin),
          s = Math.sin(spin);
        x = r0.map((v, k) => (v * c + u0[k] * s) * size);
        y = r0.map((v, k) => (u0[k] * c - v * s) * size);
        ends = [mid, mid];
      } else {
        const dir = along.map((v) => v / length);
        x = norm(cross(dir, view)).map((v) => v * size);
        y = dir.map((v) => v * size);
        ends = [a, b];
      }
      const corner = (end, sx, sy) => ends[end].map((v, k) => v + x[k] * sx + y[k] * sy);
      const p00 = corner(0, -1, -1),
        p10 = corner(0, 1, -1),
        p01 = corner(1, -1, 1),
        p11 = corner(1, 1, 1);
      put(p00, -1, -1, color, kind);
      put(p10, 1, -1, color, kind);
      put(p11, 1, 1, color, kind);
      put(p00, -1, -1, color, kind);
      put(p11, 1, 1, color, kind);
      put(p01, -1, 1, color, kind);
    };
    for (const system of systems.values()) {
      for (const p of system.particles) {
        const { layer } = p;
        const t = p.age / p.life;
        const size = p.radius * (layer.size[0] + (layer.size[1] - layer.size[0]) * Math.sqrt(t));
        const color = ramp(breathPalette[layer.colors], t);
        const tail = layer.stretch ? p.position.map((v, k) => v - p.velocity[k] * layer.stretch) : p.position;
        quad(tail, p.position, size, color, KINDS[layer.kind], p.spin + p.age * 2);
      }
      const e = system.emitter;
      if (!e) continue;
      const [u, w] = basis(e.direction);
      const toWorld = (o) => e.origin.map((v, k) => v + (e.direction[k] * o[0] + u[k] * o[1] + w[k] * o[2]) * e.radius);
      for (const [layer, bolt] of system.bolts) {
        const stops = breathPalette[layer.colors];
        for (const path of bolt.paths) {
          const points = path.map(toWorld);
          for (let i = 0; i < points.length - 1; i++) {
            const t = path[i + 1][0] / layer.reach;
            const color = ramp(stops, t * 0.85);
            color[3] *= e.strength;
            const width = layer.width * e.radius * (1.2 - 0.6 * t);
            const halo = ramp(stops, 1);
            halo[3] *= 0.35 * e.strength;
            quad(points[i], points[i + 1], width * 4, halo, KINDS.bolt);
            quad(points[i], points[i + 1], width, color, KINDS.bolt);
          }
        }
      }
    }
    return { data: scratch.subarray(0, n), count: n / FLOATS };
  }

  return { update, build };
}
