import { palette } from "../palette.js";
import { mouthPoint } from "../breath/mouthPoint.js";
import { boneMatrices, multiply, orientation, point, transform } from "../math3d.js";
import { hash } from "../animate/flightNoise.js";

/** Seconds a puff lasts. */
export const YAWN_PUFF_LIFE = 1.2;
const PUFFS = 5,
  KIND = 0;

/**
 * The little puff of breath a yawning dragon lets out as its jaw shuts, leaving the mouth of the
 * posed `racer` (`{ anatomy, pose, position, forward }`) at `time`: `size` is the dragon's head length.
 * @param {{ anatomy: { bones: { id: string, position: number[] }[] }, pose: object, position: number[], forward: number[] }} racer
 * @param {number} size
 * @param {number} time
 */
export function yawnPuff(racer, size, time) {
  const { anatomy } = racer;
  const model = multiply(orientation(racer.position, racer.forward, 0), transform(anatomy.bones[0].position.map((v) => -v)));
  const jaw = boneMatrices(anatomy, racer.pose)[anatomy.bones.findIndex((bone) => bone.id === "jaw")];
  return { at: point(multiply(model, jaw), mouthPoint(anatomy)), ahead: racer.forward, size, born: time };
}

/**
 * Draws `puff` into billboards `out` at `time`: a few soft wisps drifting ahead and up, swelling
 * as they fade.
 * @param {{ quad: Function }} out
 * @param {ReturnType<typeof yawnPuff>} puff
 * @param {number} time
 */
export function drawYawnPuff(out, { at, ahead, size, born }, time) {
  for (let n = 0; n < PUFFS; n++) {
    const age = time - born - 0.06 * n;
    if (age <= 0 || age >= YAWN_PUFF_LIFE) continue;
    const u = age / YAWN_PUFF_LIFE,
      drift = (1 - Math.exp(-2.5 * age)) * size,
      side = hash(n, 71) - 0.5;
    const p = [0, 1, 2].map((k) => at[k] + ahead[k] * drift * (0.6 + 0.4 * hash(n, 73)) + (k === 1 ? 0.5 * drift : 0) + (k !== 1 ? side * 0.3 * drift * (k ? ahead[0] : -ahead[2]) : 0));
    out.quad(p, p, size * (0.28 + 0.1 * hash(n, 79)) * (0.6 + u), [...palette.snort, 0.6 * (1 - u) * Math.min(1, age / 0.1), 0.2], KIND, 6 * hash(n, 83) + u);
  }
}
