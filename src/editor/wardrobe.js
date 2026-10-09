import { normalizeSpec } from "../character/characterSpec.js";
import { escapeHtml } from "../escapeHtml.js";
import { icon } from "./editorIcons.js";
import { starters, starterSpec } from "../character/characterStarters.js";

const KEY = "character-editor:wardrobe";
const LIMIT = 48;

/** @typedef {{ id: string, spec: object, portrait: string, savedAt: number }} Saved */

/** The saved characters, newest first, kept in this browser. */
export function createWardrobeStore(storage = globalThis.localStorage) {
  const read = () => {
    try {
      const list = JSON.parse(storage?.getItem(KEY) ?? "[]");
      return Array.isArray(list) ? list.filter((s) => s && typeof s.id === "string").map((s) => ({ ...s, spec: normalizeSpec(s.spec) })) : [];
    } catch {
      return [];
    }
  };
  const write = (list) => {
    try {
      storage?.setItem(KEY, JSON.stringify(list.slice(0, LIMIT)));
      return true;
    } catch {
      return false;
    }
  };
  return {
    /** @returns {Saved[]} */
    list: read,
    /** Saves `spec` under `id` (a new one when omitted), moving it to the front. Returns its id. */
    save(spec, portrait, id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`) {
      const list = read().filter((s) => s.id !== id);
      list.unshift({ id, spec, portrait, savedAt: Date.now() });
      if (!write(list)) write(list.map((s, i) => (i ? { ...s, portrait: "" } : s)));
      return id;
    },
    remove(id) {
      write(read().filter((s) => s.id !== id));
    },
    get(id) {
      return read().find((s) => s.id === id) ?? null;
    },
  };
}

/**
 * The wardrobe drawer: every saved character as a portrait card to load, duplicate or delete, a card
 * to save the one on stage, and the curated starters to begin from. Calls `onLoad(saved)`, `onSave()`,
 * `onDuplicate(saved)` and `onStarter(spec)`; `portraitOf(key, spec)` resolves a starter's portrait.
 */
export function openWardrobe({ store, currentId, onLoad, onSave, onDuplicate, onStarter, portraitOf }) {
  const dialog = document.createElement("dialog");
  dialog.className = "ce-dialog ce-wardrobe";
  dialog.setAttribute("aria-label", "Wardrobe");
  const render = () => {
    const list = store.list();
    dialog.innerHTML = `
      <header class="ce-dialog__head"><h2>${icon("hanger")} Wardrobe</h2><button type="button" class="ce-iconbtn" data-close aria-label="Close">${icon("close")}</button></header>
      <div class="ce-wardrobe__grid">
        <button type="button" class="ce-card ce-card--new" data-save>${icon("save")}<span>${currentId ? "Save changes" : "Save this character"}</span></button>
        ${list
          .map(
            (s) => `<article class="ce-card${s.id === currentId ? " is-current" : ""}" data-id="${s.id}">
              <button type="button" class="ce-card__open" data-load aria-label="Wear ${escapeHtml(s.spec.name)}">${s.portrait ? `<img src="${s.portrait}" alt="" />` : `<span class="ce-card__blank">${icon("face")}</span>`}<span class="ce-card__name">${escapeHtml(s.spec.name)}</span></button>
              <div class="ce-card__actions"><button type="button" class="ce-iconbtn ce-iconbtn--small" data-copy aria-label="Duplicate ${escapeHtml(s.spec.name)}" title="Duplicate">${icon("copy")}</button><button type="button" class="ce-iconbtn ce-iconbtn--small" data-remove aria-label="Delete ${escapeHtml(s.spec.name)}" title="Delete">${icon("trash")}</button></div>
            </article>`,
          )
          .join("")}
      </div>
      ${list.length ? "" : `<p class="ce-dialog__note">Characters you save land here, with their portraits. They stay in this browser.</p>`}
      <h3 class="ce-dialog__sub">${icon("sparkle")} Start from</h3>
      <div class="ce-wardrobe__grid ce-wardrobe__grid--starters">
        ${starters
          .map((st) => {
            const spec = starterSpec(st);
            return `<button type="button" class="ce-card ce-card__open ce-card--starter" data-starter="${st.id}" aria-label="Start from ${escapeHtml(spec.name)}"><img alt="" data-portrait="${st.id}" /><span class="ce-card__name">${escapeHtml(spec.name)}</span></button>`;
          })
          .join("")}
      </div>`;
    for (const st of starters)
      portraitOf?.(`starter:${st.id}`, starterSpec(st)).then((url) => {
        const img = dialog.querySelector(`[data-portrait="${st.id}"]`);
        if (img) img.src = url;
      });
  };
  render();
  dialog.addEventListener("click", async (e) => {
    if (e.target === dialog || e.target.closest("[data-close]")) return dialog.close();
    if (e.target.closest("[data-save]")) {
      await onSave();
      currentId = onSave.currentId?.() ?? currentId;
      return render();
    }
    const starter = e.target.closest("[data-starter]");
    if (starter) {
      const found = starters.find((st) => st.id === starter.dataset.starter);
      if (found) onStarter(starterSpec(found));
      return dialog.close();
    }
    const card = e.target.closest("[data-id]");
    if (!card) return;
    const saved = store.get(card.dataset.id);
    if (!saved) return render();
    if (e.target.closest("[data-load]")) {
      onLoad(saved);
      dialog.close();
    } else if (e.target.closest("[data-copy]")) {
      onDuplicate(saved);
      dialog.close();
    } else if (e.target.closest("[data-remove]")) {
      if (card.dataset.confirm === "1") {
        store.remove(saved.id);
        render();
      } else {
        card.dataset.confirm = "1";
        const button = card.querySelector("[data-remove]");
        button.classList.add("is-armed");
        button.setAttribute("aria-label", `Tap again to delete ${saved.spec.name}`);
        button.title = "Tap again to delete";
      }
    }
  });
  dialog.addEventListener("close", () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
}
