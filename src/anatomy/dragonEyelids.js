import { tint } from "../palette.js";
import { add, cross, dot, normalize, scale, sub } from "../vec3.js";
import { surface } from "./dragonShape.js";
import { cast, meshOf, near } from "./meshCast.js";
import { eyeFrame } from "./dragonEyes.js";

/** How far a lid keeps off the eye across it and outwards, over the pupil, as shares of the eye's radii. */
const clearance = [0.03, 0.09];
/** A lid's thickness, as a share of the eye's outward radius. */
const thickness = 0.08;
/** Where shut lids meet, as a share of the way from the middle of the eye down to its lower edge. */
const meet = 0.25;
/** Radians the lid reaches past the eye's rim when shut, tucking its far side under the skin. */
const overlap = 0.5;
/** The share of a lid's turn its far side follows, on the lid's `back` bone; the rows between stretch. */
const trail = 0.4;
/** How far a shut lid's far side folds in towards its axis, under the skin past the eye's rim. */
const fold = 0.5;
/** The shrinks tried, largest first, to tuck an open lid out of sight. */
const tucks = [0.85, 0.75, 0.65, 0.55, 0.45, 0.35, 0.25];
/** A tucked lid shrinks this much further than its sampled corners need, so nothing between them shows. */
const margin = 0.85;
const columns = 14,
  rows = 5;
/** The head's skin round the eyes, under which open lids hide. */
const COVERS = /^(cranial-(?!crest)|recessed-orbit|cheek-plane|upper-palate|upper-beak)/;

/**
 * An upper and a lower lid over each dome eye, each a shell of skin skinned between a
 * `lid-<upper|lower>-<side>` bone that carries its edge and a `lid-<upper|lower>-back-<side>` bone
 * that carries its far side. Both lids lie on one surface turned round an axis through the eye from
 * corner to corner, fitted just over the eye and its pupil, so turning a lid about that axis slides it
 * over the eye; its far side follows by the `trail` share of the turn and folds in under the skin past
 * the eye's rim, the rows between stretching. Open, a lid's edge rests on the eye's rim and the lid is
 * shrunk towards the axis, by the part's `tuck`, until none of it shows; the part also carries that
 * `axis`, `shut`, the angle that brings its edge to meet the other lid's, and `roll`, the eye's outward
 * axis turned so that rolling about it raises the lid's front corner and lowers its back one.
 */
export function addEyelids({ rig, world, parts, skin }) {
  const covers = parts.filter(({ bone, id, vertices }) => bone === "head" && vertices && COVERS.test(id)).map(meshOf);
  for (const s of [-1, 1]) {
    const eye = parts.find(({ id }) => id === `eye-${s}`);
    if (eye?.shape !== "dome") continue;
    const { core, along, up, normal, radii, level } = eyeFrame(eye, s),
      roll = normalize(cross(along[0] < 0 ? scale(along, -1) : along, up));
    const [rx, ry] = radii.map((r) => r * (1 + clearance[0])),
      rz = radii[2] * (1 + clearance[1]),
      skinAt = level * radii[2],
      line = Math.acos(level);
    const samples = [];
    for (let i = 0; i <= 6; i++)
      for (let j = 0; j < 16; j++) {
        const a = (line * i) / 6,
          b = (Math.PI * 2 * j) / 16;
        samples.push([rx * Math.sin(a) * Math.cos(b), ry * Math.sin(a) * Math.sin(b), rz * Math.cos(a)]);
      }
    const lineY = ry * Math.sqrt(Math.max(0, 1 - (skinAt / rz) ** 2)),
      pivot = (rz * rz - lineY * lineY - skinAt * skinAt) / (2 * (rz - skinAt));
    const R = Math.max(rz - pivot, ...samples.map(([, y, z]) => 1.001 * Math.hypot(y, z - pivot)));
    const ax = Math.max(...samples.map(([x, y, z]) => Math.abs(x) / Math.sqrt(Math.max(1e-6, 1 - (y * y + (z - pivot) ** 2) / (R * R)))));
    const centre = add(core, scale(normal, pivot)),
      t = thickness * radii[2],
      lip = (0.5 * t) / R,
      edge = Math.atan2(lineY, skinAt - pivot) + lip,
      shells = [...covers, ...parts.filter(({ id }) => [`eye-${s}`, `eye-rim-${s}`, `eye-socket-${s}`].includes(id)).map(meshOf)].map((mesh) =>
        near(mesh, core, 3 * Math.max(...radii)),
      );
    const under = (point, ray) => shells.some((mesh) => cast(mesh, point, ray) < 4 * radii[2]);
    for (const upper of [true, false]) {
      const side = upper ? up : scale(up, -1);
      const at = (angle, radius, across) => {
        const r = R + radius * t,
          phi = (Math.PI / 2) * across;
        return add(add(centre, scale(along, ((ax * r) / R) * Math.sin(phi))), scale(add(scale(side, Math.sin(angle)), scale(normal, Math.cos(angle))), r * Math.cos(phi)));
      };
      const closed = (upper ? -meet : meet) * (edge - lip) + lip,
        shut = edge - closed,
        span = shut + overlap;
      const loop = [
        ...Array.from({ length: rows + 1 }, (_, j) => [closed + (span * (rows - j)) / rows, 1, j / rows]),
        [closed - lip, 0.5, 1],
        ...Array.from({ length: rows + 1 }, (_, j) => [closed + (span * j) / rows, 0, 1 - j / rows]),
      ];
      const placed = (k) =>
        loop.map(([angle, radius, w]) =>
          Array.from({ length: columns + 1 }, (_, i) => {
            const p = scale(sub(at(angle, radius, (2 * i) / columns - 1), centre), 1 - fold * Math.max(0, Math.min(1, (angle - edge) / overlap)) ** 2),
              [re, im] = [dot(p, normal), dot(p, side)],
              [a, b] = [w * Math.cos(shut) + (1 - w) * Math.cos(trail * shut), -w * Math.sin(shut) - (1 - w) * Math.sin(trail * shut)],
              d = a * a + b * b;
            return add(add(scale(along, k * dot(p, along)), scale(normal, (k * (re * a + im * b)) / d)), scale(side, (k * (im * a - re * b)) / d));
          }),
        );
      const hidden = (point) => under(point, normal) && under(point, normalize(add(normal, side)));
      const fit = tucks.find((k) => placed(k).every((row) => row.every((p) => hidden(add(centre, p))))) ?? tucks.at(-1),
        tuck = margin * fit;
      const bone = rig(`lid-${upper ? "upper" : "lower"}-${s}`, "head", centre),
        back = rig(`lid-${upper ? "upper" : "lower"}-back-${s}`, "head", centre),
        origin = add(world("head"), centre),
        vertices = placed(tuck).flat().flatMap((p) => add(origin, p)),
        joints = loop.flatMap(() => Array.from({ length: columns + 1 }, () => [bone, back])),
        weights = loop.flatMap(([, , w]) => Array.from({ length: columns + 1 }, () => w)),
        colors = loop.flatMap(([, radius]) => Array.from({ length: columns + 1 }, () => (radius === 0.5 ? tint(skin, 0.7) : skin)).flat()),
        indices = [];
      const index = (p, i) => (p % loop.length) * (columns + 1) + i;
      for (let p = 0; p < loop.length; p++)
        for (let i = 0; i < columns; i++) indices.push(index(p, i), index(p + 1, i), index(p, i + 1), index(p, i + 1), index(p + 1, i), index(p + 1, i + 1));
      const first = (columns / 2) * 6,
        corner = (k) => sub(vertices.slice(3 * indices[first + k], 3 * indices[first + k] + 3), origin),
        facing = cross(sub(corner(1), corner(0)), sub(corner(2), corner(0)));
      if (dot(facing, corner(0)) < 0)
        for (let k = 0; k < indices.length; k += 3) [indices[k + 1], indices[k + 2]] = [indices[k + 2], indices[k + 1]];
      surface(parts, `lid-${upper ? "upper" : "lower"}-${s}`, bone, vertices, indices, skin, {
        colors,
        skin: { joints, weights },
        axis: normalize(cross(side, normal)),
        shut,
        tuck,
        trail,
        roll,
      });
    }
  }
}
