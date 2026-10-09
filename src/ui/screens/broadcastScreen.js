import { escapeHtml } from "../../escapeHtml.js";
import { ordinal } from "../../ordinal.js";
import { buildRace, debrisOf, raceEntries, raceKey } from "../../race/buildRace.js";
import { createLiveRace } from "../../race/liveRace.js";
import { simulationHz } from "../../race/raceSim.js";
import { fieldCourse } from "../../fieldCourse.js";
import { raceRoster } from "../../raceField.js";
import { overviewShots } from "../../scene/overviewShot.js";
import { leagueOf } from "../../stable/leagues.js";
import { finishLeagueRace, liveRaceOf } from "../../stable/leagueRace.js";
import { leaveLiveRace, rejoinLiveRace, settleUnwatched } from "../../stable/unwatchedRace.js";
import { markReinsInvited, markReinsTaught, reinsInviteDue, reinsTaught } from "../../stable/reinsLesson.js";
import { createRaceReins } from "../raceReins.js";
import { createReinsTour } from "../reinsTour.js";
import { sampleRace } from "../../race/sampleRace.js";
import { commentaryAt } from "../../race/commentary.js";
import { commentaryLine } from "../commentaryLine.js";
import { raceShot } from "../../camera/raceShot.js";
import { createRaceView, projectPoint } from "../../scene/raceView.js";
import { createFrameLoop } from "../../scene/frameLoop.js";
import { createFreeCamera } from "../../scene/freeCamera.js";
import { findLeagueRace, racePath } from "../findLeagueRace.js";
import { creatureScale, speedScale } from "../../worldScale.js";
import { icon } from "../icons.js";
import { createCountdown } from "../countdownOverlay.js";
import { createCatchUpCard } from "../catchUpCard.js";
import { createFpsCounter } from "../fpsCounter.js";
import { createHitFloats } from "../hitFloats.js";
import { createEffectBadges } from "../effectBadges.js";
import { courseLabel, leagueName } from "../leagueLook.js";
import { injuryName } from "../blockText.js";
import { language, t as text } from "../../i18n.js";
import { LEAD_IN } from "../../race/countdown.js";
import { createRaceAudio } from "../../sound/raceAudio.js";

const cameras = ["director", "rider", "free"];
const speeds = [1, 2, 4];
const BOARD_ROWS = 3,
  CLOSE_GAP = 1,
  LINE_HOLD = 5000,
  HUD_EVERY = 150,
  END_HOLD = 1200,
  HAND_BACK = 1.5;
const decimals = (value, digits, pad = 1) =>
  new Intl.NumberFormat(language(), { minimumIntegerDigits: pad, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const clock = (time) => {
  const t = Math.max(0, time);
  return `${Math.floor(t / 60)}:${decimals(Math.floor((t % 60) * 10) / 10, 1, 2)}`;
};

/**
 * The broadcast of a league race or the exhibition field, full screen: the director, onboard
 * and free cameras, the owned dragon's position, the leaderboard and the commentator, with pause,
 * speed and skip. A league race on air (`#/live/<league>`) is flown live with the owner's dragon on
 * Autopilot: Take the reins hands it to the owner, with the chase or rider camera, the stick and
 * the gauges instead of the broadcast chrome, and Autopilot hands it back to the director. It is
 * recorded when it finishes and the results follow; left before then, it flies on by itself
 * (`leaveLiveRace`) and coming back rejoins it where it has got to. A past race is replayed from
 * its field and ride; an exhibition holds on the finish with the whole order. One WebGL context
 * serves every visit, and the loop runs only while the screen is shown.
 */
export function createBroadcastScreen(ctx) {
  const { module, game } = ctx;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const el = document.createElement("section");
  el.className = "screen broadcast";
  el.innerHTML = `
    <canvas class="broadcast__view" data-i18n-label="broadcastScreen.view"></canvas>
    <div class="broadcast__tags" data-tags></div>
    <div class="broadcast__top">
      <div class="dz-ribbon broadcast__ribbon">
        <span class="dz-ribbon__main">
          <button type="button" class="broadcast__close" data-action="close" data-i18n-label="broadcastScreen.leave">${icon("chevronLeft")}</button>
          <span class="broadcast__title" data-title></span>
        </span>
        <span class="dz-ribbon__sub" data-ribbon-sub><span class="broadcast__mode" data-mode hidden></span><span data-sub></span><span class="broadcast__clock" data-clock>0:00.0</span></span>
      </div>
      <button type="button" class="dz-badge broadcast__badge" data-action="focus" hidden>
        <span class="dz-badge__label" data-badge-name></span>
        <span data-badge-place></span>
        <span class="dz-badge__delta" data-badge-gap></span>
        <span class="dz-progress broadcast__progress" data-badge-progress role="progressbar" data-i18n-label="broadcastScreen.progress" aria-valuemin="0" aria-valuemax="100"></span>
      </button>
    </div>
    <ol class="dz-list dz-list--compact broadcast__board" data-board data-i18n-label="broadcastScreen.leaderboard"></ol>
    <div class="broadcast__foot">
      <div class="dz-dialog broadcast__dialog">
        <span class="dz-avatar broadcast__avatar">${icon("mic")}</span>
        <p class="dz-dialog__line" aria-live="polite"><span class="dz-dialog__tag" data-i18n="broadcastScreen.raceControl"></span><span data-line></span></p>
      </div>
      <button type="button" class="dz-btn dz-btn--primary dz-btn--sm broadcast__reins" data-action="reins" hidden></button>
      <div class="broadcast__controls">
        <button type="button" class="dz-btn dz-btn--dark dz-btn--sm broadcast__control broadcast__camera" data-action="camera" aria-label="${text("broadcastScreen.camera")}">${icon("video")}<span class="dz-btn__label" data-camera-label>${text("broadcastScreen.cameras.director")}</span></button>
        <button type="button" class="dz-btn dz-btn--dark dz-btn--sm dz-btn--icon broadcast__control" data-action="play" aria-label="${text("broadcastScreen.pause")}"></button>
        <button type="button" class="dz-btn dz-btn--dark dz-btn--sm dz-btn--icon broadcast__control" data-action="speed" data-i18n-label="broadcastScreen.playbackSpeed"><span class="dz-btn__label" data-speed>1×</span></button>
        <button type="button" class="dz-btn dz-btn--accent dz-btn--sm dz-btn--icon broadcast__control" data-action="skip" data-i18n-label="broadcastScreen.skip">${icon("flagFinish")}</button>
      </div>
    </div>`;
  const $ = (selector) => el.querySelector(selector);

  /** Words the fixed chrome in the current language. */
  function relabel() {
    for (const node of el.querySelectorAll("[data-i18n-label]")) node.setAttribute("aria-label", text(node.dataset.i18nLabel));
    for (const node of el.querySelectorAll("[data-i18n]")) node.textContent = text(node.dataset.i18n);
  }
  relabel();
  const canvas = $(".broadcast__view");
  const view = createRaceView(module, canvas, { adaptive: true });
  const free = createFreeCamera();
  const tags = new Map();
  const hitFloats = createHitFloats($("[data-tags]"));
  const effectBadges = createEffectBadges($("[data-tags]"));
  const countdown = createCountdown();
  $("[data-tags]").after(countdown.el);
  const catchUp = createCatchUpCard();
  $("[data-tags]").after(catchUp.el);
  const fps = createFpsCounter();
  const reins = createRaceReins(canvas, { onCommand: (command) => live?.give(command) });
  $("[data-tags]").after(reins.el);
  const tour = createReinsTour(el, { onClose: () => showMode() });
  el.append(tour.el, fps.el);
  const state = { t: -LEAD_IN, playing: true, speed: 1, camera: "director", focus: null, style: ctx.style() };
  let visible = false,
    race = null,
    builtKey = null,
    buildVersion = 0,
    target = null,
    owned = new Set(),
    names = new Map(),
    lastHud = 0,
    lastLine = null,
    lineAt = 0,
    lastShot = null,
    ended = null,
    live = null,
    lastEvents = -1,
    viewProjection = null,
    /** A dev tool's camera, `(race, t) => shot`, in place of the broadcast's own; null for the broadcast's. */
    scripted = null;


  function setPlaying(value) {
    state.playing = value;
    const button = $('[data-action="play"]');
    button.innerHTML = icon(value ? "pause" : "play");
    button.setAttribute("aria-label", text(value ? "broadcastScreen.pause" : "broadcastScreen.play"));
  }

  /** The camera button's label: the director's camera, or the ride camera while riding. */
  function cameraLabel() {
    const label = text(`broadcastScreen.cameras.${live?.riding ? reins.camera : state.camera}`);
    $("[data-camera-label]").textContent = label;
    $('[data-action="camera"]').setAttribute("aria-label", text("broadcastScreen.cameraIs", { camera: label }));
  }

  /** Shows which mode the race on air is in: the broadcast on Autopilot, the rider's frame and controls when riding. */
  function showMode() {
    const riding = Boolean(live?.riding);
    el.classList.toggle("is-live", Boolean(live));
    el.classList.toggle("is-riding", riding);
    $("[data-mode]").hidden = !live;
    $("[data-mode]").textContent = text(riding ? "broadcastScreen.riding" : "broadcastScreen.autopilot");
    const detailed = Boolean(target?.exhibition);
    $("[data-sub]").hidden = $("[data-clock]").hidden = !detailed;
    $("[data-ribbon-sub]").hidden = !live && !detailed;
    const button = $('[data-action="reins"]');
    button.hidden = !live;
    button.className = `dz-btn dz-btn--sm broadcast__reins ${riding ? "dz-btn--surface" : "dz-btn--primary"}`;
    button.innerHTML = riding ? `${icon("bolt")}<span class="dz-btn__label">${text("broadcastScreen.autopilot")}</span>` : `${icon("race")}<span class="dz-btn__label">${text("broadcastScreen.takeReins")}</span>`;
    reins.enable(riding && !tour.active, riding);
    cameraLabel();
    lastHud = 0;
  }

  /** Holds the first race on Autopilot while the stable hand explains it and points at Take the reins; seen once shown. */
  function openInvite() {
    markReinsInvited(game.stable);
    ctx.save();
    tour.autopilot(names.get(target.live.dragon) ?? text("broadcastScreen.yourDragon"));
    showMode();
  }

  /** Takes the reins of the owner's dragon or hands it back; the first time, the race holds while the controls are shown one by one. */
  function setReins(on) {
    tour.dismiss();
    if (!live || on === live.riding) return showMode();
    const id = target.live.dragon;
    if (on && sampleRace(race.recording, state.t).racers.find((r) => r.id === id)?.finished) return showMode();
    live.reins(on);
    if (on) {
      state.speed = 1;
      $("[data-speed]").textContent = "1×";
      const breath = reins.start(race.entries.get(id), race.recording.roster.find((e) => e.id === id)?.stats.recharge);
      if (!reinsTaught(game.stable)) {
        markReinsTaught(game.stable);
        ctx.save();
        tour.riding(breath ? text(`breathReveal.elements.${breath.id}`) : null);
      }
    }
    showMode();
  }

  function setCamera(mode) {
    if (mode === "free" && lastShot) {
      const [dx, dy, dz] = lastShot.eye.map((v, i) => v - lastShot.target[i]);
      const d = Math.hypot(dx, dy, dz);
      Object.assign(free.state, { yaw: Math.atan2(dz, dx), pitch: Math.asin(dy / d), distance: d, follow: true });
    }
    state.camera = mode;
    cameraLabel();
    el.classList.toggle("is-free", mode === "free");
  }

  /** The dragon the badge, the rider camera and the free camera follow: an owned one, else the leader. */
  function focusOf(sample) {
    if (state.focus && sample.racers.some((r) => r.id === state.focus)) return state.focus;
    const ours = sample.racers.filter((r) => owned.has(r.id)).sort((a, b) => a.place - b.place);
    return (ours[0] ?? sample.racers.find((r) => r.place === 1) ?? sample.racers[0])?.id ?? null;
  }

  /** A league race: owned dragons are followed and the results follow the finish. */
  function leagueSource(params) {
    const index = Number(params.race);
    const found = findLeagueRace(game.stable, params.league, Number(params.season), index);
    if (!found) return null;
    const { league, season, race: record } = found;
    return {
      field: record.field,
      ride: record.ride ?? null,
      title: text("broadcastScreen.title", { league: leagueName(league.id), race: index + 1 }),
      sub: text("broadcastScreen.season", { season: season.number }),
      owned: new Set(record.results.filter((r) => r.owned).map((r) => r.id)),
      close: `#/league/${encodeURIComponent(league.id)}`,
      results: `#/results/${racePath(league.id, season.number, index)}`,
    };
  }

  /** The race on air in a league, rejoined where it has flown to: flown live, recorded at the finish, then its results. */
  function liveSource(params) {
    const league = leagueOf(params.league);
    const onAir = league ? rejoinLiveRace(game.stable, league.id, game.now()) : null;
    if (!onAir) return null;
    const season = game.stable.leagues[league.id];
    return {
      live: onAir,
      leagueId: league.id,
      field: onAir.field,
      title: text("broadcastScreen.title", { league: leagueName(league.id), race: season.races.length + 1 }),
      sub: text("broadcastScreen.season", { season: season.number }),
      owned: new Set([onAir.dragon]),
      close: `#/league/${encodeURIComponent(league.id)}`,
      results: null,
    };
  }

  /** The exhibition field: nobody is owned and the finish holds with the full order on the board. */
  const exhibitionSource = () => ({ field: ctx.field, title: text("broadcastScreen.exhibition"), sub: text("broadcastScreen.raceSeed", { seed: ctx.field.raceSeed }), owned: new Set(), close: "#/dev/field", results: null, exhibition: true });

  async function show(source) {
    relabel();
    tour.dismiss();
    target = source;
    const { field } = source;
    $("[data-title]").textContent = source.title;
    $("[data-sub]").textContent = text("broadcastScreen.sub", { sub: source.sub, course: courseLabel(field.courseType) });
    owned = source.owned;
    names = new Map(field.participants.map((p) => [p.id, p.name]));
    state.t = source.live?.step ? source.live.step / simulationHz : -LEAD_IN;
    state.speed = 1;
    state.focus = null;
    $("[data-speed]").textContent = "1×";
    lastLine = null;
    ended = null;
    live = null;
    viewProjection = null;
    setCamera("director");
    setPlaying(true);
    showMode();
    loop.start();
    const key = source.live ? null : raceKey(field, source.ride);
    if (key && key === builtKey && race) return;
    const version = ++buildVersion;
    race = null;
    ctx.loading.show(text(`broadcastScreen.loading.${source.live?.step ? "back" : field.courseType === "canyon" ? "canyon" : "valley"}`));
    await new Promise((resolve) => {
      requestAnimationFrame(() => setTimeout(resolve));
      setTimeout(resolve, 100);
    });
    if (version !== buildVersion || !visible) return;
    const built = source.live ? goLive(source.live) : buildRace(module, field, source.ride);
    if (version !== buildVersion) return;
    race = built;
    builtKey = key;
    lastEvents = -1;
    resetTags();
    if (live) reins.start(race.entries.get(source.live.dragon), race.recording.roster.find((e) => e.id === source.live.dragon)?.stats.recharge);
    showMode();
    ctx.loading.hide();
  }

  /** Puts the race on air live, resumed where it stopped and caught up for the director; returns the race the view draws. */
  function goLive(onAir) {
    const { field } = onAir;
    const course = fieldCourse(field);
    const flight = createLiveRace({ seed: field.raceSeed, course, roster: raceRoster(field), ride: onAir.ride, step: onAir.step });
    flight.advance(Math.max(0, state.t), Infinity);
    live = flight;
    return {
      course,
      entries: raceEntries(module, field, flight.recording.roster),
      overviews: overviewShots(course),
      landings: [],
      get recording() {
        return flight.recording;
      },
      get director() {
        return flight.director;
      },
    };
  }

  /** Records the race on air with the finished `recording` and opens its results. */
  function finishLive(recording) {
    const { leagueId } = target;
    const number = game.stable.leagues[leagueId].number;
    live = null;
    showMode();
    loop.stop();
    const run = finishLeagueRace(game.stable, leagueId, recording.results, game.now());
    if (!run) return location.replace(target.close);
    ctx.save();
    for (const { name, injury } of run.injuries) ctx.notify(text("broadcastScreen.injured", { name, injury: injuryName(injury).toLowerCase() }));
    location.replace(`#/results/${racePath(leagueId, number, run.race.index)}`);
  }

  /** Keeps how far the race on air has flown on the stable, so a closed app resumes it there. */
  function keepLive() {
    if (live && target?.live) target.live.step = live.step;
  }

  /** Leaves the race on air being shown, if any, to fly on by itself; a race already at its finish keeps that finish at once. */
  function leaveLive() {
    if (!target?.live || target.live.left != null || liveRaceOf(game.stable, target.leagueId) !== target.live) return;
    live?.reins(false);
    const left = leaveLiveRace(game.stable, target.leagueId, live?.step ?? target.live.step, game.now());
    if (live?.done) settleUnwatched(left, live.recording);
    live = null;
    ctx.save();
  }

  function resetTags() {
    const host = $("[data-tags]");
    host.replaceChildren();
    tags.clear();
    for (const [id, entry] of race.entries) {
      const tag = document.createElement("div");
      tag.className = `broadcast__tag${owned.has(id) ? " is-owned" : ""}`;
      tag.style.setProperty("--c", entry.color);
      host.append(tag);
      tags.set(id, tag);
    }
    hitFloats.reset(race.entries.keys());
    effectBadges.reset(race.entries.keys());
  }

  function updateTags(sample, shot, m) {
    const w = canvas.clientWidth,
      h = canvas.clientHeight;
    for (const r of sample.racers) {
      const tag = tags.get(r.id);
      if (!tag) continue;
      const lift = 5 * (race.entries.get(r.id)?.anatomy.scale ?? creatureScale);
      const at = projectPoint(m, [r.position[0], r.position[1] + lift, r.position[2]], w, h);
      const shown = at.visible && !((shot.shot === "rider" || shot.shot === "chase") && shot.subject === r.id);
      tag.hidden = !shown;
      if (!shown) continue;
      const label = owned.has(r.id) ? `${r.place} ${names.get(r.id) ?? ""}` : String(r.place);
      if (tag.textContent !== label) tag.textContent = label;
      tag.style.opacity = owned.has(r.id) ? 1 : Math.max(0.45, Math.min(0.95, (400 * creatureScale) / at.depth));
      countdown.place(tag, at.x, at.y, projectPoint(m, [r.position[0], r.position[1] - lift / 2, r.position[2]], w, h).y);
    }
    const ours = (r) => !owned.size || owned.has(r.id);
    effectBadges.update(sample.racers, state.t, (id) => tags.get(id), ours);
    hitFloats.update(race.recording, sample.racers, state.t, (r) => {
      const lift = 5 * (race.entries.get(r.id)?.anatomy.scale ?? creatureScale);
      return projectPoint(m, [r.position[0], r.position[1] + lift, r.position[2]], w, h);
    }, (r, hit) => ours(r) || owned.has(hit.other));
  }

  function updateHud(sample, focus) {
    const ordered = [...sample.racers].sort((a, b) => a.place - b.place);
    const leader = ordered[0];
    const finished = new Map(race.recording.events.filter((e) => e.type === "finish" && e.t <= state.t).map((e) => [e.racer, e.t]));
    const gapOf = (r) => {
      if (finished.has(r.id)) return clock(finished.get(r.id));
      if (r === leader || state.t <= 0) return "";
      return `+${decimals(Math.max(0, (leader.progress - r.progress) / Math.max(12 * speedScale, r.speed || 0)), 1)}`;
    };
    const full = target.exhibition && state.t >= race.recording.duration;
    const rows = ordered.filter((r, i) => full || i < BOARD_ROWS || owned.has(r.id));
    $("[data-board]").innerHTML = rows
      .map(
        (r) => `<li class="dz-list__item${owned.has(r.id) ? " is-highlight" : ""}">
          <span class="dz-list__rank">${r.place}</span>
          <span class="broadcast__row"><i class="broadcast__swatch" style="background:${race.entries.get(r.id).color}"></i><span class="broadcast__name">${escapeHtml(names.get(r.id) ?? r.id)}</span>${full ? `<small>${gapOf(r)}</small>` : ""}</span>
        </li>`,
      )
      .join("");
    $("[data-clock]").textContent = clock(state.t);

    const subject = sample.racers.find((r) => r.id === focus);
    $('[data-action="focus"]').hidden = !subject;
    if (subject) {
      const ahead = ordered[subject.place - 2],
        behind = ordered[subject.place];
      const pace = Math.max(12 * speedScale, subject.speed || 0);
      const gap = ahead ? Math.max(0, (ahead.progress - subject.progress) / pace) : behind ? Math.max(0, (subject.progress - behind.progress) / Math.max(12 * speedScale, behind.speed || 0)) : Infinity;
      $("[data-badge-name]").textContent = names.get(subject.id) ?? subject.id;
      $("[data-badge-place]").innerHTML = ordinal(subject.place).replace(/(\d+)(\D+)/, "$1<sup>$2</sup>");
      $("[data-badge-gap]").textContent = subject.finished
        ? text("broadcastScreen.finished")
        : state.t <= 0 || gap >= CLOSE_GAP
          ? ""
          : `${ahead ? "+" : "−"}${decimals(gap, 2)}s`;
      const flown = subject.finished ? 100 : Math.round(Math.max(0, Math.min(1, subject.progress / race.course.gates.at(-1).s)) * 100);
      const progress = $("[data-badge-progress]");
      progress.style.setProperty("--value", flown);
      progress.setAttribute("aria-valuenow", flown);
      $('[data-action="focus"]').classList.toggle("is-owned", owned.has(subject.id));
    }

    const line = commentaryAt(race.recording, state.t, { owned, place: race.course.type === "canyon" ? "canyon" : "valley" });
    if (line && line.key !== lastLine) {
      lastLine = line.key;
      lineAt = performance.now();
      $("[data-line]").textContent = commentaryLine(line.event, names) ?? "";
      $(".broadcast__dialog").classList.toggle("is-owned", line.owned);
    }
    $(".broadcast__dialog").classList.toggle("is-quiet", !line || performance.now() - lineAt > LINE_HOLD);
  }

  const sound = createRaceAudio();
  const loop = createFrameLoop((dt, now) => {
    if (!race) return;
    const riding = Boolean(live?.riding);
    if (live && !tour.active && race.director && reinsInviteDue(game.stable, live.riding)) openInvite();
    if (state.playing && !tour.active) {
      const pace = !riding && state.camera === "director" && race.director ? race.director.pace(state.t) : 1;
      state.t += dt * state.speed * pace;
      if (!live) state.t = Math.min(race.recording.duration, state.t);
    }
    if (live) {
      live.advance(Math.max(0, state.t));
      state.t = Math.min(state.t, race.recording.duration);
      keepLive();
      if (race.recording.events.length !== lastEvents) {
        lastEvents = race.recording.events.length;
        race.landings = debrisOf(race.recording);
      }
    }
    const complete = live ? live.done : Boolean(target.results);
    if (complete && state.t >= race.recording.duration) {
      ended ??= now;
      if (now - ended > END_HOLD) {
        sound.stop();
        if (live) return finishLive(race.recording);
        loop.stop();
        return location.replace(target.results);
      }
    }
    const sample = sampleRace(race.recording, state.t);
    const focus = focusOf(sample);
    const motion = reducedMotion ? 0.25 : 1;
    const ours = live ? sample.racers.find((r) => r.id === target.live.dragon) : null;
    let framed = null,
      marker = null;
    if (scripted) framed = { shot: scripted(race, state.t), previous: state.t > 0 ? scripted(race, state.t - 1 / 60) : null };
    else if (ours && (riding || !race.director)) {
      framed = reins.shot(ours, state.t, dt, { motion, chase: !riding });
      if (riding && !ours.finished) marker = reins.marker(race.course.gates[ours.gate], viewProjection);
    }
    const { shot, previous } =
      framed ??
      raceShot(race, state.t, {
        camera: state.camera,
        rider: focus,
        free,
        follow: sample.racers.find((r) => r.id === focus)?.position,
        motion,
        aspect: canvas.clientWidth / Math.max(1, canvas.clientHeight),
        focus: [...owned],
      });
    const onboard = riding && reins.camera === "rider" ? ours?.id : null;
    const drawn = view.draw(race, state.t, { shot, previous, style: state.style, blur: !reducedMotion, reducedMotion, onboard, marker });
    viewProjection = drawn.viewProjection;
    if (riding && ours) {
      reins.update(ours, state.t, { gate: race.course.gates[ours.gate], gates: race.course.gates.length, viewProjection, state: live.state });
      const done = race.recording.events.find((e) => e.type === "finish" && e.racer === ours.id);
      if (done && state.t > done.t + HAND_BACK) setReins(false);
    } else reins.clear();
    catchUp.update(live?.catchingUp ?? null, now);
    lastShot = shot;
    sound.update({
      t: state.t,
      dt,
      racers: drawn.sample.racers,
      events: race.recording.events,
      shot,
      focus,
      owned,
      ageOf: (id) => race.entries.get(id)?.age,
      playing: state.playing && !tour.active,
      speed: state.speed,
      goal: race.course.gates.at(-1).s,
    });
    tour.place();
    fps.tick(now);
    countdown.update(state.t);
    updateTags(drawn.sample, shot, drawn.viewProjection);
    el.classList.toggle("is-countdown", !countdown.el.hidden);
    if (now - lastHud > HUD_EVERY) {
      updateHud(drawn.sample, focus);
      lastHud = now;
    }
  });

  el.addEventListener("click", (e) => {
    const action = e.target.closest("[data-action]")?.dataset.action;
    if (!action || !target) return;
    if (action === "close") {
      keepLive();
      if (live) ctx.save();
      return location.replace(target.close);
    }
    if (action === "reins") return setReins(!live?.riding);
    if (action === "skip") {
      if (live) return finishLive(live.complete());
      if (target.results) return location.replace(target.results);
      if (race) state.t = race.recording.duration;
      lastHud = 0;
      return;
    }
    if (action === "play") return setPlaying(!state.playing);
    if (action === "speed") {
      state.speed = speeds[(speeds.indexOf(state.speed) + 1) % speeds.length];
      $("[data-speed]").textContent = `${state.speed}×`;
    }
    if (action === "camera" && live?.riding) {
      reins.toggleCamera();
      return cameraLabel();
    }
    if (action === "camera") setCamera(cameras[(cameras.indexOf(state.camera) + 1) % cameras.length]);
    if (action === "focus" && race && owned.size > 1) {
      const sample = sampleRace(race.recording, state.t);
      const ours = sample.racers.filter((r) => owned.has(r.id)).sort((a, b) => a.place - b.place).map((r) => r.id);
      state.focus = ours[(ours.indexOf(focusOf(sample)) + 1) % ours.length];
      lastHud = 0;
    }
  });

  const pointers = new Map();
  let pinch = null;
  canvas.addEventListener("pointerdown", (e) => {
    if (state.camera !== "free") return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener("pointermove", (e) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const span = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch) free.zoom(pinch / Math.max(1, span));
      pinch = span;
      return;
    }
    free.orbit(e.clientX - last[0], e.clientY - last[1]);
  });
  for (const type of ["pointerup", "pointercancel"])
    canvas.addEventListener(type, (e) => {
      pointers.delete(e.pointerId);
      pinch = null;
    });
  canvas.addEventListener(
    "wheel",
    (e) => {
      if (state.camera !== "free") return;
      e.preventDefault();
      free.zoom(Math.exp(e.deltaY * 0.0015));
    },
    { passive: false },
  );
  addEventListener("keydown", (e) => {
    if (!visible || e.target instanceof HTMLInputElement) return;
    if (e.code === "Escape" && tour.active) return tour.end();
    if (e.code === "KeyR" && live && !e.repeat) return setReins(!live.riding);
    if (live?.riding) return;
    if (e.code === "Space") {
      e.preventDefault();
      setPlaying(!state.playing);
    }
    if (e.code === "KeyC") $('[data-action="camera"]').click();
  });

  setPlaying(true);
  return {
    el,
    /** The race on air and a paused seek to race time `t`, for dev tools; `live` is the live race while one is flown. */
    get race() {
      return race;
    },
    get live() {
      return live;
    },
    get time() {
      return state.t;
    },
    seek(t) {
      setPlaying(false);
      state.t = t;
    },
    /** Films the race through `camera(race, t)` (a shot), or the broadcast's own cameras again with null. */
    script(camera) {
      scripted = camera;
    },
    show({ params, live: onAir }) {
      visible = true;
      ctx.stage.hide();
      leaveLive();
      const source = onAir ? liveSource(params) : params.league ? leagueSource(params) : exhibitionSource();
      if (!source) return location.replace(`#/league/${encodeURIComponent(params.league)}`);
      show(source);
    },
    hide() {
      visible = false;
      buildVersion++;
      leaveLive();
      tour.dismiss();
      showMode();
      ctx.loading.hide();
      loop.stop();
      sound.stop();
      pointers.clear();
    },
    render() {},
    tick() {},
    setStyle(id) {
      state.style = id;
    },
  };
}
