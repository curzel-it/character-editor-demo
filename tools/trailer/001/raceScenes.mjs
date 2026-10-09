import { evaluate } from "../../cdp.mjs";
import { load, startClip, FPS } from "./recorder.mjs";
import { lookScript } from "./trailerLook.js";
import { raceField } from "./stablePlan.js";
import { raceCameras } from "./raceCameras.js";

const broadcast = "window.__game.broadcast()";

/** Puts the exhibition field of the star at `age` on air and resolves to the star's racer id once the race is built. */
async function onAir({ session, errors, base }, age, raceSeed) {
  await load(session, `${base}/`, "window.__game", errors);
  const id = await evaluate(session, raceField(age, raceSeed, 5));
  await load(session, `${base}/?dev=true&on-air=${age}#/dev/field/race`, `${broadcast}.race && document.getElementById("loading").hidden`, errors);
  await evaluate(session, lookScript(true));
  await evaluate(session, raceCameras);
  return id;
}

/** Films race time `from` to `to` at `rate` times real speed, through `camera` (page code for a shot function) or the broadcast's own. */
async function film(session, clip, from, to, rate = 1, camera = null) {
  await evaluate(session, `(${broadcast}.script(${camera ?? "null"}), 0)`);
  const n = Math.round(((to - from) / rate) * FPS);
  for (let i = 0; i < n; i++) {
    await evaluate(session, `(${broadcast}.seek(${from + (i * rate) / FPS}), 0)`);
    await clip.frame();
  }
}

/**
 * The race half of the trailer, a clip each in `dir`: the kids on the grid through the countdown and
 * the jump off the ground, then just ahead of the star's nose as it flies; and the adult star
 * breathing fire on a rival, slowed down.
 */
export async function recordRaces(context) {
  const { session, errors, dir } = context;
  const cuts = [];

  const kid = await onAir(context, "kid", "trailer-kids");
  let clip = await startClip(session, `${dir}/race-kid.mp4`);
  await film(session, clip, -2.4, 2.4, 1, `__trailerCameras.grid(${JSON.stringify(kid)})`);
  cuts.push({ name: "takeoff", file: "race-kid.mp4", from: 0, to: clip.frames });
  const nose = clip.frames;
  await film(session, clip, 9, 13, 1, `__trailerCameras.nose(${JSON.stringify(kid)})`);
  cuts.push({ name: "nose", file: "race-kid.mp4", from: nose, to: clip.frames });
  await clip.close();

  let adult = null,
    breath = null;
  for (let n = 0; n < 8 && !breath; n++) {
    adult = await onAir(context, "adult", `trailer-adults-${n}`);
    breath = await evaluate(
      session,
      `${broadcast}.race.recording.events.find((e) => e.type === "breath" && e.racer === ${JSON.stringify(adult)} && e.other && e.t > 6) ?? null`,
    );
  }
  if (!breath) throw new Error("The adult star never breathes on a rival");
  clip = await startClip(session, `${dir}/race-adult.mp4`);
  const fire = `__trailerCameras.fire(${JSON.stringify(adult)}, ${JSON.stringify(breath.other)})`;
  await film(session, clip, breath.t - 1.4, breath.t - 0.2, 1, fire);
  await film(session, clip, breath.t - 0.2, breath.t + 2.2, 0.5, fire);
  cuts.push({ name: "fire", file: "race-adult.mp4", from: 0, to: clip.frames, breath });
  await clip.close();

  if (errors.length) throw new Error(errors.join("\n"));
  return cuts;
}
