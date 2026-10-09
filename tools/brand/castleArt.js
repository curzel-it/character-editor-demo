const WALL = { lit: "#F4E6C8", shade: "#E0CBA2", deep: "#C9B08A" };
const ROOF = { lit: "#7F95C8", shade: "#5F74A8" };

/** A small storybook castle of cream stone and slate-blue cones, standing with its feet at (x, y). */
export function castle(x, y, scale = 1) {
  const s = (v) => v * scale;
  const window = (cx, top) => `<rect x="${cx - s(7)}" y="${top}" width="${s(14)}" height="${s(22)}" rx="${s(7)}" fill="#6B5240"/>`;
  const tower = (cx, w, h, roof) => {
    const top = y - s(h);
    const half = s(w) / 2;
    const eave = half * 1.25;
    return `<rect x="${cx - half}" y="${top}" width="${s(w)}" height="${s(h)}" rx="${s(6)}" fill="${WALL.lit}"/>
      <rect x="${cx + half * 0.25}" y="${top}" width="${half * 0.75}" height="${s(h)}" rx="${s(6)}" fill="${WALL.shade}"/>
      ${window(cx - s(3), top + s(40))}
      <path d="M${cx - eave} ${top + s(6)}Q${cx - eave * 0.5} ${top - s(roof) * 0.45} ${cx} ${top - s(roof)}Q${cx + eave * 0.5} ${top - s(roof) * 0.45} ${cx + eave} ${top + s(6)}Q${cx} ${top + s(18)} ${cx - eave} ${top + s(6)}z" fill="${ROOF.lit}"/>
      <path d="M${cx} ${top - s(roof)}Q${cx + eave * 0.5} ${top - s(roof) * 0.45} ${cx + eave} ${top + s(6)}Q${cx + eave * 0.5} ${top + s(14)} ${cx + s(4)} ${top + s(12)}Q${cx + eave * 0.2} ${top - s(roof) * 0.4} ${cx} ${top - s(roof)}z" fill="${ROOF.shade}"/>`;
  };
  const banner = (cx, top, color) => `<rect x="${cx - s(2)}" y="${top}" width="${s(4)}" height="${s(46)}" rx="${s(2)}" fill="#8A6A4E"/>
    <path d="M${cx + s(2)} ${top + s(2)}Q${cx + s(22)} ${top + s(4)} ${cx + s(36)} ${top + s(12)}Q${cx + s(22)} ${top + s(20)} ${cx + s(2)} ${top + s(24)}z" fill="${color}"/>`;
  const crenels = Array.from({ length: 7 }, (_, i) => `<rect x="${x - s(140) + i * s(42)}" y="${y - s(104)}" width="${s(28)}" height="${s(22)}" rx="${s(6)}" fill="${WALL.lit}"/>`).join("");
  return `<g>
    ${crenels}
    <rect x="${x - s(150)}" y="${y - s(90)}" width="${s(300)}" height="${s(90)}" rx="${s(8)}" fill="${WALL.lit}"/>
    <rect x="${x + s(20)}" y="${y - s(90)}" width="${s(130)}" height="${s(90)}" rx="${s(8)}" fill="${WALL.shade}"/>
    ${tower(x - s(150), 56, 180, 90)}${tower(x + s(150), 56, 180, 90)}${tower(x, 84, 240, 120)}
    ${banner(x, y - s(240) - s(120) - s(40), "#F2B33D")}
    ${banner(x - s(150), y - s(180) - s(90) - s(40), "#E8735A")}
    ${banner(x + s(150), y - s(180) - s(90) - s(40), "#7CC85E")}
    <path d="M${x - s(22)} ${y}V${y - s(34)}A${s(22)} ${s(22)} 0 0 1 ${x + s(22)} ${y - s(34)}V${y}z" fill="#7A5638"/>
    <rect x="${x - s(150)}" y="${y - s(8)}" width="${s(300)}" height="${s(8)}" rx="${s(4)}" fill="${WALL.deep}"/>
  </g>`;
}
