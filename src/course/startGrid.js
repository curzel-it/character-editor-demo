const round = (v) => Math.round(v * 1000) / 1000 + 0;
/** How far, at reference scale, the whole grid may slide sideways to find footing. */
const SLIDE = 34;

const layout = (start, slide) =>
  Array.from({ length: 12 }, (_, i) => {
    const row = Math.floor(i / 4),
      lane = i % 4;
    return {
      position: [
        -12 - row * 16,
        start.position[1] + (row % 2 ? 3 : 0),
        (lane - 1.5) * 15 + (row % 2 ? 7.5 : 0) - 3.75 + slide,
      ].map(round),
      forward: [1, 0, 0],
    };
  });

/**
 * Twelve staggered start slots behind x = 0, four abreast, at reference scale. When some slot has no
 * `footing` (a reference-scale position test, such as staying out of the river), the whole grid slides
 * sideways by the smallest whole metre that gives every slot footing, so the lanes keep their shape and
 * no slot gains on another; failing that, it takes the slide that leaves the fewest slots without.
 * @param {{ position: number[] }} start
 * @param {(position: number[]) => boolean} [footing]
 */
export function startGrid(start, footing = () => true) {
  let best = { grid: layout(start, 0), missing: Infinity };
  for (let d = 0; d <= SLIDE; d++) {
    for (const slide of d ? [d, -d] : [0]) {
      const grid = layout(start, slide);
      const missing = grid.filter((slot) => !footing(slot.position)).length;
      if (!missing) return grid;
      if (missing < best.missing) best = { grid, missing };
    }
  }
  return best.grid;
}
