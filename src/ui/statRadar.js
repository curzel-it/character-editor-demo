import { escapeHtml } from "../escapeHtml.js";
import { statShares } from "../statBars.js";

const size = 220,
  centre = size / 2,
  reach = 78;
const point = (i, n, r) => {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return [centre + Math.cos(a) * r * reach, centre + Math.sin(a) * r * reach];
};
const path = (values) => values.map((v, i) => point(i, values.length, v).map((c) => c.toFixed(1)).join(",")).join(" ");

/**
 * The five racing stats as a radar: the filled shape is the dragon now, its form the build and its
 * size the strength; the outline is the same build at 5 stars. A kid's Breath axis is greyed until it can breathe.
 */
export function statRadarHtml(genes, genome, strength, breathes = true) {
  const stats = statShares(genes, genome, strength, breathes);
  const n = stats.length;
  const rings = [0.25, 0.5, 0.75, 1].map((r) => `<polygon class="radar__ring" points="${path(stats.map(() => r))}"/>`).join("");
  const spokes = stats.map((s, i) => `<line class="radar__spoke" x1="${centre}" y1="${centre}" x2="${point(i, n, 1)[0].toFixed(1)}" y2="${point(i, n, 1)[1].toFixed(1)}"/>`).join("");
  const labels = stats
    .map((s, i) => {
      const [x, y] = point(i, n, 1.24);
      return `<text class="radar__label" ${s.off ? 'data-off=""' : ""} x="${x.toFixed(1)}" y="${y.toFixed(1)}">${escapeHtml(s.label)}</text>`;
    })
    .join("");
  const shown = stats.map((s) => (s.off ? 0 : s.share));
  return `<figure class="radar" aria-label="${escapeHtml(stats.map((s) => `${s.label} ${Math.round(s.share * 100)}`).join(", "))}">
      <svg viewBox="-20 0 ${size + 40} ${size}" role="img" aria-hidden="true">
        ${rings}${spokes}
        <polygon class="radar__top" points="${path(stats.map((s) => (s.off ? 0 : s.top)))}"/>
        <polygon class="radar__now" points="${path(shown)}"/>
        ${labels}
      </svg>
    </figure>`;
}
