import { fields, groups, fieldShown } from "../character/characterSpec.js";
import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./editorIcons.js";
import { tileViews } from "./tileRenderer.js";
import { openColorPicker } from "./colorPicker.js";

const HOVER_DELAY = 140;

/**
 * The editing panel: a tab per group (Body, Face, Eyes, Hair, Outfit, Extras) with a lock that keeps
 * the group through a shuffle and a dice that shuffles it alone, then each section's fields: option
 * tiles drawn live with the character itself, sliders, and colour swatches with a custom picker.
 * Hovering a tile previews it on the stage. Calls `onChange(changes, { commit })`, `onPreview(changes | null)`,
 * `onFocus(focus)` as the framing should follow, `onShuffle(group)` and `onLock(group)`.
 * @param {{ state: ReturnType<import("./editorState.js").createEditorState>, tiles: ReturnType<import("./tileRenderer.js").createTileRenderer>,
 *   onChange: (changes: object, options: { commit: boolean }) => void, onPreview: (changes: object | null) => void,
 *   onFocus: (focus: string) => void, onShuffle: (group: string) => void }} options
 */
export function createEditorPanel({ state, tiles, onChange, onPreview, onFocus, onShuffle }) {
  const el = document.createElement("section");
  el.className = "ce-panel";
  el.setAttribute("aria-label", "Character options");
  let group = groups[0].id;
  const visible = new Set();
  el.innerHTML = `
    <nav class="ce-tabs" role="tablist" aria-label="Categories">
      ${groups.map((g, i) => `<button type="button" class="ce-tab" role="tab" id="ce-tab-${g.id}" aria-controls="ce-group-${g.id}" data-tab="${g.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}">${icon(g.icon)}<span>${g.label}</span></button>`).join("")}
    </nav>
    <div class="ce-panel__head">
      <h2 class="ce-panel__title" data-title></h2>
      <button type="button" class="ce-iconbtn" data-lock aria-pressed="false" title="Keep this group when shuffling"></button>
      <button type="button" class="ce-iconbtn" data-shuffle title="Shuffle this group">${icon("dice")}</button>
    </div>
    <div class="ce-panel__body" data-body>
      ${groups.map((g) => `<div class="ce-group" role="tabpanel" id="ce-group-${g.id}" aria-labelledby="ce-tab-${g.id}" data-group="${g.id}" ${g.id === group ? "" : "hidden"}>${groupHtml(g.id)}</div>`).join("")}
    </div>`;
  const $ = (q) => el.querySelector(q);
  const body = $("[data-body]");

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const key = entry.target.dataset.tileKey;
        if (entry.isIntersecting) visible.add(key);
        else visible.delete(key);
      }
      refreshTiles();
    },
    { root: body, rootMargin: "120px" },
  );
  for (const tile of el.querySelectorAll("[data-tile-key]")) observer.observe(tile);

  function groupHtml(id) {
    const sections = [];
    for (const field of fields.filter((f) => f.group === id)) {
      let section = sections.find((s) => s.name === field.section);
      if (!section) sections.push((section = { name: field.section, fields: [] }));
      section.fields.push(field);
    }
    return sections
      .map(
        (section) => `<section class="ce-section"><h3 class="ce-section__title">${escapeHtml(section.name)}</h3>${section.fields.map(fieldHtml).join("")}</section>`,
      )
      .join("");
  }

  function fieldHtml(field) {
    const head = `<div class="ce-field__label"><span>${escapeHtml(field.label)}</span><b data-current></b></div>`;
    if (field.kind === "choice")
      return `<div class="ce-field ce-field--choice" data-field="${field.key}" data-focus="${field.focus}">${head}
        <div class="ce-tiles" role="radiogroup" aria-label="${escapeHtml(field.label)}">${field.options
          .map((o) => `<button type="button" class="ce-tile" role="radio" aria-checked="false" data-value="${o.id}" data-tile-key="${field.key}:${o.id}" title="${escapeHtml(o.label)}"><canvas width="${tiles.size}" height="${tiles.size}"></canvas><span>${escapeHtml(o.label)}</span></button>`)
          .join("")}</div></div>`;
    if (field.kind === "slider")
      return `<div class="ce-field ce-field--slider" data-field="${field.key}" data-focus="${field.focus}">
        <label class="ce-slider"><span class="ce-slider__name">${escapeHtml(field.label)}</span>
          <input type="range" min="0" max="1" step="0.005" aria-label="${escapeHtml(field.label)}" title="Double-click to reset" data-slider />
          <span class="ce-slider__ends"><span>${escapeHtml(field.min ?? "")}</span><span>${escapeHtml(field.max ?? "")}</span></span>
        </label></div>`;
    return `<div class="ce-field ce-field--color" data-field="${field.key}" data-focus="${field.focus}">${head}
      ${field.swatches
        .map(
          (row) => `<div class="ce-swatches" role="radiogroup" aria-label="${escapeHtml(field.label)}">${row
            .map((s) => `<button type="button" class="ce-swatch${s.hex === "none" ? " ce-swatch--none" : ""}" role="radio" aria-checked="false" data-value="${s.hex}" title="${escapeHtml(s.id)}" aria-label="${escapeHtml(s.id)}" ${s.hex === "none" ? "" : `style="--swatch:${s.hex}"`}></button>`)
            .join("")}</div>`,
        )
        .join("")}
      <div class="ce-swatches ce-swatches--custom"><button type="button" class="ce-swatch ce-swatch--custom" data-custom aria-label="Custom colour" title="Custom colour">${icon("palette")}</button><span class="ce-swatch__hex" data-hex></span></div>
    </div>`;
  }

  function selectTab(id, { focus = true } = {}) {
    group = id;
    for (const tab of el.querySelectorAll("[data-tab]")) {
      const on = tab.dataset.tab === id;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    for (const panel of el.querySelectorAll("[data-group]")) panel.hidden = panel.dataset.group !== id;
    body.scrollTop = 0;
    tiles.cancel();
    visible.clear();
    render();
    const first = fields.find((f) => f.group === id);
    if (focus && first) onFocus(first.focus);
  }

  /** Marks the chosen values, hides fields that do not apply, and asks for fresh tiles. */
  function render() {
    const spec = state.spec;
    const g = groups.find((x) => x.id === group);
    $("[data-title]").textContent = g.label;
    const locked = state.locks.has(group);
    const lock = $("[data-lock]");
    lock.innerHTML = icon(locked ? "lock" : "unlock");
    lock.setAttribute("aria-pressed", String(locked));
    lock.setAttribute("aria-label", locked ? `${g.label} is kept when shuffling` : `Keep ${g.label} when shuffling`);
    lock.classList.toggle("is-on", locked);
    $("[data-shuffle]").setAttribute("aria-label", `Shuffle ${g.label}`);
    for (const node of el.querySelectorAll(`[data-group="${group}"] [data-field]`)) {
      const field = fields.find((f) => f.key === node.dataset.field);
      node.hidden = !fieldShown(field, spec);
      const value = spec[field.key];
      if (field.kind === "slider") {
        const input = node.querySelector("[data-slider]");
        if (document.activeElement !== input || !input.matches(":active")) input.value = String(value);
        input.style.setProperty("--fill", `${Number(value) * 100}%`);
        continue;
      }
      const current = node.querySelector("[data-current]");
      if (field.kind === "choice") current.textContent = field.options.find((o) => o.id === value)?.label ?? "";
      else {
        const swatch = field.swatches.flat().find((s) => s.hex === value);
        current.textContent = swatch ? (swatch.hex === "none" ? "None" : capital(swatch.id)) : "Custom";
        node.querySelector("[data-hex]").textContent = swatch ? "" : String(value);
        const custom = node.querySelector("[data-custom]");
        custom.classList.toggle("is-on", !swatch);
        custom.style.setProperty("--swatch", swatch ? "transparent" : String(value));
      }
      for (const option of node.querySelectorAll("[data-value]")) {
        const on = option.dataset.value === value;
        option.setAttribute("aria-checked", String(on));
        option.tabIndex = on ? 0 : -1;
      }
      if (field.kind === "color" && !node.querySelector('[aria-checked="true"]')) node.querySelector("[data-custom]").tabIndex = 0;
      else if (field.kind === "color") node.querySelector("[data-custom]").tabIndex = -1;
      if (field.kind === "choice" && !node.querySelector('[aria-checked="true"]')) node.querySelector("[data-value]").tabIndex = 0;
    }
    refreshTiles();
  }

  function refreshTiles() {
    const spec = state.spec;
    for (const node of el.querySelectorAll(`[data-group="${group}"] .ce-field--choice:not([hidden])`)) {
      const field = fields.find((f) => f.key === node.dataset.field);
      const view = tileViews[field.key] ?? tileViews.default;
      for (const tile of node.querySelectorAll("[data-tile-key]")) {
        const key = tile.dataset.tileKey;
        if (!visible.has(key)) continue;
        const canvas = tile.querySelector("canvas");
        const chosen = tile.getAttribute("aria-checked") === "true";
        tiles.request(key, { ...spec, [field.key]: tile.dataset.value }, view, (source) => {
          const context = canvas.getContext("2d");
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(source, 0, 0, canvas.width, canvas.height);
          tile.classList.add("is-drawn");
        }, chosen ? 3 : 2);
      }
    }
  }

  const capital = (text) => text.charAt(0).toUpperCase() + text.slice(1);
  const fieldOf = (node) => fields.find((f) => f.key === node.closest("[data-field]")?.dataset.field);

  el.addEventListener("click", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab) return selectTab(tab.dataset.tab);
    if (e.target.closest("[data-lock]")) {
      state.toggleLock(group);
      return render();
    }
    if (e.target.closest("[data-shuffle]")) return onShuffle(group);
    const custom = e.target.closest("[data-custom]");
    if (custom) {
      const field = fieldOf(custom);
      onFocus(field.focus);
      const before = state.spec[field.key];
      openColorPicker(custom, {
        value: before === "none" ? "#c08060" : before,
        label: `${field.label}: custom colour`,
        onInput: (hex) => onChange({ [field.key]: hex }, { commit: false }),
        onCommit: (hex) => onChange({ [field.key]: hex }, { commit: true }),
      });
      return;
    }
    const option = e.target.closest("[data-value]");
    if (option) {
      clearTimeout(hoverTimer);
      previewing = false;
      const field = fieldOf(option);
      onFocus(field.focus);
      onChange({ [field.key]: option.dataset.value }, { commit: true });
    }
  });

  el.addEventListener("keydown", (e) => {
    const tab = e.target.closest("[data-tab]");
    if (tab && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const ids = groups.map((g) => g.id);
      const at = ids.indexOf(tab.dataset.tab);
      const next = e.key === "Home" ? 0 : e.key === "End" ? ids.length - 1 : (at + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + ids.length) % ids.length;
      selectTab(ids[next]);
      el.querySelector(`[data-tab="${ids[next]}"]`).focus();
      return;
    }
    const option = e.target.closest("[role=radio]");
    if (!option || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
    e.preventDefault();
    const list = [...option.closest("[data-field]").querySelectorAll("[role=radio]")];
    const at = list.indexOf(option);
    const next = list[(at + (e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 1) + list.length) % list.length];
    next.focus();
    next.click();
  });

  el.addEventListener("input", (e) => {
    if (!e.target.matches("[data-slider]")) return;
    const field = fieldOf(e.target);
    e.target.style.setProperty("--fill", `${Number(e.target.value) * 100}%`);
    onChange({ [field.key]: Number(e.target.value) }, { commit: false });
  });
  el.addEventListener("change", (e) => {
    if (!e.target.matches("[data-slider]")) return;
    onChange({ [fieldOf(e.target).key]: Number(e.target.value) }, { commit: true });
  });
  el.addEventListener("dblclick", (e) => {
    const slider = e.target.closest("[data-slider]");
    if (!slider) return;
    const field = fieldOf(slider);
    onChange({ [field.key]: field.default }, { commit: true });
  });
  el.addEventListener("pointerdown", (e) => {
    const node = e.target.closest("[data-field]");
    if (node && e.target.closest("[data-slider]")) onFocus(node.dataset.focus);
  });
  el.addEventListener("focusin", (e) => {
    const node = e.target.closest("[data-field]");
    if (node && e.target.matches("[data-slider]")) onFocus(node.dataset.focus);
  });

  let hoverTimer = 0,
    previewing = false;
  el.addEventListener("pointerover", (e) => {
    if (e.pointerType !== "mouse") return;
    const option = e.target.closest(".ce-tile, .ce-swatch[data-value]");
    if (!option) return;
    clearTimeout(hoverTimer);
    hoverTimer = setTimeout(() => {
      const field = fieldOf(option);
      if (!field || option.getAttribute("aria-checked") === "true") return;
      previewing = true;
      onPreview({ [field.key]: option.dataset.value });
    }, HOVER_DELAY);
  });
  el.addEventListener("pointerout", (e) => {
    if (e.pointerType !== "mouse") return;
    const option = e.target.closest(".ce-tile, .ce-swatch[data-value]");
    if (!option || option.contains(e.relatedTarget)) return;
    clearTimeout(hoverTimer);
    if (previewing) {
      previewing = false;
      onPreview(null);
    }
  });

  return {
    el,
    render,
    selectTab,
    get group() {
      return group;
    },
  };
}
