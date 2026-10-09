import { palette } from "../palette.js";
import { point, transform } from "../math3d.js";
import { add, cross, dot, normalize, scale, sub } from "../vec3.js";
import { part } from "./parts.js";
import { cast, near, rounded } from "./meshCast.js";

const cap = 1.2;

/** The share of a dome eye's crown sunk below the skin. */
export const eyeSink = 0.5;

/**
 * An eye as a shallow dome half sunk into the head on side `s`, so its edges curve into the skin
 * rather than sitting on it: `at` is where its crown's centre meets the skin, `size` the
 * footprint's half width and height there, `bulge` the crown's height from footprint to top. The
 * iris covers the top of the dome, ringed in ink down to the skin line, a ring that thins from a
 * kid's (`maturity` 0) to an adult's, and a cup of skin no wider than that line runs from it deep
 * into the skull; the slit pupil follows the dome's curve, `pupil` its half width and height and `shift` how far
 * forwards of the centre it sits. The dome faces local `+z` on the right and `-z` on the left.
 */
export function eyeDome({ parts, eye: iris, skin: hide, maturity = 1 }, s, { at: skin, size: [w, h], bulge, rotation, pupil: [pw, ph], shift = 0 }) {
  const reach = Math.sqrt(1 - (Math.cos(cap) + eyeSink * (1 - Math.cos(cap))) ** 2),
    line = Math.asin(reach),
    ring = Math.asin((1 - (0.1 - 0.05 * maturity)) * reach),
    radii = [w / reach, h / reach, bulge / (1 - Math.cos(cap))],
    turn = transform([0, 0, 0], rotation),
    base = add(skin, point(turn, [0, 0, -s * eyeSink * bulge])),
    dome = { segments: 12, rest: cap, facing: s };
  part(parts, `eye-${s}`, "head", "dome", base, radii, iris, rotation, { ...dome, cap: ring });
  part(parts, `eye-rim-${s}`, "head", "dome", [...base], [...radii], palette.ink, rotation, { ...dome, cap: line, from: ring });
  part(parts, `eye-socket-${s}`, "head", "dome", [...base], [w, h, radii[2]], hide, rotation, {
    ...dome,
    rest: Math.acos(Math.cos(cap) - Math.cos(line)),
    cap: Math.PI,
    from: Math.PI / 2,
  });
  const pupilCap = Math.asin(Math.min(0.9 * Math.sin(ring), ph / radii[1])),
    sag = radii[2] * (1 - Math.sqrt(1 - (shift / radii[0]) ** 2)),
    at = add(base, point(turn, [shift, 0, -s * sag]));
  part(parts, `pupil-${s}`, "head", "dome", at, [(1.5 * pw) / Math.sin(pupilCap), radii[1], 1.12 * radii[2]], palette.ink, rotation, {
    segments: 8,
    cap: pupilCap,
    rest: cap,
    facing: s,
  });
}

/** Footprint half width and height and crown height of an eye part, dome or not. */
export function eyeExtent({ shape, scale, cap: c, rest = c }) {
  if (shape !== "dome") return scale;
  return [scale[0] * Math.sin(rest), scale[1] * Math.sin(rest), scale[2] * (1 - Math.cos(rest))];
}

/** The head's skull mesh, the one the eyes and brows sit on. */
export const skullOf = (parts) =>
  parts.find(({ id, bone, vertices }) => bone === "head" && vertices && id.startsWith("cranial-") && !id.startsWith("cranial-crest"));

export const unturn = (m, [x, y, z]) => [m[0] * x + m[1] * y + m[2] * z, m[4] * x + m[5] * y + m[6] * z, m[8] * x + m[9] * y + m[10] * z];

/**
 * Seats each dome eye in the skull: the skin round its iris is found along the eye's axis on the
 * skull mesh as the rounded styles draw it, and the eye with its rim, socket and pupil turns to face straight out of that patch
 * and sinks into it until the iris's edge meets the skin, but never so far that the skull shows
 * through the iris or its ring.
 */
export function seatEyes(parts) {
  const flat = skullOf(parts);
  if (!flat) return;
  const level = Math.cos(cap) + eyeSink * (1 - Math.cos(cap)),
    reach = Math.sqrt(1 - level * level);
  for (const s of [-1, 1]) {
    const eye = parts.find(({ id }) => id === `eye-${s}`);
    if (eye?.shape !== "dome") continue;
    const turn = transform([0, 0, 0], eye.rotation),
      normal = point(turn, [0, 0, s]),
      crown = eye.scale[2] * (1 - Math.cos(cap)),
      centre = add(eye.position, scale(normal, eyeSink * crown)),
      lift = 4 * (crown + Math.max(eye.scale[0], eye.scale[1]));
    const skull = rounded(near(flat, centre, 1.5 * Math.max(eye.scale[0], eye.scale[1])));
    const ring = [];
    for (let i = 0; i < 12; i++) {
      const a = (Math.PI * 2 * i) / 12,
        from = add(add(centre, point(turn, [eye.scale[0] * reach * Math.cos(a), eye.scale[1] * reach * Math.sin(a), 0])), scale(normal, lift)),
        d = cast(skull, from, scale(normal, -1));
      if (d < Infinity) ring.push(add(from, scale(normal, -d)));
    }
    if (ring.length < 9) continue;
    const middle = scale(ring.reduce(add, [0, 0, 0]), 1 / ring.length);
    let facing = ring.reduce((n, p, i) => add(n, cross(sub(p, middle), sub(ring[(i + 1) % ring.length], middle))), [0, 0, 0]);
    facing = normalize(dot(facing, normal) < 0 ? scale(facing, -1) : facing);
    const [z] = eye.rotation.slice(2),
      local = scale(facing, s),
      v = [local[0] * Math.cos(z) + local[1] * Math.sin(z), -local[0] * Math.sin(z) + local[1] * Math.cos(z), local[2]],
      rotation = [Math.asin(Math.max(-1, Math.min(1, -v[1]))), Math.atan2(v[0], v[2]), z],
      turned = transform([0, 0, 0], rotation);
    let rise = 0;
    for (const r of [0, 0.35, 0.7, 0.9, 1])
      for (let i = 0; i < (r ? 12 : 1); i++) {
        const a = (Math.PI * 2 * i) / 12,
          [x, y] = [r * reach * Math.cos(a), r * reach * Math.sin(a)],
          from = add(add(middle, point(turned, [eye.scale[0] * x, eye.scale[1] * y, 0])), scale(facing, lift)),
          d = cast(skull, from, scale(facing, -1));
        if (d === Infinity) continue;
        const dome = eye.scale[2] * (Math.sqrt(Math.max(0, 1 - x * x - y * y)) - level);
        rise = Math.max(rise, lift - d - dome);
      }
    const base = sub(add(middle, scale(facing, rise + 0.03 * crown)), scale(facing, eyeSink * crown)),
      origin = eye.position;
    for (const p of parts.filter(({ id }) => [`eye-${s}`, `eye-rim-${s}`, `eye-socket-${s}`, `pupil-${s}`].includes(id))) {
      p.position = add(base, point(turned, unturn(turn, sub(p.position, origin))));
      p.rotation = rotation;
    }
  }
}

/**
 * A seated dome eye's frame: its rotation `turn`, outward `normal`, forward `along` and `up` axes,
 * the `centre` of its iris's edge at the skin and that edge's half width and height `size`; the
 * dome is part of an ellipsoid round `core` with `radii` along those axes, and `level` is the
 * share of the outward radius at which it meets the skin.
 */
export function eyeFrame(eye, s) {
  const level = Math.cos(cap) + eyeSink * (1 - Math.cos(cap)),
    reach = Math.sqrt(1 - level * level),
    turn = transform([0, 0, 0], eye.rotation),
    normal = point(turn, [0, 0, s]),
    core = sub(eye.position, scale(normal, eye.scale[2] * Math.cos(cap)));
  return {
    turn,
    normal,
    along: point(turn, [1, 0, 0]),
    up: point(turn, [0, 1, 0]),
    centre: add(core, scale(normal, level * eye.scale[2])),
    size: [eye.scale[0] * reach, eye.scale[1] * reach],
    core,
    radii: [...eye.scale],
    level,
  };
}
