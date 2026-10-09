import { tube } from "../jockey/riderMesh.js";
import { riderSkins } from "../jockey/riderLook.js";
import { tint } from "../palette.js";
import { keeperItemParts } from "./keeperItems.js";

const KNUCKLE = 0.088;

/** Fingers from index to little: knuckle offset across the palm, two segment lengths and radius, in metres. */
export const keeperFingers = [
  { z: -0.027, lengths: [0.046, 0.044], r: 0.0098 },
  { z: -0.009, lengths: [0.051, 0.047], r: 0.0102 },
  { z: 0.009, lengths: [0.048, 0.044], r: 0.0098 },
  { z: 0.026, lengths: [0.037, 0.035], r: 0.0088 },
];

const THUMB = { at: [0.012, -0.008, -0.03], yaw: 0.75, lengths: [0.042, 0.036], r: 0.0115 };

const bone = (id, parent, position, rotation = [0, 0, 0]) => ({ id, parent, position, rotation });

function part(id, boneId, rings, color, segments = 8) {
  const mesh = tube(rings, { segments, color: () => color });
  return { id, bone: boneId, shape: "mesh", position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], color, ...mesh };
}

/** A tapering finger segment `length` metres along +X with a rounded tip. */
const digit = (length, r, tip) => [
  { p: [-0.004, 0, 0], r: r * 1.02 },
  { p: [length * 0.5, 0, 0], r: r * 0.97 },
  { p: [length - (tip ? r * 0.6 : 0), 0, 0], r: r * (tip ? 0.8 : 0.95) },
  ...(tip ? [{ p: [length, 0, 0], r: r * 0.35 }] : []),
];

/**
 * The owner's right hand as an anatomy the renderer draws like a dragon, true to size and in their
 * skin: the wrist, palm, a two-joint thumb and four two-joint fingers. The wrist sits at the origin
 * with the fingers along +X, the palm facing -Y and the thumb towards -Z, holding `item` (`keeperItems`)
 * when given. Pose it with `keeperHandPose`.
 * @param {{ look: { skin: string } }} owner
 * @param {string} [item]
 */
export function createKeeperHand(owner, item) {
  const skin = (riderSkins.find((s) => s.id === owner.look?.skin) ?? riderSkins[1]).rgb;
  const bones = [bone("arm", null, [0, 0, 0]), bone("hand", "arm", [0, 0, 0])];
  const parts = [
    part("keeper-wrist", "arm", [
      { p: [-0.075, 0, 0], r: [0.02, 0.026] },
      { p: [-0.06, 0, 0], r: [0.026, 0.033] },
      { p: [0.004, 0, 0], r: [0.024, 0.031] },
    ], skin),
    part("keeper-palm", "hand", [
      { p: [-0.006, 0.002, 0], r: [0.02, 0.032] },
      { p: [0.04, 0.003, 0], r: [0.022, 0.043] },
      { p: [KNUCKLE, 0.002, 0], r: [0.017, 0.043] },
      { p: [KNUCKLE + 0.008, 0.001, 0], r: [0.011, 0.036] },
    ], skin),
  ];
  keeperFingers.forEach((f, i) => {
    bones.push(bone(`finger-${i}-0`, "hand", [KNUCKLE, 0, f.z]), bone(`finger-${i}-1`, `finger-${i}-0`, [f.lengths[0], 0, 0]));
    parts.push(part(`keeper-finger-${i}-0`, `finger-${i}-0`, digit(f.lengths[0], f.r, false), skin, 6));
    parts.push(part(`keeper-finger-${i}-1`, `finger-${i}-1`, digit(f.lengths[1], f.r * 0.92, true), tint(skin, 1.02), 6));
  });
  bones.push(bone("thumb-0", "hand", THUMB.at, [0, THUMB.yaw, 0]), bone("thumb-1", "thumb-0", [THUMB.lengths[0], 0, 0]));
  parts.push(part("keeper-thumb-0", "thumb-0", digit(THUMB.lengths[0], THUMB.r, false), skin, 6));
  parts.push(part("keeper-thumb-1", "thumb-1", digit(THUMB.lengths[1], THUMB.r * 0.92, true), tint(skin, 1.02), 6));
  parts.push(...keeperItemParts(item));
  return { id: "keeper-hand", bones, parts, height: 0.1, bounds: { center: [0.05, 0, -0.06], radius: 0.24 } };
}
