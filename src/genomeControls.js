import { dragonColors } from "./palette.js";

let activeGroup = "color";
const cssColor = (rgb) =>
  `rgb(${rgb.map((n) => Math.round(n * 255)).join(" ")})`;

export function showGenomeControls(module, genome, onChange) {
  const genes = document.getElementById("genes");
  const tabs = document.getElementById("gene-tabs");
  const presets = document.getElementById("color-presets");
  const shapeTab = document.getElementById("shape-tab");
  const colorTab = document.getElementById("color-tab");
  const grouped = module.genes.some((gene) => gene.group === "color");
  tabs.hidden = !grouped;
  function paletteSelection() {
    for (const button of presets.querySelectorAll("button")) {
      const preset = module.presets.find(
        (entry) => entry.id === button.dataset.palette,
      );
      button.setAttribute(
        "aria-pressed",
        String(
          Object.entries(preset.genes).every(
            ([key, value]) => Math.abs(genome[key] - value) < 1e-8,
          ),
        ),
      );
    }
  }
  function draw() {
    presets.hidden = !grouped || activeGroup !== "color";
    shapeTab.setAttribute("aria-selected", String(activeGroup === "shape"));
    colorTab.setAttribute("aria-selected", String(activeGroup === "color"));
    presets.replaceChildren(
      ...(module.presets || []).map((preset) => {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.palette = preset.id;
        button.title = `${preset.label} palette`;
        const colors = dragonColors(preset.genes);
        const swatch = document.createElement("span");
        swatch.className = "palette-swatch";
        swatch.style.background = `linear-gradient(125deg, ${cssColor(colors.skin)} 0% 45%, ${cssColor(colors.membrane)} 45% 75%, ${cssColor(colors.under)} 75% 100%)`;
        swatch.setAttribute("aria-hidden", "true");
        button.append(swatch, document.createTextNode(preset.label));
        button.onclick = () => {
          Object.assign(genome, preset.genes);
          onChange();
          draw();
        };
        return button;
      }),
    );
    paletteSelection();
    genes.replaceChildren(
      ...module.genes
        .filter((gene) => !grouped || (gene.group || "shape") === activeGroup)
        .map((gene) => {
          const group = document.createElement("div");
          group.className = "gene";
          const row = document.createElement("div");
          row.className = "gene-label";
          const label = document.createElement("label");
          label.htmlFor = `gene-${gene.name}`;
          label.textContent = gene.label;
          if (gene.choices) {
            const select = document.createElement("select");
            select.id = label.htmlFor;
            select.append(
              ...gene.choices.map((choice, index) =>
                Object.assign(document.createElement("option"), {
                  value: index,
                  textContent: choice,
                }),
              ),
            );
            select.value = Math.min(
              gene.choices.length - 1,
              Math.floor(genome[gene.name]),
            );
            select.addEventListener("change", () => {
              genome[gene.name] = Number(select.value);
              onChange();
            });
            row.append(label);
            group.append(row, select);
            return group;
          }
          const output = document.createElement("output");
          output.textContent = genome[gene.name].toFixed(2);
          const input = document.createElement("input");
          input.type = "range";
          input.id = label.htmlFor;
          input.min = gene.min;
          input.max = gene.max;
          input.step = (gene.max - gene.min) / 200;
          input.value = genome[gene.name];
          input.addEventListener("input", () => {
            genome[gene.name] = Number(input.value);
            output.textContent = Number(input.value).toFixed(2);
            onChange();
            paletteSelection();
          });
          row.append(label, output);
          group.append(row, input);
          return group;
        }),
    );
  }
  shapeTab.onclick = () => {
    activeGroup = "shape";
    draw();
  };
  colorTab.onclick = () => {
    activeGroup = "color";
    draw();
  };
  draw();
}
