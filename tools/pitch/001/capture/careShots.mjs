// Stills and clips of every care minigame being played, for the talk: a phone, a dragon whose care
// tile is the action, the frame-stepped clock and scripted touches. Writes shots/care/*.webp,
// feed.mp4, clean.mp4 and shots/care.json.
//   node tools/pitch/001/capture/careShots.mjs [--url http://127.0.0.1:8094] [--out <media dir>] [--tmp <scratch dir>] [--only warm,feed] [--no-clips]
import { spawn } from "node:child_process";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors, emulateDevice, navigate, sleep, touchAt } from "../../../cdp.mjs";
import { installVirtualClock } from "./virtualClock.js";
import { base, shotsDir, tmp } from "./args.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const only = option("only", "") ? option("only").split(",") : null;
const peekDir = option("peek") && resolve(tmp, option("peek"));
const clips = !args.includes("--no-clips");
const out = shotsDir("care");
const PHONE = { width: 390, height: 844, dpr: 2.5 };
const FPS = 30;
const FRAME = 1000 / FPS;

/** The dragons the shots use: seeded genomes dressed in named colours. */
const LOOKS = {
  rose: { seed: 537, colors: { scales: "rose", wings: "lavender", underside: "ivory" }, genes: { markings: 0 } },
  azure: { seed: 21, colors: { scales: "azure", wings: "turquoise", underside: "ivory" } },
  emerald: { seed: 44, colors: { scales: "fern", wings: "lime", underside: "mint" } },
  ember: { seed: 12, colors: { scales: "ember", wings: "amber", underside: "sand" } },
  amethyst: { seed: 73, colors: { scales: "violet", wings: "rose", underside: "lavender" } },
  tangerine: { seed: 90, colors: { scales: "tangerine", wings: "coral", underside: "sand" } },
  sky: { seed: 8, colors: { scales: "sky", wings: "mint", underside: "ivory" } },
};

/** Runs in the page: seeds the stable with `dragons` (and `eggs`) and wraps every minigame so the shots can see it. */
async function pageSeed({ dragons, eggs, looks }) {
  const { createDragon } = await import("/src/stable/createDragon.js");
  const { createEgg } = await import("/src/stable/egg.js");
  const { loadSubject, makeGenome } = await import("/src/subjects.js");
  const { needsOf } = await import("/src/stable/care.js");
  const { colourIndex } = await import("/src/palette.js");
  const { createOwner } = await import("/src/stable/owner.js");
  const genes = (await loadSubject("dragon")).genes;
  const stable = window.__game.game.stable;
  const now = stable.clock.game;
  const made = dragons.map((d, i) => {
    const look = looks[d.look];
    const genome = { ...makeGenome(genes, look.seed), ...Object.fromEntries(Object.entries(look.colors).map(([k, v]) => [k, colourIndex(v)])), ...(look.genes ?? {}), ...(d.genes ?? {}) };
    const dragon = createDragon({ seed: `talk-${d.look}-${i}`, genome, age: d.age, now, strength: d.strength ?? 2.4 });
    if (d.name) dragon.name = d.name;
    for (const n of needsOf(dragon.age)) dragon.care[n.id] = n.id === d.low ? (d.level ?? 12) : 92 - 3 * i;
    dragon.bond = 0.5;
    return dragon;
  });
  stable.dragons = made;
  stable.owner = { ...createOwner("talk-owner"), name: "Sam" };
  stable.eggs = (eggs ?? []).map((seed) => createEgg(seed, now - 30 * 60_000));
  stable.wild = [];
  stable.welcomed = true;
  stable.careTaught = true;
  stable.reinsTaught = true;
  stable.reinsInvited = true;
  stable.raceHint = "done";
  stable.highscores = { feed: 12, volleyball: 24, fetch: 600, clean: 2000, exercise: 40, groom: 6, warm: 600 };
  window.__game.save();
  return [...stable.eggs.map((e) => e.id), ...made.map((d) => d.id)];
}

/** Runs in the page once the stable is up: every minigame records itself and its last view on `window.__mg`, played from a fixed seed. */
async function pageHook(seed) {
  const { minigames } = await import("/src/minigames/minigames.js");
  for (const list of Object.values(minigames))
    for (const def of list) {
      def.original ??= def.create;
      def.create = (options) => {
        const game = def.original({ ...options, seed });
        const update = game.update;
        game.update = (view) => {
          window.__mg.view = view;
          return update.call(game, view);
        };
        window.__mg = { id: def.id, game, options, view: null };
        return game;
      };
    }
  const math = await import("/src/math3d.js");
  const { spotPoints } = await import("/src/minigames/coatSpots.js");
  const { scratchSpots } = await import("/src/minigames/scratchSpots.js");
  const canvasBox = () => document.querySelector(".yard canvas").getBoundingClientRect();
  /** The viewport point of world point `p`. */
  const screen = (p) => {
    const q = window.__mg.view.project(p);
    const box = canvasBox();
    return { x: q.x + box.left, y: q.y + box.top, front: q.front };
  };
  const bone = (racer, id, local = [0, 0, 0]) => {
    const index = racer.anatomy.bones.findIndex((b) => b.id === id);
    const model = math.multiply(math.orientation(racer.position, racer.forward, racer.bank ?? 0), math.transform(racer.anatomy.bones[0].position.map((v) => -v)));
    return math.point(math.multiply(model, math.boneMatrices(racer.anatomy, racer.pose)[index]), local);
  };
  let groomSpots = null;
  window.__talk = {
    screen,
    step: () => window.__mg?.game.step,
    /** The posed dragon's mouth, head and chest on the screen. */
    centre: () => screen(window.__mg.view.dragon.position),
    body() {
      const racer = window.__mg.view.dragon;
      const head = bone(racer, "head");
      const size = Math.max(0.5, head[1]);
      return { mouth: screen(bone(racer, "jaw", [0.06 * size, 0, 0])), head: screen(head), chest: screen(bone(racer, "chest")), centre: screen(racer.position) };
    },
    tip: () => (window.__mg.view.tip ? screen(window.__mg.view.tip) : null),
    /** Clean's mud spots on the screen, with what is left of each. */
    mud() {
      const coat = window.__mg.game.coat;
      return spotPoints(coat, window.__mg.view.dragon).map((p, i) => ({ ...screen(p), mud: coat[i].mud, foam: coat[i].foam, side: coat[i].side }));
    },
    /** Groom's itchy spots, in order, on the screen. */
    itch(found) {
      groomSpots ??= scratchSpots(window.__mg.options.anatomy, { side: 1, seed });
      const list = groomSpots.spots;
      const [p] = spotPoints([list[found % list.length]], window.__mg.view.dragon);
      return screen(p);
    },
    ball() {
      const b = window.__mg.game.ball;
      if (!b) return null;
      const box = canvasBox();
      return { x: b.x + box.left, y: b.y + box.top, r: b.r };
    },
    beat: () => window.__mg.game.beat,
    score: () => window.__mg.game.score,
  };
}

async function openPhone() {
  const session = await launch({ url: "about:blank", width: PHONE.width, height: PHONE.height });
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await emulateDevice(session, { ...PHONE, maxTouchPoints: 5 });
  await session.send("Page.addScriptToEvaluateOnNewDocument", { source: `(${installVirtualClock})()` });
  return { session, errors };
}

let visit = 0;

/** The UI's CSS transitions restart every frame under the stepped clock, so they are shown at their end. */
const settleTransitions = (session) => evaluate(session, `for (const a of document.getAnimations()) if (a instanceof CSSTransition) a.finish()`);

/**
 * Loads a stable of `dragons` (and `eggs`) on the phone, shows `focus` (an index into eggs then
 * dragons) and holds the clock; returns helpers to step it, touch the glass and shoot.
 */
async function stage(session, errors, { dragons, eggs = [], focus = 0, seed = "talk" }) {
  await navigate(session, new URL(`/?v=${++visit}`, base).href);
  if (!(await waitFor(session, "window.__game", 30000))) throw new Error(`The game did not load: ${errors.join("\n")}`);
  const ids = await evaluate(session, `(${pageSeed})(${JSON.stringify({ dragons, eggs, looks: LOOKS })})`);
  await navigate(session, new URL(`/?v=${++visit}#/stable/${encodeURIComponent(ids[focus])}`, base).href);
  if (!(await waitFor(session, `document.querySelector(".stable-home [data-action]") && document.querySelector(".yard canvas")`, 30000))) throw new Error(`No stable: ${errors.join("\n")}`);
  await evaluate(session, `(${pageHook})(${JSON.stringify(seed)})`);
  await sleep(2500);
  await evaluate(session, `document.querySelector('[data-tour="skip"]')?.click()`);
  await evaluate(session, "__clock.hold()");
  const s = {
    session,
    /** Moves the clock `ms` on in frames. */
    step: (ms = FRAME) => evaluate(session, `__clock.step(${ms}, ${Math.min(ms, 1000 / 60)})`),
    async idle(seconds) {
      const n = Math.max(1, Math.round(seconds * FPS));
      for (let i = 0; i < n; i++) await s.step(FRAME);
    },
    js: (expr) => evaluate(session, expr),
    down: (x, y) => touchAt(session, "touchStart", [[x, y]]),
    move: (x, y) => touchAt(session, "touchMove", [[x, y]]),
    up: () => touchAt(session, "touchEnd", []),
    /** Starts care action `action` from its tile, picking its `variant`th minigame. */
    async play(action, variant = 0) {
      await evaluate(session, `(() => { const r = Math.random; Math.random = () => ${variant ? 0.99 : 0}; document.querySelector('[data-action="${action}"]').click(); Math.random = r; })()`);
      await s.step(FRAME);
      if (!(await evaluate(session, "Boolean(window.__mg)"))) throw new Error(`${action} did not start a minigame`);
    },
    /** A quick look at the frame for picking moments, into the scratch folder `--peek` names. */
    async peek(name) {
      if (!peekDir) return;
      await settleTransitions(session);
      const { data } = await session.send("Page.captureScreenshot", { format: "jpeg", quality: 60, clip: { x: 0, y: 0, width: PHONE.width, height: PHONE.height, scale: 0.5 } });
      await writeFile(resolve(peekDir, `${name}.jpg`), Buffer.from(data, "base64"));
    },
    async shot(name) {
      await s.step(1);
      await settleTransitions(session);
      const { data } = await session.send("Page.captureScreenshot", { format: "webp", quality: 90 });
      const file = resolve(out, `${name}.webp`);
      await writeFile(file, Buffer.from(data, "base64"));
      console.log(file);
      return file;
    },
  };
  return s;
}

/** A clip of the stage: `frame()` steps the clock a frame and pipes a screenshot to ffmpeg, scaled to 1080x1920 with the phone's 390x844 centred on a blurred fill. */
function startClip(s, name) {
  const file = resolve(out, `${name}.mp4`);
  const ffmpeg = spawn(
    "ffmpeg",
    ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "png", "-i", "-",
      "-filter_complex", "[0:v]split[a][b];[a]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.04[bg];[b]scale=-2:1920[fg];[bg][fg]overlay=(W-w)/2:0,format=yuv420p",
      "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-r", String(FPS), file],
    { stdio: ["pipe", "inherit", "inherit"] },
  );
  const exited = new Promise((done, fail) => ffmpeg.on("exit", (code) => (code ? fail(new Error(`ffmpeg exited ${code}`)) : done())));
  return {
    async frame(between) {
      await s.step(FRAME);
      if (between) await between();
      await settleTransitions(s.session);
      const { data } = await s.session.send("Page.captureScreenshot", { format: "png", optimizeForSpeed: true });
      if (!ffmpeg.stdin.write(Buffer.from(data, "base64"))) await new Promise((done) => ffmpeg.stdin.once("drain", done));
    },
    async close() {
      ffmpeg.stdin.end();
      await exited;
      console.log(file);
    },
  };
}

/**
 * Drives a touch along `path(u)` (u 0..1) over `seconds` of game time, a sample a frame, calling
 * `each` after every step (to capture a clip frame), and lifts it unless `keep`.
 */
async function gesture(s, path, seconds, { each = null, keep = false } = {}) {
  const n = Math.max(2, Math.round(seconds * FPS));
  const p0 = path(0);
  await s.down(p0.x, p0.y);
  for (let i = 1; i <= n; i++) {
    const p = path(i / n);
    await s.move(p.x, p.y);
    if (each) await each();
    else await s.step(FRAME);
  }
  if (!keep) await s.up();
}

const shots = [];
const caption = (file, title, text) => shots.push({ file: `care/${file}`, title, caption: text });

const scenes = {
  async yard(s) {
    await s.idle(1.5);
    await s.shot("yard-hungry");
    caption("yard-hungry.webp", "A hungry kid", "Each dragon shows the one need running lowest as a care tile, so the yard always says what to do next.");
  },

  async feed(s) {
    await s.play("feed");
    await s.idle(1.6);
    const tip = await s.js("__talk.tip()");
    const { mouth } = await s.js("__talk.body()");
    const from = { x: 200, y: 560 };
    const to = { x: from.x + (mouth.x - tip.x) / 2.4, y: from.y + (mouth.y - Number(option("lift", 22)) - tip.y) / 2.4 };
    await gesture(s, (u) => ({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }), 0.35, { keep: true });
    await s.idle(0.3);
    await s.peek("feed-aim");
    await s.shot("feed");
    caption("feed.webp", "Snack toss", "Drag to aim a drumstick along the dotted arc; a clean catch fills the dragon up faster than one eaten off the grass.");
    await s.up();
    for (let i = 0; i < 60; i++) {
      await s.step(FRAME);
      await s.peek(`feed-${String(i).padStart(2, "0")}`);
    }
    console.log("score", await s.js("__talk.score()"));
  },

  async volleyball(s) {
    await s.play("play", 0);
    let touching = false, frame = 0, shotAt = null;
    for (let i = 0; i < 300; i++) {
      if (shotAt === null && (await s.js("__talk.score()")) >= 3) shotAt = i + 10;
      if (i === shotAt) await s.shot("volleyball");
      const step = await s.js("__talk.step()");
      if (step === "done" || step === "dropped" || step === "whiffed") break;
      const ball = await s.js("__talk.ball()");
      if (step === "catch" && ball && ball.y > 0.5 * PHONE.height) {
        if (!touching) await s.down(ball.x, ball.y);
        else await s.move(ball.x, ball.y);
        touching = true;
      } else if (step === "throw" && touching) {
        await s.up();
        touching = false;
        await s.idle(0.4);
        await gesture(s, (u) => ({ x: 200, y: 640 - 200 * u }), 0.14);
      }
      await s.step(FRAME);
      if (shotAt !== null && i >= shotAt - 5 && i < shotAt + 15) await s.peek(`vb-${String(frame++).padStart(3, "0")}`);
    }
    caption("volleyball.webp", "Volleyball", "Catch the ball the dragon heads back and flick it up again; every touch of the rally lifts its mood.");
  },

  async fetch(s) {
    await s.play("play", 1);
    await s.idle(1.6);
    await gesture(s, (u) => ({ x: 250 - 30 * u, y: 600 - 280 * u }), 0.4, { keep: true });
    await s.idle(0.3);
    await s.peek("fetch-aim");
    await s.up();
    await s.idle(1);
    await s.shot("fetch");
    caption("fetch.webp", "Fetch", "Drag up to aim and let go: the dragon takes off after the stick and brings back whatever it finds, cheering up as it plays.");
  },

  async clean(s) {
    caption("clean.webp", "Bath time: rinse", "Aim the hose at the suds to rinse them off, then the camera swings round for the other side.");
    caption("clean-scrub.webp", "Bath time: scrub", "Scrub the mud off with the sponge, more of it the dirtier the dragon got racing.");
    await s.play("clean");
    await s.idle(1.5);
    let frame = 0, scrubs = 0, rinses = 0;
    for (let round = 0; round < 40; round++) {
      const step = await s.js("__talk.step()");
      if (step === "done") break;
      const spots = (await s.js("__talk.mud()")).filter((m) => m.front && (step === "sponge" ? m.mud > 0 : m.foam > 0));
      if (step === "swing" || !spots.length) {
        await s.idle(0.2);
        continue;
      }
      const m = spots[0];
      const sideA = m.side === 1;
      const snap = (name, at) => async (k) => { if (sideA && k === at) await s.shot(name); };
      const scrubShot = snap("clean-scrub", scrubs === 1 ? 12 : -1), rinseShot = snap("clean", rinses === 1 ? 10 : -1);
      let k = 0;
      if (step === "sponge") scrubs++;
      else rinses++;
      if (step === "sponge") await gesture(s, (u) => ({ x: m.x + 30 * Math.sin(u * 6 * Math.PI), y: m.y + 12 * Math.cos(u * 6 * Math.PI) }), 0.6, { each: async () => { await s.step(FRAME); await scrubShot(k++); if (frame % 4 === 0) await s.peek(`clean-${String(frame / 4).padStart(3, "0")}`); frame++; } });
      else await gesture(s, (u) => ({ x: m.x + 6 * Math.sin(u * 4 * Math.PI), y: m.y }), 0.6, { each: async () => { await s.step(FRAME); await rinseShot(k++); if (frame % 4 === 0) await s.peek(`clean-${String(frame / 4).padStart(3, "0")}`); frame++; } });
    }
    console.log("score", await s.js("__talk.score()"));
  },

  async exercise(s) {
    await s.play("exercise");
    let frame = 0, jacks = 0, shotAt = null;
    for (let i = 0; i < 600; i++) {
      const beat = await s.js("__talk.beat()");
      const step = await s.js("__talk.step()");
      if (step === "done" || step === "flop") break;
      if (beat && beat.count === 0 && beat.until < 1 / FPS && beat.until > -0.05) {
        await s.down(200, 500);
        await s.up();
        if (step === "jack" && ++jacks === 2) shotAt = i + 6;
      }
      if (i === shotAt) {
        await s.step(FRAME);
        await s.shot("exercise");
        caption("exercise.webp", "Workout", "Tap on the beat to drive each rep of a quickening circuit of drills, keeping teen and adult dragons fit.");
        break;
      }
      await s.step(FRAME);
      if (i % 3 === 0) await s.peek(`ex-${String(frame++).padStart(3, "0")}`);
    }
    console.log("score", await s.js("__talk.score()"));
  },

  async groom(s) {
    caption("groom.webp", "Scratch spot", "Stroke an adult dragon's head to find the hidden itch; it leans in, closes its eyes and thumps a foot, and the bond grows.");
    await s.play("groom");
    await s.idle(1.2);
    let frame = 0;
    let shotAt = null;
    for (let round = 0; round < 12; round++) {
      const found = await s.js("__talk.score()");
      if (found >= 3) break;
      const at = await s.js(`__talk.itch(${found})`);
      await gesture(s, (u) => ({ x: at.x + 14 * Math.cos(u * 8 * Math.PI), y: at.y + 10 * Math.sin(u * 8 * Math.PI) }), 1.2, { each: async () => {
        await s.step(FRAME);
        if (shotAt === null && (await s.js("__talk.score()")) >= 1) shotAt = frame + 9;
        if (frame === shotAt) await s.shot("groom");
        if (frame % 3 === 0) await s.peek(`groom-${String(frame / 3).padStart(3, "0")}`);
        frame++;
      } });
      await s.idle(0.3);
    }
    console.log("score", await s.js("__talk.score()"));
  },

  async warm(s) {
    await s.play("nudge");
    await s.idle(1.2);
    const c = await s.js("__talk.centre()");
    const r = 70;
    let a = 0;
    const circle = () => ({ x: c.x + r * Math.cos(a), y: c.y - 10 + 0.8 * r * Math.sin(a) });
    await s.down(circle().x, circle().y);
    for (let i = 0; i < 400; i++) {
      a += 0.32;
      const p = circle();
      await s.move(p.x, p.y);
      await s.step(FRAME);
      const score = await s.js("__talk.score()");
      if (score >= 100 && i % 3 === 0) break;
    }
    await s.shot("warm");
    await s.up();
    caption("warm.webp", "Warm the egg", "Rub circles round the egg to keep it glowing just right; every warm hatches a stronger, closer dragon.");
  },
};

/** Minigame seeds whose rolls let the scripted throws land. */
const clipSeeds = { feed: "b", clean: "talk" };

const clipScenes = {
  /** A few drumsticks thrown at the mouth, each aimed with a drag and let go. */
  async feed(s) {
    await s.play("feed");
    const clip = startClip(s, "feed");
    const idle = async (seconds) => {
      for (let i = 0; i < Math.round(seconds * FPS); i++) await clip.frame();
    };
    await idle(1.2);
    for (const [lift, side] of [[18, 0], [12, 6], [20, -6]]) {
      const tip = await s.js("__talk.tip()");
      const { mouth } = await s.js("__talk.body()");
      const from = { x: 210, y: 560 };
      const to = { x: from.x + (mouth.x + side - tip.x) / 2.4, y: from.y + (mouth.y - lift - tip.y) / 2.4 };
      await gesture(s, (u) => ({ x: from.x + (to.x - from.x) * u, y: from.y + (to.y - from.y) * u }), 0.4, { keep: true, each: () => clip.frame() });
      await idle(0.25);
      const before = await s.js("__talk.score()");
      await s.up();
      await idle(0.5);
      for (let i = 0; i < 90 && (await s.js("__talk.score()")) === before && (await s.js("__talk.step()")) === "throw"; i++) await clip.frame();
      for (let i = 0; i < 120 && (await s.js("__talk.step()")) !== "throw" && (await s.js("__talk.step()")) !== "last"; i++) await clip.frame();
      await idle(0.6);
    }
    await idle(0.4);
    await clip.close();
    caption("feed.mp4", "Snack toss, played", "Three drumsticks aimed and thrown, three catches: feeding is a little game of skill, not a button.");
  },

  /** Mud scrubbed off with the sponge, then the lather hosed away. */
  async clean(s) {
    await s.play("clean");
    const clip = startClip(s, "clean");
    let frames = 0;
    const frame = async () => {
      frames++;
      await clip.frame();
    };
    for (let i = 0; i < 40; i++) await frame();
    while (frames < 285) {
      const step = await s.js("__talk.step()");
      if (step === "done") break;
      const spots = (await s.js("__talk.mud()")).filter((m) => m.front && (step === "sponge" ? m.mud > 0 : m.foam > 0));
      if (step === "swing" || !spots.length) {
        await frame();
        continue;
      }
      const m = spots[0];
      const path = step === "sponge" ? (u) => ({ x: m.x + 30 * Math.sin(u * 6 * Math.PI), y: m.y + 12 * Math.cos(u * 6 * Math.PI) }) : (u) => ({ x: m.x + 6 * Math.sin(u * 4 * Math.PI), y: m.y });
      await gesture(s, path, 0.6, { each: frame });
    }
    await clip.close();
    caption("clean.mp4", "Bath time, played", "Sponge the mud into lather, then hose the suds away until the dragon shines.");
  },
};

async function run(name, setup, scene) {
  const { session, errors } = await openPhone();
  try {
    const s = await stage(session, errors, { ...setup, seed: option("seed", setup.seed ?? "talk") });
    await scene(s);
    if (errors.length) console.error(errors.join("\n"));
  } finally {
    await session.close();
  }
}

const plan = [
  ["yard", { dragons: [{ look: "rose", age: "kid", low: "fullness" }, { look: "azure", age: "teen" }, { look: "ember", age: "adult" }] }, scenes.yard],
  ["feed", { dragons: [{ look: option("look", "rose"), age: option("age", "kid"), low: "fullness" }] }, scenes.feed],
  ["volleyball", { dragons: [{ look: "azure", age: "kid", low: "happiness" }] }, scenes.volleyball],
  ["fetch", { dragons: [{ look: "ember", age: "kid", low: "happiness" }] }, scenes.fetch],
  ["clean", { dragons: [{ look: "emerald", age: "kid", low: "cleanliness", level: 5 }] }, scenes.clean],
  ["exercise", { dragons: [{ look: option("look", "sky"), age: option("age", "adult"), low: "exercise" }] }, scenes.exercise],
  ["groom", { dragons: [{ look: "tangerine", age: "adult", low: "affection" }] }, scenes.groom],
  ["warm", { dragons: [{ look: "azure", age: "kid" }], eggs: [option("egg", "talk-egg-5")] }, scenes.warm],
];

await mkdir(out, { recursive: true });
for (const [name, setup, scene] of plan) if (!only || only.includes(name)) await run(name, setup, scene);
if (clips)
  for (const [name, scene] of Object.entries(clipScenes))
    if (!only || only.includes(`${name}.mp4`)) await run(name, { ...plan.find(([n]) => n === name)[1], seed: clipSeeds[name] }, scene);
const index = shotsDir("care.json");
const previous = only ? JSON.parse(await readFile(index, "utf8").catch(() => "[]")) : [];
const merged = [...previous.filter((p) => !shots.some((s) => s.file === p.file)), ...shots];
await writeFile(index, JSON.stringify(merged, null, 2) + "\n");
console.log(index);
