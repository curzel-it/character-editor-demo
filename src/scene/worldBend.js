/**
 * The world curving away from the camera like a rolling log: a point `d` from `bendFrom` (the eye) along the
 * ground drops by `bend.x` × d² up close, easing to at most `bend.x` × `bend.y`² far off, where the
 * ranges and clouds settle behind the crest. Vertex shaders place their geometry through `bent`.
 */
export const bendGlsl = `
uniform vec2 bend;
uniform vec3 bendFrom;
float bendDrop(vec2 d) {
  return bend.y > 0.0 ? bend.x * bend.y * bend.y * (1.0 - exp(-dot(d, d) / (bend.y * bend.y))) : 0.0;
}
vec3 bent(vec3 p) {
  return vec3(p.x, p.y - bendDrop(p.xz - bendFrom.xz), p.z);
}
`;
