import { drawMascot } from "./mascot.js";
import { cloud, flowers, gradient, hills, mountains, trees } from "./landscape.js";
import { castle } from "./castleArt.js";
import { renderLogo } from "./logoArt.js";
import { colourIndex } from "/src/palette.js";

export const SPLASH_SIZE = { width: 1290, height: 2796 };
const { width: W, height: H } = SPLASH_SIZE;

const GREENS = [["#3E8E4E", "#4FA35A", "#6DBE6A"], ["#4A9A48", "#5CB052", "#7FCB68"], ["#5E9E3E", "#74B54C", "#93CF66"]];

const backdrop = () => `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="position:absolute;inset:0"><defs>
  ${gradient("splash-sky", [[0, "#6FB8EE"], [0.4, "#AEDBF6"], [0.62, "#FFF1DA"]])}
  <radialGradient id="splash-sun" cx="0.8" cy="0.22" r="0.6"><stop offset="0" stop-color="#FFE7B0" stop-opacity=".75"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
  ${gradient("splash-meadow", [[0, "#A9DC88"], [1, "#86C866"]])}
  ${gradient("splash-knoll", [[0, "#93D06C"], [0.5, "#7DBE5A"], [1, "#6AAE4C"]])}
  ${gradient("splash-river", [[0, "#8FD0F2"], [1, "#4FA7E0"]])}
  </defs>
  <rect width="${W}" height="${H}" fill="url(#splash-sky)"/><rect width="${W}" height="${H}" fill="url(#splash-sun)"/>
  ${cloud(240, 1020, 170, { opacity: 0.9 })}${cloud(1080, 880, 130, { opacity: 0.8 })}${cloud(700, 1240, 110, { opacity: 0.7 })}
  ${mountains({ floor: 1760, lit: "#DCEAF8", shade: "#B9D1EE", snow: "#FFFBF2", peaks: [[80, 1180, 360], [560, 1100, 380], [1180, 1220, 340]] })}
  ${mountains({ floor: 1780, lit: "#B5CDEB", shade: "#93B3E0", snow: "#F2F7FD", peaks: [[330, 1380, 300], [930, 1340, 320]] })}
  ${hills({ seed: "splash-far", width: W, floor: 2100, top: 1600, bottom: 1700, count: 4, fill: "#B8E39A", lip: "#D3F0BC" })}
  ${trees({ seed: "splash-trees-far", x0: -20, x1: 520, y0: 1690, y1: 1780, count: 26, size: 90, greens: GREENS })}
  ${castle(1000, 1745, 1.25)}
  ${hills({ seed: "splash-mid", width: W, floor: 2300, top: 1740, bottom: 1830, count: 3, fill: "url(#splash-meadow)", lip: "#C3EBA6" })}
  ${trees({ seed: "splash-trees-a", x0: -40, x1: 470, y0: 1820, y1: 2010, count: 22, size: 140, greens: GREENS })}
  ${trees({ seed: "splash-trees-b", x0: 880, x1: W + 40, y0: 1880, y1: 2080, count: 16, size: 160, greens: GREENS })}
  ${hills({ seed: "splash-knoll", width: W, floor: H + 40, top: 1940, bottom: 2060, count: 3, fill: "url(#splash-knoll)", lip: "#A6DC86" })}
  <ellipse cx="560" cy="2002" rx="250" ry="34" fill="#3F7A2E" opacity=".28"/>
  ${hills({ seed: "splash-front", width: W, floor: H + 40, top: 2320, bottom: 2420, count: 2, fill: "#6CAF4D", lip: "#86C866" })}
  ${flowers({ seed: "splash-flowers", x0: 0, x1: W, y0: 2120, y1: 2700, count: 60, size: 22, colors: ["#FFFFFF", "#F7A6C1", "#FFE08A", "#C9B6F2"] })}
  ${trees({ seed: "splash-bush-l", x0: -60, x1: 90, y0: 2420, y1: 2440, count: 2, size: 260, greens: GREENS, pines: 0 })}
  ${trees({ seed: "splash-bush-r", x0: 1180, x1: 1330, y0: 2380, y1: 2400, count: 2, size: 240, greens: GREENS, pines: 0 })}
</svg>`;

/** Portrait loading screen: the brand dragon as a kid on a grassy knoll above the valley, the wordmark and the progress bar. @param {HTMLElement} root */
export async function renderSplash(root) {
  root.classList.add("splash");
  root.style.cssText = `position:relative;overflow:hidden;width:${W}px;height:${H}px`;
  root.insertAdjacentHTML("beforeend", backdrop());

  const canvas = Object.assign(document.createElement("canvas"), { width: 1290, height: 1300 });
  canvas.className = "splash__dragon";
  root.append(canvas);
  await drawMascot(canvas, {
    age: "kid",
    yaw: -0.55,
    pitch: 0.1,
    zoom: 1.25,
    genes: { head: 0, headgear: 0 },
    motion: { stand: 1, time: 0.7 },
  });

  await flyer(root, { left: 120, top: 640, genes: { scales: colourIndex("azure"), wings: colourIndex("cobalt") } });
  await flyer(root, { left: 800, top: 540, genes: { scales: colourIndex("rust"), wings: colourIndex("rust") } });

  const logo = document.createElement("div");
  logo.className = "splash__logo";
  root.append(logo);
  await renderLogo(logo, { part: "badge" });

  root.insertAdjacentHTML(
    "beforeend",
    `<div class="splash__loading"><div class="splash__track"><div class="splash__fill"></div></div><p class="splash__label">Waking the stable…</p></div>`,
  );
}

/** A small dragon gliding in the sky, to show the field is not one dragon. */
async function flyer(root, { left, top, genes }) {
  const canvas = Object.assign(document.createElement("canvas"), { width: 420, height: 280 });
  canvas.style.cssText = `position:absolute;left:${left}px;top:${top}px`;
  root.append(canvas);
  await drawMascot(canvas, { yaw: -0.9, pitch: 0.25, zoom: 1.35, time: 0.62, motion: { effort: 0.4, glide: 0.5, time: 0.62 }, genes: { head: 0, headgear: 0, ...genes } });
}
