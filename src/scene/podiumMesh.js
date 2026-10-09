import { ceremonyPalette as C } from "../palette.js";
import { createPropMesh } from "./propMesh.js";

const DAIS = 0.18,
  LIP = 0.06,
  PLATE = 0.42,
  POLE = 0.08,
  FLAG = 0.55;

/**
 * The winners' podium as a prop: a carpeted dais with one stone step per place, each step a
 * plate in its medal's metal on the front face, and a pennant in the division's metal on a pole
 * behind either end. `steps` are `{ x, height, halfWidth, halfDepth, medal }` in metres around the
 * origin, the front facing +Z. `division` is `gold`, `silver` or `bronze`.
 * @param {{ x: number, height: number, halfWidth: number, halfDepth: number, medal: "gold" | "silver" | "bronze" }[]} steps
 * @param {"gold" | "silver" | "bronze"} division
 */
export function podiumAnatomy(steps, division) {
  const prop = createPropMesh();
  const { centre, halfWidth, depth, margin, poles, pole } = layout(steps);
  prop.box([centre, margin * 0.5], halfWidth + LIP * 4, depth + margin * 1.5 + LIP * 4, 0, DAIS * 0.5, C.stoneDark, C.carpetEdge);
  prop.box([centre, margin * 0.5], halfWidth, depth + margin * 1.5, DAIS * 0.5, DAIS, C.stoneDark, C.carpet);
  for (const step of steps) {
    const base = DAIS,
      top = DAIS + step.height;
    prop.box([step.x, 0], step.halfWidth, step.halfDepth, base, top - LIP, C.stone, C.stone);
    prop.box([step.x, 0], step.halfWidth + LIP, step.halfDepth + LIP, top - LIP, top, C.stoneDark, C.stone);
    const plate = Math.min(step.halfWidth, step.height) * PLATE;
    const y = base + (step.height - LIP) / 2,
      z = step.halfDepth + 0.02;
    const metal = C.metals[step.medal];
    prop.quad([step.x, y - plate, z], [step.x + plate, y, z], [step.x, y + plate, z], [step.x - plate, y, z], metal);
  }
  for (const [side, x, z] of poles) {
    prop.box([x, z], POLE, POLE, 0, DAIS + pole, C.pole);
    prop.lathe([x, z], [[POLE * 2.2, DAIS + pole], [0, DAIS + pole + POLE * 3]], 6, C.metals[division]);
    const flag = pole * FLAG * 0.5;
    const top = DAIS + pole - POLE,
      reach = -side * flag * 1.6;
    prop.tri([x, top, z + POLE], [x, top - flag, z + POLE], [x + reach, top - flag * 0.45, z + POLE], C.metals[division]);
    prop.tri([x, top - flag, z - POLE], [x, top, z - POLE], [x + reach, top - flag * 0.45, z - POLE], C.metals[division]);
  }
  return prop.anatomy();
}

/** Where the dais and the pennant poles stand around `steps`. */
function layout(steps) {
  const left = Math.min(...steps.map((s) => s.x - s.halfWidth)),
    right = Math.max(...steps.map((s) => s.x + s.halfWidth));
  const depth = Math.max(...steps.map((s) => s.halfDepth));
  const margin = 0.25 * depth;
  const halfWidth = (right - left) / 2 + margin,
    centre = (right + left) / 2;
  const poles = [-1, 1].map((side) => [side, centre + side * halfWidth, -depth - margin]);
  return { centre, halfWidth, depth, margin, poles, pole: Math.max(...steps.map((s) => s.height)) * 2.6 + 1 };
}

/** Points that frame the podium: the dais's front corners and the top of either pennant. */
export function podiumFrame(steps) {
  const { centre, halfWidth, depth, margin, poles, pole } = layout(steps);
  const front = depth + margin * 2;
  return [[centre - halfWidth, 0, front], [centre + halfWidth, 0, front], ...poles.map(([, x, z]) => [x, DAIS + pole, z])];
}

/** The top of each step, where a dragon stands. */
export const stepTop = (step) => DAIS + step.height;
