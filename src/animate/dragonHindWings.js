const soft = (v, limit) => limit * Math.tanh(v / limit);

/**
 * Hind-wing flight pose: a smaller, quicker echo of the main stroke that trails it by a fraction of
 * a beat and tucks back along the tail in dives. The bones exist on every dragon, so this always runs.
 */
export function hindWingPose(bones, state) {
  const { psi, amplitude, power, glide, dive, fatigue, turn } = state;
  for (const side of [-1, 1]) {
    const phase = psi(side) - 0.9;
    const a = 0.75 * amplitude * (1 - 0.3 * fatigue) * (1 - 0.1 * side * turn);
    const elevation = soft(0.06 - 0.1 * dive + 0.05 * glide + a * Math.sin(phase), 0.9);
    const fold = 0.5 * (1 - Math.cos(phase - 0.2));
    const tuck = 0.9 * dive + 0.15 * fatigue;
    bones[`hindwing-${side}`] = {
      rotation: [side * elevation, side * (-0.1 * glide - 0.45 * dive + 0.15 * a * Math.sin(phase - 0.4)), -0.15 * a * Math.cos(phase)],
    };
    bones[`hindwing-elbow-${side}`] = {
      rotation: [side * a * 0.35 * Math.sin(phase - 0.6), side * 0.35 * (fold * a + tuck), 0],
    };
    bones[`hindwing-tip-${side}`] = {
      rotation: [side * a * (0.3 + 0.1 * power) * Math.sin(phase - 1.1), -side * 0.4 * (fold * a + tuck), 0],
    };
  }
}
