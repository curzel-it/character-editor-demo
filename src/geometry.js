export function primitive(part) {
  if (part.shape === "mesh")
    return { vertices: part.vertices, indices: part.indices };
  if (part.shape === "box")
    return {
      vertices: [
        -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1, -1, -1, 1, 1, -1, 1, 1, 1,
        1, -1, 1, 1,
      ],
      indices: [
        0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 3, 7, 6, 3, 6, 2,
        1, 2, 6, 1, 6, 5, 0, 4, 7, 0, 7, 3,
      ],
    };
  const vertices = [],
    indices = [];
  const segments = part.segments || 10;
  if (part.shape === "ellipsoid") {
    const rings = Math.max(4, Math.round(segments / 2));
    for (let j = 0; j <= rings; j++)
      for (let i = 0; i <= segments; i++) {
        const a = (Math.PI * j) / rings,
          b = (Math.PI * 2 * i) / segments;
        vertices.push(
          Math.sin(a) * Math.cos(b),
          Math.cos(a),
          Math.sin(a) * Math.sin(b),
        );
      }
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segments; i++) {
        const k = j * (segments + 1) + i;
        indices.push(
          k,
          k + 1,
          k + segments + 1,
          k + 1,
          k + segments + 2,
          k + segments + 1,
        );
      }
  } else if (part.shape === "dome") {
    const rings = Math.max(3, Math.round(segments / 3)),
      { cap, from = 0, facing = 1 } = part,
      floor = Math.cos(part.rest ?? cap);
    for (let j = 0; j <= rings; j++)
      for (let i = 0; i < segments; i++) {
        const a = from + ((cap - from) * j) / rings,
          b = (Math.PI * 2 * i) / segments;
        vertices.push(facing * Math.sin(a) * Math.cos(b), Math.sin(a) * Math.sin(b), facing * (Math.cos(a) - floor));
      }
    vertices.push(0, 0, facing * (Math.cos(cap) - floor));
    const ring = (j, i) => j * segments + (i % segments),
      bottom = (rings + 1) * segments;
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < rings; j++)
        indices.push(ring(j, i), ring(j + 1, i), ring(j, i + 1), ring(j, i + 1), ring(j + 1, i), ring(j + 1, i + 1));
      if (!from) indices.push(bottom, ring(rings, i + 1), ring(rings, i));
    }
  } else if (part.shape === "cylinder" || part.shape === "cone") {
    for (let j = 0; j < 2; j++)
      for (let i = 0; i < segments; i++) {
        const a = (i * Math.PI * 2) / segments,
          r = part.shape === "cone" && j === 1 ? 0 : 1;
        vertices.push(Math.cos(a) * r, j * 2 - 1, Math.sin(a) * r);
      }
    vertices.push(0, -1, 0, 0, 1, 0);
    for (let i = 0; i < segments; i++) {
      const n = (i + 1) % segments;
      indices.push(
        i,
        n,
        i + segments,
        n,
        n + segments,
        i + segments,
        segments * 2,
        n,
        i,
        segments * 2 + 1,
        i + segments,
        n + segments,
      );
    }
    for (let i = 0; i < indices.length; i += 3)
      [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]];
  } else throw new Error(`Unknown shape: ${part.shape}`);
  return { vertices, indices };
}
