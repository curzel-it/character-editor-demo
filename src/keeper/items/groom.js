import { palette } from "../../palette.js";
import { GRIP, piece } from "./itemPiece.js";

/** A horn comb: its spine through the fist, out past the thumb, with a row of teeth to the palm's side. */
function comb() {
  const c = palette.careTools.groom;
  const [x, y] = GRIP;
  const teeth = Array.from({ length: 15 }, (_, i) => piece(`comb-tooth-${i}`, "box", [x, y - 0.042, -0.06 - i * 0.012], [0.003, 0.028, 0.0034], c.horn));
  return [piece("comb-spine", "box", [x, y - 0.004, -0.11], [0.004, 0.017, 0.125], c.horn), ...teeth];
}

/** What the keeper holds to groom a dragon. */
export const groomItems = { comb };
