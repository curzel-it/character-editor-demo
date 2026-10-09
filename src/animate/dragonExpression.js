/**
 * The lids each mood holds at full strength: `upper` and `lower` as shares of their travel, as in
 * `lidPose`, the upper lids' `tilt` and how far `down` the pupils sink, as a share of their reach.
 */
const moods = {
  glum: { upper: 0.65, lower: 0.2, tilt: 1, down: 0.7 },
  weary: { upper: 0.68, lower: 0.18, tilt: 0.15, down: 0.3 },
  glee: { upper: 0.25, lower: 0.6, tilt: -0.15, down: 0 },
};

/**
 * The lids a dragon's mood holds in `motion`: `glum` (0..1) lowers them with their back corners
 * drooping, disappointed or sad; `weary` lowers them heavily, tired or hungry; `glee` pushes the lower
 * lids up, smiling eyes. The moods add up, each by its strength, and the sad ones drop the gaze.
 * @param {{ glum?: number, weary?: number, glee?: number }} [motion]
 */
export function expressionOf(motion) {
  const face = { upper: 0, lower: 0, tilt: 0, down: 0 };
  for (const [mood, lids] of Object.entries(moods)) {
    const k = Math.max(0, Math.min(1, motion?.[mood] ?? 0));
    for (const key of Object.keys(face)) face[key] += k * lids[key];
  }
  return { upper: Math.min(1, face.upper), lower: Math.min(1, face.lower), tilt: Math.max(-1, Math.min(1, face.tilt)), down: Math.min(1, face.down) };
}
