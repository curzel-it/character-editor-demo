import { escapeHtml } from "../../escapeHtml.js";
import { adoptStarter, starterKids, welcomed } from "../../stable/starters.js";
import { renameOwner } from "../../stable/owner.js";
import { jockeyName } from "../../jockey/jockeyName.js";
import { riderNameHtml } from "../riderMaker.js";
import { icon } from "../icons.js";
import { logoHtml } from "../logo.js";
import { createMeadowStage } from "../meadowStage.js";
import { t } from "../../i18n.js";
import { standout } from "../../dragonBuild.js";

const BAND_ROOM = 12,
  KID_TURN = 0.55,
  RIDDEN_TURN = 1.1;

/**
 * The first run, in one meadow scene: the owner, who rides every dragon they own, gives their rider
 * a name, everything else being the same for every owner; the stable hand offers three kids,
 * seen all together until one is picked from the roster or tapped in the meadow, which frames it alone, turned three-quarters;
 * the roster's first card, or a tap on the open meadow, steps back out to all three. Once one is raised the others
 * leave and the kid stands ridden beside a gift egg, with a word on the first race, then the stable. A welcomed stable skips straight to the stable.
 */
export function createWelcomeScreen(ctx) {
  const { module, game } = ctx;
  const thumbs = ctx.faces;
  const el = document.createElement("section");
  el.className = "screen welcome";
  el.innerHTML = `
    <div class="welcome__meadow" data-meadow></div>
    <div class="dz-logo dz-logo--corner welcome__logo" data-logo>${logoHtml(false)}</div>
    <div class="welcome__head" data-head></div>
    <div class="welcome__popup" data-popup hidden>
      <form class="dz-card dz-card--parchment welcome__greet" data-greet>
        <span class="dz-avatar welcome__greet-avatar">${icon("home")}</span>
        <span class="dz-dialog__tag welcome__greet-tag">${t("welcomeScreen.stableHand")}</span>
        <p class="welcome__greet-line">${t("welcomeScreen.nameLine")}</p>
        ${riderNameHtml()}
        <button type="submit" class="dz-btn dz-btn--primary dz-btn--block"><span class="dz-btn__label">${t("welcomeScreen.nameNext")}</span></button>
      </form>
    </div>
    <div class="welcome__foot" data-foot>
      <div class="dz-dialog welcome__dialog">
        <span class="dz-avatar welcome__avatar">${icon("home")}</span>
        <p class="dz-dialog__line" aria-live="polite"><span class="dz-dialog__tag">${t("welcomeScreen.stableHand")}</span><span data-line></span></p>
      </div>
      <div class="dz-roster-panel welcome__roster" data-kids-panel hidden>
        <div class="dz-roster welcome__kids" data-kids role="listbox"></div>
      </div>
      <button type="button" class="dz-btn dz-btn--block welcome__next" data-next><span class="dz-btn__label" data-label></span></button>
    </div>`;
  const $ = (selector) => el.querySelector(selector);
  let step = "name",
    kids = [],
    picked = -1,
    adopted = null,
    style = "cozy";

  /** The stage band between the head and the foot, where the kids stand. */
  function freeBand() {
    if (step === "name") return {};
    const stage = meadow.el.getBoundingClientRect();
    const above = Math.max(...["[data-head]", "[data-logo]"].map((s) => $(s).getBoundingClientRect().bottom));
    return { top: above - stage.top + BAND_ROOM, bottom: $("[data-foot]").getBoundingClientRect().top - stage.top - 8 };
  }

  const meadow = createMeadowStage(module, { onTap: (index) => pick(index), frameArea: freeBand });
  $("[data-meadow]").append(meadow.el);

  const canvasHtml = () => `<canvas width="${thumbs.width}" height="${thumbs.height}"></canvas>`;

  function kidCardHtml(kid, i) {
    const stat = standout(module.genes, kid.genome);
    return `<button type="button" class="dz-roster-card welcome__kid" role="option" data-kid="${i}" aria-selected="false">
      <span class="dz-roster-card__art">${canvasHtml()}</span>
      <span class="dz-roster-card__name">${escapeHtml(kid.name)}</span>
      <span class="dz-roster-card__sub welcome__stat">${t(`statBars.${stat}`)}</span>
    </button>`;
  }

  function rosterHtml() {
    const all = `<button type="button" class="dz-roster-card welcome__kid" role="option" data-kid="-1" aria-selected="false">
      <span class="dz-roster-card__art welcome__all">${kids.map(canvasHtml).join("")}</span>
      <span class="dz-roster-card__name">${t("welcomeScreen.allKids")}</span>
      <span class="dz-roster-card__sub">${t("welcomeScreen.allKidsSub")}</span>
    </button>`;
    return all + kids.map(kidCardHtml).join("");
  }

  function drawRoster() {
    const canvases = [...el.querySelectorAll("[data-kids] canvas")];
    canvases.forEach((canvas, n) => thumbs.draw(canvas, kids[n % kids.length], style));
  }

  function pickView() {
    $("[data-head]").innerHTML = "";
    $("[data-kids]").setAttribute("aria-label", t("welcomeScreen.kids"));
    $("[data-kids]").innerHTML = rosterHtml();
    drawRoster();
    meadow.setItems(kids);
    showPicked();
  }

  function showPicked() {
    const kid = kids[picked];
    const owner = game.stable.owner.name;
    $("[data-line]").textContent = kid ? t(`welcomeScreen.pickLines.${standout(module.genes, kid.genome)}`, { kid: kid.name }) : t("welcomeScreen.meetLine", { owner });
    $("[data-label]").textContent = kid ? t("welcomeScreen.raise", { name: kid.name }) : t("welcomeScreen.pickFirst");
    $("[data-next]").disabled = !kid;
    el.querySelectorAll("[data-kid]").forEach((card) => card.setAttribute("aria-selected", String(Number(card.dataset.kid) === picked)));
    el.querySelector(`[data-kid="${picked}"]`)?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  /** The kid adopted, ridden by the owner in their silks. */
  const riddenKid = () => ({ ...adopted, jockey: game.stable.owner });

  function rename(name) {
    renameOwner(game.stable, name);
    ctx.save();
    $("[data-maker-name]").value = game.stable.owner.name;
  }

  function nameView() {
    $("[data-head]").innerHTML = "";
    meadow.setItems([]);
    const input = $("[data-maker-name]");
    if (document.activeElement !== input) input.value = game.stable.owner.name;
  }

  function giftView() {
    const egg = game.stable.eggs[0];
    $("[data-head]").innerHTML = `<span class="dz-stamp welcome__stamp">${t("welcomeScreen.gift")}</span>`;
    const here = picked - 1;
    meadow.pick(0, false, here > 0 ? -RIDDEN_TURN : RIDDEN_TURN);
    meadow.setItems([riddenKid(), egg], [here, here + (here > 0 ? -0.6 : 0.6)]);
    $("[data-line]").textContent = t("welcomeScreen.giftLine", { name: adopted.name });
    $("[data-label]").textContent = t("welcomeScreen.giftNext");
  }

  function render() {
    if (el.dataset.step !== step) meadow.orbit.reset();
    el.dataset.step = step;
    $("[data-next]").className = `dz-btn dz-btn--${step === "gift" ? "success" : "primary"} dz-btn--block welcome__next`;
    $("[data-next]").disabled = false;
    $("[data-popup]").hidden = step !== "name";
    $("[data-foot]").hidden = step === "name";
    $("[data-kids-panel]").hidden = step !== "pick";
    $("[data-logo]").hidden = step === "gift";
    if (step === "pick") pickView();
    else if (step === "gift") giftView();
    else nameView();
  }

  /** Frames kid `index` alone, or all three at -1. */
  function pick(index) {
    if (step !== "pick" || !(index === -1 || kids[index])) return;
    if (index !== picked) meadow.orbit.reset();
    picked = index;
    meadow.pick(index, index >= 0, KID_TURN);
    showPicked();
  }

  function meetKids() {
    kids = starterKids(module.genes, game.stable);
    picked = -1;
    meadow.pick(-1);
  }

  function toPick() {
    step = "pick";
    meetKids();
    render();
  }

  function advance() {
    if (step === "name") return;
    if (step === "pick") {
      if (!kids[picked]) return;
      adopted = adoptStarter(game.stable, module.genes, picked);
      ctx.save();
      step = "gift";
      return render();
    }
    ctx.select(adopted.id);
    step = "name";
    location.replace("#/stable");
  }

  el.addEventListener("click", (e) => {
    const card = e.target.closest("[data-kid]");
    if (card) pick(Number(card.dataset.kid));
    if (e.target.closest("[data-next]")) advance();
    if (e.target.closest("[data-maker-rename]")) rename(jockeyName(String(Math.floor(Math.random() * 1e9))));
  });

  el.addEventListener("change", (e) => {
    if (e.target.matches("[data-maker-name]")) rename(e.target.value);
  });

  $("[data-greet]").addEventListener("submit", (e) => {
    e.preventDefault();
    rename($("[data-maker-name]").value);
    $("[data-maker-name]").blur();
    toPick();
  });

  return {
    el,
    show() {
      if (!welcomed(game.stable)) {
        if (step === "gift") step = "name";
      } else if (step !== "gift" || !adopted) return location.replace("#/stable");
      if (step === "pick") meetKids();
      render();
      meadow.show();
    },
    hide() {
      meadow.hide();
    },
    setStyle(id) {
      style = id;
      meadow.setStyle(id);
      if (step === "pick" && kids.length) drawRoster();
    },
    render() {},
    tick() {},
  };
}
