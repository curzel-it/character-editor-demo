import { palette } from "../../palette.js";
import { ACROSS, GRIP, piece } from "./itemPiece.js";

const FLY = -0.7;

/** A training flag: a pole through the fist, out past the thumb to a knob, with a striped cloth flying off it. */
function flag() {
  const c = palette.careTools.exercise;
  const [x, y] = GRIP;
  const cloth = (id, z, color) => piece(`flag-${id}`, "box", [x + Math.sin(FLY) * 0.075, y + Math.cos(FLY) * 0.075, z], [0.003, 0.066, 0.02], color, [0, 0, -FLY]);
  return [
    piece("flag-pole", "cylinder", [x, y, -0.12], [0.009, 0.19, 0.009], c.pole, ACROSS),
    piece("flag-knob", "ellipsoid", [x, y, -0.315], [0.016, 0.016, 0.016], c.knob),
    cloth("top", -0.27, c.cloth),
    cloth("middle", -0.23, c.stripe),
    cloth("bottom", -0.19, c.cloth),
  ];
}

/** What the keeper holds to exercise a dragon. */
export const exerciseItems = { flag };
