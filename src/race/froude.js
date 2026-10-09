import { speedScale, lengthScale } from "../worldScale.js";

/**
 * Froude factors for race constants tuned at the reference scale. With gravity fixed, lengths grow by
 * `lengthScale`, speeds and times by its square root, per-second rates shrink by it, and
 * accelerations and dimensionless ratios are unchanged. Multiply a reference constant by its dimension.
 */
export const froude = Object.freeze({
  length: lengthScale,
  speed: speedScale,
  time: speedScale,
  rate: 1 / speedScale,
  lengthPerSecond: speedScale,
});
