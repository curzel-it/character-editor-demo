const turn = Math.PI * 2;
const frac = (v) => ((v % 1) + 1) % 1;

/**
 * The jacket's colour at `t` along the torso (0 the hem, 1 the collar) and `angle` round it, in the
 * silks' pattern of `body` and `accent`.
 */
export function jacketPaint(pattern, { body, accent }) {
  return (t, angle) => {
    const w = Math.sin(angle);
    const alt = (on) => (on ? accent : body);
    if (pattern === "hoops") return alt(Math.floor(t * 6) % 2 === 1);
    if (pattern === "stripes") return alt(Math.floor((angle / turn) * 10) % 2 === 1);
    if (pattern === "halves") return alt(w < 0);
    if (pattern === "quarters") return alt(w < 0 !== t > 0.5);
    if (pattern === "sash") return alt(Math.abs(t - 0.5 - 0.5 * w) < 0.2);
    if (pattern === "crossbelts") return alt(Math.abs(t - 0.5 - 0.5 * w) < 0.13 || Math.abs(t - 0.5 + 0.5 * w) < 0.13);
    if (pattern === "chevrons") return alt(frac(t * 2 - Math.abs(w) * 0.9) < 0.5);
    if (pattern === "checks") return alt((Math.floor(t * 5) + Math.floor((angle / turn) * 8)) % 2 === 1);
    if (pattern === "diamonds") return alt(Math.abs(frac(t * 3) - 0.5) + Math.abs(frac((angle / turn) * 6) - 0.5) < 0.5);
    if (pattern === "braces") return alt(Math.abs(Math.abs(w) - 0.55) < 0.17);
    return body;
  };
}

/** The silks cap's colour at `t` up the dome and `angle` round it: quartered, hooped, striped or plain in the cap colour. */
export function capPaint(pattern, { body, accent, cap }) {
  return (t, angle) => {
    const w = Math.sin(angle),
      front = Math.cos(angle);
    if (pattern === "quarters" || pattern === "halves" || pattern === "checks") return w < 0 !== front < 0 ? cap : body;
    if (pattern === "hoops") return t > 0.35 && t < 0.62 ? accent : cap;
    if (pattern === "stripes" || pattern === "braces") return Math.abs(w) < 0.3 && t > 0.1 ? accent : cap;
    if (pattern === "diamonds" || pattern === "crossbelts") return t > 0.4 && Math.floor((angle / Math.PI) * 3) % 2 ? accent : cap;
    return cap;
  };
}
