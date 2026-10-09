import { bendGlsl } from "./worldBend.js";
import { header, atmosphere } from "./shaders.js";

export const waterVertex = `${header}
layout(location=0) in vec3 position;
layout(location=1) in vec2 bank;
uniform mat4 viewProjection;${bendGlsl}
out vec3 vWorld;
out vec2 vBank;
void main() {
  vWorld = position;
  vBank = bank;
  gl_Position = viewProjection * vec4(bent(position), 1.0);
}`;

/**
 * Lakes and rivers. The body runs from a light `shallow` tone at the shore to `deep` over open water
 * (depth from the light map's stored ground height), lit like flat terrain and shaded by the baked sun
 * shadow. Sky reflection rises toward grazing angles (fresnel) through the facets of two coarse animated
 * triangle lattices, whose tilts also break the sun's reflection into a glitter path of whole facets;
 * once facets are a few pixels across they fade to a flat surface and the glitter to a soft broad path.
 * A pale foam band marks the waterline and the river banks. The result is capped below the hoops' brightness.
 */
export const waterFragment = `${header}${atmosphere}
in vec3 vWorld;
in vec2 vBank;
uniform vec3 fillColor;
uniform vec2 shadowLift;
uniform sampler2D lightMap;
uniform vec4 lightArea;
uniform vec2 lightSoft;
uniform float time;
uniform vec3 deepColor;
uniform vec3 shallowColor;
uniform vec3 foamColor;
uniform vec3 skyTint;
// x: fresnel looking straight down, y: at grazing angles, z: its power, w: brightest the water gets
uniform vec4 fresnel;
// x: near glitter gain, y: its power, z: far power, w: far gain
uniform vec4 glitter;
// x: facet size, y: facet tilt, z: depth over which the shallows darken, w: foam depth
uniform vec4 shape;
out vec4 outColor;
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// Tilt of the equilateral lattice triangle holding p, rocking on its own slow phase; fade drops to 0
// once a triangle is only a few pixels across, and centre is the triangle's centre.
vec2 lattice(vec2 p, mat2 turn, float size, float seed, out float fade, out vec2 centre) {
  vec2 q = turn * p / size;
  vec2 s = vec2(q.x - q.y * 0.57735, q.y * 1.1547);
  vec2 cell = floor(s);
  float upper = step(1.0, dot(fract(s), vec2(1.0)));
  vec2 id = cell * 2.0 + upper + seed;
  vec2 c = cell + (1.0 + upper) / 3.0;
  centre = (vec2(c.x + c.y * 0.5, c.y * 0.866025) * size) * turn;
  float a = hash(id), b = hash(id + 17.3);
  vec2 w = fwidth(s);
  fade = 1.0 - smoothstep(0.04, 0.14, max(w.x, w.y));
  float t = time * (0.5 + 0.5 * a);
  return vec2(sin(t + 6.2832 * b), cos(t * 0.83 + 6.2832 * a)) * fade;
}
// Two lattices at different sizes and angles overlap into irregular facets.
vec2 facetTilt(vec2 p, out float fade, out vec2 centre) {
  float wide;
  vec2 unused;
  vec2 tilt = lattice(p, mat2(0.8, 0.6, -0.6, 0.8), shape.x, 0.0, fade, centre) * 0.65;
  tilt += lattice(p, mat2(0.96, -0.28, 0.28, 0.96), shape.x * 1.73, 41.0, wide, unused) * 0.5;
  return tilt * shape.y;
}
void main() {
  vec3 v = normalize(eye - vWorld);
  vec2 uv = (vWorld.xz - lightArea.xy) * lightArea.zw;
  float depth = 1e4, sun = 1.0;
  if (lightArea.z != 0.0 && all(greaterThanEqual(uv, vec2(0.0))) && all(lessThanEqual(uv, vec2(1.0)))) {
    vec4 t = texture(lightMap, uv);
    depth = vWorld.y - t.g;
    sun = smoothstep(lightSoft.x, lightSoft.y, depth - t.r);
  }
  float shallow = smoothstep(0.0, shape.z, depth);
  float lap = shape.w * 0.25 * sin(time * 1.1 + dot(vWorld.xz, vec2(0.11, 0.07)) / shape.x * 6.0);
  float edge = min(depth, (vBank.y - abs(vBank.x)) * 0.35);
  float foam = 1.0 - smoothstep(shape.w * 0.45, shape.w, edge + lap);
  vec3 body = mix(shallowColor, deepColor, shallow);
  float ambient = 0.37 * (1.0 + shadowLift.y * (1.0 - sun));
  vec3 light = fillColor * ambient + sunColor * sunDir.y * mix(shadowLift.x, 1.0, sun) * 1.15;
  float fade;
  vec2 centre;
  vec2 tilt = facetTilt(vWorld.xz, fade, centre);
  vec3 n = normalize(vec3(tilt.x, 1.0, tilt.y));
  vec3 r = reflect(-v, n);
  r.y = abs(r.y);
  // Fresnel follows the facets only halfway, so they ripple the reflection without checkering it.
  float grazing = pow(1.0 - clamp(dot(normalize(n + vec3(0.0, 1.0, 0.0)), v), 0.0, 1.0), fresnel.z);
  float f = mix(fresnel.x, fresnel.y, grazing);
  vec3 sky = skyBase(r) * skyTint * mix(0.82, 1.0, sun);
  vec3 c = mix(body * light, sky, f);
  // Near glints use the view from the facet's centre, so a facet lights as a whole triangle.
  vec3 glint = reflect(normalize(vec3(centre.x, vWorld.y, centre.y) - eye), n);
  float near = pow(max(dot(glint, sunDir), 0.0), glitter.y) * glitter.x;
  float far = pow(max(dot(r, sunDir), 0.0), glitter.z) * glitter.w;
  c += sunColor * mix(far, near, fade) * sun * (1.0 - foam);
  c = mix(c, foamColor * light, foam * 0.85);
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  c *= min(1.0, fresnel.w / max(l, 1e-4));
  outColor = vec4(applyFog(c, vWorld, 1.0), 1.0);
}`;
