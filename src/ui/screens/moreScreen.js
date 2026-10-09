import { escapeHtml } from "../../escapeHtml.js";
import { clockSpeeds } from "../../stable/gameClock.js";
import { medalsOf, trophiesOf } from "../../stable/honours.js";
import { silksSwatch } from "../../jockey/jockeySilks.js";
import { icon } from "../icons.js";
import { medalRowHtml, trophyRowHtml } from "../honoursLook.js";
import { language, languages, setLanguage, t } from "../../i18n.js";
import { gameDate } from "../stableView.js";
import { setSoundSettings, soundSettings } from "../../sound/audioOutput.js";
import { askForNotifications, canNotify, openNotificationSettings, remindersOn, setRemindersOn, watchPermission } from "../../needNotifications.js";

/** The sound card: a volume slider each for effects and music. */
function soundHtml() {
  const settings = soundSettings();
  const row = (kind, label) =>
    `<label class="more__row more__volume" data-silent><span>${t(label)}</span><input type="range" data-sound="${kind}" min="0" max="100" step="1" value="${Math.round(settings[kind] * 100)}" aria-label="${t(label)}" /></label>`;
  return `<div class="dz-card dz-card--parchment more__card">
        <h2 class="dz-h3">${t("moreScreen.sound")}</h2>
        ${row("effects", "moreScreen.soundEffects")}
        ${row("music", "moreScreen.soundMusic")}
      </div>`;
}

const legalLinks = [
  { label: "moreScreen.privacy", url: "https://curzel.it/privacy.html" },
  { label: "moreScreen.terms", url: "https://curzel.it/terms-and-conditions.html" },
];

/**
 * Settings: the trophy and medal cabinet, look and language (Cozy's detail and language, which reloads the page), the effects and music volumes, care reminders in the apps, a new stable, the dev tools with `?dev=true` (a link to the owner's Profile, `#/more/profile`, clock speed and the exhibition field with its
 * gene editor), then the privacy policy and terms, which the apps open in their in-app browser. `ctx.setCozyDetail(id)` changes Cozy's rounding; `ctx.reset()` starts over through the welcome.
 */
export function createMoreScreen(ctx) {
  const { game } = ctx;
  const el = document.createElement("section");
  el.className = "screen more";
  let confirmReset = false;
  /** What the phone said about notifications, as the app last reported it; null in a browser or before it says. */
  let permission = null;
  let unwatch = null;

  /** The reminders card: on or off, and what the phone still needs, or a word that only the apps remind. */
  function remindersHtml() {
    if (!canNotify()) return `<p class="dz-caption">${t("moreScreen.remindersWeb")}</p>`;
    const on = remindersOn();
    const toggle = `<div class="more__row"><span>${t("moreScreen.remindersRow")}</span><span class="segmented" role="group" aria-label="${t("moreScreen.remindersRow")}">${[true, false]
      .map((v) => `<button type="button" data-reminders="${v}" aria-pressed="${v === on}">${t(v ? "moreScreen.remindersOn" : "moreScreen.remindersOff")}</button>`)
      .join("")}</span></div>`;
    const button = (attr, label) => `<div class="more__buttons"><button type="button" class="dz-btn dz-btn--primary dz-btn--sm" ${attr}><span class="dz-btn__label">${t(label)}</span></button></div>`;
    if (!on) return `${toggle}<p class="dz-caption">${t("moreScreen.remindersOffText")}</p>`;
    if (permission === "ask") return `${toggle}<p class="dz-caption">${t("moreScreen.remindersAsk")}</p>${button("data-allow", "moreScreen.remindersAllow")}`;
    if (permission === "denied") return `${toggle}<p class="dz-caption">${t("moreScreen.remindersDenied")}</p>${button("data-open-settings", "moreScreen.remindersOpenSettings")}`;
    return `${toggle}<p class="dz-caption">${t("moreScreen.remindersWhen")}</p>`;
  }

  const resetHtml = () =>
    `<button type="button" class="dz-btn dz-btn--danger dz-btn--sm" data-reset><span class="dz-btn__label">${t(confirmReset ? "moreScreen.confirmReset" : "moreScreen.newStable")}</span></button>`;

  /** The developer tools, opened by `?dev=true`: the clock speeds, the exhibition field and a new stable. */
  const devCardHtml = (stable) => `<div class="dz-card dz-card--parchment more__card">
        <h2 class="dz-h3">${t("moreScreen.developer")}</h2>
        <div class="more__row"><span class="more__clock">${t("moreScreen.gameClock")}<small data-game-date>${gameDate(stable.clock.game)}</small></span><span class="segmented" role="group" aria-label="${t("moreScreen.gameClockSpeed")}">${clockSpeeds
          .map((s) => `<button type="button" data-speed="${s}" aria-pressed="${s === stable.clock.speed}">×${s}</button>`)
          .join("")}</span></div>
        <div class="more__buttons">
          <a class="dz-btn dz-btn--dark dz-btn--sm" href="#/dev/field"><span class="dz-btn__label">${t("moreScreen.exhibition")}</span></a>
          ${resetHtml()}
        </div>
      </div>`;

  function render() {
    const { stable } = game;
    const trophies = trophiesOf(stable).map((trophy) => trophyRowHtml(trophy, { name: true }));
    const won = medalsOf(stable).map((m) => medalRowHtml(m, { name: true }));
    el.innerHTML = `
      ${
        ctx.dev
          ? `<a class="dz-card dz-card--parchment more__link" href="#/more/profile">
        <i class="more__silks" style="background:${silksSwatch(stable.owner.silks)}"></i>
        <span class="more__link-text"><b>${t("moreScreen.profile")}</b><small>${escapeHtml(stable.owner.name)}</small></span>
        ${icon("chevronRight")}
      </a>`
          : ""
      }
      <div class="dz-card dz-card--parchment more__card">
        <h2 class="dz-h3">${t("moreScreen.trophies")}</h2>
        ${trophies.length ? `<ul class="honours">${trophies.join("")}</ul>` : `<p class="dz-caption">${t("moreScreen.noTrophies")}</p>`}
        <h2 class="dz-h3">${t("moreScreen.medals")}</h2>
        ${won.length ? `<ul class="honours">${won.join("")}</ul>` : `<p class="dz-caption">${t("moreScreen.noMedals")}</p>`}
      </div>
      <div class="dz-card dz-card--parchment more__card">
        <h2 class="dz-h3">${t("moreScreen.settings")}</h2>
        ${
          ctx.style() === "cozy"
            ? `<div class="more__row"><span>${t("moreScreen.detail")}</span><span class="segmented" role="group" aria-label="${t("moreScreen.detail")}">${["light", "full"]
                .map((d) => `<button type="button" data-detail="${d}" aria-pressed="${d === ctx.cozyDetail()}">${t(`moreScreen.details.${d}`)}</button>`)
                .join("")}</span></div>`
            : ""
        }
        <div class="more__row"><span>${t("language.label")}</span><span class="segmented" role="group" aria-label="${t("language.label")}">${languages
          .map((l) => `<button type="button" data-language="${l.id}" lang="${l.id}" aria-pressed="${l.id === language()}">${l.label}</button>`)
          .join("")}</span></div>
      </div>
      ${soundHtml()}
      <div class="dz-card dz-card--parchment more__card">
        <h2 class="dz-h3">${t("moreScreen.reminders")}</h2>
        ${remindersHtml()}
      </div>
      ${ctx.dev ? devCardHtml(stable) : `<div class="dz-card dz-card--parchment more__card"><div class="more__buttons">${resetHtml()}</div></div>`}
      <nav class="dz-card dz-card--parchment more__legal" aria-label="${t("moreScreen.legal")}">
        ${legalLinks.map((l) => `<a href="${l.url}" target="_blank" rel="noopener">${t(l.label)}${icon("chevronRight")}</a>`).join("")}
      </nav>`;
  }

  el.addEventListener("input", (e) => {
    const slider = e.target.closest("[data-sound]");
    if (slider) setSoundSettings({ [slider.dataset.sound]: Number(slider.value) / 100 });
  });

  el.addEventListener("click", (e) => {
    const languageButton = e.target.closest("[data-language]");
    if (languageButton && languageButton.dataset.language !== language()) {
      setLanguage(languageButton.dataset.language);
      return location.reload();
    }
    const detailButton = e.target.closest("[data-detail]");
    if (detailButton) ctx.setCozyDetail(detailButton.dataset.detail);
    const speed = Number(e.target.closest("[data-speed]")?.dataset.speed);
    if (speed) {
      game.stable.clock.speed = speed;
      ctx.save();
    }
    const reminders = e.target.closest("[data-reminders]");
    if (reminders) setRemindersOn(reminders.dataset.reminders === "true");
    if (reminders) ctx.save();
    if (e.target.closest("[data-allow]")) askForNotifications();
    if (e.target.closest("[data-open-settings]")) openNotificationSettings();
    if (e.target.closest("[data-reset]")) {
      if (confirmReset) ctx.reset();
      confirmReset = !confirmReset;
    }
    if (detailButton || speed || reminders || e.target.closest("[data-reset]")) render();
  });

  return {
    el,
    show() {
      confirmReset = false;
      render();
      unwatch ??= watchPermission((status) => {
        permission = status;
        render();
      });
    },
    hide() {
      unwatch?.();
      unwatch = null;
    },
    tick() {
      const date = el.querySelector("[data-game-date]");
      if (date) date.textContent = gameDate(game.stable.clock.game);
    },
    render,
  };
}
