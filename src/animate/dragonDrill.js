import { rests } from "./dragonLanding.js";

// A squat bends the knee forward and rakes the shin back so the hips sink over feet that stay put.
const SQUAT = { thigh: 0.65, shin: -1.1, foot: 0.3, neck: [-0.12, 0, 0] };
// A push-up tips the body onto the hands and closes the elbows, the neck holding the head up.
const PRESS = { body: 0.25, chest: 0.08, bend: 1.4, neck: [0.25, 0.1, 0] };
// Wing jacks fling the wings up past level and out, the legs straddled.
const JACK = { raise: 1.25, sweep: 0.25, elbow: 0.3, straddle: 0.3 };
// A flop lays the neck along the ground, chin down, the wings sprawled and drooping onto it.
const FLOP = { neck: [-0.1, 0.05, 0.1], head: 0.1, droop: 0.12 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const amount = (motion, key, lo = 0) => (Number.isFinite(motion?.[key]) ? clamp(motion[key], lo, 1) : 0);

/**
 * The workout drills a standing dragon can be put through, each 0..1 in `motion`: `pushup` lowers an
 * adult's chest between its planted wing hands, `squat` sinks the hips on the hind legs, `jack` flings
 * the wings up overhead with the legs apart (with `wings` freeing them), `crunch` curls the tail up
 * over the back as the neck ducks to meet it (below 0 it stretches the other way) and `flop` sprawls
 * the dragon face down, wings out (with `sleep` lowering it).
 * @param {object} [motion]
 */
export const drillOf = (motion) => ({
  pushup: amount(motion, "pushup"),
  squat: amount(motion, "squat"),
  jack: amount(motion, "jack"),
  crunch: amount(motion, "crunch", -1),
  flop: amount(motion, "flop"),
});

/** The age's rest stance bent by the drills in `motion` (the standing pose's hands and feet replant on it), or undefined. */
export function drillRest(anatomy, motion) {
  const rest = rests[anatomy.age];
  const { pushup, squat } = drillOf(motion);
  if (!rest || (pushup <= 0 && squat <= 0)) return undefined;
  const leg = rest.leg ?? {};
  const press = rest.reach ? pushup : 0,
    sink = squat + 0.5 * press;
  return {
    ...rest,
    body: rest.body - PRESS.body * press,
    chest: rest.chest - PRESS.chest * press,
    bend: rest.bend === undefined ? undefined : rest.bend + PRESS.bend * press,
    neck: rest.neck.map((v, i) => v + PRESS.neck[i] * press + SQUAT.neck[i] * squat),
    leg: { ...leg, thigh: (leg.thigh ?? 0.49) + SQUAT.thigh * sink, shin: (leg.shin ?? 0.04) + SQUAT.shin * sink, foot: (leg.foot ?? 0.7) + SQUAT.foot * sink },
  };
}

const add = (bones, id, delta) => {
  const bone = (bones[id] ??= {});
  bone.rotation = (bone.rotation ?? [0, 0, 0]).map((v, i) => v + delta[i]);
};

const toward = (bones, id, target, k) => {
  const bone = (bones[id] ??= {});
  bone.rotation = (bone.rotation ?? [0, 0, 0]).map((v, i) => v + (target[i] - v) * k);
};

/**
 * The drills in `motion` that layer on the finished pose: the wing jack, the crunch and the flop,
 * whose wings sprawl back out to `flight`, the flight pose's wings (see `wingsOf`).
 */
export function drillPose(bones, anatomy, motion, flight) {
  const { jack, crunch, flop } = drillOf(motion);
  if (jack > 0)
    for (const side of [-1, 1]) {
      add(bones, `wing-${side}`, [-side * JACK.raise * jack, side * JACK.sweep * jack, 0]);
      add(bones, `wing-elbow-${side}`, [-side * JACK.elbow * jack, 0, 0]);
      add(bones, `leg-hind-${side}`, [-side * JACK.straddle * jack, 0, 0]);
      add(bones, `foot-hind-${side}`, [side * 0.5 * JACK.straddle * jack, 0, 0]);
    }
  if (crunch !== 0) {
    const curl = Math.max(0, crunch),
      stretch = Math.max(0, -crunch);
    add(bones, "root", [0, 0, -0.1 * curl + 0.05 * stretch]);
    add(bones, "chest", [0, 0, -0.12 * curl]);
    for (let i = 0; i < 7; i++) add(bones, `tail-${i}`, [0, 0, -(0.32 + 0.04 * i) * curl + 0.08 * stretch]);
    add(bones, "neck-0", [0, 0, -0.25 * curl + 0.12 * stretch]);
    add(bones, "neck-1", [0, 0, -0.2 * curl]);
    add(bones, "head", [0, 0, 0.35 * curl - 0.15 * stretch]);
  }
  if (flop > 0) {
    if (flight)
      for (const [id, bone] of Object.entries(flight)) {
        toward(bones, id, bone.rotation ?? [0, 0, 0], flop);
        if (bones[id].position) bones[id].position = bones[id].position.map((v, i) => v + ((bone.position?.[i] ?? 0) - v) * flop);
      }
    for (const side of [-1, 1]) {
      add(bones, `wing-${side}`, [side * FLOP.droop * flop, 0, 0]);
      add(bones, `wing-wrist-${side}`, [side * FLOP.droop * flop, 0, 0]);
    }
    FLOP.neck.forEach((pitch, i) => toward(bones, `neck-${i}`, [0, 0, pitch], flop));
    toward(bones, "head", [0, 0, FLOP.head], flop);
  }
}
