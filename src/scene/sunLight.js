/** The one sun lighting every scene and every studio view, as a unit vector towards it. */
export const SUN = (() => {
  const d = [-0.52, 0.4, 0.62],
    l = Math.hypot(...d);
  return d.map((v) => v / l);
})();

/**
 * The sun in the model space of a subject standing with its head along `forward` (world XZ), so a
 * studio view can light a lone subject exactly as the scene lights it there.
 * @param {number[]} forward
 */
export function sunFacing(forward) {
  const l = Math.hypot(forward[0], forward[2]);
  const f = [forward[0] / l, 0, forward[2] / l],
    left = [-f[2], 0, f[0]];
  return [f[0] * SUN[0] + f[2] * SUN[2], SUN[1], left[0] * SUN[0] + left[2] * SUN[2]];
}
