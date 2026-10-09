import { racerName } from "../../racerName.js";
import { reseedParticipant } from "../../fieldEdits.js";
import { showGenomeControls } from "../../genomeControls.js";
import { createFlightModes } from "../../flightModes.js";
import { withAttitude } from "../../animate/flightAttitude.js";
import { statShares } from "../../statBars.js";
import { createJockey, rerollJockeySeed } from "../../jockey/createJockey.js";
import { silksFieldsHtml, silksFromChange } from "../silksFields.js";
import { bindPickers } from "../pickerFields.js";
import { ages, ageOf, canBreathe, grownWingspan } from "../../dragonAge.js";
import { icon } from "../icons.js";
import { statIcons } from "../statIcons.js";
import { t } from "../../i18n.js";

const tabs = ["dragon", "genes", "rider"];
/** Sliders on the participant: their range, the value they start from and how many digits they keep. */
const sliders = {
  strength: { min: 1, max: 5, step: 0.05, fallback: 3, digits: 2 },
};
const slider = (id) => {
  const label = t(`editorScreen.${id}`);
  const s = sliders[id];
  return `<div class="gene"><div class="gene-label"><label for="editor-${id}">${label}</label><output data-out="${id}"></output></div><input type="range" id="editor-${id}" data-slider="${id}" min="${s.min}" max="${s.max}" step="${s.step}" /></div>`;
};

/**
 * The gene editor, a developer tool for one participant of the exhibition field: the live preview
 * on the shared stage with flight modes, then name, seed and age, every gene with the palette
 * presets, the harness, the rider and its strength in stars, with live racing stats. Edits apply in
 * place and save at once; Prev and Next step through the grid.
 */
export function createEditorScreen(ctx) {
  const { module, stage } = ctx;
  const el = document.createElement("section");
  el.className = "screen detail editor";
  el.innerHTML = `
    <div class="detail__hero editor__hero">
      <div class="detail__stage" data-stage></div>
    </div>
    <div class="editor__modes" role="radiogroup" aria-label="${t("editorScreen.flightMode")}" data-modes></div>
    <div class="editor__nav">
      <button type="button" class="dz-btn dz-btn--dark dz-btn--sm dz-btn--icon" data-action="prev" aria-label="${t("editorScreen.previous")}">${icon("chevronLeft")}</button>
      <span class="editor__position" data-position></span>
      <button type="button" class="dz-btn dz-btn--dark dz-btn--sm dz-btn--icon" data-action="play"></button>
      <button type="button" class="dz-btn dz-btn--dark dz-btn--sm dz-btn--icon" data-action="next" aria-label="${t("editorScreen.next")}">${icon("chevronRight")}</button>
    </div>
    <div class="dz-card dz-card--parchment stat-list editor__stats" data-stats></div>
    <div class="dz-card dz-card--parchment editor__card">
      <div class="dz-tabs" role="tablist" aria-label="${t("editorScreen.editor")}">${tabs
        .map((id) => `<button type="button" class="dz-tab" role="tab" data-tab="${id}">${t(`editorScreen.tabs.${id}`)}</button>`)
        .join("")}</div>
      <div class="editor__body" data-panel="dragon">
        <label class="field">${t("editorScreen.name")}<input class="text-input" data-k="name" maxlength="24" autocomplete="off" /></label>
        <div class="field"><label for="editor-seed-input">${t("editorScreen.seed")}</label><div class="editor__inline"><input class="text-input" id="editor-seed-input" data-k="seed" maxlength="64" autocomplete="off" /><button type="button" class="dz-btn dz-btn--dark dz-btn--sm" data-action="generate"><span class="dz-btn__label">${t("editorScreen.generate")}</span></button></div></div>
        <div class="more__row"><span>${t("editorScreen.age")}</span><span class="segmented" role="group" aria-label="${t("editorScreen.age")}">${ages
          .map((a) => `<button type="button" data-age="${a.id}">${t(`dragonAge.${a.id}`)}</button>`)
          .join("")}</span></div>
        <div class="more__row"><span>${t("editorScreen.harness")}</span><span class="segmented" role="group" aria-label="${t("editorScreen.harness")}"><button type="button" data-harness="off">${t("editorScreen.off")}</button><button type="button" data-harness="on">${t("editorScreen.on")}</button></span></div>
        <p class="dz-caption">${t("editorScreen.harnessCaption")}</p>
        ${slider("strength")}
      </div>
      <div class="editor__body" data-panel="genes">
        <div id="gene-tabs" class="dz-tabs editor__gene-tabs" role="tablist" aria-label="${t("editorScreen.genomeControls")}" hidden>
          <button id="shape-tab" type="button" class="dz-tab" role="tab" aria-controls="genes">${t("editorScreen.shape")}</button>
          <button id="color-tab" type="button" class="dz-tab" role="tab" aria-controls="genes">${t("editorScreen.colours")}</button>
        </div>
        <div id="color-presets" class="editor__presets"></div>
        <div id="genes" class="editor__genes"></div>
        <button type="button" class="dz-btn dz-btn--surface dz-btn--sm" data-action="reset"><span class="dz-btn__label">${t("editorScreen.resetGenes")}</span></button>
      </div>
      <div class="editor__body" data-panel="rider">
        <p class="dz-caption">${t("editorScreen.riderCaption")}</p>
        <div class="field"><label for="editor-jockey-name">${t("editorScreen.name")}</label><div class="editor__inline"><input class="text-input" id="editor-jockey-name" data-k="jockeyName" maxlength="28" autocomplete="off" /><button type="button" class="dz-btn dz-btn--dark dz-btn--sm" data-action="reroll"><span class="dz-btn__label">${t("editorScreen.reroll")}</span></button></div></div>
        <div data-silks></div>
      </div>
    </div>`;
  const $ = (selector) => el.querySelector(selector);
  const flight = createFlightModes($("[data-modes]"));
  let participant = null,
    tab = "dragon",
    playing = !matchMedia("(prefers-reduced-motion: reduce)").matches,
    last = null;

  const field = () => ctx.field;
  const index = () => field().participants.indexOf(participant);
  const hashOf = (p) => `#/dev/editor/${encodeURIComponent(p.id)}`;

  /** The stage pose: the chosen flight mode, advanced only while playing. */
  function pose(anatomy, time) {
    const delta = last === null ? 0 : Math.min(0.1, Math.max(0, time - last));
    last = time;
    const motion = playing ? flight.step(delta, grownWingspan(anatomy.genome, anatomy.age)).motion : flight.motion();
    return withAttitude(module.pose(anatomy, flight.phase, motion), motion);
  }

  function showTab() {
    for (const b of el.querySelectorAll("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === tab));
    for (const panel of el.querySelectorAll("[data-panel]")) panel.hidden = panel.dataset.panel !== tab;
  }

  function showPlaying() {
    const button = $('[data-action="play"]');
    button.innerHTML = icon(playing ? "pause" : "play");
    button.setAttribute("aria-label", t(playing ? "editorScreen.pause" : "editorScreen.play"));
  }

  function showStats() {
    $("[data-stats]").innerHTML = statShares(module.genes, participant.genome, participant.strength ?? sliders.strength.fallback, canBreathe(participant.age))
      .map(
        (s) => `<div class="dz-meter dz-meter--stat" style="--c:var(--dz-info);--value:${((s.off ? 0 : s.share) * 100).toFixed(1)}">
          ${icon(statIcons[s.key])}<span>${s.label}</span><div class="dz-meter__track"><div class="dz-meter__fill"></div></div><span class="dz-meter__value">${s.off ? "–" : s.level.toFixed(1)}</span></div>`,
      )
      .join("");
  }

  function showRider() {
    const j = participant.jockey;
    $('[data-k="jockeyName"]').value = j.name;
    $("[data-silks]").innerHTML = silksFieldsHtml(j.silks, "editor-silks");
  }

  function showSliders() {
    for (const [id, s] of Object.entries(sliders)) {
      const value = participant[id] ?? s.fallback;
      $(`[data-slider="${id}"]`).value = value;
      $(`[data-out="${id}"]`).textContent = value.toFixed(s.digits);
    }
  }

  /** Everything that follows from the participant's current state, then the save. */
  function changed() {
    const age = ageOf(participant.age).id;
    for (const b of el.querySelectorAll("[data-age]")) b.setAttribute("aria-pressed", String(b.dataset.age === age));
    for (const b of el.querySelectorAll("[data-harness]")) b.setAttribute("aria-pressed", String((b.dataset.harness === "on") === (participant.harness !== false)));
    ctx.setTitle(participant.name);
    $("[data-position]").textContent = `P${index() + 1} / ${field().participants.length}`;
    $('[data-action="prev"]').disabled = index() <= 0;
    $('[data-action="next"]').disabled = index() >= field().participants.length - 1;
    showSliders();
    showStats();
    stage.show(participant, { jockey: participant.jockey, pose, zoom: 1.5 });
    ctx.saveField();
  }

  /** Loads a newly shown participant or new genes into the controls that are not redrawn on each change. */
  function fill() {
    participant.jockey ??= createJockey(participant.seed);
    $('[data-k="name"]').value = participant.name;
    $('[data-k="seed"]').value = participant.seed;
    showRider();
    showGenomeControls(module, participant.genome, changed);
    changed();
  }

  function reseed(seed) {
    reseedParticipant(module, participant, seed);
    fill();
  }

  bindPickers(el);
  el.addEventListener("click", (e) => {
    const tabButton = e.target.closest("[data-tab]");
    if (tabButton) {
      tab = tabButton.dataset.tab;
      return showTab();
    }
    const age = e.target.closest("[data-age]");
    if (age) {
      participant.age = age.dataset.age;
      return changed();
    }
    const harness = e.target.closest("[data-harness]");
    if (harness) {
      participant.harness = harness.dataset.harness === "on";
      return changed();
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    const step = { prev: -1, next: 1 }[action];
    if (step) {
      const next = field().participants[index() + step];
      if (next) location.replace(hashOf(next));
    }
    if (action === "play") {
      playing = !playing;
      showPlaying();
    }
    if (action === "generate") {
      const typed = $('[data-k="seed"]').value.trim();
      reseed(typed && typed !== participant.seed ? typed : String(Math.floor(Math.random() * 1e6)));
    }
    if (action === "reset") reseed(participant.seed);
    if (action === "reroll") {
      participant.jockey = createJockey(rerollJockeySeed(participant.jockey.seed));
      showRider();
      changed();
    }
  });

  el.addEventListener("input", (e) => {
    const id = e.target.dataset.slider;
    if (id) {
      const s = sliders[id];
      participant[id] = Number(Number(e.target.value).toFixed(s.digits));
      return changed();
    }
    const key = e.target.dataset.k;
    if (key === "name") {
      participant.name = e.target.value.trim().slice(0, 24) || racerName(participant.seed);
      return changed();
    }
    if (key === "jockeyName") {
      participant.jockey.name = e.target.value.trim().slice(0, 28) || participant.jockey.name;
      changed();
    }
  });

  el.addEventListener("change", (e) => {
    const silks = silksFromChange(participant.jockey.silks, e.target);
    if (silks) {
      participant.jockey.silks = silks;
      showRider();
    } else return;
    changed();
  });

  $('[data-k="seed"]').addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    $('[data-action="generate"]').click();
  });

  showPlaying();
  showTab();
  return {
    el,
    show({ params }) {
      const next = field().participants.find((p) => p.id === params.id);
      if (!next) return location.replace("#/dev/field");
      stage.attach($("[data-stage]"), { orbit: true });
      if (next !== participant) {
        participant = next;
        last = null;
        fill();
      } else changed();
    },
    hide() {
      stage.hide();
    },
    render() {},
    tick() {},
  };
}
