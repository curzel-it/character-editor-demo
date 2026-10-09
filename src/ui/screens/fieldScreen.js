import { escapeHtml } from "../../escapeHtml.js";
import { courseType, courseTypes } from "../../course/createCourse.js";
import { fieldLimits } from "../../raceField.js";
import { addParticipant, fieldAge, moveParticipant, removeParticipant, setFieldAge, shuffleGrid } from "../../fieldEdits.js";
import { racerColors } from "../../racerColors.js";
import { shortJockeyName } from "../../jockey/jockeyName.js";
import { silksSwatch } from "../../jockey/jockeySilks.js";
import { ages, ageOf } from "../../dragonAge.js";
import { icon } from "../icons.js";
import { t } from "../../i18n.js";

const seeds = [
  { key: "courseSeed", fallback: "2407" },
  { key: "raceSeed", fallback: "1" },
];

const segmented = (label, name, options, current, optionLabel = (o) => o.label) =>
  `<div class="more__row"><span>${label}</span><span class="segmented" role="group" aria-label="${label}">${options
    .map((o) => `<button type="button" data-${name}="${o.id}" aria-pressed="${o.id === current}">${optionLabel(o)}</button>`)
    .join("")}</span></div>`;

/**
 * The exhibition field, a developer sandbox apart from the stable: the race settings (course,
 * seeds, age of the whole field), the participants in grid order to add, remove, reorder
 * and open in the editor, and Start race, which opens the broadcast. Every change saves at once.
 */
export function createFieldScreen(ctx) {
  const el = document.createElement("section");
  el.className = "screen field-screen";
  const field = () => ctx.field;

  function rowHtml(p, i, count) {
    const { jockey } = p;
    const detail = [escapeHtml(shortJockeyName(jockey.name)), t(`dragonAge.${ageOf(p.age).id}`), t("fieldScreen.stars", { stars: (p.strength ?? 3).toFixed(1) })].join(" · ");
    return `<li class="field-row" data-id="${escapeHtml(p.id)}">
      <a class="field-row__open" href="#/dev/editor/${encodeURIComponent(p.id)}">
        <span class="field-row__art"><canvas width="${ctx.thumbs.width}" height="${ctx.thumbs.height}"></canvas><span class="field-row__pos">P${i + 1}</span></span>
        <span class="field-row__text">
          <b><i class="field-row__color" style="background:${racerColors(p.genome).color}"></i>${escapeHtml(p.name)}</b>
          <small><i class="field-row__silks" style="background:${silksSwatch(jockey.silks)}"></i>${detail}</small>
        </span>
      </a>
      <span class="field-row__moves">
        <button type="button" data-move="-1" aria-label="${escapeHtml(t("fieldScreen.moveUp", { name: p.name }))}" ${i === 0 ? "disabled" : ""}>${icon("arrowUp")}</button>
        <button type="button" data-move="1" class="is-down" aria-label="${escapeHtml(t("fieldScreen.moveDown", { name: p.name }))}" ${i === count - 1 ? "disabled" : ""}>${icon("arrowUp")}</button>
        <button type="button" data-remove aria-label="${escapeHtml(t("fieldScreen.remove", { name: p.name }))}" ${count <= fieldLimits.min ? "disabled" : ""}>${icon("plus")}</button>
      </span>
    </li>`;
  }

  function render() {
    const f = field();
    const count = f.participants.length;
    el.innerHTML = `
      <div class="dz-card dz-card--parchment field-card">
        <h2 class="field-card__title">${t("fieldScreen.race")}</h2>
        ${segmented(t("fieldScreen.course"), "course", courseTypes, f.courseType)}
        ${segmented(t("fieldScreen.age"), "age", ages, fieldAge(f), (a) => t(`dragonAge.${a.id}`))}
        <div class="field-card__seeds">${seeds
          .map((s) => `<label class="field">${t(`fieldScreen.${s.key}`)}<input class="text-input" data-seed="${s.key}" value="${escapeHtml(f[s.key])}" maxlength="64" autocomplete="off" inputmode="text" /></label>`)
          .join("")}</div>
        <p class="dz-caption">${t("fieldScreen.caption")}</p>
      </div>
      <div class="dz-card dz-card--parchment field-card">
        <div class="league-section__row"><h2 class="field-card__title">${t("fieldScreen.theField")}</h2><span class="dz-caption">${t("fieldScreen.fieldCount", { count, max: fieldLimits.max })}</span></div>
        <ol class="field-list">${f.participants.map((p, i) => rowHtml(p, i, count)).join("")}</ol>
        <div class="field-card__buttons">
          <button type="button" class="dz-btn dz-btn--dark dz-btn--sm" data-action="add" ${count >= fieldLimits.max ? "disabled" : ""}>${icon("plus")}<span class="dz-btn__label">${t("fieldScreen.add")}</span></button>
          <button type="button" class="dz-btn dz-btn--surface dz-btn--sm" data-action="shuffle"><span class="dz-btn__label">${t("fieldScreen.shuffle")}</span></button>
        </div>
      </div>
      <a class="dz-btn dz-btn--primary dz-btn--block field-start" href="#/dev/field/race">${icon("flagFinish")}<span class="dz-btn__label">${t("fieldScreen.start")}</span></a>`;
    for (const canvas of el.querySelectorAll(".field-row canvas")) {
      const p = f.participants.find((x) => x.id === canvas.closest("[data-id]").dataset.id);
      ctx.thumbs.draw(canvas, p, ctx.style());
    }
  }

  function changed() {
    ctx.saveField();
    render();
  }

  el.addEventListener("click", (e) => {
    const f = field();
    const index = f.participants.findIndex((p) => p.id === e.target.closest("[data-id]")?.dataset.id);
    const move = e.target.closest("[data-move]");
    if (move && moveParticipant(f, index, index + Number(move.dataset.move))) return changed();
    if (e.target.closest("[data-remove]") && removeParticipant(f, index)) return changed();
    const course = e.target.closest("[data-course]");
    if (course) {
      f.courseType = courseType(course.dataset.course);
      return changed();
    }
    const age = e.target.closest("[data-age]");
    if (age) {
      setFieldAge(f, age.dataset.age);
      return changed();
    }
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (action === "add") {
      const added = addParticipant(ctx.module, f);
      if (!added) return;
      ctx.saveField();
      return ctx.go(`#/dev/editor/${encodeURIComponent(added.id)}`);
    }
    if (action === "shuffle") {
      shuffleGrid(f, Date.now());
      changed();
    }
  });
  el.addEventListener("input", (e) => {
    const key = e.target.dataset.seed;
    if (!key) return;
    field()[key] = e.target.value.trim() || seeds.find((s) => s.key === key).fallback;
    ctx.saveField();
  });

  return {
    el,
    show: render,
    hide() {},
    render() {},
    tick() {},
    setStyle() {
      if (!el.hidden) render();
    },
  };
}
