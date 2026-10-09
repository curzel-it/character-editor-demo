const RATE = 3.2;

const nudge = (bones, id, delta) => {
  const r = bones[id]?.rotation ?? [0, 0, 0];
  bones[id] = { ...bones[id], rotation: r.map((v, i) => v + delta[i]) };
};

/** How high a thumping foot is lifted at `time`, 0..1: it rises and stamps down a few times a second. */
export const thumpBeat = (time) => Math.abs(Math.sin(Math.PI * RATE * time)) ** 0.6;

/**
 * A hind foot thumping like a happy dog's, on top of a standing pose: `thump` (0..1) lifts the hind leg
 * on side `thumpSide` (+1 is +Z) and stamps it down to `thumpBeat`.
 */
export function thumpPose(bones, motion, time) {
  const k = Math.max(0, Math.min(1, motion.thump ?? 0));
  if (k <= 0 || time === null) return;
  const side = (motion.thumpSide ?? 1) >= 0 ? 1 : -1;
  const lift = k * (0.35 + 0.65 * thumpBeat(time));
  nudge(bones, `leg-hind-${side}`, [-side * 0.1 * lift, 0, 0.45 * lift]);
  nudge(bones, `shin-hind-${side}`, [0, 0, 0.3 * lift]);
  nudge(bones, `foot-hind-${side}`, [0, 0, -0.25 * lift]);
}
