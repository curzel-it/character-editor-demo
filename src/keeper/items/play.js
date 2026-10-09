import { palette } from "../../palette.js";
import { ACROSS, GRIP, piece } from "./itemPiece.js";

/** The play ball's radius in metres and its centre on the keeper's hand bone, cupped in the fingers. */
export const PLAY_BALL = { radius: 0.06, at: [0.1, -0.058, -0.004] };

/** A rubber ball with a band round its middle, cupped in the fingers. */
function ball() {
  const c = palette.careTools.play;
  const r = PLAY_BALL.radius;
  return [
    piece("ball", "ellipsoid", PLAY_BALL.at, [r, r, r], c.ball),
    piece("ball-band", "cylinder", PLAY_BALL.at, [r * 1.03, r * 0.24, r * 1.03], c.band, [0.4, 0, 0.3]),
  ];
}

/** The middle of the fetch stick on the keeper's hand bone, and its length in metres. */
export const PLAY_STICK = { at: [GRIP[0], GRIP[1], -0.04], length: 0.46 };

/** A fetch stick through the fist, mostly out past the thumb, with a twig and a leaf near its tip. */
function stick() {
  const c = palette.careTools.fetch;
  const { at, length } = PLAY_STICK;
  const [x, y, z] = at;
  return [
    piece("stick", "cylinder", at, [0.016, length / 2, 0.016], c.stick, ACROSS),
    piece("stick-knot", "ellipsoid", [x, y + 0.004, z + 0.09], [0.02, 0.02, 0.026], c.stickDark),
    piece("stick-twig", "cylinder", [x, y + 0.03, z - 0.16], [0.007, 0.05, 0.007], c.stickDark, [0.7, 0, 0]),
    piece("stick-leaf", "ellipsoid", [x, y + 0.062, z - 0.2], [0.012, 0.022, 0.034], c.leaf, [0.5, 0, 0]),
  ];
}

/** What the keeper holds to play with a dragon. */
export const playItems = { ball, stick };
