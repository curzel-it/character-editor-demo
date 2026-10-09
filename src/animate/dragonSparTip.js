/** The tip of a rigid wing spar mesh (`wing-spar-±1-n`), in its bone's frame. */
export function sparTip(anatomy, id) {
  const { vertices } = anatomy.parts.find((part) => part.id === id);
  const tip = [0, 0, 0],
    ring = 6;
  for (let i = vertices.length - ring * 3; i < vertices.length; i += 3)
    for (let k = 0; k < 3; k++) tip[k] += vertices[i + k] / ring;
  return tip;
}
