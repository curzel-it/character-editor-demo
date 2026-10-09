import { add, cross, mix, scale, smooth, sub, unit } from "./surface.js";

/**
 * @typedef {{ point: (yaw: number, pitch: number) => number[], normal: (yaw: number, pitch: number) => number[],
 *   offset: (yaw: number, pitch: number, out: number) => number[], centre: number[], size: number,
 *   eye: { yaw: number, pitch: number, radius: number }, nose: { pitch: number }, mouth: { pitch: number }, ear: { yaw: number, pitch: number } }} HeadShape
 */

const gauss = (dx, dy, wx, wy) => Math.exp(-((dx * dx) / (wx * wx) + (dy * dy) / (wy * wy)));

/**
 * The head as a surface around its centre (model space), by `yaw` round the vertical (0 the face,
 * a quarter turn the character's right) and `pitch` up from the eye line: a soft, broad cozy skull
 * that narrows into the jaw and chin, its cheeks filled or hollowed by the face sliders.
 * Feature anchors (`eye`, `nose`, `mouth`, `ear`) are angles on this surface.
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {number[]} centre
 * @param {number} size the head's scale from the body measures
 * @returns {HeadShape}
 */
export function headShape(spec, centre, size) {
  const n = (key) => Number(spec[key]);
  const width = mix(0.9, 1.1, n("faceWidth"));
  const length = mix(0.96, 1.2, n("faceLength"));
  const jaw = mix(0.6, 0.88, n("jaw"));
  const chin = n("chin");
  const cheeks = mix(-0.01, 0.014, n("cheeks"));
  const rx = 0.106 * size,
    ry = 0.112 * size,
    rz = 0.101 * size * width;

  /** Local position before the head's centre is added. */
  function local(yaw, pitch) {
    const c = Math.cos(pitch);
    const d = [c * Math.cos(yaw), Math.sin(pitch), c * Math.sin(yaw)];
    let x = d[0] * rx,
      y = d[1] * ry,
      z = d[2] * rz;
    const below = smooth(0.05, -1.25, pitch);
    const front = smooth(-0.2, 0.7, d[0]);
    const back = smooth(0.1, -0.8, d[0]);
    y *= mix(1, length, below);
    z *= mix(1, mix(1, jaw, front * 0.9 + 0.1), below * below);
    z *= 1 - chin * 0.35 * below ** 3 * front;
    x += chin * 0.012 * size * below ** 2.5 * front;
    x *= 1 - 0.28 * back * below;
    x -= 0.24 * rx * Math.max(0, d[0] - 0.55) ** 2;
    if (d[0] < 0 && pitch > -0.2) x *= 1 + 0.05 * smooth(-0.2, 0.6, pitch);
    y *= 1 - 0.05 * smooth(0.6, 1.4, pitch);
    const puff = cheeks * size * (gauss(Math.abs(yaw) - 0.95, pitch + 0.42, 0.42, 0.3) + 0.5 * gauss(Math.abs(yaw) - 1.3, pitch + 0.62, 0.35, 0.3));
    return [x + d[0] * puff, y + d[1] * puff * 0.4, z + d[2] * puff];
  }

  const point = (yaw, pitch) => add(centre, local(yaw, pitch));
  const STEP = 0.004;
  const normal = (yaw, pitch) => {
    const p = Math.max(-1.55, Math.min(1.55, pitch));
    const du = sub(local(yaw + STEP, p), local(yaw - STEP, p));
    const dv = sub(local(yaw, p + STEP), local(yaw, p - STEP));
    return unit(cross(du, dv)).map((v) => -v);
  };
  const eyeHeight = mix(-0.16, 0.08, n("eyeHeight"));
  return {
    point,
    normal,
    offset: (yaw, pitch, out) => add(point(yaw, pitch), scale(normal(yaw, pitch), out)),
    centre,
    size,
    eye: { yaw: mix(0.3, 0.47, n("eyeSpacing")), pitch: eyeHeight, radius: 0.024 * size * mix(0.78, 1.3, n("eyeSize")) },
    nose: { pitch: eyeHeight - 0.36 },
    mouth: { pitch: eyeHeight - 0.66 },
    ear: { yaw: Math.PI / 2 + 0.1, pitch: eyeHeight - 0.12 },
  };
}

/**
 * Rows of points over a patch of the head from `pitch0` to `pitch1` and round all yaws, `out(yaw, pitch)`
 * metres off the surface along its normal: the skin itself, or shells laid over it.
 * @param {HeadShape} head
 */
export function headRows(head, { columns = 56, rows = 36, pitch0 = -Math.PI / 2, pitch1 = Math.PI / 2, out = () => 0 } = {}) {
  const grid = [];
  for (let j = 0; j <= rows; j++) {
    const pitch = mix(pitch1, pitch0, j / rows);
    const pole = Math.abs(Math.abs(pitch) - Math.PI / 2) < 1e-6;
    const row = [];
    for (let i = 0; i < columns; i++) {
      const yaw = (i / columns) * Math.PI * 2;
      row.push(pole ? head.offset(0, pitch, out(0, pitch)) : head.offset(yaw, pitch, out(yaw, pitch)));
    }
    grid.push(row);
  }
  return grid;
}

/** The yaw and pitch of row `j` and column `i` in `headRows`' grid. */
export const rowAngles = (j, i, { columns = 56, rows = 36, pitch0 = -Math.PI / 2, pitch1 = Math.PI / 2 } = {}) => [
  (i / columns) * Math.PI * 2,
  mix(pitch1, pitch0, j / rows),
];

/** `yaw` folded into -π..π, 0 the face. */
export const wrapYaw = (yaw) => Math.atan2(Math.sin(yaw), Math.cos(yaw));
