/**
 * Hind-leg flight pose. The rest rig is a mid tuck; negative pitch streamlines the legs back under
 * the tail, positive pitch lowers them. `state` carries the resolved flight blend from `pose`.
 */
export function legPose(bones, state) {
  const { theta, psi, flap, effort, sprint, glide, dive, up, fatigue, turn, slow, quirk } = state;
  const streamline = (flap * (0.35 + 0.65 * smooth(effort)) + 0.4 * glide) * (1 - fatigue);
  const hang = glide * (1 - dive) * (1 - fatigue);
  const limp = fatigue * fatigue * (3 - 2 * fatigue);
  for (const side of [-1, 1]) {
    const phase = side * (0.12 + 0.05 * quirk);
    const drive = -Math.cos(psi(side) - 0.35 + phase);
    const kick = flap * (0.05 + 0.1 * effort) * (1 - 0.6 * limp);
    const swing =
      limp *
      (0.2 * Math.sin(theta - 2.3 + phase) +
        0.08 * Math.sin(2 * theta + side) +
        0.1 * slow(0.9, 13 + side * 2));
    const trail = 0.07 * slow(0.37, 17 + side) * (1 - sprint) * (1 - limp);
    const clench =
      0.08 + 0.14 * sprint + 0.1 * dive - 0.22 * hang - 0.45 * limp +
      kick * 1.4 * Math.max(0, drive) +
      0.05 * slow(0.8, 19 + side * 5) * (1 - sprint);
    bones[`leg-hind-${side}`] = {
      rotation: [
        -side * (0.04 + 0.08 * limp + 0.05 * hang) + 0.2 * turn * (1 - 0.5 * limp) +
          0.05 * limp * Math.sin(theta + side * 1.1),
        side * (0.03 - 0.06 * limp),
        -0.42 * streamline - 0.3 * dive + 0.12 * hang + 0.08 * up +
          0.62 * limp + trail + swing - kick * drive,
      ],
    };
    bones[`shin-hind-${side}`] = {
      rotation: [
        0,
        0,
        -0.2 * streamline - 0.12 * dive + 0.2 * hang + 0.1 * limp +
          0.3 * swing + kick * 0.6 * Math.sin(psi(side) - 1.2 + phase),
      ],
    };
    bones[`foot-hind-${side}`] = {
      rotation: [
        0,
        0,
        -0.14 * streamline - 0.1 * dive + 0.2 * hang + 0.6 * limp +
          0.6 * swing + kick * 0.9 * Math.sin(psi(side) - 1.9 + phase),
      ],
    };
    bones[`toes-hind-${side}`] = { rotation: [0, 0, clench] };
    bones[`hallux-hind-${side}`] = { rotation: [0, 0, -0.4 - 0.8 * clench] };
  }
}

const smooth = (x) => x * x * (3 - 2 * x);
