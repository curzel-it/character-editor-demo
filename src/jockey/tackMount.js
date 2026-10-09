import { boneMatrices, inverseRigid, multiply, point, transform } from "../math3d.js";
import { hideTriangles, hideTop, partTouches } from "./hideProbe.js";

const add = (a, b) => a.map((v, i) => v + b[i]);

/** Moves the mount onto the hide so the saddle rests on the back rather than floating or sinking. */
function seated(mount, bind, index, triangles) {
  const matrix = bind[index.get(mount.bone)];
  const world = point(matrix, mount.local);
  const top = hideTop(triangles, world[0], world[2]);
  if (top === null) return mount;
  return { ...mount, local: point(inverseRigid(matrix), [world[0], top + 0.04, world[2]]) };
}

/** Where the saddle sits: the `saddle` socket, or a point on `root` just behind the neck base. */
function saddleMount(anatomy, bind, index, triangles) {
  const socket = anatomy.sockets?.find((s) => s.id === "saddle" && index.has(s.bone));
  if (socket) return { bone: socket.bone, local: socket.position };
  const root = anatomy.bones.find((b) => !b.parent) ?? anatomy.bones[0];
  const neck = anatomy.bones.find((b) => /neck/.test(b.id));
  const rootWorld = point(bind[index.get(root.id)], [0, 0, 0]);
  const base = neck ? point(bind[index.get(neck.id)], [0, 0, 0]) : add(rootWorld, [1, 0, 0]);
  const x = base[0] - 0.9;
  const world = [x, hideTop(triangles, x, 0) ?? rootWorld[1] + 0.6, 0];
  return { bone: root.id, local: point(inverseRigid(bind[index.get(root.id)]), world) };
}

/**
 * The shared frame for tack: the rest-pose skeleton, the hide, and the seat on the back (+X forward,
 * +Y up, origin on the saddle), with `toWorld`/`fromWorld` between seat and model space. `rigid` and
 * `shape` build parts fixed to the seat's bone from seat-frame coordinates; ids are prefixed by the
 * layer (`harness-`, `saddle-`, `jockey-`).
 */
export function tackMount(anatomy) {
  const bind = boneMatrices(anatomy);
  const index = new Map(anatomy.bones.map((b, i) => [b.id, i]));
  const triangles = hideTriangles(anatomy);
  const mount = seated(saddleMount(anatomy, bind, index, triangles), bind, index, triangles);
  const matrix = bind[index.get(mount.bone)];
  const toWorld = (p) => point(matrix, add(mount.local, p));
  const rigid = (id, mesh) => ({
    id,
    bone: mount.bone,
    shape: "mesh",
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    color: mesh.colors.slice(0, 3),
    vertices: mesh.vertices.map((v, i) => v + mount.local[i % 3]),
    indices: mesh.indices,
    colors: mesh.colors,
  });
  const shape = (id, kind, position, scale, color, rotation = [0, 0, 0]) => ({
    id,
    bone: mount.bone,
    shape: kind,
    position: add(mount.local, position),
    rotation,
    scale,
    color,
  });
  const toSeat = inverseRigid(matrix);
  const fromWorld = (world) => point(toSeat, world).map((v, i) => v - mount.local[i]);
  return { anatomy, bind, index, triangles, mount, saddle: toWorld([0, 0, 0]), toWorld, fromWorld, rigid, shape };
}

/**
 * Crests and other small parts that would poke through the tack are left off the area it covers:
 * `box` is [[x0, x1], [y0, y1], halfWidth] in the seat frame.
 */
export function clearOfTack(frame, parts, [[x0, x1], [y0, y1], half]) {
  const { bind, index, mount } = frame;
  const seat = inverseRigid(multiply(bind[index.get(mount.bone)], transform(mount.local)));
  return parts.filter(
    (part) =>
      /hide|body|membrane/.test(part.id) ||
      !partTouches(part, bind, index, seat, ([x, y, z]) => x > x0 && x < x1 && y > y0 && y < y1 && Math.abs(z) < half),
  );
}
