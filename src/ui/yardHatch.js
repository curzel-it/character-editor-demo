import { eggReady } from "../stable/egg.js";
import { hatchEgg } from "../stable/hatch.js";
import { t } from "../i18n.js";

const taps = 3;

/** Hatching in the stable yard: a ready egg cracks under a few taps and pops into a kid. */
export function createYardHatch(ctx) {
  const { module, game } = ctx;
  let eggId = null,
    tapped = 0;

  return {
    /** One tap on a ready egg: returns how many cracks it has, and the kid once it pops. */
    crack(egg) {
      if (!eggReady(egg)) return { cracks: 0, kid: null };
      if (egg.id !== eggId) [eggId, tapped] = [egg.id, 0];
      tapped++;
      if (tapped < taps) return { cracks: tapped, kid: null };
      [eggId, tapped] = [null, 0];
      const kid = hatchEgg(game.stable, module.genes, egg.id, game.now());
      return kid ? { cracks: taps, kid } : { cracks: 0, kid: null };
    },
    /** The Hatch tile's label for a ready egg: how the cracking is going. */
    label(egg) {
      return t(egg.id === eggId && tapped ? "yardHatch.again" : "yardHatch.hatch");
    },
  };
}
