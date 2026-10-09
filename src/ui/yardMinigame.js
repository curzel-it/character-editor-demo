import { t } from "../i18n.js";
import { icon } from "./icons.js";
import { needLook } from "./careLook.js";
import { careActions, needValue } from "../stable/care.js";
import { bestScore, minigameAmount, minigameNeed, settleMinigame } from "../stable/minigameResult.js";
import { minigameFor } from "../minigames/minigames.js";
import { createBeatMarker } from "./yardBeat.js";
import { playMinigameScore, playMinigameStep } from "../sound/minigameAudio.js";

/**
 * A care action's minigame played in the stable yard: the name plate, actions and roster fade away
 * (`is-playing` on `host`), the top bar shows the game's title and score, and a bar at the bottom its
 * hint, the need filling as it is played and Done, under a beat marker for a game that keeps a `beat`. It ends once the game is done or on Done, settling
 * the care, and the yard plays the end of the action's care reaction; `onEnd(dragon, gained, need)` follows
 * with the points gained on `need`.
 */
const LEAVE = 300;

export function createYardMinigame(ctx, { host, yard, onEnd }) {
  const bar = document.createElement("div");
  bar.className = "play-bar";
  const hud = document.createElement("div");
  hud.className = "yard__play";
  hud.hidden = true;
  host.append(hud);
  let current = null,
    band = null,
    leaving = 0;

  /** The band of the yard left free over the dragon while a game plays, in `host`'s pixels; kept as the game ends. */
  function area() {
    if (hud.hidden) return band;
    const top = document.querySelector(".topbar").getBoundingClientRect().bottom - host.getBoundingClientRect().top;
    band = { top, bottom: hud.offsetTop };
    return band;
  }

  const $ = (root, selector) => root.querySelector(selector);

  /** Rising points where they were won, over the yard. */
  function floatAt(x, y, text) {
    const el = document.createElement("div");
    el.className = "dz-float play-float";
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    host.append(el);
    el.addEventListener("animationend", () => el.remove());
  }

  function build({ def, need, game, marker }) {
    const look = def.meter ?? needLook[need];
    const band = game.band ? ` data-band style="--band-from:${game.band[0]};--band-to:${game.band[1]}"` : "";
    bar.innerHTML = `<span class="play-chip">${icon(def.icon)}<span>${t(`minigames.${def.id}.title`)}</span></span>
      <span class="play-chip play-chip--score">${icon("star")}<span data-play-score>0</span><small data-play-best></small></span>`;
    hud.innerHTML = `<p class="yard__play-hint" data-play-hint></p>
      <div class="yard__play-row">
        <div class="dz-meter yard__play-meter" style="--c:${look.color}">${icon(look.icon)}<div${band} class="dz-meter__track"><div class="dz-meter__fill"></div></div></div>
        <button type="button" class="dz-btn dz-btn--success dz-btn--sm" data-play-done>${t("minigames.done")}</button>
      </div>`;
    $(hud, "[data-play-done]").addEventListener("click", finish);
    if (marker) hud.prepend(marker.el);
  }

  /** What the need would be if the game were settled now. */
  function preview() {
    const { dragon, action, need, game, best } = current;
    return minigameNeed(dragon, action, game.score > best ? 1 : minigameAmount(game.progress), need);
  }

  function refresh() {
    const { game, def, best } = current;
    for (const e of game.takeEvents()) {
      floatAt(e.x, e.y, e.text ? t(`minigames.${def.id}.${e.text}`) : e.combo > 1 ? `+${e.points} ×${e.combo}` : `+${e.points}`);
      if (!e.text) playMinigameScore(def.id, e, game.step);
    }
    $(bar, "[data-play-score]").textContent = game.score;
    $(bar, "[data-play-best]").textContent = best ? t("minigames.best", { score: Math.max(best, game.score) }) : "";
    bar.classList.toggle("is-record", Boolean(best) && game.score > best);
    if (game.step !== current.step) {
      if (current.step) playMinigameStep(def.id, game.step, current.dragon.age);
      current.step = game.step;
      const hint = $(hud, "[data-play-hint]");
      hint.textContent = game.step === "done" ? "" : t(`minigames.${def.id}.${game.step}`);
      hint.classList.remove("is-new");
      void hint.offsetWidth;
      hint.classList.add("is-new");
    }
    $(hud, ".dz-meter").style.setProperty("--value", current.settle ? game.meter : preview());
    current.marker?.update(game.beat);
  }

  function loop() {
    if (!current) return;
    refresh();
    if (current.game.done) return finish();
    current.frame = requestAnimationFrame(loop);
  }

  function close() {
    cancelAnimationFrame(current.frame);
    current = null;
    yard.stopPlay();
    ctx.playBar(null);
    host.classList.remove("is-playing");
    area();
    hud.classList.add("is-leaving");
    leaving = setTimeout(() => {
      hud.hidden = true;
      hud.classList.remove("is-leaving");
    }, LEAVE);
  }

  /** Ends the game being played and settles the care it gave, or hands the game to its own `settle`. */
  function finish() {
    if (!current) return;
    const { dragon, game, def, index, action, need, from, settle } = current;
    close();
    if (settle) return settle(game);
    const { record } = settleMinigame(ctx.game.stable, dragon, { action, id: def.id, progress: game.progress, score: game.score });
    ctx.save();
    yard.care(index, action, def.finale);
    const own = `minigames.${def.id}.record`;
    if (record) ctx.notify(t(t(own) === own ? "minigames.record" : own, { name: dragon.name }), "star");
    onEnd(dragon, Math.round(needValue(dragon, need) - from), need);
  }

  return {
    /**
     * Starts a minigame of care action `action` on `dragon`, standing at spot `index`; false when it has
     * none or cannot play. A game with no need to fill, an egg's, shows its own `meter` and is settled
     * by `settle(game)` as it ends.
     */
    start(dragon, index, action, settle = null) {
      const def = minigameFor(action);
      const need = careActions.find((a) => a.id === action)?.need;
      if (!def || current) return false;
      const game = yard.play(index, (anatomy) => def.create({ anatomy, dragon, seed: `${dragon.id}:${ctx.game.now()}` }), area);
      if (!game) return false;
      current = { dragon, index, action, need, def, game, best: bestScore(ctx.game.stable, def.id), from: settle ? 0 : needValue(dragon, need), settle, step: null, frame: 0, marker: "beat" in game ? createBeatMarker() : null };
      clearTimeout(leaving);
      hud.classList.remove("is-leaving");
      build(current);
      hud.hidden = false;
      host.classList.add("is-playing");
      ctx.playBar(bar);
      loop();
      return true;
    },
    /** Ends the game being played, if any, settling what was done. */
    finish,
    get playing() {
      return Boolean(current);
    },
  };
}
