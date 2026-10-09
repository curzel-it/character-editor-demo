import { escapeHtml } from "../../escapeHtml.js";
import { racerName } from "../../racerName.js";
import { markStarsCelebrated, starToCelebrate, starsOf } from "../../stable/strength.js";
import { formTagHtml, nextForm } from "../formLook.js";
import { formatDuration } from "../formatDuration.js";
import { applyCare, careActionFor, careActions, needValue } from "../../stable/care.js";
import { careAlarm } from "../../stable/awaySummary.js";
import { canWarm, eggReady, incubationProgress, timeToHatch, timeToWarm, warmEgg, warmLimit } from "../../stable/egg.js";
import { evolve, readyToEvolve } from "../../stable/lifeStages.js";
import { onAirBlock, onAirLeague } from "../../stable/onAir.js";
import { leagueForAge } from "../../stable/leagues.js";
import { slotsFree, slotsUsed, stableSlots } from "../../stable/stableSlots.js";
import { findWild, onTheWay, timeToArrive } from "../../stable/wild.js";
import { slumbering } from "../../stable/soulAltar.js";
import { fatigueLimit } from "../../stable/condition.js";
import { eggOrigin } from "../stableView.js";
import { icon } from "../icons.js";
import { needLook, careLook } from "../careLook.js";
import { dragonStarsHtml } from "../stars.js";
import { floatText } from "../floatText.js";
import { eggHtml } from "../eggArt.js";
import { badgeOf, moodOf } from "../mood.js";
import { showMood } from "../moodLine.js";
import { dragonLine } from "../dragonStatus.js";
import { createYardStage } from "../yardStage.js";
import { faceOf } from "../dragonFace.js";
import { createYardMinigame } from "../yardMinigame.js";
import { createProfileSheet } from "../profileSheet.js";
import { createYardHatch } from "../yardHatch.js";
import { createYardReveal } from "../yardReveal.js";
import { createBreathReveal } from "../breathReveal.js";
import { createWildBox } from "../wildBox.js";
import { honoursOf } from "../../stable/honours.js";
import { honourBadgeHtml } from "../honoursLook.js";
import { createStableTour } from "../stableTour.js";
import { careTaught, markCareTaught } from "../../stable/careLesson.js";
import { markFirstCare, markRaceHintDone, raceHintDue } from "../../stable/raceLesson.js";
import { createRaceHint } from "../raceHint.js";
import { leagueName } from "../leagueLook.js";
import { settleWarm } from "../../stable/eggMinigameResult.js";
import { t } from "../../i18n.js";
import { careActionName } from "../careNames.js";
import { playDragonCall, playDragonYawn, playStable } from "../../sound/stableSounds.js";
import { festeDue, markFeste, markSeen } from "../../stable/feste.js";
import { festeOf } from "../../scene/care/feste.js";

const kindOf = (item) => (item.incubation !== undefined ? "egg" : "dragon");
const isKid = (item) => item.age === "kid";

/**
 * The stable, home of the game: every egg and dragon standing in one yard scene, the camera
 * gliding between them from the roster and orbiting the one in view under a drag. What shows over the scene, its name,
 * best trophy or medal, mood and actions, follows the one in view; its profile rises over the yard as a sheet from the Profile action,
 * where its name can be edited and its breath played in the yard. An egg is warmed right here as a minigame and a ready one hatched, cracking under taps of its Hatch tile or of the egg itself,
 * and a dragon that finished its stage evolves into the next age on stage from its Evolve action.
 * On the owner's first visit the stable hand walks care, reminders and saving as coach marks; after their first care,
 * a bubble points at the Race tile until they enter a race or dismiss it.
 * A dragon slumbering after a ritual or resting after a race lies asleep at its spot, and gets up as it wakes.
 * An adult can be sent to the wild from its actions, asked once and again when the stable would be left empty;
 * the roster's Wild tab lists the wild ones to call home, and one on its way holds a slot in the roster, counting down.
 * `ctx` holds the module, the game, `save()`, `notify(text)` and `go(hash)`.
 */
export function createStableHome(ctx) {
  const { module, game } = ctx;
  const el = document.createElement("section");
  el.className = "screen stable-home";
  el.innerHTML = `
    <div class="yard" data-yard></div>
    <div class="yard__head" data-head>
      <div class="yard__plate">
        <span class="yard__name"><span data-name></span><button type="button" class="yard__rename" data-rename aria-label="${t("stableHome.rename")}">${icon("pencil")}</button></span>
        <span class="yard__sub" data-sub></span>
        <span class="yard__stars" data-stars></span>
      </div>
      <p class="yard__mood" data-mood hidden></p>
    </div>
    <div class="yard__panel" data-panel>
      <div class="actions" data-actions></div>
    </div>
    <div class="yard__roster dz-roster-panel">
      <div class="stable-tabs" role="tablist" aria-label="${t("stableHome.roster")}">
        <button type="button" class="stable-count" role="tab" data-tab-roster="stable" aria-selected="true"></button>
        <button type="button" class="stable-count" role="tab" data-tab-roster="wild" aria-selected="false"></button>
        <span class="stable-slots" data-slots></span>
      </div>
      <div class="dz-roster" data-roster role="listbox" aria-label="${t("stableHome.yourStable")}"></div>
    </div>
    <p class="stable-empty" data-empty hidden></p>`;
  const $ = (selector) => el.querySelector(selector);
  const thumbs = ctx.faces;
  const sheet = createProfileSheet(ctx, {
    onClose: () => closeProfile(),
    onBreathe: (button) => breathe(button),
    onLeft: (gone, flew) => {
      if (flew) yard.takeOff(gone.id);
      selected = null;
      location.replace("#/stable");
    },
  });
  el.append(sheet.el);
  const hatching = createYardHatch(ctx),
    reveal = createYardReveal();
  $("[data-yard]").after(...reveal.layers);
  const wildBox = createWildBox(ctx, {
    onCalled: () => {
      rosterKey = "";
      render();
    },
    onProfile: (id) => ctx.go(`#/stable/${encodeURIComponent(id)}/profile`),
  });
  $("[data-roster]").after(wildBox.el);
  const tour = createStableTour(el);
  el.append(tour.el);
  const raceHint = createRaceHint({
    onRace: () => act("race"),
    onDismiss: () => {
      markRaceHintDone(game.stable);
      ctx.save();
      tick();
    },
  });
  $("[data-actions]").before(raceHint.el);
  const breathReveal = createBreathReveal(el, {
    breathe: (id) => yard.breathe(items().findIndex((entry) => entry.id === id)),
    hold: (id) => yard.holdWide(id),
  });
  const asleep = (item) => game.stable.dragons.includes(item) && (slumbering(item, game.now()) || item.fatigue > fatigueLimit);
  const yard = createYardStage(module, stableSlots, {
    asleep,
    face: (item) => (game.stable.dragons.includes(item) ? faceOf(item) : null),
    keeper: () => game.stable.owner,
    yawned: (item) => playDragonYawn(item.age),
    onFocus: (index) => {
      if (wildView) return;
      const item = items()[index];
      if (item && item.id !== selected) {
        selected = item.id;
        render({ swap: true });
      }
    },
    onTap: () => {
      const item = current();
      if (item && kindOf(item) === "egg" && eggReady(item)) hatch(item, $('[data-action="hatch"]'));
    },
    frameArea: (index) => {
      const item = yardItems()[index];
      const kind = item ? kindOf(item) : null;
      const shown = wildView ? item : current();
      if (shown && kind === kindOf(shown)) {
        const stage = yard.el.getBoundingClientRect();
        const head = $("[data-head]").getBoundingClientRect();
        const below = breathReveal.card() ?? (sheet.isOpen ? sheet.el : rosterTab === "wild" ? $(".yard__roster") : $("[data-panel]"));
        areas[kind] = { top: head.bottom - stage.top, bottom: below.getBoundingClientRect().top - stage.top };
      }
      return areas[kind] ?? (current() ? areas[kindOf(current())] : undefined);
    },
  });
  const areas = {};
  $("[data-yard]").append(yard.el);
  const minigame = createYardMinigame(ctx, {
    host: el,
    yard,
    onEnd(dragon, gained, need) {
      markFirstCare(game.stable);
      ctx.save();
      render();
      if (gained > 0 && dragon.id === selected) floatText($("[data-name]"), `+${gained}`, needLook[need].color, el);
    },
  });
  let selected = null,
    style = "cozy",
    visible = false,
    renaming = false,
    rosterKey = "",
    /** The roster tab in view, `stable` or `wild`. */
    rosterTab = "stable",
    /** The wild dragon whose profile is open over the yard, or null. */
    wildView = null,
    /** Whether a sheet of the app, such as While you were away, covers the yard. */
    covered = false;

  const booked = () => (game.stable.wild ?? []).filter(onTheWay);
  const items = () => [...game.stable.eggs, ...game.stable.dragons.filter(isKid), ...game.stable.dragons.filter((w) => !isKid(w))];
  /** Where a wild dragon whose profile is open stands in the yard: the spot after the stable's, or the last one when it is full. */
  const guestSpot = () => Math.min(items().length, stableSlots - 1);
  /** What stands in the yard: the stable, with a wild dragon whose profile is open standing in as a guest. */
  function yardItems() {
    const guest = wildView ? findWild(game.stable, wildView) : null;
    return guest ? [...items().slice(0, guestSpot()), guest] : items();
  }

  function current() {
    const all = items();
    return all.find((item) => item.id === selected) ?? all[0] ?? null;
  }

  const badge = (item, kind) => badgeOf(item, kind, game.now(), game.stable);

  function subtitle(item, kind) {
    return kind === "egg" ? eggOrigin(item) : dragonLine(item);
  }

  const profileAction = () => ({ id: "profile", label: t("stableHome.profile"), icon: "book", variant: "dark" });

  const careTile = (a) => ({ id: a.id, label: careActionName(a.id), icon: careLook[a.id].icon, variant: careLook[a.id].variant, meter: true });

  /** A dragon shows one care tile, for its neediest need. */
  function actionsFor(item, kind) {
    if (kind === "egg")
      return [
        profileAction(),
        { id: "nudge", label: t("stableHome.warm"), icon: "sparkle", color: "var(--dz-warning)", meter: true },
        { id: "hatch", label: t("yardHatch.hatch"), icon: "egg", variant: "success", meter: true },
      ];
    return [
      profileAction(),
      { id: "race", label: t("stableHome.race"), icon: "race", variant: "primary" },
      ...(readyToEvolve(item) && !onAirBlock(game.stable, item.id) ? [{ id: "evolve", label: t("stableHome.evolve"), icon: "evolve", color: "var(--dz-success)" }] : []),
      careTile(careActionFor(item)),
    ];
  }

  function renderActions(item, kind) {
    const actions = actionsFor(item, kind);
    $("[data-actions]").style.setProperty("--n", actions.length);
    $("[data-actions]").innerHTML = actions
      .map(
        (a) =>
          `<button type="button" class="dz-btn dz-btn--tile ${a.variant ? `dz-btn--${a.variant}` : ""}" data-action="${a.id}" ${a.color ? `style="--c:${a.color}"` : ""}>${icon(a.icon)}<span class="dz-btn__label">${a.label}</span>${a.meter ? `<span class="dz-btn__meter" data-meter></span>` : ""}</button>`,
      )
      .join("");
  }

  const setTileMeter = (action, value, low = false) => {
    const meter = $(`[data-action="${action}"] [data-meter]`);
    meter?.style.setProperty("--value", Math.max(0, Math.min(100, value)));
    meter?.classList.toggle("is-low", low);
  };

  /** The care tile carries the need it tends, and changes over once another need runs lower. */
  function updateCareAction(item) {
    const a = careActionFor(item);
    if (!$(`[data-action="${a.id}"]`)) renderActions(item, "dragon");
    const value = needValue(item, a.need);
    setTileMeter(a.id, value, value < careAlarm);
  }

  /** Warm shows the time to the next warm and its uses, Hatch the time left. */
  function updateEggActions(item) {
    const now = game.now();
    const ready = eggReady(item);
    const wait = timeToWarm(item, now);
    const warm = $('[data-action="nudge"]'),
      hatch = $('[data-action="hatch"]');
    warm.disabled = !canWarm(item, now);
    warm.querySelector(".dz-btn__label").textContent = wait === null ? t("stableHome.warm") : wait > 0 ? formatDuration(wait) : t("stableHome.warmCount", { count: item.warms, limit: warmLimit });
    hatch.disabled = !ready;
    hatch.querySelector(".dz-btn__label").textContent = ready ? hatching.label(item) : formatDuration(timeToHatch(item));
    setTileMeter("nudge", (item.warms / warmLimit) * 100);
    setTileMeter("hatch", incubationProgress(item) * 100);
  }

  function cardHtml(item) {
    const kind = kindOf(item);
    const mark = badge(item, kind);
    const art = kind === "egg" ? eggHtml(module.genes, item, style, "egg-art--card") : `<canvas width="${thumbs.width}" height="${thumbs.height}"></canvas>`;
    const below = kind === "egg" ? (eggReady(item) ? `<span class="dz-roster-card__sub">${t("stableHome.ready")}</span>` : "") : dragonStarsHtml(item);
    return `<button type="button" class="dz-roster-card ${kind === "egg" ? "dz-roster-card--egg" : ""}" role="option" data-id="${item.id}" aria-selected="${item.id === selected}">
      ${mark ? `<span class="dz-roster-card__badge">${icon(mark)}</span>` : ""}
      <span class="dz-roster-card__art">${art}${kind === "egg" ? "" : `<span class="dz-roster-card__honours">${honourBadgeHtml(honoursOf(game.stable, item.id))}</span>`}</span>
      <span class="dz-roster-card__name">${escapeHtml(kind === "egg" ? t("stableHome.egg") : item.name)}</span>
      ${below}
    </button>`;
  }

  const timeLeft = (w) => formatDuration(timeToArrive(w, game.now()));

  /** A slot held by a dragon flying home: greyed, counting down, opening its profile. */
  function bookedHtml(w) {
    return `<button type="button" class="dz-roster-card dz-roster-card--booked" data-booked="${escapeHtml(w.id)}" aria-label="${escapeHtml(t("stableHome.bookedLabel", { name: w.name }))}">
      <span class="dz-roster-card__art"><canvas width="${thumbs.width}" height="${thumbs.height}"></canvas><span class="dz-roster-card__left" data-left>${timeLeft(w)}</span></span>
      <span class="dz-roster-card__name">${escapeHtml(w.name)}</span>
      <span class="dz-roster-card__sub">${t("stableHome.onTheWay")}</span>
    </button>`;
  }

  function renderRoster(force = false) {
    const all = items(),
      coming = booked(),
      wild = game.stable.wild ?? [];
    const free = slotsFree(game.stable);
    const key =
      all.map((item) => `${item.id}:${item.age ?? ""}:${item.name ?? ""}:${badge(item, kindOf(item))}:${item.id === selected}:${kindOf(item) === "dragon" ? starsOf(item).stars : ""}`).join("|") +
      coming.map((w) => w.id).join(",") +
      style +
      free +
      rosterTab +
      wild.length +
      game.stable.seasons.length;
    if (!force && key === rosterKey) {
      for (const left of $("[data-roster]").querySelectorAll("[data-booked]")) left.querySelector("[data-left]").textContent = timeLeft(findWild(game.stable, left.dataset.booked));
      if (rosterTab === "wild") wildBox.tick();
      return;
    }
    rosterKey = key;
    $('[data-tab-roster="stable"]').textContent = t("stableHome.yourStable");
    $("[data-slots]").textContent = t("stableHome.slots", { used: slotsUsed(game.stable), total: stableSlots });
    $('[data-tab-roster="wild"]').textContent = t("stableHome.wildTab", { count: wild.length });
    for (const tab of el.querySelectorAll("[data-tab-roster]")) tab.setAttribute("aria-selected", String(tab.dataset.tabRoster === rosterTab));
    el.classList.toggle("is-wild", rosterTab === "wild");
    $("[data-roster]").hidden = rosterTab !== "stable";
    wildBox.el.hidden = rosterTab !== "wild";
    if (rosterTab === "wild") wildBox.render(force);
    const freeCard = `<a class="dz-roster-card dz-roster-card--add" href="#/altar">${icon("plus")}<span class="dz-roster-card__sub">${t("stableHome.freeSlot")}</span></a>`;
    $("[data-roster]").innerHTML = all.map(cardHtml).join("") + coming.map(bookedHtml).join("") + freeCard.repeat(free);
    for (const canvas of $("[data-roster]").querySelectorAll("canvas")) {
      const card = canvas.closest("[data-id], [data-booked]");
      const dragon = card.dataset.booked ? findWild(game.stable, card.dataset.booked) : game.stable.dragons.find((w) => w.id === card.dataset.id);
      thumbs.draw(canvas, dragon, style);
    }
  }

  /** The name plate over the profile of a wild dragon, in the wild or on its way home. */
  function renderWildPlate(w) {
    if (!renaming) $("[data-name]").textContent = w.name;
    $("[data-rename]").hidden = true;
    $("[data-sub]").textContent = onTheWay(w) ? t("stableHome.onTheWayHome", { time: timeLeft(w) }) : t("stableHome.inTheWild");
    $("[data-stars]").innerHTML = dragonStarsHtml(w) + honourBadgeHtml(honoursOf(game.stable, w.id)) + formTagHtml(nextForm(game.stable, w, game.now()));
    showMood($("[data-mood]"), null);
  }

  function render({ swap = false } = {}) {
    $("[data-rename]").setAttribute("aria-label", t("stableHome.rename"));
    $(".stable-tabs").setAttribute("aria-label", t("stableHome.roster"));
    $("[data-roster]").setAttribute("aria-label", t("stableHome.yourStable"));
    const item = current();
    const wildOnes = (game.stable.wild ?? []).length;
    const wildOpen = wildView ? findWild(game.stable, wildView) : null;
    $("[data-empty]").hidden = Boolean(item);
    $("[data-empty]").textContent = t(wildOnes ? "stableHome.emptyWild" : "stableHome.emptyStable");
    if (!item && wildOnes) rosterTab = "wild";
    for (const part of el.querySelectorAll(".yard__head, .yard__panel")) part.hidden = !item && !wildOpen;
    $(".yard__roster").hidden = !item && !wildOnes;
    yard.setItems(yardItems(), module.genes);
    if (wildOpen) {
      renderWildPlate(wildOpen);
      sheet.render();
      renderRoster();
      return;
    }
    if (!item) {
      renderRoster();
      return;
    }
    selected = item.id;
    const kind = kindOf(item);
    if (!renaming) $("[data-name]").textContent = kind === "egg" ? t("stableHome.egg") : item.name;
    $("[data-rename]").hidden = kind === "egg";
    $("[data-sub]").textContent = subtitle(item, kind);
    $("[data-stars]").innerHTML = kind === "egg" ? "" : dragonStarsHtml(item) + honourBadgeHtml(honoursOf(game.stable, item.id)) + formTagHtml(nextForm(game.stable, item, game.now()));
    renderActions(item, kind);
    sheet.render();
    renderRoster();
    tick();
    if (swap) {
      for (const part of el.querySelectorAll("[data-head], [data-panel]")) {
        part.classList.remove("is-swapping");
        void part.offsetWidth;
        part.classList.add("is-swapping");
      }
    }
  }

  /** Refreshes timers, alerts, moods and button states without rebuilding the screen. */
  function tick() {
    const item = current();
    const wildOpen = wildView ? findWild(game.stable, wildView) : null;
    if (wildOpen || !item) {
      raceHint.show(null);
      if (wildOpen) renderWildPlate(wildOpen);
      renderRoster();
      sheet.tick();
      return;
    }
    const kind = kindOf(item);
    const mood = moodOf(item, kind, game.now(), game.stable);
    showMood($("[data-mood]"), mood?.calm ? null : mood);
    if (kind === "egg") updateEggActions(item);
    if (kind === "dragon") updateCareAction(item);
    updateRaceHint(item, kind);
    renderRoster();
    sheet.tick();
    tour.place();
    celebrateStars();
  }

  /** Points at the Race tile of the dragon in view while the first race hint is due. */
  function updateRaceHint(item, kind) {
    const tile = $('[data-action="race"]');
    const due = kind === "dragon" && tile && raceHintDue(game.stable);
    raceHint.show(due ? item.name : null, due ? leagueName(leagueForAge(item.age).id) : "", tile);
  }

  /** Toasts every star a dragon earned since the last one celebrated, popping it on the name plate of the one in view. */
  function celebrateStars() {
    for (const w of game.stable.dragons) {
      const stars = starToCelebrate(w);
      if (!stars) continue;
      markStarsCelebrated(w, stars);
      ctx.save();
      ctx.notify(t("stableEvents.star", { name: w.name }), "star");
      if (w.id !== selected) continue;
      $("[data-stars]").innerHTML = dragonStarsHtml(w) + honourBadgeHtml(honoursOf(game.stable, w.id)) + formTagHtml(nextForm(game.stable, w, game.now()));
      const star = $(`[data-stars] [data-star="${stars}"]`);
      star?.classList.add("is-new");
      if (star) floatText(star, "+1", "var(--dz-accent)", el);
    }
  }

  /** The first visit's walk through the stable, on the owner's dragon; seen once shown. */
  function teach() {
    const item = current();
    if (careTaught(game.stable) || sheet.isOpen || !item || kindOf(item) !== "dragon") return;
    markCareTaught(game.stable);
    ctx.save();
    tour.open(item.name, ".yard__panel [data-actions] > :last-child");
  }

  /** Notes the dragon in view as seen, once it has greeted the owner when it was missed long enough. */
  function sight() {
    const item = current();
    if (!visible || covered || document.hidden || wildView || !item || kindOf(item) !== "dragon") return;
    const now = Date.now();
    if (festeDue(game.stable, item, now, { asleep: asleep(item) })) greet(item, now);
    markSeen(item, now);
  }

  /** Has `item` greet the owner, calling out as it hops. */
  function greet(item, now) {
    const feste = festeOf(item.age);
    const wait = yard.greet(items().indexOf(item), feste);
    if (wait === null) return;
    markFeste(game.stable, now);
    for (const [at, sound, rate] of feste.calls) setTimeout(() => playStable(sound, { rate }), (wait + at) * 1000);
  }

  function select(id) {
    selected = id;
    render({ swap: true });
    yard.focus(items().findIndex((item) => item.id === id));
    sight();
    $(`[data-roster] [data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  function openProfile() {
    const item = current();
    if (item) ctx.go(`#/stable/${encodeURIComponent(item.id)}/profile`);
  }

  function closeProfile() {
    ctx.back(`#/stable/${encodeURIComponent(selected ?? "")}`);
  }

  function startRename() {
    const w = current();
    if (renaming || !w.name) return;
    renaming = true;
    const name = $("[data-name]");
    name.innerHTML = `<input class="rename-input" maxlength="24" autocomplete="off" aria-label="${t("stableHome.name")}" value="${escapeHtml(w.name)}" />`;
    const input = name.querySelector("input");
    input.focus();
    input.select();
    const finish = () => {
      if (!renaming) return;
      renaming = false;
      w.name = input.value.trim().slice(0, 24) || racerName(w.seed);
      ctx.save();
      rosterKey = "";
      render();
    };
    input.addEventListener("blur", finish);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") input.blur();
    });
  }

  function breathe(button) {
    const seconds = yard.breathe(items().findIndex((entry) => entry.id === selected));
    if (!seconds) return;
    button.disabled = true;
    setTimeout(() => (button.disabled = false), seconds * 1000);
  }

  /** One tap towards hatching `egg`; once it pops, the yard plays the hatching and the kid takes the stage. */
  function hatch(egg, button) {
    const index = items().findIndex((entry) => entry.id === egg.id);
    const { cracks, kid } = hatching.crack(egg);
    if (!cracks) return;
    floatText(button, t(kid ? "stableHome.pop" : "stableHome.crack"), "var(--dz-accent)", el);
    playStable("crack", { level: kid ? 1.3 : 1, rate: 1 + cracks * 0.05 });
    yard.crack(index, cracks);
    if (!kid) return tick();
    ctx.save();
    selected = kid.id;
    reveal.play(el, yard.hatch(index, items().findIndex((entry) => entry.id === kid.id), items(), module.genes), t("stableHome.hatched"), "kid");
    history.replaceState(null, "", `#/stable/${encodeURIComponent(kid.id)}`);
    rosterKey = "";
    render();
  }

  /** Settles the Warm minigame on `egg`: a day sooner and a little stronger. */
  function warmed(egg, game) {
    const { warmed, record } = settleWarm(ctx.game.stable, egg, { id: game.id, score: game.score }, ctx.game.now());
    ctx.save();
    render();
    if (warmed && egg.id === selected && visible) floatText($("[data-name]"), t("stableHome.warmGain"), "var(--dz-warning)", el);
    if (record) ctx.notify(t("minigames.warm.record"), "star");
  }

  /** Evolves `dragon` into its next age, which the yard plays out on stage. */
  function evolveDragon(dragon) {
    const from = dragon.age;
    if (!evolve(ctx.game.stable, dragon)) return;
    ctx.save();
    rosterKey = "";
    render();
    const seconds = yard.grow(items().indexOf(dragon), dragon, from);
    if (!seconds) return;
    reveal.play(el, seconds, t(`stableHome.grown.${dragon.age}`), dragon.age);
    breathReveal.play(dragon, from, seconds);
  }

  function act(action, button) {
    const item = current();
    const now = game.now();
    if (action === "profile") return openProfile();
    if (action === "evolve") return evolveDragon(item);
    if (action === "race") {
      const onAir = onAirLeague(game.stable, item.id);
      return ctx.go(onAir ? `#/live/${onAir}` : `#/league/${leagueForAge(item.age).id}/entry/${encodeURIComponent(item.id)}`);
    }
    if (action === "nudge") {
      if (!canWarm(item, now)) return;
      if (minigame.start(item, items().indexOf(item), action, (game) => warmed(item, game))) return;
      if (!warmEgg(item, now)) return;
      floatText(button, t("stableHome.warmGain"), "var(--dz-warning)", el);
      playStable("warm");
    } else if (action === "hatch") {
      return hatch(item, button);
    } else {
      if (minigame.start(item, items().indexOf(item), action)) return;
      const effect = careActions.find((a) => a.id === action)?.effect;
      if (!effect || !applyCare(item, action)) return;
      for (const [need, delta] of Object.entries(effect)) if (delta > 0) floatText(button, `+${delta}`, needLook[need].color, el);
      yard.care(items().indexOf(item), action);
      playStable("sparkle");
      setTimeout(() => playDragonCall(item.age, 0.7), 350);
      markFirstCare(game.stable);
    }
    ctx.save();
    render();
  }

  el.addEventListener("click", (e) => {
    const card = e.target.closest("[data-roster] [data-id]");
    if (card) return select(card.dataset.id);
    const coming = e.target.closest("[data-roster] [data-booked]");
    if (coming) return ctx.go(`#/stable/${encodeURIComponent(coming.dataset.booked)}/profile`);
    const tab = e.target.closest("[data-tab-roster]");
    if (tab) {
      rosterTab = tab.dataset.tabRoster;
        return render();
    }
    if (e.target.closest("[data-rename]")) return startRename();
    const action = e.target.closest("[data-action]");
    if (action && !action.disabled) act(action.dataset.action, action);
  });

  return {
    el,
    /** Shows the stable on `params.id` when given, its profile sheet open with `profile`, under an app sheet with `sheet`. */
    show({ params = {}, profile = false, sheet: under = false } = {}) {
      covered = under;
      const was = visible,
        before = selected,
        wasWild = wildView;
      visible = true;
      if (params.id && items().some((item) => item.id === params.id)) selected = params.id;
      wildView = profile && params.id && findWild(game.stable, params.id) ? params.id : null;
      if (wildView) sheet.open(wildView);
      else if (profile && current()) sheet.open(current().id);
      else sheet.close();
      el.classList.toggle("is-profile", sheet.isOpen);
      rosterKey = "";
      render({ swap: was && before !== selected });
      const index = wildView ? guestSpot() : Math.max(0, items().findIndex((item) => item.id === selected));
      yard.focus(index, { instant: !was || Boolean(wildView) || wasWild });
      if (!was) yard.show();
      teach();
      if (was) $(`[data-roster] [data-id="${CSS.escape(selected ?? "")}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    },
    hide() {
      visible = false;
      minigame.finish();
      tour.dismiss();
      breathReveal.close();
      sheet.close();
      el.classList.remove("is-profile");
      yard.hide();
    },
    render,
    tick() {
      tick();
      sight();
    },
    /** Selects `id` the next time the stable shows, such as a newly hatched kid. */
    select(id) {
      selected = id;
    },
    /** The id of the egg or dragon selected in the stable, if any. */
    selected: () => selected,
    setStyle(next) {
      style = next;
      yard.setStyle(next);
      wildBox.setStyle(next);
      if (visible) renderRoster(true);
    },
  };
}
