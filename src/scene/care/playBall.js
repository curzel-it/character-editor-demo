import { palette } from "../../palette.js";
import { createPropMesh } from "../propMesh.js";
import { PLAY_BALL } from "../../keeper/items/play.js";

const SIDES = 12,
  RINGS = 8,
  BAND = 0.24;

let built = null;

/** The keeper's play ball as a prop centred on the origin, its band round the Y axis. */
export function playBallAnatomy() {
  if (built) return built;
  const { ball, band } = palette.careTools.play;
  const r = PLAY_BALL.radius;
  const prop = createPropMesh();
  const ring = (a) => [r * Math.cos(a), r * Math.sin(a)];
  const arc = (from, to, steps) => Array.from({ length: steps + 1 }, (_, i) => ring(from + ((to - from) * i) / steps));
  const edge = Math.asin(BAND);
  prop.lathe([0, 0], arc(-Math.PI / 2, -edge, RINGS / 2), SIDES, ball);
  prop.lathe([0, 0], [ring(-edge).map((v, k) => (k ? v : v * 1.03)), ring(edge).map((v, k) => (k ? v : v * 1.03))], SIDES, band);
  prop.lathe([0, 0], arc(edge, Math.PI / 2, RINGS / 2), SIDES, ball);
  built = prop.anatomy();
  return built;
}
