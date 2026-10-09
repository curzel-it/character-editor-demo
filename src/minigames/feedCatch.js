/** How likely a dragon of each age is to snap a piece thrown dead on its mouth out of the air. */
export const catchSkill = { kid: 0.66, teen: 0.8, adult: 0.92 };

/**
 * How a dragon with `skill` meets a piece passing `lateral` across and `rise` above its mouth, both
 * in units of its reach: `catch` within reach when `roll` comes under its chance, which falls off
 * towards the edge of its reach; otherwise a fumble within reach (`bonk` on the nose, a `late` chomp,
 * or the piece landing on its `head`), or out of reach a piece dropping onto its `head`, falling
 * `short` or flying wide for a `spin` after it. `roll` and `pick` are uniform randoms, 0..1.
 * @returns {"catch" | "bonk" | "late" | "head" | "short" | "spin"}
 */
export function catchOutcome({ lateral, rise, skill, roll, pick }) {
  const off = Math.hypot(lateral, rise);
  if (off < 1) {
    if (roll < skill * Math.sqrt(1 - off * off)) return "catch";
    return pick < 0.45 ? "bonk" : pick < 0.85 ? "late" : "head";
  }
  if (rise > 0.6 && rise < 2 && Math.abs(lateral) < 1.2) return "head";
  if (rise < -1 && Math.abs(lateral) < -rise) return "short";
  return "spin";
}
