import { escapeHtml } from "../escapeHtml.js";
import { formatDuration } from "./formatDuration.js";
import { callHome, onTheWay, timeToArrive } from "../stable/wild.js";
import { slotsFree } from "../stable/stableSlots.js";
import { icon } from "./icons.js";
import { recordLine } from "./stableView.js";
import { callAllNote, noRoomLine, waitingInWild } from "./wildLines.js";
import { t } from "../i18n.js";

/**
 * The Wild section of the Stable roster: every wild dragon with its thumbnail, name and record and
 * Call home, or the time left for one already on its way. A warning says why none can come while the
 * stable is full; with several waiting, Call all home says how many fit.
 * `onCalled(dragons)` follows a call home, `onProfile(id)` a tap on a dragon.
 */
export function createWildBox(ctx, { onCalled, onProfile }) {
  const { game, thumbs } = ctx;
  const el = document.createElement("div");
  el.className = "wild-box";
  el.hidden = true;
  let key = "",
    style = "cozy";

  const wild = () => game.stable.wild ?? [];
  const left = (w) => t("wildBox.onTheWay", { time: formatDuration(timeToArrive(w, game.now())) });

  function rowHtml(w, full) {
    const coming = onTheWay(w);
    const action = coming
      ? `<span class="wild-row__left" data-left="${escapeHtml(w.id)}">${left(w)}</span>`
      : `<button type="button" class="dz-btn dz-btn--success dz-btn--sm" data-call="${escapeHtml(w.id)}" ${full ? "disabled" : ""}>${icon("home")}<span class="dz-btn__label">${t("wildBox.callHome")}</span></button>`;
    return `<li class="wild-row ${coming ? "is-coming" : ""}">
      <button type="button" class="wild-row__who" data-wild-profile="${escapeHtml(w.id)}">
        <span class="wild-row__art"><canvas width="${thumbs.width}" height="${thumbs.height}" data-thumb="${escapeHtml(w.id)}"></canvas></span>
        <span class="wild-row__text"><b>${escapeHtml(w.name)}</b><small>${recordLine(w)
          .split(" · ")
          .map((part) => `<span>${part}</span>`)
          .join(" · ")}</small></span>
      </button>
      ${action}
    </li>`;
  }

  function render(force = false) {
    const all = wild();
    const next = all.map((w) => `${w.id}:${w.name}:${onTheWay(w)}:${w.record?.starts}`).join("|") + style + slotsFree(game.stable) + game.stable.eggs.length;
    if (!force && next === key) return tick();
    key = next;
    const warning = waitingInWild(game.stable).length ? noRoomLine(game.stable) : null;
    const note = callAllNote(game.stable);
    el.innerHTML = all.length
      ? `${warning ? `<p class="wild-box__warn" role="status">${icon("info")}<span>${escapeHtml(warning)}</span></p>` : ""}
        ${
          note && note.fit
            ? `<div class="wild-box__all"><span>${escapeHtml(note.line)}</span><button type="button" class="dz-btn dz-btn--success dz-btn--sm" data-call-all>${icon("home")}<span class="dz-btn__label">${note.fit === note.of ? t("wildBox.callAll") : t("wildBox.callSome", { count: note.fit })}</span></button></div>`
            : ""
        }
        <ul class="wild-box__list">${all.map((w) => rowHtml(w, Boolean(warning))).join("")}</ul>`
      : `<p class="wild-box__empty">${t("wildBox.empty")}</p>`;
    for (const canvas of el.querySelectorAll("[data-thumb]")) thumbs.draw(canvas, all.find((w) => w.id === canvas.dataset.thumb), style);
  }

  function tick() {
    for (const span of el.querySelectorAll("[data-left]")) {
      const w = wild().find((entry) => entry.id === span.dataset.left);
      if (w && onTheWay(w)) span.textContent = left(w);
    }
  }

  function call(ids) {
    const now = game.now();
    const called = ids.map((id) => callHome(game.stable, id, now)).filter(Boolean);
    if (!called.length) return;
    ctx.save();
    ctx.notify(t("wildBox.flyingHome", { count: called.length, name: called[0].name }));
    onCalled(called);
  }

  el.addEventListener("click", (e) => {
    const one = e.target.closest("[data-call]");
    if (one && !one.disabled) return call([one.dataset.call]);
    if (e.target.closest("[data-call-all]")) return call(waitingInWild(game.stable).map((w) => w.id));
    const who = e.target.closest("[data-wild-profile]");
    if (who) onProfile(who.dataset.wildProfile);
  });

  return {
    el,
    render,
    tick,
    setStyle(next) {
      style = next;
      if (!el.hidden) render(true);
    },
  };
}
