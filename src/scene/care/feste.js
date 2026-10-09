const PERK = 0.3,
  SETTLE = 0.6,
  GROUND = 0.3;

/**
 * How each age greets: `hops` hops of `beat` seconds, `height` body sizes high and leaning back by
 * `lean`, the wings fluttering `flutter` open, freed from the fold and raised when `free` or opened out
 * of the stance otherwise, the tail wagging `wag` radians `wagRate` times a second, the mouth `smile`
 * open, and its `calls` as `[seconds, stable sound, rate]`.
 */
const ages = {
  kid: { hops: 5, beat: 0.4, height: 0.14, flutter: 0.6, free: true, wag: 0.55, wagRate: 4, smile: 0.6, lean: 0.6, calls: [[0.35, "chirpKid", 1.15], [1.05, "chirpKid", 1.3], [1.85, "chirpKid", 1.2]] },
  teen: { hops: 3, beat: 0.46, height: 0.1, flutter: 0.4, wag: 0.42, wagRate: 3.2, smile: 0.45, lean: 0.45, calls: [[0.4, "chirpTeen", 1.1], [1.2, "chirpTeen", 1.2]] },
  adult: { hops: 2, beat: 0.55, height: 0.05, flutter: 0.15, wag: 0.25, wagRate: 2.2, smile: 0.25, lean: 0.2, calls: [[0.45, "chirpTeen", 0.8]] },
};

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const ease = (t) => t * t * (3 - 2 * t);
const rise = (since, from, to) => ease(clamp01((since - from) / (to - from)));
const bump = (since, from, to) => (since > from && since < to ? Math.sin((Math.PI * (since - from)) / (to - from)) : 0);

/**
 * Fare le feste: a dragon greeting its owner back like a happy dog. It perks up, hops on its hind
 * legs with the wings fluttering half open, the tail wagging, a smile and the head up and turned to
 * the yard's camera, and settles.
 * Kids go wild, teens are keen and adults give two polite hops. A reaction as in `careReactions`,
 * with the `calls` it makes as `[seconds, stable sound, rate]`.
 * @param {"kid" | "teen" | "adult" | string} age
 */
export function festeOf(age) {
  const { hops, beat, height, flutter, free = false, wag, wagRate, smile, lean, calls } = ages[age] ?? ages.kid;
  const end = PERK + hops * beat;
  const length = end + SETTLE;
  return {
    length,
    calls,
    motion(since) {
      const joy = rise(since, 0, PERK) * (1 - rise(since, end, length));
      const hop = Math.floor((since - PERK) / beat);
      const u = (since - PERK) / beat - hop;
      const hopping = hop >= 0 && hop < hops;
      const air = hopping && u > GROUND ? (u - GROUND) / (1 - GROUND) : 0;
      const flight = air > 0 ? 4 * air * (1 - air) : 0;
      const coil = hopping && u <= GROUND ? Math.sin((Math.PI * u) / GROUND) : 0;
      const flap = flutter * joy * (0.6 + 0.4 * Math.sin(2 * Math.PI * 5 * since));
      const crouch = bump(since, 0.05, PERK + 0.02) + coil + 0.8 * bump(since, end - 0.02, end + 0.25);
      return {
        impact: 0.35 * crouch,
        spring: lean * (flight - 0.6 * coil),
        lift: height * flight,
        ...(free ? { wings: 0.5 * flap, wingRaise: flap } : { stand: 1 - flap }),
        glee: joy,
        roar: smile * joy * (0.7 + 0.3 * flight),
        lookPitch: joy * (0.35 - 0.4 * lean * flight),
        lookYaw: 0.5 * joy,
        tailSwing: wag * joy * Math.sin(2 * Math.PI * wagRate * since),
        tailRaise: 0.3 * joy,
      };
    },
  };
}
