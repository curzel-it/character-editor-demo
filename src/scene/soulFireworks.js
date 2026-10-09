import { breathElements } from "../breath/breathElements.js";
import { breathPalette, fireworkPalette } from "../palette.js";
import { makeRng } from "../rng.js";
import { basis, createBillboards, ramp } from "./billboards.js";
import { shellStars } from "./fireworkShells.js";

/**
 * When each part of the ritual's fireworks starts, in seconds from the first breath: the plumes pour
 * onto the altar, `merge` into a vortex and an orb that gathers and holds its breath, `burst` into
 * rising streams and shells, `settle` as glittering dust while one soul-light per parent spirals down,
 * and at `reveal` those lights reach the altar, where the egg appears or the lights go out. `end` is
 * when the last of it has faded.
 */
export const fireworksPhases = Object.freeze({ breath: 0, merge: 3.2, burst: 5, settle: 9.4, reveal: 12.4, end: 14.2 });

const P = fireworksPhases;
const KIND = { puff: 0, shard: 1, spark: 2, bolt: 2, glint: 3, glow: 4 };
const BREATH_END = 3.3,
  ORB_HEIGHT = 0.95,
  FINALE = 8.1,
  SOULS_FROM = 8.9;

const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (a, b, t) => a.map((v, k) => v + (b[k] - v) * t);
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const smooth = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const beat = (t, at) => Math.exp(-(((t - at) / 0.07) ** 2));
const unit = (v) => scale(v, 1 / (Math.hypot(v[0], v[1], v[2]) || 1));

/** A deterministic 0..1 from two integers, for twinkles and flickers that must not use the wall clock. */
function hash(a, b) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul((b + 0x632be5ab) | 0, 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x2c1b3c6d);
  h ^= h >>> 12;
  h = Math.imul(h, 0x297a2d39);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

/** Position after `age` seconds from `p0` at `v0` under linear `drag` and a downward `fall` acceleration. */
function ballistic(p0, v0, drag, fall) {
  const g = fall / drag;
  return (age) => {
    const e = (1 - Math.exp(-drag * age)) / drag;
    return [p0[0] + v0[0] * e, p0[1] + (v0[1] + g) * e - g * age, p0[2] + v0[2] * e];
  };
}

function randomUnit(random) {
  const y = random() * 2 - 1,
    a = random() * Math.PI * 2,
    r = Math.sqrt(1 - y * y);
  return [r * Math.cos(a), y, r * Math.sin(a)];
}

/** The dust ramp leaned towards an element's hue. */
function dustOf(hue, share) {
  return fireworkPalette.dust.map(([r, g, b, a, glow]) => [...mix([r, g, b], hue, share), a, glow]);
}

/** The element entry for an id or an entry. */
const elementOf = (e) => breathElements.find((b) => b.id === (typeof e === "string" ? e : e?.id)) ?? breathElements[0];

/**
 * The Soul Altar's fireworks, fixed by `seed` and drawn as a pure function of `t` (seconds since the
 * breath started). `elements[i]` (breath element ids or entries) is breathed from `origins[i]`, the
 * parents' mouths, at `altar`, the top of the altar stone. `result` shapes the reveal: true gathers
 * the lights into the stone in a flash (the egg's moment), false lets them gutter out, and null fades
 * them softly. `radius` is the parents' body radius, which sizes the plumes; `ground` the height a
 * circle of light is drawn at around the altar.
 * `build(t, eye)` returns breath-shader quads, `light(t)` the `{ color, strength }` the
 * altar and its surroundings take from the show.
 * @param {{ elements: (string|{id: string})[], origins: number[][], altar: number[], seed?: string|number,
 *   result?: boolean|null, radius?: number }} options
 */
export function createSoulFireworks({ elements, origins, altar, seed = "soul-altar", result = null, radius, ground }) {
  if (!origins.length || origins.length !== elements.length) throw new Error("Each origin needs one element.");
  const random = makeRng(`${seed}:fireworks`);
  const circle = elements.map(elementOf);
  const ids = circle.map((e) => e.id);
  const distinct = [...new Set(ids)];
  const n = origins.length;
  const R = origins.reduce((sum, o) => sum + Math.hypot(o[0] - altar[0], o[2] - altar[2]), 0) / n || 12;
  const body = radius ?? R * 0.6;
  const U = Math.max(R, body * 1.5);
  const up = [0, 1, 0];
  const A = altar;
  const M = add(A, [0, U * ORB_HEIGHT, 0]);
  const hues = distinct.map((id) => fireworkPalette[id].hue);
  const star = U * 0.036;
  const particles = [];
  const bursts = [];
  let serial = 1;

  /** Adds a particle: `path(age)` gives its position; the rest describes how it draws. */
  function emit(p) {
    particles.push({ id: serial++, trail: 0, segments: 1, head: 0, twinkle: 0, strobe: 0, alpha: 1, fadeIn: 0, spin: random() * 6.28, kind: KIND.glint, ...p });
  }

  const envelope = (t) => smooth(0, 0.35, t) * (1 - smooth(2.85, BREATH_END, t));

  origins.forEach((O, i) => {
    const element = circle[i];
    const to = [A[0] - O[0], A[1] - O[1], A[2] - O[2]];
    const distance = Math.hypot(...to);
    const direction = scale(to, 1 / distance);
    const control = add(mix(O, A, 0.5), [0, distance * 0.08, 0]);
    const travel = 0.5 * Math.sqrt(distance / 12);
    const bezier = (u) => O.map((v, k) => (1 - u) * (1 - u) * v + 2 * (1 - u) * u * control[k] + u * u * A[k]);
    const [bu, bw] = basis(direction);
    for (const layer of element.layers) {
      if (layer.kind === "bolt") continue;
      const count = Math.round(layer.rate * BREATH_END * 1.1);
      for (let j = 0; j < count; j++) {
        const born = random() * BREATH_END;
        if (random() > envelope(born)) continue;
        const turn = random() * Math.PI * 2;
        const side = add(scale(bu, Math.cos(turn)), scale(bw, Math.sin(turn)));
        const spread = layer.spread * distance * (0.3 + 0.7 * Math.sqrt(random()));
        const phase = random() * 6.28;
        const out = unit([side[0], 0, side[2]]);
        const swirl = (layer.swirl ?? 0) * body * 0.15;
        emit({
          born,
          life: travel * (0.9 + 0.4 * random()),
          kind: KIND[layer.kind],
          colors: breathPalette[layer.colors],
          hot: 0.55,
          alpha: 0.7,
          size: [layer.size[0] * body, layer.size[1] * body],
          trail: layer.stretch ? layer.stretch * 0.8 : 0,
          path: (age) => {
            const x = age / travel;
            const u = x < 1 ? 1 - (1 - x) ** 1.4 : 1;
            const bulge = spread * u * (1 - 0.7 * u);
            let p = add(bezier(u), scale(side, bulge + swirl * Math.sin(age * 9 + phase)));
            p = add(p, [0, 0.35 * layer.lift * body * age * age, 0]);
            if (x > 1) p = add(p, add(scale(out, (x - 1) * R * 0.25), [0, (x - 1) * R * 0.18, 0]));
            return p;
          },
        });
      }
    }
  });

  for (let j = 0; j < 150 + 25 * n; j++) {
    const born = 2.1 + random() * 2.4;
    const element = ids[Math.floor(random() * n)];
    const life = 0.9 + 0.4 * random();
    const theta = random() * Math.PI * 2;
    const spin = 4 + 3 * random();
    const width = U * (0.26 + 0.12 * random());
    emit({
      born,
      life,
      kind: KIND.spark,
      colors: fireworkPalette[element].star,
      hot: 0.5,
      size: [star * 0.8, star * 0.5],
      trail: 0.12,
      segments: 3,
      head: 1,
      twinkle: 0.3,
      fadeIn: 0.15,
      path: (age) => {
        const x = Math.min(1, age / life);
        const r = width * Math.sin(Math.PI * x) ** 0.8 * (1 - 0.55 * x) + U * 0.015;
        const a = theta + spin * age + x * 2.5;
        return add(A, [r * Math.cos(a), U * ORB_HEIGHT * x ** 0.85, r * Math.sin(a)]);
      },
    });
  }

  /** A burst of `element` stars at `centre`, fired at `born`; `turnTo` is the element its stars change into. */
  function burst(element, centre, born, reach, count, turnTo = null) {
    const stars = shellStars(element, count, random);
    const palette = fireworkPalette[element];
    const bolts = [];
    for (const s of stars) {
      const path = ballistic(centre, scale(s.dir, reach * s.drag * s.speed), s.drag, s.fall * reach);
      const life = s.life;
      emit({
        born,
        life,
        kind: KIND.glint,
        colors: palette.star,
        change: turnTo ? { at: 0.5, colors: fireworkPalette[turnTo].spent } : null,
        size: [star * 1.1, star * 0.7],
        fadeIn: 0.3,
        trail: s.trail,
        segments: s.segments,
        head: s.head,
        twinkle: s.twinkle,
        strobe: s.strobe,
        path,
      });
      for (let c = 0; c < s.crackle; c++) {
        const from = path(life * 0.96);
        const v = scale(randomUnit(random), reach * 0.3);
        emit({ born: born + life * 0.96, life: 0.2 + 0.15 * random(), kind: KIND.glint, colors: fireworkPalette.dust, size: [star * 0.9, star * 0.4], twinkle: 0.7, path: ballistic(from, v, 4, reach * 0.3) });
      }
      for (let d = 0; d < s.drips; d++) {
        const at = life * (0.35 + 0.4 * random());
        const from = path(at);
        emit({
          born: born + at,
          life: 0.9 + 0.5 * random(),
          kind: KIND.puff,
          colors: breathPalette.leaf,
          size: [star * 0.45, star * 0.3],
          path: ballistic(from, [0, -reach * 0.1, 0], 1, reach * 0.5),
        });
      }
      if (s.strobe && bolts.length < 5 && s.speed > 0.9) bolts.push(path);
    }
    bursts.push({ element, centre, born, reach, bolts, count: Math.min(40, count) });
  }

  burst(ids[0], M, P.burst, U * 0.75, Math.max(0, 40 - 4 * n), distinct.length > 1 ? distinct[1] : null);
  ids.forEach((id) => burst(id, M, P.burst, U * 0.75, 18, null));

  const shells = Math.max(3, Math.min(7, n + 1));
  const start = Math.floor(random() * n);
  const comets = [];
  for (let k = 0; k < shells; k++) {
    const element = ids[(start + k) % n];
    const next = distinct[(distinct.indexOf(element) + 1) % distinct.length];
    const launch = P.burst + 0.35 + (k * 2.3) / (shells - 1);
    const angle = random() * Math.PI * 2;
    const lateral = U * (0.35 + 0.45 * random());
    const target = add(M, [Math.cos(angle) * lateral, U * (0.55 + 0.55 * random()), Math.sin(angle) * lateral]);
    const flight = 0.7 + 0.15 * random();
    const rise = (x) => {
      const u = 1 - (1 - x) ** 2;
      return add(mix(M, target, u), [0, Math.sin(Math.PI * x) * U * 0.05, 0]);
    };
    comets.push({ element, launch, flight, rise });
    emit({ born: launch, life: flight, kind: KIND.glint, colors: fireworkPalette[element].star, hot: 0.2, size: [star * 1.6, star * 1.4], trail: 0.14, segments: 3, head: 1.3, path: (age) => rise(Math.min(1, age / flight)) });
    for (let g = 0; g < 16; g++) {
      const x = g / 16,
        born = launch + x * flight;
      emit({
        born,
        life: 0.5 + 0.4 * random(),
        kind: KIND.glint,
        colors: dustOf(fireworkPalette[element].hue, 0.35),
        size: [star * 0.8, star * 0.3],
        twinkle: 0.8,
        path: ballistic(rise(x), scale(randomUnit(random), U * 0.04), 2, U * 0.12),
      });
    }
    burst(element, target, launch + flight, U * (0.55 + 0.12 * random()), 52 + 3 * n, distinct.length > 1 && k % 2 ? next : null);
  }

  const finale = add(M, [0, U * 0.8, 0]);
  if (distinct.length > 1)
    distinct.forEach((id, i) => burst(id, finale, FINALE + i * 0.06, U * 1.05, Math.round(100 / distinct.length) + 8, distinct[(i + 1) % distinct.length]));
  else {
    burst(distinct[0], finale, FINALE, U * 1.05, 100, null);
    burst(distinct[0], finale, FINALE + 0.25, U * 0.6, 50, null);
  }
  const pistil = shellStars("fire", 18, random);
  for (const s of pistil)
    emit({ born: FINALE + 0.08, life: 1.6 + random() * 0.6, colors: fireworkPalette.dust, size: [star, star * 0.6], trail: 0.08, head: 1.2, twinkle: 0.5, path: ballistic(finale, scale(s.dir, U * 0.35 * 2.4 * s.speed), 2.4, U * 0.08) });

  for (let j = 0; j < 220 + 20 * n; j++) {
    const born = 8.3 + random() * 3;
    const element = ids[Math.floor(random() * n)];
    const r0 = U * 1.1 * Math.sqrt(random());
    const theta = random() * Math.PI * 2;
    const y0 = U * (0.5 + 1.5 * random());
    const fall = U * (0.1 + 0.07 * random());
    const sway = random() * 6.28;
    emit({
      born,
      life: Math.min(2.6 + 1.2 * random(), P.end - born),
      colors: dustOf(fireworkPalette[element].hue, 0.6),
      size: [star * 0.75, star * 0.55],
      twinkle: 0.85,
      fadeIn: 0.5,
      path: (age) => {
        const r = r0 * Math.exp(-0.22 * age);
        const a = theta + 0.35 * age;
        return add(A, [r * Math.cos(a) + Math.sin(age * 1.3 + sway) * U * 0.02, Math.max(0, y0 - fall * age), r * Math.sin(a)]);
      },
    });
  }

  const floor = ground ?? A[1] - U * 0.08;
  const bearings = origins.map((O) => Math.atan2(O[2] - A[2], O[0] - A[0]));
  /** How lit the circle is at `t`, and how far each parent's arc has spread around it (0..1). */
  const circleAt = (t) => {
    const spread = smooth(0.4, 2.8, t);
    let lit = smooth(0.2, 0.8, t) * (1 - smooth(P.burst + 0.1, P.burst + 1.4, t));
    lit *= 1 + 0.6 * (beat(t, 3.95) + beat(t, 4.35) + beat(t, 4.7) + beat(t, 4.85));
    if (result === true) lit += smooth(P.reveal - 0.1, P.reveal + 0.1, t) * Math.exp(-Math.max(0, t - P.reveal - 0.1) * 1.4) * 1.2;
    return { spread, lit };
  };
  function drawCircle(q, t) {
    const { spread, lit } = circleAt(t);
    if (lit < 0.01) return;
    const segments = 96;
    const radii = [R * 0.52, R * 0.45];
    let previous = null;
    for (let k = 0; k <= segments; k++) {
      const a = (k / segments) * Math.PI * 2;
      let nearest = 0,
        gap = Infinity;
      bearings.forEach((b, i) => {
        const d = Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
        if (d < gap) [gap, nearest] = [d, i];
      });
      const reach = (Math.PI / n) * spread * 1.02;
      const on = clamp01((reach - gap) / 0.12);
      const point = [A[0] + Math.cos(a) * radii[0], floor + U * 0.01, A[2] + Math.sin(a) * radii[0]];
      if (previous && on > 0) {
        const c = ramp(fireworkPalette[ids[nearest]].star, 0.15);
        c[3] = clamp01(c[3] * lit * on * 0.9);
        q.quad(previous, point, star * 0.32, c, KIND.spark);
        if (hash(k, Math.floor(t * 10)) > 0.9) q.quad(point, point, star * 1.2, c, KIND.glint, t);
      }
      previous = point;
      if (k % 4 === 0 && on > 0) {
        const tick = a + t * 0.25;
        const inner = [A[0] + Math.cos(tick) * radii[1], floor + U * 0.01, A[2] + Math.sin(tick) * radii[1]];
        const outer = [A[0] + Math.cos(tick + 0.03) * (radii[1] + U * 0.035), floor + U * 0.01, A[2] + Math.sin(tick + 0.03) * (radii[1] + U * 0.035)];
        const c = ramp(fireworkPalette[ids[nearest]].star, 0.3);
        c[3] = clamp01(c[3] * lit * on * 0.7);
        q.quad(inner, outer, star * 0.28, c, KIND.spark);
      }
    }
  }

  const souls = origins.map((O, i) => {
    const angle = Math.atan2(O[2] - A[2], O[0] - A[0]);
    return { element: ids[i], angle, height: U * (1.5 + 0.35 * random()), reach: U * (0.6 + 0.2 * random()), phase: random() * 6.28 };
  });
  const soulAt = (soul, t) => {
    const x = smooth(SOULS_FROM, P.reveal, t);
    const r = soul.reach * (1 - x) ** 1.3;
    const a = soul.angle + x * Math.PI * 1.3;
    return add(A, [r * Math.cos(a), lerp(soul.height, U * 0.04, x) + Math.sin(t * 2 + soul.phase) * U * 0.02 * (1 - x), r * Math.sin(a)]);
  };

  if (result === true) {
    for (let j = 0; j < 44; j++) {
      const a = (j / 44) * Math.PI * 2;
      const element = ids[j % n];
      emit({ born: P.reveal + 0.05, life: 1.1, colors: dustOf(fireworkPalette[element].hue, 0.3), size: [star * 1.2, star * 0.5], twinkle: 0.4, path: (age) => add(A, [Math.cos(a) * U * 0.7 * (1 - Math.exp(-3 * age)), U * 0.01, Math.sin(a) * U * 0.7 * (1 - Math.exp(-3 * age))]) });
    }
    for (let j = 0; j < 36; j++) {
      const a = random() * Math.PI * 2,
        r = U * 0.08 * random();
      emit({ born: P.reveal + random() * 0.4, life: 0.9 + 0.4 * random(), colors: fireworkPalette.dust, size: [star * 0.9, star * 0.4], twinkle: 0.7, path: (age) => add(A, [Math.cos(a + age) * r, U * 0.3 * age, Math.sin(a + age) * r]) });
    }
  }
  if (result === false)
    souls.forEach((soul) => {
      const from = soulAt(soul, P.reveal);
      for (let j = 0; j < 6; j++)
        emit({ born: P.reveal + 0.3 + random() * 0.3, life: 0.8 + 0.6 * random(), kind: KIND.puff, colors: breathPalette.mist, size: [star * 1.2, star * 3], path: ballistic(add(from, scale(randomUnit(random), U * 0.02)), [0, U * 0.05, 0], 1.5, -U * 0.02) });
    });

  particles.sort((a, b) => a.born - b.born);

  const hueAt = (t) => {
    if (hues.length === 1) return hues[0];
    const x = (((t / 0.45) % hues.length) + hues.length) % hues.length;
    const i = Math.floor(x);
    return mix(hues[i], hues[(i + 1) % hues.length], smooth(0, 1, x - i));
  };

  function draw(q, p, t) {
    const age = t - p.born;
    const u = age / p.life;
    let colors = p.colors,
      cu = u * (p.hot ? 1 - p.hot : 1);
    if (p.change && u > p.change.at) {
      colors = p.change.colors;
      cu = (u - p.change.at) / (1 - p.change.at);
    }
    const c = ramp(colors, cu);
    let a = p.alpha,
      size = lerp(p.size[0], p.size[1], u);
    if (p.fadeIn) {
      const fade = Math.min(1, age / p.fadeIn);
      a *= fade * fade;
      size *= 0.4 + 0.6 * fade;
    }
    if (p.twinkle) {
      const f = hash(p.id, Math.floor(t * 16));
      const k = f > 0.82 ? 1.8 : 0.35 + 0.65 * f;
      a *= lerp(1, k, p.twinkle);
      size *= lerp(1, 0.7 + 0.6 * f, p.twinkle);
    }
    if (p.strobe && hash(p.id + 7, Math.floor(t * 22)) < p.strobe) a *= 0.12;
    c[3] = Math.min(1, c[3] * a);
    if (c[3] < 0.01) return;
    const pos = p.path(age);
    if (p.trail) {
      for (let s = 0; s < p.segments; s++) {
        const a1 = age - (p.trail * s) / p.segments;
        if (a1 <= 0) break;
        const a0 = Math.max(0, age - (p.trail * (s + 1)) / p.segments);
        const fade = (1 - s / p.segments) ** 1.5;
        const tail = [...c];
        tail[3] *= fade * 0.6;
        q.quad(p.path(a0), s ? p.path(a1) : pos, size * (0.55 - (0.3 * s) / p.segments), tail, KIND.spark);
      }
      if (p.head) q.quad(pos, pos, size * p.head * 1.6, c, KIND.glint, p.spin + age * 3);
    } else q.quad(pos, pos, size * (p.kind === KIND.glint ? 1.6 : 1), c, p.kind, p.spin + age * 2);
  }

  /** A jagged bolt from `a` to `b`, redrawn every `flicker` seconds. */
  function bolt(q, a, b, t, key, width, alpha) {
    const stops = breathPalette.bolt;
    const along = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const length = Math.hypot(...along);
    if (length < 1e-6) return;
    const [bu, bw] = basis(scale(along, 1 / length));
    const frame = Math.floor(t / 0.07);
    const steps = 8;
    let previous = a;
    for (let i = 1; i <= steps; i++) {
      const x = i / steps;
      const j = i === steps ? 0 : length * 0.09 * Math.sin(Math.PI * x);
      const point = add(add(a, scale(along, x)), add(scale(bu, (hash(key + i, frame) - 0.5) * 2 * j), scale(bw, (hash(key + 50 + i, frame) - 0.5) * 2 * j)));
      const color = ramp(stops, x * 0.8);
      color[3] *= alpha;
      const halo = ramp(stops, 1);
      halo[3] *= 0.35 * alpha;
      q.quad(previous, point, width * 4, halo, KIND.bolt);
      q.quad(previous, point, width, color, KIND.bolt);
      previous = point;
    }
  }

  function glow(q, at, size, color, alpha, whiten = 0, light = 1) {
    if (alpha < 0.01) return;
    q.quad(at, at, size, [...mix(color, [1, 1, 1], whiten), clamp01(alpha), light], KIND.glow);
  }

  function build(t, eye) {
    const q = createBillboards(eye);
    if (!(t >= 0 && t < P.end)) return q.result();
    drawCircle(q, t);
    for (const p of particles) {
      if (p.born > t) break;
      if (t - p.born < p.life) draw(q, p, t);
    }

    const pool = envelope(t);
    if (t < P.merge + 0.4) {
      const flicker = 0.85 + 0.15 * hash(3, Math.floor(t * 20));
      glow(q, add(A, [0, U * 0.03, 0]), U * (0.05 + 0.08 * smooth(0, 2.5, t)) * flicker, hueAt(t), 0.4 * pool, 0.1, 0.7);
    }

    ids.forEach((id, i) => {
      if (id !== "storm") return;
      const strength = envelope(t);
      if (strength < 0.15) return;
      for (let k = 0; k < 2; k++) bolt(q, origins[i], add(A, [0, U * 0.03, 0]), t, 1000 * (i + 1) + 97 * k, U * 0.004, strength);
    });

    if (t > 2.6 && t < P.burst + 0.05) {
      const grow = smooth(2.6, 4.3, t);
      const hold = smooth(4.55, 4.98, t);
      const pulse = 0.25 * (beat(t, 3.95) + beat(t, 4.35)) + 0.35 * (beat(t, 4.7) + beat(t, 4.85));
      const rho = U * 0.12 * grow * (1 - 0.55 * hold) * (1 + pulse);
      const hue = hueAt(t);
      glow(q, M, rho * 4, hue, 0.4 + 0.25 * pulse + 0.3 * hold, 0, 0.4);
      glow(q, M, rho * 1.6, hue, 0.95, 0.1 + 0.3 * hold, 0.45);
      q.quad(M, M, rho * 2.6 * (1 + hold), [...mix(hue, [1, 1, 1], 0.35), 0.9, 0.6], KIND.glint, t * 1.5);
      souls.forEach((soul, i) => {
        const tilt = (i / n) * Math.PI;
        const speed = 3 + 5 * hold;
        for (let s = 0; s < 3; s++) {
          const a = soul.phase + t * speed - s * 0.12;
          const r = rho * (2.4 - 1.2 * hold);
          const local = [Math.cos(a) * r, Math.sin(a) * r * Math.sin(tilt), Math.sin(a) * r * Math.cos(tilt)];
          const color = [...fireworkPalette[soul.element].star[1]];
          color[3] *= grow * (1 - s * 0.3);
          q.quad(add(M, local), add(M, local), star * (s ? 1 : 1.8), color, KIND.glint, t * 2);
        }
      });
      if (t > 4.1) {
        for (let k = 0; k < 28; k++) {
          const dir = unit([hash(k, 11) - 0.5, hash(k, 12) - 0.5, hash(k, 13) - 0.5]);
          const x = (t * 1.8 + hash(k, 14)) % 1;
          const r0 = U * 0.6 * (1 - x) ** 2,
            r1 = U * 0.6 * Math.max(0, 1 - x - 0.12) ** 2;
          const color = ramp(fireworkPalette[ids[k % n]].star, 0.2);
          color[3] *= smooth(4.1, 4.5, t) * Math.sin(Math.PI * x);
          q.quad(add(M, scale(dir, r0)), add(M, scale(dir, r1)), star * 0.5, color, KIND.spark);
        }
      }
      if (ids.includes("storm") && t > 3.4)
        for (let k = 0; k < 2; k++) {
          const f = Math.floor(t / 0.09);
          const dir = unit([hash(k, f) - 0.5, hash(k + 3, f) - 0.5, hash(k + 5, f) - 0.5]);
          bolt(q, M, add(M, scale(dir, rho * 3.5)), t, 5000 + k * 31, U * 0.003, 0.8);
        }
    }

    const sinceBurst = t - P.burst;
    if (sinceBurst >= 0 && sinceBurst < 0.35) {
      const x = sinceBurst / 0.35;
      glow(q, M, U * (0.4 + 1.1 * x), hueAt(t), 0.7 * (1 - x) ** 2, 0.3, 0.7);
      q.quad(M, M, U * (0.2 + 0.2 * x), [1, 1, 1, (1 - x) ** 4, 1], KIND.glint, 0.4);
    }
    for (const b of bursts) {
      const age = t - b.born;
      if (age >= 0 && age < 1.6) {
        const x = age / 1.6;
        glow(q, b.centre, b.reach * (0.9 + 0.5 * Math.sqrt(x)), fireworkPalette[b.element].hue, 0.22 * Math.sin(Math.PI * Math.min(1, x * 3)) * (1 - x) ** 1.5 * (b.count / 40), 0, 0.3);
      }
      if (age < 0 || age > 0.5) continue;
      if (b.born > P.burst + 0.01) glow(q, b.centre, b.reach * (0.15 + 0.35 * age / 0.5), fireworkPalette[b.element].hue, 0.4 * (1 - age / 0.5) ** 3, 0, 0.5);
      if (age < 0.32)
        b.bolts.forEach((path, k) => bolt(q, b.centre, path(age), t, 9000 + k * 13 + Math.round(b.born * 100), U * 0.003, 1 - age / 0.32));
    }
    const finaleAge = t - FINALE;
    if (finaleAge > 0 && finaleAge < 0.3) glow(q, finale, U * (0.4 + finaleAge), fireworkPalette.flash, 0.5 * (1 - finaleAge / 0.3) ** 2, 0, 0.8);

    if (t > SOULS_FROM && t < P.end) {
      const arrive = t - P.reveal;
      souls.forEach((soul, i) => {
        let alpha = smooth(SOULS_FROM, SOULS_FROM + 0.8, t);
        if (arrive > 0) {
          if (result === false) alpha *= Math.max(0, 1 - arrive / (0.35 + 0.1 * i)) * (hash(i, Math.floor(t * 24)) > 0.35 ? 1 : 0.2);
          else alpha *= Math.max(0, 1 - arrive / 0.25);
        }
        if (alpha <= 0.01) return;
        const hue = fireworkPalette[soul.element].hue;
        const pulse = 1 + 0.2 * Math.sin(t * 5 + soul.phase);
        for (let s = 3; s >= 1; s--) {
          const back = soulAt(soul, t - s * 0.12);
          const front = soulAt(soul, t - (s - 1) * 0.12);
          q.quad(back, front, star * 0.6, [...mix(hue, [1, 1, 1], 0.15), alpha * 0.7 * (1 - s / 4), 0.5], KIND.spark);
        }
        const at = soulAt(soul, t);
        glow(q, at, U * 0.07 * pulse, hue, 0.7 * alpha, 0.05, 0.45);
        q.quad(at, at, star * 2.6 * pulse, [...mix(hue, [1, 1, 1], 0.3), alpha, 0.6], KIND.glint, t);
      });
      if (t > P.reveal - 0.9 && result !== false) {
        const gather = smooth(P.reveal - 0.9, P.reveal, t) * (1 - smooth(P.reveal, P.reveal + 0.5, t));
        glow(q, add(A, [0, U * 0.04, 0]), U * 0.12, hueAt(t), 0.45 * gather, 0.4);
      }
    }
    if (result === true && t > P.reveal && t < P.end) {
      const x = t - P.reveal;
      const flash = x < 0.12 ? x / 0.12 : Math.exp(-(x - 0.12) * 2.2);
      glow(q, add(A, [0, U * 0.08, 0]), U * (0.35 + 0.25 * Math.min(1, x)), fireworkPalette.flash, 0.9 * flash, 0.2);
      q.quad(add(A, [0, U * 0.1, 0]), add(A, [0, U * 0.1, 0]), U * 0.35 * flash, [1, 1, 1, flash, 1], KIND.glint, 0.3);
    }
    if (result == null && t > P.reveal && t < P.end) {
      const x = t - P.reveal;
      glow(q, add(A, [0, U * 0.05, 0]), U * 0.16, hueAt(t), 0.4 * Math.exp(-x * 1.5), 0.4);
    }
    return q.result();
  }

  function light(t) {
    let strength = 0.35 * envelope(t),
      color = hueAt(t);
    if (t > 2.6 && t < P.burst) {
      const grow = smooth(2.6, 4.3, t),
        hold = smooth(4.55, 4.98, t);
      strength = Math.max(strength, 0.3 + 0.35 * grow + 0.25 * (beat(t, 3.95) + beat(t, 4.35) + beat(t, 4.7) + beat(t, 4.85)) + 0.2 * hold);
    }
    let flash = 0;
    for (const b of bursts) {
      const age = t - b.born;
      if (age >= 0 && age < 1.2) flash = Math.max(flash, (b.born <= P.burst + 0.01 ? 1 : 0.55) * Math.exp(-age * 3));
    }
    if (t >= FINALE && t < FINALE + 1.2) flash = Math.max(flash, 0.8 * Math.exp(-(t - FINALE) * 2.5));
    if (flash > strength) {
      color = mix(color, fireworkPalette.flash, 0.5);
      strength = flash;
    }
    if (t > P.settle - 0.6 && t < P.reveal) strength = Math.max(strength, 0.2 + 0.2 * smooth(P.reveal - 0.9, P.reveal, t));
    if (t >= P.reveal) {
      const x = t - P.reveal;
      if (result === true) {
        strength = x < 0.12 ? 0.4 + 0.6 * (x / 0.12) : 0.25 + 0.75 * Math.exp(-(x - 0.12) * 2.2);
        color = mix(color, fireworkPalette.flash, 0.6);
      } else strength = (result === false ? 0.4 : 0.35) * Math.exp(-x * (result === false ? 3 : 1.5));
    }
    return { color, strength: clamp01(strength) };
  }

  return { phases: P, radius: U, orb: M, build, light, particleCount: particles.length };
}

/** The name of the phase playing at `t`. */
export function fireworksPhase(t) {
  if (t >= P.end) return "done";
  if (t >= P.reveal) return "reveal";
  if (t >= P.settle) return "settle";
  if (t >= P.burst) return "burst";
  if (t >= P.merge) return "merge";
  return "breath";
}
