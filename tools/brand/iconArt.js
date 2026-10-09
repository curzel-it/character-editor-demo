import { drawMascot } from "./mascot.js";
import { cloud, gradient, hills, mountains } from "./landscape.js";

export const ICON_SIZE = 1024;

const SKY = [[0, "#7EC4F0"], [0.55, "#BDE3F7"], [1, "#FFF1DA"]];

const backdrop = () => `<svg viewBox="0 0 1024 1024" width="1024" height="1024"><defs>${gradient("sky", SKY)}
  ${gradient("icon-far", [[0, "#9FD889"], [1, "#86C96A"]])}${gradient("icon-near", [[0, "#8ACB62"], [1, "#6FB24F"]])}
  <radialGradient id="glow" cx="0.82" cy="0.14" r="0.55"><stop offset="0" stop-color="#FFE9B8" stop-opacity=".9"/><stop offset="1" stop-color="#FFE9B8" stop-opacity="0"/></radialGradient></defs>
  <rect width="1024" height="1024" fill="url(#sky)"/><rect width="1024" height="1024" fill="url(#glow)"/>
  ${cloud(170, 250, 150, { opacity: 0.95 })}${cloud(880, 420, 110, { opacity: 0.85 })}
  ${mountains({ floor: 860, lit: "#CFE3F6", shade: "#AFCBEB", snow: "#FFFBF2", peaks: [[60, 600, 230], [930, 640, 220], [720, 700, 200]] })}
  ${hills({ seed: "icon-far", width: 1024, floor: 1100, top: 760, bottom: 830, count: 3, fill: "url(#icon-far)", lip: "#C3EBA6" })}
  ${hills({ seed: "icon-near", width: 1024, floor: 1100, top: 860, bottom: 920, count: 2, fill: "url(#icon-near)", lip: "#A6DC86" })}
</svg>`;

/**
 * The app icon in two layers: the sky and mountains, and the dragon's head on its own, so the
 * store icon can be flattened and the Android adaptive icon keeps them apart.
 * @param {HTMLElement} root
 * @param {{layer: "all" | "background" | "foreground", inset: number}} options `inset` shrinks the dragon toward the centre
 */
export async function renderIcon(root, { layer, inset }) {
  root.style.cssText = `position:relative;width:${ICON_SIZE}px;height:${ICON_SIZE}px`;
  if (layer !== "foreground") root.insertAdjacentHTML("beforeend", backdrop());
  if (layer === "background") return;
  const canvas = Object.assign(document.createElement("canvas"), { width: ICON_SIZE, height: ICON_SIZE });
  canvas.style.cssText = "position:absolute;inset:0";
  root.append(canvas);
  await drawMascot(canvas, {
    focus: "head",
    radius: 1.3,
    zoom: inset,
    age: "kid",
    yaw: -0.7,
    pitch: 0.1,
    offset: [-0.05, -0.05, 0],
    genes: { head: 0, headgear: 0 },
    motion: { stand: 1, time: 0.7 },
  });
}
