import { eggAnatomy } from "../eggMesh.js";
import { breathOf } from "../breath/breathElements.js";
import { palette, standingStonePalette } from "../palette.js";
import { smoothstep } from "../animate/flightMotion.js";
import { createSoulFireworks } from "./soulFireworks.js";
import { createAltarMist } from "./altarMist.js";
import { altarPlaceProps } from "./altarPlace.js";
import { raiseShare, ritualTimeline } from "./ritualTimeline.js";
import { ritualShots, shotAt } from "./ritualShots.js";

const EGG_SIZE = 0.3,
  EGG_GLOW = 1.8;

/** Two sets of breath-shader quads as one. */
function joined(a, b) {
  if (!b.count) return a;
  const data = new Float32Array(a.data.length + b.data.length);
  data.set(a.data);
  data.set(b.data, a.data.length);
  return { data, count: a.count + b.count };
}

/**
 * The ritual show in a place with its cast: `dragons` (the parents, `{ genome }`) glide in, land in
 * formation, breathe at the altar and the fireworks play out to an egg (`look`, the egg's
 * `{ shell, spots, seed }`, when `success`) or an empty stone. Deterministic from `seed`.
 * `frame(t)` gives the scene frame's `racers`, `props`, `fireworks` and `camera` `t` seconds in,
 * plus the `shot` id; `timeline` says when everything happens.
 */
export function createRitualShow({ place, cast, dragons, success, seed, look }) {
  const timeline = ritualTimeline({ count: dragons.length, success, seed });
  const parents = cast.parents(dragons.slice(0, timeline.count));
  const elements = parents.map((p) => breathOf(p.dragon.genome).id);
  const colors = elements.map((id) => palette.elementGlow[id]);
  const show = createSoulFireworks({
    elements,
    origins: parents.map((p) => p.mouth),
    altar: place.altar.eggPoint,
    seed,
    result: success,
    radius: parents[0].anatomy.bounds.radius,
    ground: 0.02,
  });
  const hue = [0, 1, 2].map((k) => colors.reduce((sum, c) => sum + c[k], 0) / colors.length);
  const mist = success ? null : createAltarMist({ altar: place.altar.eggPoint, from: timeline.fireworks.reveal - 0.2, seed, hue });
  const effects = mist ? { build: (t, eye) => joined(show.build(t, eye), mist.build(t, eye)) } : show;
  const shots = ritualShots(timeline, { altar: place.altar, ring: place.ring, custodian: place.custodian, welcoming: cast.welcoming, parents, burst: show.orb[1] });
  let egg = null;
  if (success && look) {
    const full = eggAnatomy(look);
    const radius = full.bounds.radius * EGG_SIZE;
    egg = {
      anatomy: { ...full, parts: full.parts.map((p) => ({ ...p, scale: [EGG_SIZE, EGG_SIZE, EGG_SIZE] })), bounds: { center: [0, 0, 0], radius } },
      position: place.altar.eggPoint.map((v, i) => (i === 1 ? v + radius : v)),
    };
  }
  const reveal = timeline.breath + timeline.fireworks.reveal;

  /** The custodian's pose: raising the staff, holding it through the fireworks, then talking at the reveal. */
  function custodianAt(t) {
    const raise = raiseShare(t);
    const facing = smoothstep(timeline.cueStart - 0.6, timeline.cueStart + 0.6, t) * (1 - smoothstep(reveal + 0.4, reveal + 1.6, t));
    if (t < reveal + 0.8) return cast.custodian(t, { pose: "idle", toward: "ritual", blend: raise, facing });
    return cast.custodian(t, { pose: "ritual", toward: "talking", blend: smoothstep(reveal + 0.8, reveal + 1.8, t), facing });
  }

  function frame(t) {
    const tf = t - timeline.breath;
    const racers = [custodianAt(t)];
    parents.forEach((p, i) => {
      const r = cast.arriving(p, t, { ...timeline.arrivals[i], cueStart: timeline.cueStart });
      if (r) racers.push(r);
    });
    if (egg && t >= reveal) racers.push({ ...egg, pose: { bones: {} }, forward: [0.6, 0, 0.8], glow: Math.max(0.1, 1 - smoothstep(reveal, reveal + EGG_GLOW, t)) });
    const waking = 0.12 + 0.3 * raiseShare(t);
    let props;
    if (tf < -0.5) props = altarPlaceProps(place, { altarGlow: waking * 0.6, runeGlow: waking, colors, runeColor: standingStonePalette.rune });
    else {
      const light = show.light(Math.max(0, tf));
      const after = smoothstep(reveal, reveal + 1.5, t);
      const hum = success ? 0.35 * after : 0;
      const fade = success ? 1 : 1 - 0.7 * after;
      props = altarPlaceProps(place, {
        altarGlow: Math.max(0.1, hum, light.strength) * fade,
        runeGlow: Math.max(waking, hum, 0.2 + 0.8 * light.strength) * fade,
        colors,
        runeColor: light.color,
      });
    }
    const fireworks = tf > -0.2 && t < timeline.card + 3 ? { show: effects, t: tf } : null;
    const { id, camera } = shotAt(shots, t);
    return { racers, props, fireworks, camera, shot: id };
  }

  return { timeline, shots, parents, elements, frame };
}
