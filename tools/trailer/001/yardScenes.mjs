import { evaluate } from "../../cdp.mjs";
import { load, startClip, PHONE } from "./recorder.mjs";
import { createFingers, gesture, tapAt } from "./finger.mjs";
import { lookScript } from "./trailerLook.js";
import { layEgg, readyToGrow, wantsFetch, playFetch } from "./stablePlan.js";

const W = PHONE.width,
  H = PHONE.height;
const mix = (a, b, t) => a + (b - a) * t;
const ready = "document.querySelector('.stable-home [data-action]')";

/** Has the stable screen draw the stable afresh, after the trailer edited it. */
async function refresh(session, clip) {
  await evaluate(session, `(window.__game.save(), location.hash = "#/stable", 0)`);
  await clip.idle(0.1);
  await evaluate(session, `(location.hash = "#/stable/" + encodeURIComponent(window.__game.game.stable.dragons[0].id), 0)`);
  await clip.idle(0.1);
}

/** Waits, unseen, until `expression` holds in the page. */
async function until(session, clip, expression, seconds = 30) {
  for (let i = 0; i < seconds * 30; i++) {
    if (await evaluate(session, `!!(${expression})`)) return;
    await clip.idle(1 / 30);
  }
  throw new Error(`Never got: ${expression}`);
}

/**
 * The stable yard half of the trailer, each scene its own clip in `dir`: the egg tapped open, the
 * kid turned round and pinched in on its face, the kid growing into a teen, the teen fetching a
 * stick, the teen growing into an adult and the adult fetching a log.
 */
export async function recordYard({ session, errors, base, dir, only, stopAfter }) {
  const want = (name) => !only || only.includes(name);
  await load(session, `${base}/`, "window.__game", errors);
  const eggId = await evaluate(session, layEgg);
  await load(session, `${base}/?trailer#/stable/${encodeURIComponent(eggId)}`, ready, errors);
  await evaluate(session, lookScript(true));
  await evaluate(session, "new Promise((done) => setTimeout(done, 1200))");
  const fingers = createFingers(session);
  const clip = await startClip(session, `${dir}/yard.mp4`);
  const cuts = [];
  const scene = async (name, film) => {
    const from = clip.frames;
    await film();
    if (want(name)) cuts.push({ name, from, to: clip.frames });
  };

  await scene("hatch", async () => {
    await clip.play(0.9);
    const egg = [W / 2, H * 0.55];
    for (let k = 0; k < 3; k++) {
      await tapAt(clip, fingers, egg);
      await clip.play(k < 2 ? 0.55 : 0.3);
    }
    await clip.play(5.6);
  });

  const pinch = (u) => {
    const half = mix(36, 62, u);
    const c = [mix(W * 0.45, W * 0.31, u), mix(H * 0.3, H * 0.5, u)];
    return [
      [c[0] - half * 0.55, c[1] - half * 0.85],
      [c[0] + half * 0.55, c[1] + half * 0.85],
    ];
  };
  await clip.idle(4);
  await scene("inspect", async () => {
    const y = H * 0.66;
    await gesture(clip, fingers, 1.4, (u) => [[mix(W * 0.85, W * 0.12, u), y]]);
    await gesture(clip, fingers, 1.2, (u) => [[mix(W * 0.12, W * 0.85 - 60, u), y]]);
    await clip.play(0.25);
    await fingers.move([]);
    await clip.play(0.4);
    await gesture(clip, fingers, 1.6, pinch);
    await fingers.move([]);
    await clip.play(1.8);
  });
  if (stopAfter === "inspect") return finish();

  await unseen(clip, fingers, 1, (u) => pinch(1 - u));
  await evaluate(session, readyToGrow);
  await refresh(session, clip);
  await until(session, clip, `document.querySelector('[data-action="evolve"]')`);
  await scene("teen", async () => {
    await evaluate(session, `(document.querySelector('[data-action="evolve"]').click(), 0)`);
    await clip.play(3.4, 1.6);
    await clip.play(1.4);
  });
  await clip.idle(2.5);
  await evaluate(session, `(document.querySelector('[data-breath-reveal="done"]')?.click(), 0)`);
  if (stopAfter === "teen") return finish();

  await clip.idle(1.5);
  await evaluate(session, wantsFetch);
  await refresh(session, clip);
  await until(session, clip, `document.querySelector('[data-action="play"]')`);
  await evaluate(session, playFetch("stick"));
  await clip.idle(1.6);
  await scene("stick", async () => throwFetch(clip, fingers, 7.5));
  await finishGame(session, clip);

  await evaluate(session, readyToGrow);
  await refresh(session, clip);
  await until(session, clip, `document.querySelector('[data-action="evolve"]')`);
  await scene("adult", async () => {
    await evaluate(session, `(document.querySelector('[data-action="evolve"]').click(), 0)`);
    await clip.play(3.4, 1.6);
    await clip.play(1.4);
  });

  await clip.idle(1.5);
  await evaluate(session, wantsFetch);
  await refresh(session, clip);
  await until(session, clip, `document.querySelector('[data-action="play"]')`);
  await evaluate(session, playFetch("log"));
  await clip.idle(1.6);
  await throwFetch(clip, fingers, 7.5);
  await clip.idle(1);
  await scene("log", async () => throwFetch(clip, fingers, 8));
  await finishGame(session, clip);

  return finish();

  async function finish() {
    await clip.close();
    if (errors.length) throw new Error(errors.join("\n"));
    return cuts;
  }
}

/** A gesture played out unseen, the page moving on a frame at a time. */
async function unseen(clip, fingers, seconds, path) {
  const n = Math.round(seconds * 30);
  for (let i = 0; i <= n; i++) {
    await fingers.move(path(i / n));
    await clip.idle(1 / 30);
  }
  await fingers.move([]);
}

/** A throw aimed with a drag up the screen and the dragon's run after it, filmed for `seconds`. */
async function throwFetch(clip, fingers, seconds) {
  await gesture(clip, fingers, 0.55, (u) => [[mix(W * 0.62, W * 0.5, u), mix(H * 0.82, H * 0.38, u)]]);
  await fingers.move([]);
  await clip.play(seconds);
}

/** Ends the game being played, unseen. */
async function finishGame(session, clip) {
  await evaluate(session, `(document.querySelector("[data-play-done]")?.click(), 0)`);
  await clip.idle(4);
}
