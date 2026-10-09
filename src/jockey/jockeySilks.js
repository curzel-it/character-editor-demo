import { makeRng } from "../rng.js";
import { palette, pigment } from "../palette.js";

/** Racing silk colours, in the order a picker shows them. Every value comes from the shared palette helpers. */
export const silkColors = [
  { id: "white", rgb: palette.ivory },
  { id: "cream", rgb: pigment(0.12, 0.6, 0.8) },
  { id: "silver", rgb: pigment(0.58, 0.12, 0.72) },
  { id: "grey", rgb: palette.steel },
  { id: "black", rgb: palette.dark },
  { id: "brown", rgb: pigment(0.07, 0.5, 0.28) },
  { id: "maroon", rgb: pigment(0.97, 0.55, 0.28) },
  { id: "scarlet", rgb: pigment(0.99, 0.72, 0.46) },
  { id: "coral", rgb: pigment(0.02, 0.8, 0.66) },
  { id: "orange", rgb: pigment(0.07, 0.85, 0.55) },
  { id: "gold", rgb: palette.gold },
  { id: "yellow", rgb: pigment(0.14, 0.85, 0.58) },
  { id: "lime", rgb: pigment(0.24, 0.62, 0.55) },
  { id: "emerald", rgb: pigment(0.4, 0.6, 0.36) },
  { id: "forest", rgb: pigment(0.38, 0.5, 0.22) },
  { id: "mint", rgb: pigment(0.42, 0.5, 0.74) },
  { id: "teal", rgb: pigment(0.48, 0.6, 0.38) },
  { id: "sky", rgb: pigment(0.56, 0.62, 0.7) },
  { id: "royal", rgb: pigment(0.62, 0.66, 0.44) },
  { id: "navy", rgb: pigment(0.64, 0.55, 0.22) },
  { id: "lavender", rgb: pigment(0.74, 0.5, 0.76) },
  { id: "purple", rgb: pigment(0.77, 0.5, 0.4) },
  { id: "pink", rgb: pigment(0.92, 0.7, 0.72) },
];

export const silkPatterns = [
  { id: "plain" },
  { id: "hoops" },
  { id: "stripes" },
  { id: "halves" },
  { id: "quarters" },
  { id: "sash" },
  { id: "crossbelts" },
  { id: "chevrons" },
  { id: "checks" },
  { id: "diamonds" },
  { id: "braces" },
];

const colorIds = silkColors.map((c) => c.id);
const patternIds = silkPatterns.map((p) => p.id);
const byId = Object.fromEntries(silkColors.map((c) => [c.id, c.rgb]));
const luminance = ([r, g, b]) => 0.3 * r + 0.59 * g + 0.11 * b;

/** @typedef {{ pattern: string, colors: string[] }} Silks */

/** Seeded silks: a pattern and two or three distinct, mutually readable colours. */
export function createSilks(seed) {
  const random = makeRng(`silks:${seed}`);
  const pattern = patternIds[Math.floor(random() * patternIds.length)];
  const count = random() < 0.45 ? 3 : 2;
  const colors = [colorIds[Math.floor(random() * colorIds.length)]];
  for (let tries = 0; colors.length < count && tries < 64; tries++) {
    const id = colorIds[Math.floor(random() * colorIds.length)];
    const contrast = Math.abs(luminance(byId[id]) - luminance(byId[colors[0]]));
    if (!colors.includes(id) && contrast > (colors.length === 1 ? 0.18 : 0.08)) colors.push(id);
  }
  while (colors.length < 2) colors.push(colors[0] === "white" ? "black" : "white");
  return { pattern, colors };
}

export function restoreSilks(saved, seed) {
  const base = createSilks(seed);
  const pattern = patternIds.includes(saved?.pattern) ? saved.pattern : base.pattern;
  const colors = Array.isArray(saved?.colors)
    ? saved.colors.filter((id) => colorIds.includes(id)).slice(0, 3)
    : [];
  return { pattern, colors: colors.length >= 2 ? colors : base.colors };
}

/**
 * RGB roles for the rider model: `body` and `accent` make the jacket pattern, `sleeves` and `cap`
 * follow racing convention (contrast sleeves on plain silks, the third colour on the cap).
 */
export function silksRgb(silks) {
  const [a, b, c] = silks.colors.map((id) => byId[id] ?? palette.ivory);
  return {
    body: a,
    accent: b,
    third: c ?? b,
    sleeves: silks.pattern === "plain" ? b : c ?? a,
    cap: c ?? b,
  };
}

const css = (rgb) => `rgb(${rgb.map((v) => Math.round(v * 255)).join(" ")})`;

/** A CSS background that previews the silks in a small swatch. */
export function silksSwatch(silks) {
  const { body, accent, third } = silksRgb(silks);
  const [a, b, c] = [body, accent, third].map(css);
  const p = silks.pattern;
  if (p === "hoops") return `repeating-linear-gradient(0deg, ${a} 0 3px, ${b} 3px 6px)`;
  if (p === "stripes") return `repeating-linear-gradient(90deg, ${a} 0 3px, ${b} 3px 6px)`;
  if (p === "halves") return `linear-gradient(90deg, ${a} 50%, ${b} 50%)`;
  if (p === "quarters") return `conic-gradient(${a} 0 25%, ${b} 0 50%, ${a} 0 75%, ${b} 0)`;
  if (p === "sash") return `linear-gradient(135deg, ${a} 38%, ${b} 38% 62%, ${a} 62%)`;
  if (p === "chevrons") return `repeating-linear-gradient(135deg, ${a} 0 3px, ${b} 3px 6px)`;
  if (p === "crossbelts") return `linear-gradient(45deg, transparent 40%, ${b} 40% 60%, transparent 60%), linear-gradient(135deg, ${a} 40%, ${b} 40% 60%, ${a} 60%)`;
  if (p === "checks") return `repeating-conic-gradient(${a} 0 25%, ${b} 0 50%) 0 0 / 12px 12px`;
  if (p === "diamonds") return `conic-gradient(from 45deg at 50% 50%, ${b} 0 25%, ${a} 0 50%, ${b} 0 75%, ${a} 0) 0 0 / 14px 14px`;
  if (p === "braces") return `linear-gradient(90deg, ${a} 22%, ${b} 22% 36%, ${a} 36% 64%, ${b} 64% 78%, ${a} 78%)`;
  return `linear-gradient(90deg, ${b} 22%, ${a} 22% 78%, ${c} 78%)`;
}
