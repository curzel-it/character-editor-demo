import { palette } from "../../palette.js";
import { ACROSS, GRIP, piece } from "./itemPiece.js";

/** Where the meat of the drumstick sits on the keeper's hand bone, for anything that takes it from the hand. */
export const MEAT_AT = [GRIP[0], GRIP[1], -0.15];

/** A drumstick: its bone through the fist with the knuckle end past the little finger, a seared chunk of meat out past the thumb. */
function drumstick() {
  const c = palette.careTools.feed;
  const [x, y, z] = MEAT_AT;
  return [
    piece("drumstick-bone", "cylinder", [x, y, -0.03], [0.011, 0.07, 0.011], c.bone, ACROSS),
    piece("drumstick-knob-0", "ellipsoid", [x, y + 0.011, 0.045], [0.016, 0.016, 0.016], c.bone),
    piece("drumstick-knob-1", "ellipsoid", [x, y - 0.011, 0.045], [0.016, 0.016, 0.016], c.bone),
    piece("drumstick-meat", "ellipsoid", [x, y, z], [0.046, 0.044, 0.068], c.meat),
    piece("drumstick-sear", "ellipsoid", [x + 0.008, y + 0.006, z - 0.012], [0.04, 0.04, 0.056], c.seared),
  ];
}

/** What the keeper holds to feed a dragon. */
export const feedItems = { drumstick };
