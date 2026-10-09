import { makeRng } from "../../rng.js";
import { palette } from "../../palette.js";

const SHARD = 1,
  GLINT = 3,
  GRAVITY = 1.6,
  DRAG = 1.8;

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** `count` confetti pieces drawn from seed `name`, each with its launch, life, flutter and tint. */
function pieces(name, count) {
  const random = makeRng(name);
  return Array.from({ length: count }, (_, i) => {
    const angle = (i / count) * Math.PI * 2 + random() * 0.5;
    const speed = 1.4 + random() * 1.4;
    return {
      out: [Math.cos(angle) * speed, 1.6 + random() * 1.8, Math.sin(angle) * speed],
      delay: random() * 0.12,
      life: 1.1 + random() * 0.7,
      scale: 0.08 + random() * 0.06,
      flutter: 5 + random() * 6,
      spin: random() * Math.PI * 2,
      tint: i % 3,
      kind: i % 4 ? SHARD : GLINT,
    };
  });
}

/**
 * A burst of confetti, flung up and out from `centre` and fluttering down, `since` seconds after it
 * pops, for a dragon whose body measures about `size` metres; a third in `color`, the rest in the
 * play ball's colours.
 */
export function playConfetti(name, count) {
  const bits = pieces(name, count);
  return (out, since, { centre, size, color }) => {
    const tints = [color, palette.careTools.play.band, palette.careTools.play.ball];
    for (const p of bits) {
      const t = since - p.delay;
      const u = t / p.life;
      if (u <= 0 || u >= 1) continue;
      const fly = (1 - Math.exp(-DRAG * t)) / DRAG;
      const sway = 0.06 * Math.sin(p.flutter * t + p.spin) * u;
      const at = [
        centre[0] + (p.out[0] * fly + sway) * size * 0.45,
        centre[1] + (p.out[1] * fly - 0.5 * GRAVITY * t * t) * size * 0.45,
        centre[2] + (p.out[2] * fly - sway) * size * 0.45,
      ];
      const alpha = clamp01(u * 12) * clamp01((1 - u) * 4);
      const glint = p.kind === GLINT;
      const width = p.scale * size * (glint ? 1 + 0.4 * Math.sin(t * 14 + p.spin) : 0.6 + 0.4 * Math.abs(Math.sin(p.flutter * t)));
      out.quad(at, at, width, [...tints[p.tint], alpha, glint ? 0.7 : 0.35], p.kind, p.spin + t * p.flutter);
    }
  };
}
