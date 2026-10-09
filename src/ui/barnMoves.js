const ORBIT = 1.6,
  GLIDE = 1,
  WIDEN = 16,
  RISE = 7,
  AIM = 5;

/** Seconds a turn round the barn lasts, and a glide along one of its sides. */
export const barnMoves = { orbit: ORBIT, glide: GLIDE };

const smoother = (t) => t * t * t * (t * (6 * t - 15) + 10);
const mix = (a, b, t) => a + (b - a) * t;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** An eye's place around `centre` [x, z]: its bearing, its reach over the ground and its height. */
function around(centre, eye) {
  const dx = eye[0] - centre[0],
    dz = eye[2] - centre[1];
  return { bearing: Math.atan2(dz, dx), reach: Math.hypot(dx, dz), height: eye[1] };
}

/**
 * The camera `since` seconds into a turn round the barn from shot `from` to shot `to` on its other
 * side: it orbits the barn's centre the short way round, easing in and out, drawing out wide and up
 * as it goes and back in, its aim leaving the first subject for the barn and coming to the second.
 * `barn` is its footprint.
 */
export function orbitShot({ centre }, from, to, since) {
  const k = smoother(Math.min(1, Math.max(0, since / ORBIT)));
  const start = around(centre, from.eye),
    end = around(centre, to.eye);
  const bearing = start.bearing + wrap(end.bearing - start.bearing) * k;
  const wide = Math.sin(Math.PI * k);
  const reach = mix(start.reach, end.reach, k) + WIDEN * wide,
    height = mix(start.height, end.height, k) + RISE * wide;
  const eye = [centre[0] + Math.cos(bearing) * reach, height, centre[1] + Math.sin(bearing) * reach];
  const barn = [centre[0], AIM, centre[1]];
  const aim = from.target.map((v, n) => mix(v, to.target[n], smoother(k)));
  const target = aim.map((v, n) => mix(v, barn[n], wide));
  return { ...to, eye, target, shift: mix(from.shift ?? 0, to.shift ?? 0, k) * (1 - wide) };
}

/** The camera `since` seconds into a glide from shot `from` to shot `to`, easing in and out. */
export function glideShot(from, to, since) {
  const k = smoother(Math.min(1, Math.max(0, since / GLIDE)));
  const at = (a, b) => a.map((v, n) => mix(v, b[n], k));
  return { ...to, eye: at(from.eye, to.eye), target: at(from.target, to.target), shift: mix(from.shift ?? 0, to.shift ?? 0, k) };
}
