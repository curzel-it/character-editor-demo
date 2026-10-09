import { add, dot, lerp, scale, sub } from "../vec3.js";
import { cast, meshOf } from "./meshCast.js";
import { eyeFrame, skullOf } from "./dragonEyes.js";

/** How much of a brow's depth stands proud of the head. */
const proud = 0.55;

/**
 * Settles each brow onto the head once the eyes are seated. Over the eye every ring of the brow's
 * sweep moves onto the iris's upper edge, a hood that runs along it and covers it from above; ahead
 * of and behind the eye the rings keep their own line. Either way each ring then slides along the
 * eye's outward axis until it stands `proud` of the skull and the eye, so the brow rests on the head.
 */
export function seatBrows(parts) {
  const skull = skullOf(parts);
  if (!skull) return;
  for (const s of [-1, 1]) {
    const eye = parts.find(({ id }) => id === `eye-${s}`);
    if (eye?.shape !== "dome") continue;
    const surfaces = [skull, ...parts.filter(({ id }) => [`eye-${s}`, `eye-rim-${s}`, `eye-socket-${s}`].includes(id))].map(meshOf),
      { normal, along, up, centre: middle, size: [w, h] } = eyeFrame(eye, s);
    const settle = (at, depth) => {
      const from = add(at, normal),
        d = Math.min(...surfaces.map((mesh) => cast(mesh, from, scale(normal, -1))));
      return d === Infinity ? at : add(from, scale(normal, (2 * proud - 1) * depth - d));
    };
    for (const brow of parts.filter(({ id, vertices }) => vertices && id.endsWith(`brow-${s}`))) {
      const ring = 3 * (brow.segments ?? 5),
        { vertices } = brow;
      for (let r = 0; r < vertices.length; r += ring) {
        const points = [];
        for (let i = r; i < r + ring; i += 3) points.push(vertices.slice(i, i + 3));
        const centre = scale(points.reduce(add, [0, 0, 0]), 1 / points.length),
          depth = Math.max(...points.map((p) => Math.abs(dot(sub(p, centre), normal)))),
          height = Math.max(...points.map((p) => Math.abs(dot(sub(p, centre), up)))),
          u = dot(sub(centre, middle), along),
          x = Math.max(-w, Math.min(w, u)),
          edge = add(add(middle, scale(along, x)), scale(up, h * Math.sqrt(1 - (x / w) ** 2) + 0.5 * height)),
          away = Math.max(0, Math.min(1, (Math.abs(u) - 0.8 * w) / (0.4 * w))),
          target = lerp(settle(edge, depth), settle(centre, depth), away),
          move = sub(target, centre);
        for (let i = r; i < r + ring; i += 3) for (let k = 0; k < 3; k++) vertices[i + k] += move[k];
      }
    }
  }
}
