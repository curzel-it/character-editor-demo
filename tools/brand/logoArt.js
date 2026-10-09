import { drawMascot } from "./mascot.js";
import { cloud, mountains } from "./landscape.js";

import { DEFAULT_LOGO_FONT, LOGO_FONTS } from "./logoFonts.js";

/** `word` is the title alone, `badge` adds the plate and tagline, `peaks` adds the mountains, `full` adds the dragon too. */
export const LOGO_SIZES = {
  word: { width: 2048, height: 540 },
  badge: { width: 2048, height: 600 },
  peaks: { width: 2048, height: 760 },
  full: { width: 2048, height: 1190 },
};
const PEAKS_LIFT = 430;
export const TAGLINE = ["Raise", "Race", "Breed", "Champions"];

const peaks = () => `<svg class="logo__peaks" viewBox="0 0 1400 520" width="1400" height="520">
  ${mountains({ floor: 560, lit: "#BFD8F3", shade: "#98BCE6", snow: "#FFFBF2", peaks: [[170, 330, 190], [450, 260, 230], [960, 250, 230], [1230, 320, 190]] })}
  ${mountains({ floor: 560, lit: "#A9CBEF", shade: "#83ADE0", snow: "#FFFBF2", peaks: [[700, 205, 270]] })}
  ${cloud(300, 400, 70)}${cloud(1120, 390, 60)}
</svg>`;

/** The wordmark on its badge: crown, DRAGONS!, and the tagline. */
const WORD = "DRAGONS!";
const LAYERS = ["rim", "ink", "ext", "hi", "face", "sprout"];
/** The ink is the stroked letters in one brown; the rim is that silhouette dropped as a soft warm shadow. */
const RIM_FILTER = `<svg width="0" height="0" style="position:absolute">
<filter id="logo-ink" x="-5%" y="-20%" width="110%" height="140%" color-interpolation-filters="sRGB">
  <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 .353  0 0 0 0 .224  0 0 0 0 .133  0 0 0 1 0"/>
</filter>
<filter id="logo-rim" x="-5%" y="-20%" width="110%" height="150%" color-interpolation-filters="sRGB">
  <feOffset in="SourceAlpha" dy="22"/><feGaussianBlur stdDeviation="14"/>
  <feColorMatrix type="matrix" values="0 0 0 0 .235  0 0 0 0 .157  0 0 0 0 .078  0 0 0 .35 0"/>
</filter></svg>`;
/** Two leaves sprouting from the top of the D. */
const SPROUT = `<svg class="logo__sprout" viewBox="0 0 120 110" aria-hidden="true">
  <g stroke="#5A3922" stroke-width="7" stroke-linejoin="round" stroke-linecap="round">
    <path d="M60 104C60 84 58 70 54 58" fill="none"/>
    <path d="M55 60C38 62 14 54 8 26 34 18 54 34 55 60z" fill="#8BD06B"/>
    <path d="M57 56C62 30 82 10 112 12 112 42 88 60 57 56z" fill="#6DBE55"/>
  </g>
  <path d="M20 30C32 30 44 40 50 52M66 46C76 34 88 24 102 20" fill="none" stroke="#C8F0A8" stroke-width="5" stroke-linecap="round"/>
</svg>`;
const wordHtml = (extra = "") => {
  const mid = (WORD.length - 1) / 2;
  const letters = [...WORD].map((ch, i) => {
    const t = (i - mid) / mid;
    const jitter = [0.6, -0.5, 0.4, -0.3, 0.5, -0.6, 0.3, 0][i];
    return `<span class="logo__ch" style="--dy:${(t * t * 0.07).toFixed(3)}em;--rot:${(t * 5 + jitter).toFixed(2)}deg">${ch}${i === 0 ? SPROUT : ""}</span>`;
  }).join("");
  return `<div class="logo__word ${extra}">${RIM_FILTER}${LAYERS.map((layer) => `<div class="logo__layer logo__layer--${layer}">${letters}</div>`).join("")}</div>`;
};


export const wordmarkHtml = () => `<div class="logo__mark">
  <div class="logo__plate"></div>
  ${wordHtml()}
  <div class="logo__tagline">${TAGLINE.map((word) => `<span>${word}</span>`).join('<i class="logo__dot"></i>')}</div>
</div>`;

/**
 * Draws a logo on a transparent page.
 * @param {HTMLElement} root
 * @param {{part?: keyof typeof LOGO_SIZES, font?: keyof typeof LOGO_FONTS}} [options]
 */
export async function renderLogo(root, { part = "full", font = DEFAULT_LOGO_FONT } = {}) {
  const [family, weight] = LOGO_FONTS[font] ?? LOGO_FONTS[DEFAULT_LOGO_FONT];
  const { width, height } = LOGO_SIZES[part];
  root.classList.add("logo");
  const lift = part === "peaks" ? PEAKS_LIFT : 0;
  root.style.cssText = `--mark-top:${part === "full" || part === "peaks" ? 590 - lift : 0}px;--peaks-top:${235 - lift}px;--dz-font-logo:"${family}";--logo-weight:${weight};width:${width}px;height:${height}px`;
  if (part === "word") {
    root.insertAdjacentHTML("beforeend", wordHtml("logo__word--alone"));
    return;
  }
  if (part === "full" || part === "peaks") root.insertAdjacentHTML("beforeend", peaks());
  if (part === "full") {
    const canvas = Object.assign(document.createElement("canvas"), { width: 1400, height: 760 });
    canvas.className = "logo__dragon";
    root.append(canvas);
    await drawMascot(canvas, {
      time: 0.65,
      yaw: -0.9,
      pitch: 0.12,
      zoom: 1.5,
      motion: { effort: 0.5, glide: 0, time: 0.65 },
      genes: { head: 0, headgear: 0 },
    });
  }
  root.insertAdjacentHTML("beforeend", wordmarkHtml());
}
