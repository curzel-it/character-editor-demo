import { withTack } from "./withTack.js";

/** A dragon ridden by `jockey`, saddled and (unless `harness` is false) harnessed; none without one. */
export const withJockey = (anatomy, jockey, { harness = true } = {}) =>
  jockey ? withTack(anatomy, { harness, saddle: true, jockey }) : anatomy;
