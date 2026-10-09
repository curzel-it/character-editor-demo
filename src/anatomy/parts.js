export function bone(
  bones,
  id,
  parent,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
) {
  bones.push({ id, parent, position, rotation });
  return id;
}

export function part(
  parts,
  id,
  boneId,
  shape,
  position,
  scale,
  color,
  rotation = [0, 0, 0],
  extra = {},
) {
  parts.push({
    id,
    bone: boneId,
    shape,
    position,
    scale,
    color,
    rotation,
    ...extra,
  });
}
