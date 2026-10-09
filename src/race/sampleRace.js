import { lerp, normalize } from "../vec3.js";

const mix = (a, b, k) => a + (b - a) * k;

/**
 * Racer state at time `t`, interpolated between recorded frames; `flap` wraps around 1. Before the
 * start the racers hold their first frame, their wings still beating at the opening rate.
 */
export function sampleRace(recording, t) {
  const { frames, hz } = recording;
  if (t < 0) return beforeStart(recording, t);
  const x = Math.max(0, Math.min(frames.length - 1, t * hz)),
    i = Math.max(0, Math.min(frames.length - 2, Math.floor(x))),
    k = frames.length > 1 ? x - i : 0;
  const a = frames[i],
    b = frames[i + 1] || a;
  return {
    t,
    racers: a.racers.map((racer, n) => {
      const next = b.racers[n];
      let flap = next.flap - racer.flap;
      if (flap < -0.5) flap += 1;
      return {
        ...racer,
        position: lerp(racer.position, next.position, k),
        forward: normalize(lerp(racer.forward, next.forward, k)),
        bank: mix(racer.bank, next.bank, k),
        flap: (((racer.flap + flap * k) % 1) + 1) % 1,
        speed: mix(racer.speed, next.speed, k),
        progress: mix(racer.progress, next.progress, k),
        landing: mix(racer.landing ?? 0, next.landing ?? 0, k),
      };
    }),
  };
}

function beforeStart({ frames, hz }, t) {
  const [a, b = a] = frames;
  return {
    t,
    racers: a.racers.map((racer, n) => {
      const rate = ((((b.racers[n].flap - racer.flap) % 1) + 1) % 1) * hz;
      return { ...racer, flap: (((racer.flap + rate * t) % 1) + 1) % 1, landing: racer.landing ?? 0 };
    }),
  };
}
