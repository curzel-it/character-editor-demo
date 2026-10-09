import { guardPageGestures } from "./ui/pageGestures.js";
import { loadSubject, styles } from "./subjects.js";
import { loadCozyDetail, setCozyDetail } from "./cozyDetailPreference.js";
import { loadField, saveField } from "./raceField.js";
import { followCloud, loadStable, saveStable } from "./stable/stableSave.js";
import { createStable } from "./stable/newStable.js";
import { tickClock } from "./stable/gameClock.js";
import { advanceStable } from "./stable/advanceStable.js";
import { scheduleReminders } from "./needNotifications.js";
import { welcomed } from "./stable/starters.js";
import { cheatDragon, dragonKinds } from "./stable/cheats.js";
import { installInfoTips } from "./ui/infoTip.js";
import { logoHtml } from "./ui/logo.js";
import { icon } from "./ui/icons.js";
import { createToasts } from "./ui/toasts.js";
import { createAwayLog } from "./ui/awayLog.js";
import { createAwaySheet } from "./ui/awaySheet.js";
import { createUnwatchedRaces } from "./ui/unwatchedRaces.js";
import { ordinal } from "./ordinal.js";
import { language, t } from "./i18n.js";
import { createLoadingScreen } from "./ui/loadingScreen.js";
import { renderNav, setActiveTab } from "./ui/nav.js";
import { matchRoute } from "./ui/router.js";
import { createStableHome } from "./ui/screens/stableHome.js";
import { createMoreScreen } from "./ui/screens/moreScreen.js";
import { createOwnerProfileScreen } from "./ui/screens/ownerProfileScreen.js";
import { createLineageScreen } from "./ui/screens/lineageScreen.js";
import { createDetailsScreen } from "./ui/screens/detailsScreen.js";
import { createAltarScreen } from "./ui/screens/altarScreen.js";
import { createLeagueDetailScreen } from "./ui/screens/leagueDetailScreen.js";
import { createRaceEntryScreen } from "./ui/screens/raceEntryScreen.js";
import { createRacesScreen } from "./ui/screens/racesScreen.js";
import { createBroadcastScreen } from "./ui/screens/broadcastScreen.js";
import { createResultsScreen } from "./ui/screens/resultsScreen.js";
import { createCeremonyScreen } from "./ui/screens/ceremonyScreen.js";
import { createWelcomeScreen } from "./ui/screens/welcomeScreen.js";
import { createFieldScreen } from "./ui/screens/fieldScreen.js";
import { createEditorScreen } from "./ui/screens/editorScreen.js";
import { createDragonStage } from "./ui/dragonStage.js";
import { createThumbnails } from "./dragonThumbnails.js";
import { palette } from "./palette.js";
import { installGameSound } from "./sound/gameSound.js";

const params = new URLSearchParams(location.search);
if (params.has("course") || params.has("race")) {
  location.replace(`/race.html${location.search}`);
  await new Promise(() => {});
}

document.documentElement.lang = language();
guardPageGestures();
installInfoTips(document.body);

const $ = (id) => document.getElementById(id);
const loading = createLoadingScreen($("loading"));
const module = await loadSubject("dragon");
const newStable = () => createStable(module.genes, Math.floor(Math.random() * 1e6), Date.now());
/** `?dev=true` opens the developer tools: the clock speeds and the exhibition field. */
const dev = params.get("dev") === "true";
const style = styles.some((s) => s.id === params.get("style")) ? params.get("style") : "cozy";
setCozyDetail(loadCozyDetail());

const game = { stable: loadStable(module.genes) ?? newStable(), now: () => game.stable.clock.game };
if (!dev) game.stable.clock.speed = 1;
followCloud();
let saving = true;
/** Saves the stable, telling the owner once when storage starts refusing it, and plans the reminders from it. */
function save() {
  scheduleReminders(game.stable, Date.now());
  const saved = saveStable(game.stable);
  if (!saved && saving) ctx.notify(t("app.saveFailed"));
  saving = saved;
}
const stage = createDragonStage(module);
stage.setStyle(style);
let routed = 0,
  playBarSwap = 0;
const TOPBAR_SWAP = 220;
const ctx = {
  module,
  game,
  stage,
  thumbs: createThumbnails(module, { width: 152, height: 138, resting: true, zoom: 1.6, background: palette.sky }),
  /** Head-and-shoulders thumbnails for the tall art of the league cards. */
  portraits: createThumbnails(module, { width: 184, height: 260, resting: true, zoom: 2.6, background: palette.sky, focus: "head" }),
  /** Face close-ups for the stable roster cards. */
  faces: createThumbnails(module, { width: 176, height: 136, resting: true, zoom: 3.8, background: palette.sky, focus: "head" }),
  save,
  /** The exhibition field of the developer tools, saved apart from the stable. */
  field: loadField(module),
  saveField: () => saveField(ctx.field),
  notify: createToasts($("toasts")),
  loading,
  go: (hash) => (location.hash = hash),
  /** Steps back within the app, or to `fallback` when the app was opened on this screen. */
  back(fallback) {
    if (routed > 1) history.back();
    else location.replace(fallback);
  },
  /** Names the open page in the top bar, in place of its route's title. */
  setTitle: (text) => ($("page-title").textContent = text),
  /** Shows `node` in the top bar while a minigame plays, or takes it away with null. */
  playBar(node) {
    clearTimeout(playBarSwap);
    const bar = $("play-bar");
    if (node) {
      bar.classList.remove("is-leaving");
      bar.replaceChildren(node);
      bar.hidden = false;
      $("app").classList.add("app--playing");
      bar.classList.add("is-entering");
      return;
    }
    bar.classList.add("is-leaving");
    playBarSwap = setTimeout(() => {
      bar.classList.remove("is-leaving");
      bar.replaceChildren();
      bar.hidden = true;
      $("app").classList.remove("app--playing");
    }, TOPBAR_SWAP);
  },
  select: (id) => screens.stable.select(id),
  selected: () => screens.stable.selected(),
  style: () => style,
  dev,
  cozyDetail: loadCozyDetail,
  setCozyDetail,
  reset() {
    game.stable = newStable();
    save();
    ctx.go("#/welcome");
  },
};

const screens = {
  stable: createStableHome(ctx),
  lineage: createLineageScreen(ctx),
  details: createDetailsScreen(ctx),
  altar: createAltarScreen(ctx),
  broadcast: createBroadcastScreen(ctx),
  results: createResultsScreen(ctx),
  ceremony: createCeremonyScreen(ctx),
  more: createMoreScreen(ctx),
  ownerProfile: createOwnerProfileScreen(ctx),
  leagueDetail: createLeagueDetailScreen(ctx),
  raceEntry: createRaceEntryScreen(ctx),
  races: createRacesScreen(ctx),
  welcome: createWelcomeScreen(ctx),
  field: createFieldScreen(ctx),
  editor: createEditorScreen(ctx),
};
const awaySheet = createAwaySheet(ctx);
$("play-bar").addEventListener("animationend", (e) => e.animationName === "topbar-in" && $("play-bar").classList.remove("is-entering"));
$("app").append(awaySheet.el);
for (const screen of Object.values(screens)) {
  screen.el.hidden = true;
  screen.setStyle?.(style);
  $("screens").append(screen.el);
}
$("page-back").innerHTML = icon("chevronLeft");
$("page-back").setAttribute("aria-label", t("app.back"));
$("page-back").addEventListener("click", () => back && ctx.back(back));
/** Where the top bar's back button leads when the app was opened on this page. */
let back = null;
const routes = [
  { path: "welcome", tab: null, screen: "welcome", title: "welcome", immersive: true },
  { path: "stable", tab: "stable", screen: "stable", title: "stable", scene: true },
  { path: "away", tab: "stable", screen: "stable", title: "away", sheet: true, scene: true },
  { path: "stable/:id", tab: "stable", screen: "stable", title: "stable", scene: true },
  { path: "stable/:id/profile", tab: "stable", screen: "stable", title: "profile", scene: true, profile: true },
  { path: "dragon/:id/details", tab: "stable", screen: "details", title: "details", back: (p) => `#/stable/${encodeURIComponent(p.id)}/profile` },
  { path: "dragon/:id/lineage", tab: "stable", screen: "lineage", title: "lineage", back: (p) => `#/dragon/${encodeURIComponent(p.id)}/details` },
  { path: "altar", tab: "altar", screen: "altar", title: "altar" },
  { path: "altar/:id", tab: "altar", screen: "altar", title: "altar" },
  { path: "broadcast/:league/:season/:race", tab: "race", screen: "broadcast", title: "race", immersive: true },
  { path: "live/:league", tab: "race", screen: "broadcast", title: "race", immersive: true, live: true },
  { path: "results/:league/:season/:race", tab: "race", screen: "results", title: "results", back: (p) => `#/league/${encodeURIComponent(p.league)}` },
  { path: "ceremony/:league/:season", tab: "race", screen: "ceremony", title: "ceremony", immersive: true },
  { path: "more", tab: "more", screen: "more", title: "more" },
  { path: "more/profile", dev: true, tab: "more", screen: "ownerProfile", title: "ownerProfile", back: () => "#/more" },
  { path: "league", tab: "race", screen: "races", title: "races" },
  { path: "league/:id", tab: "race", screen: "leagueDetail", title: "league", back: () => "#/race" },
  { path: "league/:id/entry", tab: "race", screen: "raceEntry", title: "raceEntry", back: (p) => `#/league/${encodeURIComponent(p.id)}` },
  { path: "league/:id/entry/:dragon", tab: "race", screen: "raceEntry", title: "raceEntry", back: (p) => `#/league/${encodeURIComponent(p.id)}` },
  { path: "race", tab: "race", screen: "races", title: "races" },
  { path: "dev/field", dev: true, tab: "more", screen: "field", title: "exhibition", back: () => "#/more" },
  { path: "dev/field/race", dev: true, tab: "more", screen: "broadcast", title: "exhibitionRace", immersive: true },
  { path: "dev/editor/:id", dev: true, tab: "more", screen: "editor", title: "editor", back: () => "#/dev/field" },
];
let current = null;

function route() {
  const match = matchRoute(routes, location.hash);
  if (!match) return location.replace("#/stable");
  const { route: r, params } = match;
  if (r.dev && !dev) return location.replace("#/more");
  if (!welcomed(game.stable) && r.screen !== "welcome") return location.replace("#/welcome");
  if (r.screen === "stable" && !r.sheet && openMissed()) return location.replace("#/away");
  if (r.sheet && !awaySheet.worthShowing()) return location.replace("#/stable");
  routed++;
  const next = screens[r.screen];
  if (current && current !== next) {
    current.hide();
    current.el.hidden = true;
  }
  current = next;
  next.el.hidden = false;
  back = r.back?.(params) ?? null;
  $("page-back").hidden = !back;
  $("page-title").textContent = t(`routes.${r.title}`);
  next.show({ params, profile: Boolean(r.profile), live: Boolean(r.live), sheet: Boolean(r.sheet) });
  $("screens").scrollTop = 0;
  $("app").classList.toggle("app--immersive", Boolean(r.immersive));
  $("app").classList.toggle("app--scene", Boolean(r.scene));
  $("logo").hidden = !r.scene;
  $("page-title").hidden = Boolean(r.scene);
  setActiveTab($("nav"), r.tab);
  if (r.sheet) awaySheet.open();
  else awaySheet.close();
  document.title = r.title === "stable" ? "Dragons!" : t("app.documentTitle", { title: t(`routes.${r.title}`) });
}

const away = createAwayLog();
const unwatched = createUnwatchedRaces(game);
/** Races that finished unwatched while the owner was in the game, kept for While you were away. */
const missed = [];
const raced = (events) => events.some((e) => e.type === "raced");

/**
 * Moves the game clock on; stages, care, rest and races left on air follow, and what changed is
 * announced or kept for the return. A race that finished unwatched also waits for the Stable, where
 * While you were away shows it, at once when the Stable is open with no minigame playing.
 */
function tickGame() {
  const { stable } = game;
  const events = advanceStable(stable, tickClock(stable.clock, Date.now()), stable.clock.game);
  unwatched.kick();
  if (away.away) away.add(events);
  else {
    announce(events);
    missed.push(...events.filter((e) => e.type === "raced"));
    if (raced(events) && location.hash === "#/stable" && !$("app").classList.contains("app--playing") && openMissed()) location.replace("#/away");
  }
  if (events.length) current?.render();
  else current?.tick();
  return events;
}

/** Opens While you were away on the races that finished unwatched while in the game; false with none to show. */
function openMissed() {
  if (!missed.length) return false;
  const events = missed.splice(0);
  const visit = { events, realAway: 0, gameAway: game.now() - Math.min(...events.map((e) => e.left)), sheet: true };
  if (!awaySheet.worthShowing(visit)) return false;
  awaySheet.open(visit);
  return true;
}

function announce(events) {
  const name = (id) => game.stable.dragons.find((w) => w.id === id)?.name ?? "A dragon";
  for (const e of events) {
    if (e.type === "raced") {
      const place = game.stable.leagues[e.league]?.races[e.race]?.results.find((r) => r.id === e.id)?.place;
      if (place) ctx.notify(t("stableEvents.raced", { name: name(e.id), place: ordinal(place) }), "flagFinish");
    }
    if (e.type === "evolve") ctx.notify(t("stableEvents.evolve", { name: name(e.id) }));
    if (e.type === "ready") ctx.notify(t("stableEvents.ready"));
    if (e.type === "healed") ctx.notify(t("stableEvents.healed", { name: name(e.id) }));
    if (e.type === "rested") ctx.notify(t("stableEvents.rested", { name: name(e.id) }));
  }
}

/**
 * Ends an absence: a long one with news opens While you were away, a short one or one back to a race
 * on air only toasts, but a race that finished unwatched always opens it.
 */
function welcomeBack() {
  const visit = away.back(Date.now(), game.stable.clock.game);
  if (!visit) return;
  const events = [...missed.splice(0), ...visit.events];
  const shown = { ...visit, events };
  if (!awaySheet.worthShowing(shown) || (!raced(events) && (!visit.sheet || location.hash.startsWith("#/live/")))) return announce(events);
  awaySheet.open(shown);
  if (location.hash !== "#/away") location.hash = "#/away";
}

$("logo").innerHTML = logoHtml(false);
$("logo").setAttribute("aria-label", t("app.logoLabel"));
$("nav").setAttribute("aria-label", t("app.screensLabel"));
renderNav($("nav"));
installGameSound(document);
away.leave(game.stable.clock.real, game.stable.clock.game);
tickGame();
save();
addEventListener("hashchange", route);
loading.hide();
route();
welcomeBack();
let sinceSave = 0;
setInterval(() => {
  const events = tickGame();
  if (events.length || ++sinceSave >= 5) {
    save();
    sinceSave = 0;
  }
}, 1000);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    if (location.hash.startsWith("#/live/")) screens.broadcast.hide();
    tickGame();
    save();
    away.leave(Date.now(), game.stable.clock.game);
  } else {
    tickGame();
    welcomeBack();
    if (location.hash.startsWith("#/live/")) route();
  }
});
addEventListener("pagehide", save);
window.__game = {
  game,
  tick: tickGame,
  save,
  /** The broadcast screen: its `race`, `seek(t)` and `script(camera)`. */
  broadcast: () => screens.broadcast,
  /** The awards ceremony screen: its `stage` (`seek(t)`). */
  ceremony: () => screens.ceremony,
  /** The Altar screen: its `stage` (`playing`, `seek(t)`, `skip()`). */
  altar: () => screens.altar,
  /** Pretends the game was closed for `ms` of real time, then returns to it. */
  away(ms) {
    game.stable.clock.real -= ms;
    away.leave(game.stable.clock.real, game.stable.clock.game);
    tickGame();
    welcomeBack();
  },
  /** Console cheats: `kinds()` lists what `addDragon(kind, { age, strength, name, seed })` takes. */
  cheats: {
    kinds: () => dragonKinds(module.genes),
    addDragon(kind, options) {
      const dragon = cheatDragon(module.genes, game.stable, kind, options);
      game.stable.dragons.push(dragon);
      save();
      route();
      ctx.select(dragon.id);
      return dragon;
    },
  },
};
