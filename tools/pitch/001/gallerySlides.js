import { drawDragon, genomeOf, variant, gene } from "./dragonGallery.js";
import { dragonColours, colourIndex } from "/src/palette.js";

const BASE = 537;
const coat = (id, underside = "ivory") => ({ scales: colourIndex(id), wings: colourIndex(id), underside: colourIndex(underside), markings: 0 });
const UNDERSIDE = { ivory: "sand", sand: "chocolate", ash: "ivory", mint: "forest", lavender: "plum", gold: "chocolate" };
const PATTERN_COATS = ["tangerine", "fern", "azure", "violet", "rose"];

/** Adds a captioned canvas to `grid`, to be drawn later with `spec`. */
function cell(grid, spec, caption, swatch) {
  const figure = document.createElement("figure");
  const canvas = document.createElement("canvas");
  canvas.dataset.dragon = JSON.stringify(spec);
  figure.append(canvas);
  if (caption) {
    const label = document.createElement("figcaption");
    if (swatch) label.innerHTML = `<span class="swatch" style="background:${swatch}"></span>`;
    label.append(caption);
    figure.append(label);
  }
  grid.append(figure);
}

function colourGrid(slide) {
  const grid = slide.querySelector(".gallery");
  const age = grid.dataset.age;
  for (const colour of dragonColours)
    cell(grid, { seed: BASE, genes: coat(colour.id, UNDERSIDE[colour.id]), age, zoom: age === "kid" ? 1.7 : 1.5 }, colour.label, colour.hex);
}

function patternGrid(slide) {
  const grid = slide.querySelector(".gallery");
  for (const marking of gene("markings").ids) {
    const label = document.createElement("div");
    label.className = "row-label";
    label.textContent = { none: "Plain", leopard: "Leopard", zebra: "Zebra", cow: "Cow" }[marking];
    grid.append(label);
    for (const colour of PATTERN_COATS)
      cell(grid, { seed: BASE, genes: { ...coat(colour, "ivory"), hindWings: 0, markings: variant("markings", marking) }, age: "teen", zoom: 1.9, yaw: -0.3 });
  }
}

function wall(slide) {
  const grid = slide.querySelector(".gallery");
  const ages = ["adult", "kid", "teen", "adult", "teen", "kid", "adult", "adult"];
  for (let i = 0; i < 30; i++) cell(grid, { seed: `wall-${i * 7 + 3}`, age: ages[i % ages.length], zoom: 1.6, yaw: -0.55 + ((i % 3) - 1) * 0.35 });
}

/** One row per part gene, each variant on the same dragon, framed on `focus`. */
function partsGrid(slide) {
  const grid = slide.querySelector(".gallery");
  for (const row of grid.dataset.parts.split(",")) {
    const [name, focus, radius, yaw = "-0.55", zoom = "1"] = row.split(":");
    const g = gene(name);
    g.ids.forEach((id, i) => {
      if (name === "hindWings" && id === "none") return;
      const view = focus ? { focus, radius: Number(radius) } : {};
      cell(grid, { seed: BASE, genes: { ...coat("azure", "ivory"), hindWings: 0, [name]: i }, age: "adult", yaw: Number(yaw), zoom: Number(zoom), ...view }, g.choices[i]);
    });
  }
}

const FACES = [
  ["Calm", { gaze: [0.3, 0] }],
  ["Delighted", { glee: 1, gaze: [0.3, 0.1] }],
  ["Sad", { glum: 1 }],
  ["Tired", { weary: 1 }],
  ["Eyes shut", { lids: 1 }],
  ["Roar", { roar: 1, gaze: [0.4, 0.2] }],
];

/** The same face per age in each mood the game drives, still. */
function faceGrid(slide) {
  const grid = slide.querySelector(".gallery");
  for (const age of ["kid", "teen"])
    for (const [label, motion] of FACES)
      cell(grid, { seed: "faces-4", genes: { ...coat("coral", "sand"), head: "beaked", headgear: "ram" }, age, focus: "gaze-1", radius: age === "kid" ? 0.72 : 0.95, yaw: -1, pitch: 0.1, motion }, label);
}

const builders = { wall, colourGrid, patternGrid, partsGrid, faceGrid };

/** Builds a slide's generated grid, then draws each of its dragon canvases a frame apart. */
export function fillGallery(slide) {
  const grid = slide.querySelector("[data-build]");
  if (grid && !grid.childElementCount) builders[grid.dataset.build](slide);
  const pending = [...slide.querySelectorAll("canvas[data-dragon]:not([data-drawn])")];
  if (!pending.length) return Promise.resolve();
  slide.classList.add("measure");
  return new Promise((done) => {
    const next = () => {
      const canvas = pending.shift();
      if (!canvas) {
        slide.classList.remove("measure");
        return done();
      }
      if (canvas.hasAttribute("data-drawn")) return next();
      const { seed = BASE, genes = {}, ...view } = JSON.parse(canvas.dataset.dragon);
      const named = Object.fromEntries(Object.entries(genes).map(([key, value]) => [key, typeof value === "string" ? variant(key, value) : value]));
      drawDragon(canvas, genomeOf(seed, named), view);
      canvas.dataset.drawn = "";
      requestAnimationFrame(next);
    };
    next();
  });
}
