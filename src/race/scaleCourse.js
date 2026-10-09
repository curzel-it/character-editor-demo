const lengthKeys = new Set([
  "s",
  "s0",
  "s1",
  "length",
  "halfWidth",
  "floor",
  "ceiling",
  "radius",
  "halfSpan",
  "thickness",
  "depth",
  "height",
  "width",
  "cellSize",
]);
const keep = new Set(["forward", "index", "type", "seed", "signature", "columns", "rows"]);

function scaleValue(value, key, factor) {
  if (keep.has(key)) return value;
  if (Array.isArray(value))
    return key === "position" || key === "origin" || key === "heights"
      ? value.map((v) => v * factor)
      : value.map((v) => scaleValue(v, "", factor));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scaleValue(v, k, factor)]));
  return typeof value === "number" && lengthKeys.has(key) ? value * factor : value;
}

/**
 * Geometric copy of a course enlarged by `factor`: every length (positions, arc lengths, widths,
 * altitudes, gate and thermal radii, terrain) grows by it and thermal lift, a speed, by its square
 * root, so the scaled course is Froude-similar to the original.
 */
export function scaleCourse(course, factor) {
  const scaled = scaleValue(course, "", factor);
  scaled.thermals = scaled.thermals?.map((t) => ({ ...t, lift: t.lift * Math.sqrt(factor) }));
  return scaled;
}
