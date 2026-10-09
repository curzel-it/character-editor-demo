// Pitch-deck shots of the leagues, the Soul Altar and the awards ceremony on a phone: a stable
// mid-season in the Main Event, its ritual show and a Gold season's ceremony, as WebP stills and
// two H.264 clips. Writes shots/league/ and shots/league.json.
//   node tools/pitch/001/capture/leagueShots.mjs [--url http://127.0.0.1:8094] [--out <media dir>] [--tmp <scratch dir>] [--only league,altar,ceremony,clips]
//     [--sweep 7,14,20 (altar show frames to tmp, for picking moments)] [--altar-from s] [--altar-seconds 15]
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate, sleep } from "../../../cdp.mjs";
import { installVirtualClock } from "./virtualClock.js";
import { spawn } from "node:child_process";
import { base, shotsDir, tmp } from "./args.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const only = option("only", "league,altar,ceremony,clips").split(",");
const out = shotsDir("league");
const STILL = { width: 390, height: 844, dpr: 2.5 };
const CLIP = { width: 405, height: 720, dpr: 1080 / 405 };
const hour = 3_600_000;
const manifest = [];

/** A phone with the virtual clock in every page; real time until `__clock.hold()`. */
async function openPhone(phone) {
  const session = await launch({ url: "about:blank", width: phone.width, height: phone.height });
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await emulateDevice(session, { ...phone, maxTouchPoints: 2 });
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installVirtualClock})()` });
  await navigate(session, new URL("/", base).href);
  if (!(await waitFor(session, "window.__game", 30000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
  return { session, errors, js: (expression) => evaluate(session, expression) };
}

async function still(session, file, title, caption) {
  await mkdir(out, { recursive: true });
  const { data } = await session.send("Page.captureScreenshot", { format: "webp", quality: 90 });
  await writeFile(resolve(out, file), Buffer.from(data, "base64"));
  manifest.push({ file: `league/${file}`, title, caption });
  console.log(file);
}

/** Scrolls the screens so the `index`th match of `selector` sits `top` CSS px below the top. */
const scrollTo = (js, selector, index = 0, top = 72) =>
  js(`(() => {
    const n = [...document.querySelectorAll(${JSON.stringify(selector)})].filter((e) => e.getClientRects().length)[${index}];
    if (!n) return false;
    let s = n.parentElement;
    while (s && !(s.scrollHeight > s.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(s).overflowY))) s = s.parentElement;
    s ??= document.scrollingElement;
    s.scrollTop += n.getBoundingClientRect().top - ${top};
    return s.id || s.className || s.tagName;
  })()`);

/** Moves a held clock `ms` on in 60 Hz frames. */
async function step(js, ms) {
  for (let left = ms; left > 1e-6; left -= 1000 / 30) await js(`__clock.step(${Math.min(left, 1000 / 30)}, ${1000 / 60})`);
}

/**
 * A welcomed stable of handsome dragons: `adults` and `teens` as [preset, breath, strength, name],
 * the Main Event and Teen League run as `seasons` says ({ league: [[division, races, place?], ...] },
 * a full season closing and the next one starting in its new division), `place` forcing the owner's
 * place in each race. The stable seed is the first from `seed` whose next ritual of `ritual` parents
 * succeeds.
 */
function seedStable({ seed, adults, teens = [], seasons, ritual = 0, clear = true }) {
  return `(async () => {
    const [{ genes }, { cheatDragon }, { createStable }, { leagueOf, seasonLength, createSeason }, { runLeagueRace, startNextSeason }, { seasonEnd }, { makeRng }, { ritualOdds }, { renameOwner, dressOwner }] = await Promise.all([
      import("/src/genome/dragon.js"), import("/src/stable/cheats.js"), import("/src/stable/newStable.js"), import("/src/stable/leagues.js"),
      import("/src/stable/leagueRace.js"), import("/src/stable/seasonEnd.js"), import("/src/rng.js"), import("/src/stable/soulAltar.js"), import("/src/stable/owner.js"),
    ]);
    let seed = ${JSON.stringify(seed)}, n = 0;
    if (${ritual}) while (!(makeRng(seed + n + ":ritual:1")() < ritualOdds(${ritual}))) n++;
    const stable = createStable(genes, seed + n, Date.now());
    Object.assign(stable, { welcomed: true, careTaught: true, reinsInvited: true, reinsTaught: true, raceHint: "done" });
    const add = ([kind, breath, strength, name], age, i) => {
      const dragon = cheatDragon(genes, stable, [kind, "breath:" + breath], { age, strength, name, seed: "talk:" + age + ":" + i + ":" + kind });
      dragon.bond = 0.85;
      stable.dragons.push(dragon);
      return dragon;
    };
    ${JSON.stringify(adults)}.forEach((d, i) => add(d, "adult", i));
    ${JSON.stringify(teens)}.forEach((d, i) => add(d, "teen", i));
    const hour = 3600000;
    let at = 0;
    const { closeSeason } = await import("/src/stable/seasonEnd.js");
    const queues = Object.entries(${JSON.stringify(seasons)}).map(([league, runs]) => {
      const info = leagueOf(league), crew = stable.dragons.filter((w) => w.age === info.age), list = [];
      runs.forEach(([division, races, place], k) => {
        for (let i = 0; i < races; i++) list.push({ league, info, crew, division, k, i, place });
      });
      return list;
    });
    while (queues.some((q) => q.length))
      for (const q of queues) {
        const job = q.shift();
        if (!job) continue;
        const { league, info, crew, division, k, i, place } = job;
        if (!i) {
          if (k) startNextSeason(stable, genes, league);
          else stable.leagues[league] = createSeason(genes, info, 1, stable.seed, division);
        }
        const season = stable.leagues[league];
        const dragon = crew[i % crew.length];
        for (const w of crew) Object.assign(w, { fatigue: 0, injury: null });
        runLeagueRace(stable, league, dragon.id, (at += hour));
        if (!place) continue;
        const race = season.races.at(-1);
        const mine = race.results.find((r) => r.owned), other = race.results.find((r) => r.place === place[i % place.length]);
        const was = mine.place;
        [mine.place, other.place] = [other.place, mine.place];
        [mine.time, other.time] = [other.time, mine.time];
        race.results.sort((x, y) => x.place - y.place);
        dragon.history[0].place = mine.place;
        dragon.record.wins += (mine.place === 1) - (was === 1);
        dragon.record.podiums += (mine.place <= 3) - (was <= 3);
        if (season.end) {
          stable.seasons.shift();
          if (season.end.trophy) stable.trophies.pop();
          if (season.end.prize?.egg) stable.eggs = stable.eggs.filter((e) => e.id !== season.end.prize.egg);
          for (const w of [...(stable.wild ?? [])]) if (w.wild?.since === at) { stable.wild.splice(stable.wild.indexOf(w), 1); delete w.wild; stable.dragons.push(w); }
          season.end = null;
          closeSeason(stable, league, at);
        }
      }
    for (const w of stable.dragons) Object.assign(w, { fatigue: 0, injury: null, care: { fullness: 92, happiness: 95, cleanliness: 90, exercise: 88, affection: 93 } });
    for (const w of stable.wild ?? []) stable.dragons.length < 6 && stable.dragons.push(w);
    stable.wild = [];
    ${clear ? "stable.eggs = [];" : ""}
    stable.clock.game = at + hour;
    window.__game.game.stable = stable;
    window.__game.save();
    location.hash = "#/stable";
    return { seed: stable.seed, owner: stable.owner.name };
  })()`;
}

const shapely = [
  ["ember", "fire", 4.2, "Ember"],
  ["azure", "water", 3.9, "Tide"],
  ["amethyst", "storm", 4, "Nova"],
  ["emerald", "nature", 3.7, "Fern"],
  ["copper", "earth", 3.6, "Rusty"],
];

async function leagueScreens() {
  const { session, errors, js } = await openPhone(STILL);
  try {
    const info = await js(
      seedStable({ seed: "talk-league", adults: shapely.slice(0, 4), teens: [["bone", "storm", 2.6, "Pip"]], seasons: { adults: [["silver", 9, [2, 1, 2, 1, 3, 2, 1, 4, 2]]], teens: [["bronze", 5]] } }),
    );
    console.log(info);
    await sleep(1500);
    await js(`location.hash = "#/league"`);
    await sleep(1500);
    await still(session, "01-leagues.webp", "Three leagues", "Kids, Teens and the Main Event: every dragon races its own age class.");
    await js(`location.hash = "#/league/adults"`);
    await sleep(1500);
    await still(session, "02-league-detail.webp", "Main Event", "Mid-season in Silver: the next race, and who goes up and who goes down.");
    await scrollTo(js, ".league-section", 0);
    await sleep(600);
    await still(session, "02b-league-table.webp", "League table", "Points every race, promotion and relegation zones, and every race of the season to rewatch.");
    await js(`location.hash = "#/league/adults/entry"`);
    await sleep(2500);
    await still(session, "03-race-entry.webp", "Race entry", "Pick which of your dragons rides today, fit and rested.");
    await scrollTo(js, ".league-section", 1);
    await sleep(600);
    await still(session, "03b-race-field.webp", "The field", "Your pick lines up against seven rival stables, favourite marked.");
    await js(`location.hash = "#/race"`);
    await sleep(1500);
    await scrollTo(js, ".league-section", 0);
    await sleep(600);
    await still(session, "12-races.webp", "Races", "Every race your dragons flew, with results and a replay.");
    if (errors.length) console.warn(errors.join("\n"));
  } finally {
    await session.close();
  }
}

/** Five adults of every breath for the Soul Altar, its first ritual of five bound to lay an egg. */
const altarStable = () => seedStable({ seed: "talk-altar", adults: shapely, seasons: {}, ritual: 5 });

/** Picks every adult into the circle, begins the ritual and holds the clock; returns the show's timeline. */
async function beginRitual(js) {
  await js(`location.hash = "#/altar"`);
  await sleep(1500);
  await js(`(async () => { const ids = [...document.querySelectorAll("[data-pick]")].map((c) => c.dataset.pick); for (const id of ids) { document.querySelector('[data-pick="' + id + '"]').click(); await new Promise((r) => setTimeout(r, 80)); } })()`);
  await sleep(2500);
  return async () => {
    await js(`document.querySelector('[data-action="begin"]').click()`);
    await sleep(800);
    await js("__clock.hold()");
    await step(js, 100);
    const { timeline, hero } = await js("window.__game.altar().stage.playing");
    const at = Object.fromEntries(timeline.beats.map((b) => [b.id, b.at]));
    return { timeline, hero, at };
  };
}

async function altarScreens() {
  const { session, errors, js } = await openPhone(STILL);
  try {
    await js(altarStable());
    await sleep(1500);
    const begin = await beginRitual(js);
    await js(`document.getElementById("screens").scrollTop = 0`);
    await sleep(500);
    await still(session, "04-altar-picker.webp", "Soul Altar", "Bring your adults to the stone circle: the more who join, the better the odds of an egg.");
    const { timeline, hero, at } = await begin();
    console.log(JSON.stringify(at), timeline.arrivals[hero], timeline.card);
    const seek = async (t) => {
      await js(`window.__game.altar().stage.seek(${t})`);
      await step(js, 1000 / 30);
      await sleep(150);
    };
    const moments = [
      ["05-altar-custodian.webp", 4.6, "The custodian", "The altar's custodian raises his staff and calls the parents in."],
      ["06-altar-landing.webp", timeline.arrivals[hero].land - 1.2, "Gathering", "Each parent glides in and lands round the ring of stones."],
      ["07-altar-breath.webp", at.merge - 0.2, "Breathing together", "The parents breathe together at the altar, every element its own colour."],
      ["08-altar-fireworks.webp", at.settle - 0.4, "Fireworks", "Their breaths meet over the stone and burst into fireworks."],
      ["09-altar-egg.webp", at.reveal + 1.2, "A new egg", "The sparks settle, and a new egg lies on the altar, carrying a little of every parent."],
    ];
    await js(`document.head.insertAdjacentHTML("beforeend", "<style>.altar-show__skip{display:none!important}</style>")`);
    const sweep = option("sweep");
    if (sweep) {
      const dir = resolve(tmp, "league-sweep");
      await mkdir(dir, { recursive: true });
      for (const t of sweep.split(",").map(Number)) {
        await seek(t);
        const { data } = await session.send("Page.captureScreenshot", { format: "jpeg", quality: 70 });
        await writeFile(`${dir}/${t.toFixed(2).padStart(6, "0")}.jpg`, Buffer.from(data, "base64"));
      }
      return;
    }
    for (const [file, t, title, caption] of moments) {
      await seek(t);
      await still(session, file, title, caption);
    }
    await js(`window.__game.altar().stage.seek(${timeline.card - 0.3}, false)`);
    await step(js, 2500);
    await sleep(400);
    await step(js, 500);
    await still(session, "09b-altar-result.webp", "The egg", "The result card: the new egg and how long the parents will rest.");
    if (errors.length) console.warn(errors.join("\n"));
  } finally {
    await session.close();
  }
}

/** A Main Event season in Gold won outright: the trophy, Champions! and a prize egg. */
const ceremonyStable = () =>
  seedStable({ seed: "talk-ceremony", adults: shapely.slice(0, 4), seasons: { adults: [["gold", 16, [1, 2, 1, 1, 3, 1, 2, 1]]] }, clear: false });

async function openCeremony(js) {
  await js(ceremonyStable());
  await sleep(1500);
  await js("__clock.hold()");
  await js(`location.hash = "#/ceremony/adults/1"`);
  await step(js, 500);
  await sleep(1500);
  await js("window.__game.ceremony().stage.seek(0)");
}

async function ceremonyScreens() {
  const { session, errors, js } = await openPhone(STILL);
  try {
    await openCeremony(js);
    await step(js, 3000);
    await sleep(300);
    await still(session, "10a-ceremony-cup.webp", "The cup", "Season's end: the cup comes down over the champion's podium.");
    await step(js, 2200);
    await sleep(300);
    await still(session, "10-ceremony.webp", "Champions!", "Confetti, the cup, and your stable crowned league champions.");
    await scrollTo(js, ".ceremony__body", 0, 20);
    await step(js, 500);
    await sleep(500);
    await still(session, "11-ceremony-results.webp", "Honours", "The trophy for the cabinet and a prize egg for the stable.");
    if (errors.length) console.warn(errors.join("\n"));
  } finally {
    await session.close();
  }
}

/** Writes `frames` screenshots, each after `advance()`, to an H.264 clip. */
async function clip(session, file, count, advance) {
  await mkdir(out, { recursive: true });
  const ffmpeg = spawn("ffmpeg", ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "png", "-i", "-", "-vf", "scale=1080:1920", "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", "30", resolve(out, file)], { stdio: ["pipe", "inherit", "inherit"] });
  const exited = new Promise((done, fail) => ffmpeg.on("exit", (code) => (code ? fail(new Error(`ffmpeg exited ${code}`)) : done())));
  for (let k = 0; k < count; k++) {
    await advance(k);
    let data;
    for (let tries = 0; !data; tries++)
      try {
        ({ data } = await session.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true }));
      } catch (error) {
        if (tries >= 3) throw error;
        console.warn(`frame ${k}: ${error.message}, retrying`);
      }
    if (!ffmpeg.stdin.write(Buffer.from(data, "base64"))) await new Promise((done) => ffmpeg.stdin.once("drain", done));
  }
  ffmpeg.stdin.end();
  await exited;
  console.log(file);
}

async function clips() {
  {
    const { session, js } = await openPhone(CLIP);
    try {
      await js(altarStable());
      await sleep(1500);
      const { at } = await (await beginRitual(js))();
      const from = Number(option("altar-from", at.merge - 2.7));
      const seconds = Number(option("altar-seconds", 15));
      await js(`document.head.insertAdjacentHTML("beforeend", "<style>.altar-show__skip{display:none!important}</style>")`);
      await js(`window.__game.altar().stage.seek(${from}, false)`);
      await step(js, 1000 / 30);
      await clip(session, "altar.mp4", seconds * 30, () => step(js, 1000 / 30));
      manifest.push({ file: "league/altar.mp4", title: "The ritual", caption: "Five dragons breathe as one, their fire becomes fireworks, and an egg appears." });
    } finally {
      await session.close();
    }
  }
  {
    const { session, js } = await openPhone(CLIP);
    try {
      await openCeremony(js);
      await step(js, 1000 / 30);
      await clip(session, "ceremony.mp4", 8 * 30, () => step(js, 1000 / 30));
      manifest.push({ file: "league/ceremony.mp4", title: "Awards ceremony", caption: "The cup comes down, confetti falls, and your stable are champions." });
    } finally {
      await session.close();
    }
  }
}

const runs = { league: leagueScreens, altar: altarScreens, ceremony: ceremonyScreens, clips };
for (const name of only) await runs[name]();
const listed = shotsDir("league.json");
const kept = await readFile(listed, "utf8").then(JSON.parse, () => []);
const merged = [...kept.filter((e) => !manifest.some((m) => m.file === e.file)), ...manifest].sort((a, b) => a.file.localeCompare(b.file));
await writeFile(listed, JSON.stringify(merged, null, 2) + "\n");
