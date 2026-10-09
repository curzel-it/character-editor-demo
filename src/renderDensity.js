const DENSE = 3,
  DENSE_SCALE = 1.5;

/**
 * Canvas pixels per CSS pixel for the 3D stages: 1.5 on a touch-first device whose screen packs 3 or more
 * device pixels per CSS pixel, 1 everywhere else.
 */
export function renderDensity() {
  const touch = globalThis.matchMedia?.("(pointer: coarse)").matches ?? false;
  return touch && (globalThis.devicePixelRatio ?? 1) >= DENSE ? DENSE_SCALE : 1;
}
