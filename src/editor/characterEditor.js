import { defaultSpec, normalizeSpec, fieldByKey, NAME_LENGTH } from "../character/characterSpec.js";
import { randomSpec, randomName } from "../character/characterRandom.js";
import { decodeCharacter } from "../character/characterCode.js";
import { createCharacterBuilder } from "../character/characterBuild.js";
import { createEditorState } from "./editorState.js";
import { createCharacterStage } from "./characterStage.js";
import { createTileRenderer } from "./tileRenderer.js";
import { createEditorPanel } from "./editorPanel.js";
import { createWardrobeStore, openWardrobe } from "./wardrobe.js";
import { openShareDialog } from "./shareDialog.js";
import { icon } from "./editorIcons.js";
import { escapeHtml } from "../escapeHtml.js";

const CURRENT = "character-editor:current";
const moves = [
  ["wave", "Wave"],
  ["cheer", "Cheer"],
  ["dance", "Dance"],
  ["jump", "Jump"],
  ["hero", "Pose"],
  ["think", "Think"],
  ["bow", "Bow"],
  ["shrug", "Shrug"],
];
const faces = [
  ["happy", "Happy"],
  ["laugh", "Laugh"],
  ["surprised", "Wow"],
  ["smug", "Smug"],
  ["wink", "Wink"],
  ["sad", "Sad"],
  ["angry", "Grr"],
  ["sleepy", "Sleepy"],
];
const reactions = ["happy", "smug", "wink", "happy", "laugh"];

const readJson = (key) => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
};
const writeJson = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Storage is optional. */
  }
};

/**
 * The character editor in `root`: a live 3D stage over the game's meadow beside a panel of every
 * trait, with undo and redo, a harmonious shuffle that respects locked groups, a wardrobe of saved
 * characters and shareable codes. The character being edited survives a reload.
 * Embedding: pass `value` to start from a character, hear `onChange(spec)` after every committed
 * edit and `onDone(spec)` when the Done button is pressed (shown only when `onDone` is given).
 * @param {HTMLElement} root
 * @param {{ value?: object, onChange?: (spec: object) => void, onDone?: (spec: object) => void, persist?: boolean }} [options]
 */
export function createCharacterEditor(root, { value, onChange, onDone, persist = true } = {}) {
  const fromHash = decodeCharacter(decodeURIComponent(location.hash.replace(/^#/, "")));
  const initial = normalizeSpec(value ?? fromHash ?? (persist ? readJson(CURRENT)?.spec : null) ?? defaultSpec(), defaultSpec());
  const state = createEditorState(initial);
  let savedId = persist && !value && !fromHash ? (readJson(CURRENT)?.savedId ?? null) : null;
  const stageBuilder = createCharacterBuilder({ size: 1 });
  const tileBuilder = createCharacterBuilder({ size: 2 });
  const wardrobe = createWardrobeStore();
  const stage = createCharacterStage({
    onReady: () => app.classList.add("is-ready"),
    frameArea: () => {
      const box = stage.el.getBoundingClientRect();
      const top = app.querySelector(".ce-stage__top")?.getBoundingClientRect();
      const bottom = app.querySelector(".ce-stage__bottom")?.getBoundingClientRect();
      return { top: top ? top.bottom - box.top + 8 : 0, bottom: bottom ? bottom.top - box.top - 6 : box.height };
    },
  });
  const tiles = createTileRenderer(tileBuilder, stage.round);

  const app = document.createElement("div");
  app.className = "ce-app";
  app.innerHTML = `
    <div class="ce-stage" data-stage>
      <div class="ce-stage__top">
        <div class="ce-name">
          <input class="ce-name__input" data-name maxlength="${NAME_LENGTH}" autocomplete="off" spellcheck="false" aria-label="Name" />
          <button type="button" class="ce-iconbtn ce-iconbtn--ghost" data-rename aria-label="Another name" title="Another name">${icon("dice")}</button>
        </div>
        <div class="ce-toolbar" role="toolbar" aria-label="Editor">
          <button type="button" class="ce-iconbtn" data-undo aria-label="Undo" title="Undo (Ctrl+Z)">${icon("undo")}</button>
          <button type="button" class="ce-iconbtn" data-redo aria-label="Redo" title="Redo (Ctrl+Shift+Z)">${icon("redo")}</button>
          <button type="button" class="ce-btn ce-btn--accent ce-btn--surprise" data-random title="Shuffle everything not locked (R)">${icon("dice")}<span>Surprise me</span></button>
          <button type="button" class="ce-iconbtn" data-wardrobe aria-label="Wardrobe" title="Wardrobe">${icon("hanger")}</button>
          <button type="button" class="ce-iconbtn" data-share aria-label="Share" title="Share or import">${icon("share")}</button>
          ${onDone ? `<button type="button" class="ce-btn ce-btn--primary" data-done>${icon("check")}<span>Done</span></button>` : `<button type="button" class="ce-btn ce-btn--primary" data-save>${icon("save")}<span>Save</span></button>`}
        </div>
      </div>
      <div class="ce-view" role="group" aria-label="View">
        <button type="button" class="ce-iconbtn ce-iconbtn--glass" data-zoom-in aria-label="Zoom in" title="Zoom in">${icon("zoomIn")}</button>
        <button type="button" class="ce-iconbtn ce-iconbtn--glass" data-zoom-out aria-label="Zoom out" title="Zoom out">${icon("zoomOut")}</button>
        <button type="button" class="ce-iconbtn ce-iconbtn--glass" data-home aria-label="Face me" title="Face me (double-click the stage)">${icon("target")}</button>
        <button type="button" class="ce-iconbtn ce-iconbtn--glass" data-twirl aria-label="Spin around" title="Spin around">${icon("rotate")}</button>
      </div>
      <div class="ce-stage__bottom">
        <div class="ce-chips" data-chips="moves">
          <button type="button" class="ce-chip ce-chip--mode" data-mode aria-label="Show expressions" title="Show expressions">${icon("wave")}<span>Moves</span></button>
          <div class="ce-chips__list" role="group" aria-label="Moves" data-list="moves">${moves.map(([id, label]) => `<button type="button" class="ce-chip" data-move="${id}">${label}</button>`).join("")}</div>
          <div class="ce-chips__list" role="group" aria-label="Expressions" data-list="faces" hidden>${faces.map(([id, label]) => `<button type="button" class="ce-chip" data-face="${id}" aria-pressed="false">${label}</button>`).join("")}</div>
        </div>
      </div>
      <div class="ce-loading" aria-hidden="true"><span></span></div>
    </div>
    <div class="ce-toast" role="status" aria-live="polite" data-toast></div>`;
  root.append(app);
  const $ = (q) => app.querySelector(q);
  $("[data-stage]").prepend(stage.el);

  const panel = createEditorPanel({
    state,
    tiles,
    onChange: (changes, { commit }) => {
      state.update(changes, { commit, detail: Object.keys(changes) });
    },
    onPreview: (changes) => {
      preview = changes;
      rebuild();
    },
    onFocus: (focus) => stage.frame(focus),
    onShuffle: (group) => shuffle(group),
  });
  app.append(panel.el);

  let preview = null,
    building = 0,
    lastReaction = 0,
    saveTimer = 0;

  async function rebuild({ bounce = true } = {}) {
    const spec = preview ? { ...state.spec, ...preview } : state.spec;
    building++;
    const slow = setTimeout(() => app.classList.add("is-building"), 260);
    try {
      const anatomy = await stageBuilder.build(spec, stage.round(), { lane: "stage" });
      if (anatomy) stage.show(anatomy, { bounce });
    } catch (error) {
      console.error(error);
      toast("That combination could not be drawn");
    } finally {
      clearTimeout(slow);
      if (--building === 0) app.classList.remove("is-building");
    }
  }

  let toastTimer = 0;
  function toast(text) {
    const el = $("[data-toast]");
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 2200);
  }

  function react(keys) {
    const now = performance.now();
    if (now - lastReaction < 2500 || Math.random() > 0.5) return;
    const sliding = keys?.some((k) => fieldByKey.get(k)?.kind === "slider");
    if (sliding) return;
    lastReaction = now;
    stage.express(reactions[Math.floor(Math.random() * reactions.length)], 1.3);
  }

  function shuffle(group) {
    const base = state.spec;
    const keep = [...state.locks];
    const next = group ? randomSpec({ base, only: group }) : randomSpec({ base, keep, rename: !state.locks.has("name") });
    state.set(next, { reason: "shuffle", detail: group ?? "all" });
    stage.express(group ? "happy" : "laugh", 1.4);
    if (!group) stage.play("jump");
    toast(group ? `Shuffled ${group}` : keep.length ? `Shuffled all but ${keep.join(", ")}` : "A new character!");
  }

  async function portrait() {
    return new Promise((resolve) => {
      const canvas = Object.assign(document.createElement("canvas"), { width: 168, height: 168 });
      tiles.request(`portrait:${Date.now()}`, state.spec, { focus: "head", yaw: -Math.PI / 2 + 0.38, zoom: 0.92 }, (source) => {
        const context = canvas.getContext("2d");
        const gradient = context.createLinearGradient(0, 0, 0, 168);
        gradient.addColorStop(0, "#bfe6fb");
        gradient.addColorStop(1, "#e9f6d8");
        context.fillStyle = gradient;
        context.fillRect(0, 0, 168, 168);
        context.drawImage(source, 0, 0, 168, 168);
        resolve(canvas.toDataURL("image/webp", 0.86));
      }, 9);
    });
  }

  async function save() {
    savedId = wardrobe.save(state.spec, await portrait(), savedId ?? undefined);
    persistNow();
    toast(`${state.spec.name} is in the wardrobe`);
  }
  save.currentId = () => savedId;

  function persistNow() {
    if (persist) writeJson(CURRENT, { spec: state.spec, savedId });
  }

  function syncChrome() {
    $("[data-undo]").disabled = !state.canUndo();
    $("[data-redo]").disabled = !state.canRedo();
    const input = $("[data-name]");
    if (document.activeElement !== input) input.value = state.spec.name;
    input.style.setProperty("--chars", String(Math.max(4, input.value.length + 1)));
    const held = stage.expression;
    for (const chip of app.querySelectorAll("[data-face]")) chip.setAttribute("aria-pressed", String(chip.dataset.face === held));
  }

  state.subscribe((spec, reason, detail) => {
    preview = null;
    rebuild({ bounce: reason !== "edit" || !Array.isArray(detail) || !detail.some((k) => fieldByKey.get(k)?.kind === "slider") });
    panel.render();
    syncChrome();
    if (reason === "edit") react(detail);
    if (reason === "shuffle" && detail === "all") stage.twirl();
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistNow, 300);
    onChange?.(spec);
  });

  app.addEventListener("click", (e) => {
    const hit = (q) => e.target.closest(q);
    if (hit("[data-undo]")) return state.undo();
    if (hit("[data-redo]")) return state.redo();
    if (hit("[data-random]")) return shuffle(null);
    if (hit("[data-rename]")) return state.update({ name: randomName() });
    if (hit("[data-zoom-in]")) return stage.zoomBy(1.25);
    if (hit("[data-zoom-out]")) return stage.zoomBy(0.8);
    if (hit("[data-home]")) return stage.home();
    if (hit("[data-twirl]")) return stage.twirl();
    if (hit("[data-save]")) return save();
    if (hit("[data-done]")) return onDone?.(state.spec);
    if (hit("[data-wardrobe]"))
      return openWardrobe({
        store: wardrobe,
        currentId: savedId,
        onSave: save,
        onLoad: (saved) => {
          savedId = saved.id;
          state.load(saved.spec);
          toast(`Wearing ${saved.spec.name}`);
        },
        onDuplicate: (saved) => {
          savedId = null;
          state.load({ ...saved.spec, name: `${saved.spec.name} II`.slice(0, NAME_LENGTH) });
          toast("A copy to change. Save it to keep it.");
        },
      });
    if (hit("[data-share]"))
      return openShareDialog({
        spec: state.spec,
        snapshot: () => stage.snapshot(),
        toast,
        onImport: (spec) => {
          savedId = null;
          state.load(spec);
          toast(`Say hello to ${spec.name}`);
        },
      });
    if (hit("[data-mode]")) {
      const bar = $("[data-chips]");
      const faces = bar.dataset.chips === "moves";
      bar.dataset.chips = faces ? "faces" : "moves";
      $('[data-list="moves"]').hidden = faces;
      $('[data-list="faces"]').hidden = !faces;
      const mode = $("[data-mode]");
      mode.innerHTML = faces ? `${icon("smile")}<span>Faces</span>` : `${icon("wave")}<span>Moves</span>`;
      mode.setAttribute("aria-label", faces ? "Show moves" : "Show expressions");
      mode.title = mode.getAttribute("aria-label");
      return;
    }
    const move = hit("[data-move]");
    if (move) return stage.play(move.dataset.move);
    const face = hit("[data-face]");
    if (face) {
      stage.hold(stage.expression === face.dataset.face ? null : face.dataset.face);
      syncChrome();
    }
  });

  $("[data-name]").addEventListener("input", (e) => e.target.style.setProperty("--chars", String(Math.max(4, e.target.value.length + 1))));
  $("[data-name]").addEventListener("change", (e) => state.update({ name: e.target.value }));
  $("[data-name]").addEventListener("keydown", (e) => e.key === "Enter" && e.target.blur());

  const onKey = (e) => {
    if (document.querySelector("dialog[open], .ce-picker")) return;
    const typing = e.target.closest?.("input:not([type=range]), textarea");
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "z") {
      if (typing) return;
      e.preventDefault();
      return e.shiftKey ? state.redo() : state.undo();
    }
    if (mod && e.key.toLowerCase() === "y") return e.preventDefault(), state.redo();
    if (mod && e.key.toLowerCase() === "s") return e.preventDefault(), save();
    if (typing || mod || e.altKey) return;
    if (e.key === "r" || e.key === "R") return shuffle(null);
    const digit = Number(e.key);
    if (digit >= 1 && digit <= 6) panel.selectTab(["body", "face", "eyes", "hair", "outfit", "extras"][digit - 1]);
  };
  addEventListener("keydown", onKey);

  panel.render();
  syncChrome();
  rebuild({ bounce: false });
  stage.start();
  stage.frame("full");

  globalThis.__characterEditor = { state, stage, panel, tiles };
  return {
    get value() {
      return state.spec;
    },
    /** Replaces the character being edited, as one undoable step. */
    set(next) {
      state.load(next);
    },
    destroy() {
      stage.stop();
      stageBuilder.dispose();
      tileBuilder.dispose();
      removeEventListener("keydown", onKey);
      app.remove();
    },
  };
}

void escapeHtml;
