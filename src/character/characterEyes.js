import { gridSurface, meshPart, tubeSurface, add, cross, mix, scale, sub, unit } from "./surface.js";
import { rgbOf, shade, mixRgb } from "./characterColors.js";

/**
 * Per eye shape: the iris and pupil as shares of the eyeball, how far the upper lid stands open at
 * rest (radians up from the eye line) and the lower lid's rest, the outer corner's tilt, whether the
 * white shows, how many glints, and a slit pupil for cat eyes.
 */
export const eyeStyles = {
  round: { iris: 0.66, pupil: 0.36, open: 0.62, low: -0.8, tilt: 0, white: true, glints: 2 },
  classic: { iris: 0.54, pupil: 0.26, open: 0.48, low: -0.72, tilt: 0, white: true, glints: 1 },
  almond: { iris: 0.58, pupil: 0.28, open: 0.26, low: -0.42, tilt: 0.14, white: true, glints: 1 },
  big: { iris: 0.72, pupil: 0.34, open: 0.8, low: -0.85, tilt: 0, white: true, glints: 3, scale: 1.12 },
  sleepy: { iris: 0.64, pupil: 0.32, open: 0.02, low: -0.62, tilt: -0.04, white: true, glints: 1 },
  bead: { iris: 1, pupil: 0, open: 0.95, low: -1, tilt: 0, white: false, glints: 1, scale: 0.62 },
  cat: { iris: 0.74, pupil: 0.3, open: 0.4, low: -0.6, tilt: 0.2, white: true, glints: 1, slit: true },
  droopy: { iris: 0.64, pupil: 0.32, open: 0.36, low: -0.66, tilt: -0.2, white: true, glints: 2 },
};

const INK = [0.09, 0.07, 0.08];
const WHITE = [0.97, 0.96, 0.94];

/**
 * The eyeball as one sphere painted in rings round the gaze: the pupil (a slit for cat eyes), the iris
 * lighter at its foot, its dark rim, then the white; rows fall on every ring's edge so they stay crisp.
 */
function eyeball(centre, radius, frame, style, iris) {
  const { f, up, side } = frame;
  const pupil = Math.asin(Math.min(0.99, style.white ? style.pupil : 0.01));
  const irisEdge = Math.asin(Math.min(0.99, style.white ? style.iris : 0.98));
  const rim = Math.min(Math.PI * 0.45, irisEdge + 0.08);
  const marks = [0, pupil * 0.5, pupil, (pupil + irisEdge) / 2, irisEdge - 0.045, irisEdge, rim, rim + 0.25, 1.3, 1.9, 2.5, Math.PI];
  const angles = [...new Set(marks.map((a) => Math.min(Math.PI, a)))].sort((x, y) => x - y);
  const C = 40;
  const rows = angles.map((theta) =>
    Array.from({ length: C }, (_, i) => {
      const phi = (i / C) * Math.PI * 2;
      const dir = add(add(scale(f, Math.cos(theta)), scale(up, Math.sin(theta) * Math.sin(phi))), scale(side, Math.sin(theta) * Math.cos(phi)));
      return add(centre, scale(dir, radius));
    }),
  );
  const light = shade(iris, 1.3),
    dark = shade(iris, 0.42);
  const bead = mixRgb(INK, iris, 0.22);
  const color = (j, i) => {
    const theta = (angles[j] + angles[j + 1]) / 2;
    const phi = ((i + 0.5) / C) * Math.PI * 2;
    if (!style.white) return bead;
    const u = Math.sin(theta) * Math.cos(phi),
      v = Math.sin(theta) * Math.sin(phi);
    const slit = style.slit && (u / 0.32) ** 2 + v * v < (style.pupil * 1.45) ** 2;
    if (style.slit ? slit : theta < pupil) return INK;
    if (theta < irisEdge - 0.045) return v < -Math.sin(irisEdge) * 0.2 ? light : iris;
    if (theta < irisEdge) return v < -Math.sin(irisEdge) * 0.35 ? iris : dark;
    if (theta < rim) return mixRgb(WHITE, dark, 0.18);
    return WHITE;
  };
  return gridSurface(rows, { color, flip: true });
}

/** Euler angles turning a part's +X onto `f`, rolled `roll` about it. */
export const aim = (f, roll = 0) => [roll, -Math.asin(Math.max(-1, Math.min(1, f[2]))), Math.atan2(f[1], f[0])];

/**
 * A lid: the part of a sphere of `radius` on one side of the eye line, in the eye's frame (`f` out
 * of the face, `up` and `side`), `upper` above the line or below it.
 */
function lidMesh(centre, radius, frame, upper, rgb) {
  const { f, up, side } = frame;
  const rows = [];
  const R = 10,
    C = 20;
  for (let j = 0; j <= R; j++) {
    const pitch = upper ? (Math.PI / 2) * (1 - j / R) : (-Math.PI / 2) * (1 - j / R);
    const row = [];
    for (let i = 0; i < C; i++) {
      const yaw = (i / C) * Math.PI * 2;
      const c = Math.cos(pitch);
      row.push(add(centre, add(add(scale(f, radius * c * Math.cos(yaw)), scale(up, radius * Math.sin(pitch))), scale(side, radius * c * Math.sin(yaw)))));
    }
    rows.push(row);
  }
  return gridSurface(rows, { color: () => rgb, flip: !upper });
}

/** A line along a lid's rim in front of the eye from `from` to `to` (angles round from `f` towards `side`), thicker at `thick`. */
function rimLine(centre, radius, frame, { from, to, width, flick = 0, outer }) {
  const { f, side } = frame;
  const count = 12;
  const rings = [];
  for (let k = 0; k <= count; k++) {
    const t = k / count;
    const yaw = mix(from, to, t);
    const dir = add(scale(f, Math.cos(yaw)), scale(side, Math.sin(yaw)));
    const towardOuter = Math.max(0, (Math.sin(yaw) * outer + 1) / 2);
    const w = width * (0.55 + 0.9 * Math.sin(Math.PI * Math.min(1, t * 1.1)) ** 0.5) * (1 + flick * towardOuter ** 3);
    rings.push({ p: add(centre, scale(dir, radius * 1.015)), r: [w * 0.55, w] });
  }
  if (flick) {
    const end = outer > 0 ? rings.at(-1) : rings[0];
    const dir = unit(sub(end.p, centre));
    const tip = add(add(end.p, scale(dir, width * 2.2 * flick)), scale(frame.up, width * 2.4 * flick));
    if (outer > 0) rings.push({ p: tip, r: [width * 0.25, width * 0.3] });
    else rings.unshift({ p: tip, r: [width * 0.25, width * 0.3] });
  }
  return tubeSurface(rings, { around: 6, up: frame.up, color: () => INK });
}

/**
 * Both eyes: an eyeball on each eye bone with iris, pupil and glints that turn with the gaze, an
 * upper and a lower lid on their own bones in the skin's colour, and the lash line on the upper lid.
 * Returns the parts, each bone's joint, and the lids' rest angles for the pose.
 * @param {import("./headShape.js").HeadShape} head
 * @param {import("./characterSpec.js").CharacterSpec} spec
 */
export function characterEyes(head, spec) {
  const style = eyeStyles[spec.eyes] ?? eyeStyles.round;
  const skin = rgbOf(spec.skin);
  const lidRgb = shade(skin, 0.95);
  const iris = rgbOf(spec.eyeColor);
  const parts = [];
  const joints = {};
  const radius = head.eye.radius * (style.scale ?? 1);
  const tilt = style.tilt + mix(-0.2, 0.2, Number(spec.eyeTilt));
  for (const [name, s] of [["L", -1], ["R", 1]]) {
    const yaw = s * head.eye.yaw,
      pitch = head.eye.pitch;
    const surface = head.point(yaw, pitch);
    const normal = head.normal(yaw, pitch);
    const f = unit(add(normal, [1.4, 0.1, 0]));
    const centre = sub(surface, scale(f, radius * (style.white ? 0.36 : 0.3)));
    const up0 = unit(sub([0, 1, 0], scale(f, f[1])));
    const side0 = cross(f, up0);
    const up = unit(sub(scale(up0, Math.cos(tilt)), scale(side0, Math.sin(tilt) * s)));
    const side = cross(f, up);
    const frame = { f, up, side };
    joints[`eye${name}`] = centre;
    joints[`lid${name}`] = centre;
    joints[`lowLid${name}`] = centre;
    const turn = aim(f, 0);
    const eyeBone = `eye${name}`;
    parts.push(meshPart(`eye-${name}`, eyeBone, eyeball(centre, radius, frame, style, iris)));
    const glints = [
      [0.42, -0.34, 0.2],
      [-0.4, 0.3, 0.1],
      [0.05, 0.48, 0.07],
    ].slice(0, style.glints);
    glints.forEach(([u, v, r], k) => {
      const dir = unit(add(add(f, scale(up, u)), scale(side, v * -s)));
      parts.push({ id: `glint-${name}-${k}`, bone: eyeBone, shape: "ellipsoid", segments: 8, position: add(centre, scale(dir, radius * 1.1)), rotation: aim(dir), scale: [radius * 0.04, radius * r, radius * r], color: [1, 1, 1] });
    });
    const lidRadius = radius * 1.1;
    parts.push(meshPart(`lid-${name}`, `lid${name}`, lidMesh(centre, lidRadius, frame, true, lidRgb)));
    parts.push(meshPart(`low-lid-${name}`, `lowLid${name}`, lidMesh(centre, radius * 1.06, frame, false, lidRgb)));
    const lash = spec.lashes;
    const width = radius * (lash === "none" ? 0.07 : lash === "soft" ? 0.1 : 0.13);
    parts.push(meshPart(`lash-${name}`, `lid${name}`, rimLine(centre, lidRadius, frame, { from: -1.45, to: 1.45, width, flick: lash === "flick" ? 1.4 : lash === "long" ? 0.7 : 0, outer: s })));
    if (lash === "long")
      for (const [k, a] of [0.75, 1.05, 1.3].entries()) {
        const yawAt = a * s;
        const base = add(centre, scale(add(scale(f, Math.cos(yawAt)), scale(side, Math.sin(yawAt))), lidRadius));
        const outward = unit(add(sub(base, centre), scale(up, 0.9)));
        const tip = add(base, scale(outward, radius * 0.32));
        parts.push(meshPart(`lash-${name}-${k}`, `lid${name}`, tubeSurface([{ p: base, r: radius * 0.05 }, { p: tip, r: radius * 0.012 }], { around: 5, color: () => INK })));
      }
  }
  return { parts, joints, lids: { open: style.open, low: style.low }, radius };
}

