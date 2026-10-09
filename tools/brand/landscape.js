import { makeRng } from "/src/rng.js";

const f = (v) => v.toFixed(1);

/** A linear gradient as an SVG paint server, top to bottom unless `[x2, y2]` says otherwise. */
export const gradient = (id, stops, [x2, y2] = [0, 1]) =>
  `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops
    .map(([offset, color, opacity = 1]) => `<stop offset="${offset}" stop-color="${color}" stop-opacity="${opacity}"/>`)
    .join("")}</linearGradient>`;

/** A smooth path through `points` (Catmull-Rom as cubic Béziers), without the leading move. */
function smooth(points) {
  let d = "";
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [points[i - 1] ?? points[i], points[i], points[i + 1], points[i + 2] ?? points[i + 1]];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

/** A crest line of `count` gentle swells between `top` and `bottom`. */
function crest({ seed, width, top, bottom, count }) {
  const random = makeRng(seed);
  const step = (width + 200) / count;
  return Array.from({ length: count + 1 }, (_, i) => [i * step - 100 + (random() - 0.5) * step * 0.3, top + (bottom - top) * random()]);
}

/**
 * A band of rolling hills: a soft crest filled down to `floor`, with a lighter lip along the top.
 * @param {{seed: string, width: number, floor: number, top: number, bottom: number, count: number, fill: string, lip?: string}} hills
 */
export function hills({ seed, width, floor, top, bottom, count, fill, lip }) {
  const points = crest({ seed, width, top, bottom, count });
  const line = `M${f(points[0][0])} ${f(points[0][1])}${smooth(points)}`;
  const body = `<path d="${line}L${width + 100} ${floor}L-100 ${floor}z" fill="${fill}"/>`;
  return lip ? `${body}<path d="${line}" fill="none" stroke="${lip}" stroke-width="${Math.max(6, (floor - top) * 0.025)}" stroke-linecap="round" opacity=".8"/>` : body;
}

let clips = 0;

/**
 * Rounded mountains: each peak a soft dome, its right flank in shade and a snow cap with drips down its slopes,
 * both clipped to the peak's outline.
 * @param {{peaks: [number, number, number][], floor: number, lit: string, shade: string, snow?: string}} range `[x, top, halfWidth]` per peak
 */
export function mountains({ peaks, floor, lit, shade, snow }) {
  return peaks
    .map(([x, top, half]) => {
      const id = `peak-${++clips}`;
      const h = floor - top;
      const round = half * 0.4;
      const outline = `M${x - half} ${floor}C${x - half * 0.5} ${top + h * 0.4} ${x - round} ${top} ${x} ${top}C${x + round} ${top} ${x + half * 0.5} ${top + h * 0.4} ${x + half} ${floor}z`;
      const flank = `M${x + half * 0.04} ${top - 10}C${x - half * 0.08} ${top + h * 0.35} ${x + half * 0.22} ${top + h * 0.7} ${x + half * 0.1} ${floor + 10}H${x + half + 10}V${top - 10}z`;
      const drip = h * 0.07;
      const line = top + h * 0.15;
      const cap = snow
        ? `<path d="M${x - half} ${top - 10}V${line}${[-0.6, -0.3, 0, 0.3, 0.6].map((t, i) => `Q${x + (t - 0.15) * half} ${line + (i % 2 ? drip * 2.2 : drip)} ${x + (t + 0.15) * half} ${line + (i % 2 ? -drip * 0.2 : drip * 0.6)}`).join("")}H${x + half}V${top - 10}z" fill="${snow}"/>`
        : "";
      return `<clipPath id="${id}"><path d="${outline}"/></clipPath><path d="${outline}" fill="${lit}"/><g clip-path="url(#${id})"><path d="${flank}" fill="${shade}"/>${cap}</g>`;
    })
    .join("");
}

/** Little five-petal flowers dotted over a band of meadow. */
export function flowers({ seed, x0, x1, y0, y1, count, size, colors }) {
  const random = makeRng(seed);
  return Array.from({ length: count }, () => {
    const depth = random();
    const x = x0 + random() * (x1 - x0);
    const y = y0 + depth * (y1 - y0);
    const r = size * (0.5 + depth * 0.7);
    const color = colors[Math.floor(random() * colors.length)];
    const petals = [0, 1, 2, 3, 4].map((i) => {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      return `<circle cx="${f(x + Math.cos(a) * r * 0.55)}" cy="${f(y + Math.sin(a) * r * 0.45)}" r="${f(r * 0.42)}" fill="${color}"/>`;
    });
    return `${petals.join("")}<circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.3)}" fill="#FFD45E"/>`;
  }).join("");
}

/**
 * A puffy cloud of overlapping rounds: a flat base, a warm shadowed belly and a bright top.
 * @param {number} x centre
 * @param {number} y base line
 * @param {number} size
 */
export function cloud(x, y, size, { top = "#FFFFFF", belly = "#F3E6F0", opacity = 1 } = {}) {
  const puffs = [[-0.62, 0.28], [-0.28, 0.46], [0.08, 0.58], [0.44, 0.42], [0.72, 0.26]];
  const circle = (dx, r, dy, color) => `<circle cx="${f(x + dx * size)}" cy="${f(y - r * size + dy)}" r="${f(r * size)}" fill="${color}"/>`;
  return `<g opacity="${opacity}">
    ${puffs.map(([dx, r]) => circle(dx, r, 0, belly)).join("")}
    <rect x="${f(x - 0.62 * size)}" y="${f(y - 0.28 * size)}" width="${f(1.34 * size)}" height="${f(0.28 * size)}" rx="${f(0.14 * size)}" fill="${belly}"/>
    ${puffs.map(([dx, r]) => circle(dx - 0.03, r * 0.9, -0.1 * size, top)).join("")}
  </g>`;
}

/** Round, bushy broadleaf trees and soft pines scattered along a band, nearer ones larger and drawn last. */
export function trees({ seed, x0, x1, y0, y1, count, size, greens, pines = 0.35, trunk = "#8A5A3B" }) {
  const random = makeRng(seed);
  const list = Array.from({ length: count }, () => ({ depth: random(), x: x0 + random() * (x1 - x0), pine: random() < pines, tone: random() }));
  return list
    .sort((a, b) => a.depth - b.depth)
    .map(({ depth, x, pine, tone }) => {
      const y = y0 + depth * (y1 - y0);
      const s = size * (0.55 + depth * 0.8);
      const [dark, mid, light] = greens[Math.floor(tone * greens.length)];
      if (pine) {
        const tier = (w, top, bottom, color) =>
          `<path d="M${f(x - w)} ${f(bottom)}Q${f(x)} ${f(bottom + s * 0.08)} ${f(x + w)} ${f(bottom)}Q${f(x + w * 0.3)} ${f(top + s * 0.1)} ${f(x)} ${f(top)}Q${f(x - w * 0.3)} ${f(top + s * 0.1)} ${f(x - w)} ${f(bottom)}z" fill="${color}"/>`;
        return `<rect x="${f(x - s * 0.06)}" y="${f(y - s * 0.3)}" width="${f(s * 0.12)}" height="${f(s * 0.3)}" rx="${f(s * 0.04)}" fill="${trunk}"/>
          ${tier(s * 0.42, y - s * 0.95, y - s * 0.22, dark)}${tier(s * 0.33, y - s * 1.3, y - s * 0.62, mid)}${tier(s * 0.22, y - s * 1.6, y - s * 1.0, light)}`;
      }
      const r = s * 0.42;
      return `<rect x="${f(x - s * 0.07)}" y="${f(y - s * 0.5)}" width="${f(s * 0.14)}" height="${f(s * 0.5)}" rx="${f(s * 0.05)}" fill="${trunk}"/>
        <circle cx="${f(x - r * 0.55)}" cy="${f(y - s * 0.7)}" r="${f(r * 0.8)}" fill="${dark}"/>
        <circle cx="${f(x + r * 0.55)}" cy="${f(y - s * 0.72)}" r="${f(r * 0.82)}" fill="${dark}"/>
        <circle cx="${f(x)}" cy="${f(y - s * 1.0)}" r="${f(r)}" fill="${mid}"/>
        <circle cx="${f(x - r * 0.3)}" cy="${f(y - s * 1.12)}" r="${f(r * 0.45)}" fill="${light}"/>`;
    })
    .join("");
}
