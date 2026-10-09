import { icon } from "/src/ui/icons.js";

const COLOURS = ["primary", "secondary", "accent", "info", "success", "warning", "purple", "danger", "navy", "cream", "cream-deep", "sky-top"];
const TYPE = [
  ["Lilita One · logo", "400 54px/1 var(--dz-font-logo)", "Dragons!"],
  ["Fredoka 600 · title", "var(--dz-text-h1)", "Ember earned a star!"],
  ["Fredoka 600 · heading", "var(--dz-text-h3)", "Main Event · Gold"],
  ["Fredoka 400 · body", "var(--dz-text-body)", "Needs feeding, play and cleaning a few times a day."],
];
const RADII = ["sm", "md", "lg", "xl"];
const SHADOWS = ["drop", "card", "float"];

/** Fills `root` with the UI tokens as the game's stylesheet resolves them, plus a few live components. */
export function tokenSheet(root) {
  const style = getComputedStyle(document.documentElement);
  const value = (name) => style.getPropertyValue(`--dz-${name}`).trim();
  const column = (title, body, width) => `<div class="card tokens__col" style="width:${width}px"><h3>${title}</h3>${body}</div>`;
  root.innerHTML =
    column(
      "Colour",
      `<div class="tokens__swatches">${COLOURS.map((name) => `<div class="tokens__swatch"><span style="background:var(--dz-${name})"></span><b>${name}</b><small>${value(name)}</small></div>`).join("")}</div>`,
      470,
    ) +
    column(
      "Type",
      TYPE.map(([label, font, sample]) => `<div class="tokens__type"><small>${label}</small><div style="font:${font}">${sample}</div></div>`).join("") +
        `<small class="tokens__rule">One rounded face, narrowed, three weights. No italics, no capitals.</small>`,
      470,
    ) +
    column(
      "Shape and parts",
      `<div class="tokens__radii">${RADII.map((r) => `<div><span style="border-radius:var(--dz-radius-${r})"></span><small>${value(`radius-${r}`)}</small></div>`).join("")}</div>
      <div class="tokens__radii">${SHADOWS.map((s) => `<div><span style="box-shadow:var(--dz-shadow-${s});border:0"></span><small>${s}</small></div>`).join("")}</div>
      <div class="tokens__parts">
        <button class="dz-btn dz-btn--primary">${icon("race")}Race</button>
        <button class="dz-btn dz-btn--accent">${icon("evolve")}Evolve</button>
        <button class="dz-btn dz-btn--tile" style="--c:var(--dz-warning)">${icon("meat")}<span class="dz-btn__label">Feed</span></button>
        <button class="dz-btn dz-btn--tile" style="--c:var(--dz-secondary)">${icon("smile")}<span class="dz-btn__label">Play</span></button>
        <button class="dz-btn dz-btn--tile" style="--c:var(--dz-info)">${icon("drop")}<span class="dz-btn__label">Clean</span></button>
      </div>
      <div class="dz-meter" style="--c:var(--dz-success);--value:72">${icon("heart")}<span>Bond</span><div class="dz-meter__track"><div class="dz-meter__fill"></div></div></div>`,
      470,
    );
}
