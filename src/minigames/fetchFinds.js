import { palette } from "../palette.js";
import { makeRng } from "../rng.js";
import { keeperItemParts } from "../keeper/keeperItems.js";
import { PLAY_STICK } from "../keeper/items/play.js";

const ACROSS = [Math.PI / 2, 0, 0];

/** A one-bone prop of `parts` on bone `hand`, its long side along Z, posed by `bones.hand` like the keeper's hand. */
const hold = (id, parts, radius) => ({ id, bones: [{ id: "hand", position: [0, 0, 0] }], parts, height: radius, bounds: { center: [0, 0, 0], radius } });
const part = (id, shape, position, scale, color, rotation = [0, 0, 0]) => ({ id: `fetch-${id}`, bone: "hand", shape, position, rotation, scale, color, segments: 8 });

/** The keeper's stick on its own, centred, `PLAY_STICK.length` long. */
const stick = hold(
  "fetch-stick",
  keeperItemParts("stick").map((p) => ({ ...p, position: p.position.map((v, k) => v - PLAY_STICK.at[k]) })),
  PLAY_STICK.length / 2,
);

/** A whole log a metre long, bark round a pale heart, a lopped branch stub on its side. */
function log() {
  const c = palette.careTools.fetch;
  return hold(
    "fetch-log",
    [
      part("log", "cylinder", [0, 0, 0], [0.17, 0.5, 0.17], c.bark, ACROSS),
      part("log-end-0", "cylinder", [0, 0, 0.5], [0.14, 0.012, 0.14], c.heart, ACROSS),
      part("log-end-1", "cylinder", [0, 0, -0.5], [0.14, 0.012, 0.14], c.heart, ACROSS),
      part("log-stub", "cylinder", [0, 0.17, 0.15], [0.05, 0.09, 0.05], c.bark, [0.5, 0, 0]),
      part("log-leaf", "ellipsoid", [0, 0.27, 0.22], [0.03, 0.05, 0.08], c.leaf, [0.6, 0, 0]),
    ],
    0.55,
  );
}

/** A cartoon bone a metre long, two round knobs at each end. */
function bone() {
  const c = palette.careTools.fetch;
  const knobs = [-1, 1].flatMap((end) => [-1, 1].map((side) => part(`bone-knob-${end}-${side}`, "ellipsoid", [0, 0.07 * side, 0.43 * end], [0.1, 0.1, 0.1], c.bone)));
  return hold("fetch-bone", [part("bone", "cylinder", [0, 0, 0], [0.065, 0.42, 0.065], c.bone, ACROSS), ...knobs], 0.55);
}

/**
 * What the dragon can bring back: its prop, its length as a share of the dragon's radius, its length on
 * the prop and how high its middle lies off the ground as a share of its length.
 */
export const fetchFinds = {
  stick: { anatomy: stick, size: 0.6, length: PLAY_STICK.length, rest: 0.04 },
  log: { anatomy: log(), size: 1, length: 1, rest: 0.17 },
  bone: { anatomy: bone(), size: 0.75, length: 1, rest: 0.17 },
};

const ODDS = [["log", 0.13], ["bone", 0.13]];

/** What the dragon brings back from throw `round` (0 the first) of the game seeded `seed`: the stick, or now and then something else; the first is always the stick. */
export function findOf(seed, round) {
  if (round === 0) return "stick";
  let roll = makeRng(`${seed}:find:${round}`)();
  for (const [id, chance] of ODDS) {
    if (roll < chance) return id;
    roll -= chance;
  }
  return "stick";
}
