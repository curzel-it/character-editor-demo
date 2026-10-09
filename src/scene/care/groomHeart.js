import { palette, tint } from "../../palette.js";
import { createPropMesh } from "../propMesh.js";

const RIM = 18,
  DEPTH = 0.28,
  EDGE = 0.1;

const outline = Array.from({ length: RIM }, (_, i) => {
  const t = (i / RIM) * Math.PI * 2;
  return [(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) / 32 + 0.08, (16 * Math.sin(t) ** 3) / 32];
});

let heart;

/**
 * A faceted heart one unit across, in the groom colour, facing +X with its point down: each face
 * rises to a ridge at its middle and a thin band runs round its rim.
 */
export function groomHeartAnatomy() {
  if (heart) return heart;
  const prop = createPropMesh();
  const color = palette.care.groom,
    light = tint(color, 1.15),
    side = tint(color, 0.7);
  for (const face of [1, -1]) {
    const mid = [face * DEPTH, 0.12, 0];
    for (let i = 0; i < RIM; i++) {
      const [y0, z0] = outline[i],
        [y1, z1] = outline[(i + 1) % RIM];
      const a = [face * EDGE, y0, z0],
        b = [face * EDGE, y1, z1];
      const shade = i % 2 ? color : light;
      if (face > 0) prop.tri(mid, a, b, shade);
      else prop.tri(mid, b, a, shade);
      if (face > 0) prop.quad(a, [-EDGE, y0, z0], [-EDGE, y1, z1], b, side);
    }
  }
  heart = prop.anatomy();
  return heart;
}
