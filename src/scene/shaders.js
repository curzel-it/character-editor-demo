import { lengthScale } from "../worldScale.js";
import { gradeGlsl } from "./grade.js";
import { bendGlsl } from "./worldBend.js";

// Scene distances are authored at the reference scale; GLSL literals carry lengthScale.
const m = (v) => (v * lengthScale).toFixed(4);
export const header = `#version 300 es
precision highp float;
`;

/** Sky gradient and aerial perspective shared by every scene shader. */
export const atmosphere = `
uniform vec3 eye;
uniform vec3 sunDir;
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunColor;
uniform vec3 ridgeColor;
uniform vec3 haze;
uniform float fogDensity;
uniform float fogStart;
vec3 skyBase(vec3 d) {
  float t = pow(clamp(d.y, 0.0, 1.0), 0.55);
  vec3 c = mix(horizon, zenith, t);
  float s = max(dot(d, sunDir), 0.0);
  float glow = pow(s, 7.0) * 0.28;
  return c + sunColor * glow;
}
vec3 applyFog(vec3 c, vec3 p, float amount) {
  vec3 v = p - eye;
  float d = length(v);
  float mean = max(0.0, (eye.y + p.y) * 0.5 - ${m(120)});
  float thin = exp(-mean / ${m(700)});
  d = max(d - fogStart, 0.0), thin = max(thin, 0.5);
  float f = (1.0 - exp(-d * fogDensity * thin)) * amount;
  vec3 dir = normalize(vec3(v.x, max(v.y, 0.0) * 0.25, v.z));
  vec3 air = haze + sunColor * pow(max(dot(dir, sunDir), 0.0), 6.0) * 0.22;
  c = mix(c, vec3(dot(c, vec3(0.3, 0.55, 0.15))), f * 0.25);
  return mix(c, air, f);
}
`;

export const skyVertex = `${header}
out vec2 ndc;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  ndc = p * 2.0 - 1.0;
  gl_Position = vec4(ndc, 1.0, 1.0);
}`;

export const skyFragment = `${header}${atmosphere}
in vec2 ndc;
uniform mat4 inverseViewProjection;
uniform float ridgeHeight;
out vec4 outColor;
float ridge(float a, float k, float seed) {
  return sin(a * k + seed) * 0.5 + sin(a * k * 2.3 + seed * 1.7) * 0.3 + sin(a * k * 5.1 + seed * 0.3) * 0.2;
}
void main() {
  vec4 far = inverseViewProjection * vec4(ndc, 1.0, 1.0);
  vec3 d = normalize(far.xyz / far.w - eye);
  vec3 c = skyBase(d);
  float s = max(dot(d, sunDir), 0.0);
  c = mix(c, sunColor * 1.08, smoothstep(0.9993, 0.9996, s));
  float a = atan(d.z, d.x);
  float h1 = (0.05 + 0.025 * ridge(a, 3.0, 1.3)) * ridgeHeight;
  float h2 = (0.028 + 0.018 * ridge(a, 5.0, 4.1)) * ridgeHeight;
  float horizonFade = 0.06;
  vec3 distant = mix(horizon, haze, 0.6);
  c = mix(c, distant, (1.0 - smoothstep(0.0, 0.14, d.y)) * 0.55);
  if (d.y < h1) c = mix(c, mix(ridgeColor, distant, 0.45), 1.0 - smoothstep(h1 - horizonFade * 0.1, h1, d.y));
  if (d.y < h2) c = mix(c, mix(ridgeColor, distant, 0.18), 1.0 - smoothstep(h2 - horizonFade * 0.1, h2, d.y));
  outColor = vec4(c, 1.0);
}`;

export const worldVertex = `${header}
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
layout(location=2) in vec2 surface;
layout(location=3) in vec3 normal;
uniform mat4 viewProjection;${bendGlsl}
out vec3 vWorld;
out vec3 vBent;
out vec3 vNormal;
out vec3 vBlend;
out vec2 vBlendSurface;
flat out vec4 vColor;
flat out vec2 vSurface;
void main() {
  vWorld = position;
  vNormal = normal;
  vBlend = color.rgb;
  vBlendSurface = surface;
  vColor = color;
  vSurface = surface;
  vBent = bent(position);
  gl_Position = viewProjection * vec4(vBent, 1.0);
}`;

export const worldFragment = `${header}${atmosphere}
in vec3 vWorld;
in vec3 vBent;
in vec3 vNormal;
in vec3 vBlend;
in vec2 vBlendSurface;
flat in vec4 vColor;
flat in vec2 vSurface;
uniform vec3 fillColor;
uniform vec3 bounceColor;
uniform vec3 strata[6];
uniform sampler2D lightMap;
uniform vec4 lightArea;
uniform vec3 lightSoft;
uniform int propLight;
uniform vec2 shadowLift;
uniform vec3 emissive;
uniform vec2 backdrop;
uniform float opacity;
uniform int soft;
out vec4 outColor;
// Baked sun visibility and ambient occlusion (see bakeLighting.js); props darken at their foot.
// A fine bake is read lightSoft.z out along the normal, clear of the texels behind a wall.
vec2 bakedLight(vec3 n) {
  vec2 uv = (vWorld.xz + n.xz * lightSoft.z - lightArea.xy) * lightArea.zw;
  if (lightArea.z == 0.0 || any(lessThan(uv, vec2(0.0))) || any(greaterThan(uv, vec2(1.0)))) return vec2(1.0);
  vec4 t = texture(lightMap, uv);
  float above = vWorld.y - t.g;
  float sun = smoothstep(lightSoft.x, lightSoft.y, above - t.r);
  float ao = t.b;
  if (propLight == 1) ao *= mix(0.72, 1.0, smoothstep(0.0, ${m(5)}, above));
  return vec2(sun, ao);
}
// Past the course the backdrop ranges flatten toward an even light with distance: far = low contrast.
float backdropFlatten() {
  if (backdrop.x == 0.0 || lightArea.z == 0.0) return 0.0;
  vec2 q = (vWorld.xz - lightArea.xy) * lightArea.zw;
  float away = length((max(-q, 0.0) + max(q - 1.0, 0.0)) / lightArea.zw);
  return backdrop.x * smoothstep(0.0, backdrop.y, away);
}
vec3 strataAt(vec3 p) {
  vec3 q = p / ${m(1)};
  float wobble = sin(q.x * 0.006 + q.z * 0.004) * 7.0 + sin(q.x * 0.021 - q.z * 0.017) * 2.0;
  float y = q.y + wobble;
  float band = floor(y / 21.0 + 0.3 * sin(y * 0.031));
  int i = int(mod(band, 6.0));
  vec3 c = strata[i];
  float fine = fract(y / 7.0) < 0.14 ? 0.92 : 1.0;
  return c * fine;
}
// Thin foliage is lit like the ground it grows from, its facing only a nudge, so a blade's far side does not go black.
vec3 foliageNormal(vec3 n) {
  return vSurface.y > 1.5 ? normalize(n * 0.35 + vec3(0.0, 1.0, 0.0)) : n;
}
// Turns n to the side the eye sees, judged on the bent surface that is drawn: the bend brings slopes behind crests into view.
vec3 towardEye(vec3 n) {
  vec3 seen = cross(dFdx(vBent), dFdy(vBent));
  return dot(n, seen) * dot(seen, eye - vBent) < 0.0 ? -n : n;
}
void main() {
  vec3 base = soft == 1 ? mix(strataAt(vWorld), vBlend, min(vBlendSurface.y, 1.0)) : mix(strataAt(vWorld), vColor.rgb, min(vSurface.y, 1.0));
  vec3 lit;
  if (soft == 1) {
    vec3 n = vSurface.y > 1.5 ? normalize(vNormal) : towardEye(normalize(vNormal));
    vec2 baked = bakedLight(n);
    float wrap = smoothstep(-0.35, 0.8, dot(n, sunDir));
    float sun = wrap * mix(shadowLift.x, 1.0, baked.x);
    vec3 shade = fillColor * (0.44 + 0.12 * n.y) + bounceColor * 0.08;
    vec3 light = mix(shade, sunColor * 1.0 + fillColor * 0.04, sun) * mix(0.72, 1.0, baked.y);
    lit = base * mix(1.0, vBlendSurface.x, 0.3) * light;
    lit = mix(lit, base * (fillColor * 0.5 + sunColor * 0.75), backdropFlatten());
  } else {
    vec3 n = foliageNormal(towardEye(normalize(cross(dFdx(vWorld), dFdy(vWorld)))));
    float key = max(dot(n, sunDir), 0.0);
    float sky = 0.5 + 0.5 * n.y;
    vec2 baked = bakedLight(n);
    float ao = baked.y;
    vec3 ambient = fillColor * (0.19 + 0.18 * sky) + bounceColor * (1.0 - sky) * 0.2;
    float sun = mix(shadowLift.x, 1.0, baked.x);
    lit = base * vSurface.x * (ambient * ao * (1.0 + shadowLift.y - shadowLift.y * baked.x) + sunColor * key * sun * 1.15 * mix(1.0, ao, 0.35));
    lit = mix(lit, base * vSurface.x * (fillColor * 0.5 + sunColor * 0.75), backdropFlatten());
  }
  // Gameplay pieces glow: brighter and more saturated than scenery, free of shade and mostly clear of fog.
  vec3 glow = vColor.rgb * emissive.x;
  glow = mix(vec3(dot(glow, vec3(0.3, 0.55, 0.15))), glow, emissive.y);
  lit = mix(lit, glow, vColor.a);
  outColor = vec4(applyFog(lit, vWorld, 1.0 - vColor.a * emissive.z), opacity);
}`;

export const racerVertex = `${header}
layout(location=0) in vec3 position;
layout(location=1) in vec3 normal;
layout(location=2) in vec3 color;
layout(location=3) in vec2 joints;
layout(location=4) in float weight;
layout(location=5) in float metal;
layout(location=6) in float marking;
uniform mat4 bones[64];
uniform mat4 model;
uniform mat4 viewProjection;
${bendGlsl}
out vec3 vNormal;
out vec3 vColor;
out vec3 vWorld;
out vec3 vRest;
out float vMetal;
out float vMarking;
void main() {
  mat4 skin = model * (bones[int(joints.x)] * weight + bones[int(joints.y)] * (1.0 - weight));
  vec4 world = skin * vec4(position, 1.0);
  vNormal = mat3(skin) * normal;
  vColor = color;
  vMetal = metal;
  vWorld = world.xyz;
  vRest = position;
  vMarking = marking;
  gl_Position = viewProjection * vec4(bent(world.xyz), 1.0);
}`;

export const racerFragment = `${header}${atmosphere}
in vec3 vNormal;
in vec3 vColor;
in vec3 vWorld;
in vec3 vRest;
in float vMetal;
uniform vec3 fillColor;
uniform vec3 rimColor;
uniform vec3 metalSheen[2];
uniform vec3 metalShadow[2];
in float vMarking;
uniform vec4 markings;
uniform vec3 markingColor;
uniform float glow;
uniform vec3 glowColor;
uniform int coatCount;
uniform vec4 coat[12];
uniform vec2 coatLook[12];
uniform vec3 mudColor;
uniform vec3 foamColor;
uniform int soft;
out vec4 outColor;
float coatNoise(vec3 p) {
  return sin(p.x * 3.1 + sin(p.y * 2.3)) * sin(p.y * 2.7 + sin(p.z * 3.3)) * sin(p.z * 2.9 + sin(p.x * 1.9));
}
/**
 * A metallic coat without reflections: the colour falls to the metal's deep tone where the surface turns
 * from the sky, lifts to its sheen where it faces up into it, and catches a tight glint towards the sun.
 */
vec3 metalLook(vec3 base, vec3 n, vec3 v, float key, int id) {
  vec3 sheen = metalSheen[id], deep = metalShadow[id];
  vec3 r = reflect(-v, n);
  float glint = max(dot(r, sunDir), 0.0);
  vec3 ground = mix(base * 0.72, mix(deep, base, 0.2), smoothstep(0.0, -0.7, r.y));
  vec3 sky = mix(base * 1.08, base * 0.78, smoothstep(0.25, 0.95, r.y));
  vec3 tone = mix(ground, sky, smoothstep(-0.06, 0.04, r.y));
  tone = mix(tone, sheen, 0.6 * smoothstep(-0.04, 0.06, r.y) * smoothstep(0.32, 0.1, r.y));
  tone *= 0.72 + 0.4 * key;
  return tone + sheen * sunColor * pow(glint, 30.0) * (soft == 1 ? 0.5 : 0.9);
}
/** How much mud and lather (x, y) cover the body where the coat spots (centre and radius in the rest pose) lie, ragged at the edge; z marks the lather's bubbles. */
vec3 coating() {
  float mud = 0.0, foam = 0.0, bubble = 0.0;
  for (int i = 0; i < 12; i++) {
    if (i >= coatCount) break;
    vec3 d = (vRest - coat[i].xyz) / coat[i].w;
    float edge = length(d) + 0.22 * coatNoise(d * 2.6);
    float cover = 1.0 - smoothstep(0.78, 0.95, edge);
    float puff = length(d) + 0.3 * coatNoise(d * 4.0);
    mud = max(mud, cover * coatLook[i].x);
    foam = max(foam, step(puff, 1.05) * coatLook[i].y);
    vec3 cell = fract(d * 3.2) - 0.5;
    bubble = max(bubble, step(puff, 1.05) * coatLook[i].y * smoothstep(0.42, 0.3, length(cell)));
  }
  return vec3(mud, foam, bubble);
}
vec3 markHash(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)), dot(p, vec3(269.5, 183.3, 246.1)), dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float markNoise(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(markHash(i).x, markHash(i + vec3(1, 0, 0)).x, f.x), mix(markHash(i + vec3(0, 1, 0)).x, markHash(i + vec3(1, 1, 0)).x, f.x), f.y),
    mix(mix(markHash(i + vec3(0, 0, 1)).x, markHash(i + vec3(1, 0, 1)).x, f.x), mix(markHash(i + vec3(0, 1, 1)).x, markHash(i + vec3(1, 1, 1)).x, f.x), f.y),
    f.z);
}
/** The distance to the nearest scattered point and a random value of its cell. */
vec2 markCells(vec3 p) {
  vec3 i = floor(p), f = fract(p);
  vec2 best = vec2(9.0, 0.0);
  for (int z = -1; z <= 1; z++)
    for (int y = -1; y <= 1; y++)
      for (int x = -1; x <= 1; x++) {
        vec3 o = vec3(x, y, z), h = markHash(i + o);
        vec3 d = o + 0.15 + 0.7 * h - f;
        float l = dot(d, d);
        if (l < best.x) best = vec2(l, h.z);
      }
  return vec2(sqrt(best.x), best.y);
}
float markEdge(float edge, float x) {
  float aa = fwidth(x) * 0.75;
  return 1.0 - smoothstep(edge - aa, edge + aa, x);
}
/** How much of the marking colour covers this point of the rest pose: leopard rosettes, zebra stripes (round the legs) or cow patches. */
float marked() {
  float kind = markings.x;
  vec3 p = vRest * markings.y + vec3(markings.zw, 0.0);
  if (kind < 1.5) {
    vec3 q = p * 3.2 + (markNoise(p * 2.2) - 0.5) * 0.6;
    vec2 cell = markCells(q);
    float r = 0.36 + 0.12 * cell.y;
    float outer = markEdge(r, cell.x), inner = markEdge(r * 0.5, cell.x);
    float rosette = max((outer - inner) * markEdge(0.62, markNoise(q * 3.4 + 11.0)), inner * 0.3);
    return cell.y < 0.3 ? markEdge(r * 0.55, cell.x) : rosette;
  }
  if (kind < 2.5) {
    float along = vMarking < 0.0 ? p.y * 1.3 : p.x + 0.35 * p.y;
    return 1.0 - markEdge(0.15, sin(along * 8.0 + (markNoise(p * 1.4) - 0.5) * 5.0));
  }
  float patches = markNoise(p * 1.3) * 0.6 + markNoise(p * 2.8 + 5.0) * 0.28 + markNoise(p * 6.0 + 9.0) * 0.12;
  return 1.0 - markEdge(0.5, patches);
}
void main() {
  vec3 n = normalize(vNormal) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 v = normalize(eye - vWorld);
  float key = max(dot(n, sunDir), 0.0);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  vec3 c;
  vec3 coats = coatCount > 0 ? coating() : vec3(0.0);
  vec3 skin = vColor;
  if (markings.x > 0.5) skin = mix(vColor, markingColor, marked() * step(0.5, abs(vMarking)));
  vec3 base = mix(skin, mudColor * (0.85 + 0.15 * coatNoise(vRest * 4.0)), coats.x);
  if (soft == 1) {
    // Soft dragons keep their hue but no colour sinks below a pastel floor.
    float l = dot(base, vec3(0.3, 0.55, 0.15));
    base = min(base * (0.07 + 0.93 * l) / max(l, 0.02), vec3(1.0));
    float wrap = smoothstep(-0.25, 0.45, dot(n, sunDir));
    vec3 shade = mix(fillColor, base, 0.35) * 0.62 + 0.18;
    vec3 light = mix(shade, vec3(1.0) + sunColor * 0.12, wrap) + fillColor * 0.12 * n.y;
    c = base * light + mix(rimColor, vec3(1.0), 0.5) * smoothstep(0.55, 0.95, rim * 3.0) * 0.18;
  } else {
    float back = max(dot(n, normalize(vec3(-sunDir.x, 0.35, -sunDir.z))), 0.0);
    vec3 light = fillColor * (0.46 + 0.2 * n.y) + sunColor * key * 0.86 + mix(fillColor, sunColor, 0.5) * back * 0.45;
    c = base * light + rimColor * rim * 0.45;
  }
  if (vMetal > 0.5) {
    vec3 metal = metalLook(base, n, v, key, int(vMetal + 0.5) - 1);
    c = metal + rimColor * rim * 0.3;
  }
  c = mix(c, foamColor * (0.8 + 0.2 * key) * (1.0 - 0.12 * coats.z), coats.y);
  c = mix(c, glowColor * (0.9 + 0.25 * rim), glow);
  outColor = vec4(applyFog(c, vWorld, 0.2), 1.0);
}`;

export const shadowMapVertex = `${header}
layout(location=0) in vec3 position;
layout(location=3) in vec2 joints;
layout(location=4) in float weight;
uniform mat4 bones[64];
uniform mat4 model;
uniform vec4 caster;
uniform vec3 sunDir;
void main() {
  mat4 skin = model * (bones[int(joints.x)] * weight + bones[int(joints.y)] * (1.0 - weight));
  vec3 r = (skin * vec4(position, 1.0)).xyz - caster.xyz;
  vec3 su = normalize(cross(sunDir, vec3(0.0, 0.0, 1.0)));
  vec3 sv = cross(sunDir, su);
  gl_Position = vec4(dot(r, su), dot(r, sv), -dot(r, sunDir) * 0.5, caster.w);
}`;

export const shadowMapFragment = `${header}
void main() {}`;

export const thermalVertex = `${header}
layout(location=0) in vec3 position;
uniform mat4 viewProjection;
uniform vec3 base;
uniform float radius;
uniform float height;${bendGlsl}
out vec3 vWorld;
out vec3 vLocal;
void main() {
  vLocal = position;
  vWorld = base + vec3(position.x * radius, position.y * height, position.z * radius);
  gl_Position = viewProjection * vec4(bent(vWorld), 1.0);
}`;

export const thermalFragment = `${header}${atmosphere}
in vec3 vWorld;
in vec3 vLocal;
uniform float time;
uniform float height;
uniform vec3 tint;
out vec4 outColor;
void main() {
  vec3 n = normalize(vec3(vLocal.x, 0.0, vLocal.z));
  vec3 v = normalize(eye - vWorld);
  float edge = pow(1.0 - abs(dot(n, v)), 1.4);
  float angle = atan(vLocal.z, vLocal.x);
  float wave = sin(vLocal.y * height / ${m(1 / 0.09)} - time * 3.2 + angle * 3.0) * 0.5 + 0.5;
  float stripes = smoothstep(0.5, 1.0, wave);
  float fade = smoothstep(0.0, 0.12, vLocal.y) * (1.0 - smoothstep(0.72, 1.0, vLocal.y));
  float d = length(vWorld - eye);
  float a = (0.04 + 0.2 * stripes) * (0.25 + edge) * fade * exp(-d * fogDensity * 1.2);
  outColor = vec4(tint * a, 1.0);
}`;

export const glowVertex = `${header}
layout(location=0) in vec3 position;
layout(location=1) in vec4 color;
uniform mat4 viewProjection;${bendGlsl}
out vec3 vWorld;
flat out vec4 vColor;
void main() {
  vWorld = position;
  vColor = color;
  gl_Position = viewProjection * vec4(bent(position), 1.0);
}`;

/**
 * Emissive geometry drawn again into the low-resolution bloom source. Fragments behind the scene
 * depth by more than `slack` are dropped, so hoops glow only where they are seen; distant ones are lifted to stay visible and
 * ones filling the lens are dimmed so their halo does not wash the frame.
 * The colour is squared so the halo runs deeper than the surface: gold burns amber, white stays white.
 */
export const glowFragment = `${header}
in vec3 vWorld;
flat in vec4 vColor;
uniform vec3 eye;
uniform float fogDensity;
uniform sampler2D depthTexture;
uniform vec2 viewport;
uniform vec2 clip;
uniform float distant;
uniform float slack;
out vec4 outColor;
float linear(float d) {
  return 2.0 * clip.x * clip.y / (clip.y + clip.x - (d * 2.0 - 1.0) * (clip.y - clip.x));
}
void main() {
  float z = linear(gl_FragCoord.z);
  if (z > linear(texture(depthTexture, gl_FragCoord.xy / viewport).r) * 1.03 + slack) discard;
  float d = length(vWorld - eye);
  float k = vColor.a * (0.3 + 0.7 * smoothstep(${m(15)}, ${m(80)}, d) + distant * smoothstep(${m(150)}, ${m(3000)}, d)) * exp(-d * fogDensity * 0.5);
  outColor = vec4(vColor.rgb * vColor.rgb * k, 1.0);
}`;

/** Dual-filter bloom: a five-tap step down a mip, and an eight-tap tent back up (added to the level below). */
export const bloomDownFragment = `${header}
in vec2 uv;
uniform sampler2D source;
uniform vec2 texel;
out vec4 outColor;
void main() {
  vec2 o = texel, p = vec2(texel.x, -texel.y);
  vec3 c = texture(source, uv).rgb * 4.0 + texture(source, uv - o).rgb + texture(source, uv + o).rgb
    + texture(source, uv - p).rgb + texture(source, uv + p).rgb;
  outColor = vec4(c / 8.0, 1.0);
}`;

export const bloomUpFragment = `${header}
in vec2 uv;
uniform sampler2D source;
uniform vec2 texel;
out vec4 outColor;
void main() {
  vec2 o = texel, p = vec2(texel.x, -texel.y);
  vec3 c = texture(source, uv + vec2(o.x * 2.0, 0.0)).rgb + texture(source, uv - vec2(o.x * 2.0, 0.0)).rgb
    + texture(source, uv + vec2(0.0, o.y * 2.0)).rgb + texture(source, uv - vec2(0.0, o.y * 2.0)).rgb
    + (texture(source, uv + o).rgb + texture(source, uv - o).rgb + texture(source, uv + p).rgb + texture(source, uv - p).rgb) * 2.0;
  outColor = vec4(c / 12.0, 1.0);
}`;

/**
 * The subject mask (colour alpha) around a pixel: the most of it within the outline's `width`, where
 * the ink goes, and within twice that, where the halo goes.
 */
const maskRingGlsl = `
vec2 maskRing(float m) {
  float near = m, far = m;
  for (int i = 0; i < 12; i++) {
    float a = float(i) * 0.5235988;
    vec2 o = vec2(cos(a), sin(a)) * texel * width;
    near = max(near, max(texture(colorTexture, uv + o).a, texture(colorTexture, uv + o * 0.5).a));
    far = max(far, texture(colorTexture, uv + o * 2.0).a);
  }
  return vec2(near, far);
}
`;

/**
 * Final pass of a studio view (one subject, no world): the racers' grade, ink outline and halo over a
 * flat `background`, or over nothing with `transparent`. The subject arrives premultiplied by its mask.
 */
export const studioFragment = `${header}
in vec2 uv;
uniform sampler2D colorTexture;
uniform vec2 texel;
uniform float width;
uniform float strength;
uniform vec3 ink;
uniform vec3 halo;
uniform vec3 background;
uniform int transparent;
out vec4 outColor;${gradeGlsl}${maskRingGlsl}
void main() {
  vec4 base = texture(colorTexture, uv);
  float m = base.a;
  vec3 c = m > 0.0 ? base.rgb / m : vec3(0.0);
  c = grade(c);
  vec2 ring = maskRing(m);
  float inked = clamp(ring.x - m, 0.0, 1.0) * strength;
  if (transparent == 1) {
    float a = m + inked;
    outColor = vec4(c * m + ink * inked, a);
    return;
  }
  c = mix(background, c, m);
  c = mix(c, halo, clamp(ring.y - ring.x, 0.0, 1.0) * 0.4 * strength);
  outColor = vec4(mix(c, ink, inked), 1.0);
}`;

export const MAX_CASTERS = 16;
export const MAX_RACER_BOXES = 16;

/**
 * Final pass. Camera motion blur by depth reprojection (world pixels only, so racers stay
 * crisp), each racer's sun shadow cast onto whatever surface the pixel shows, the hoops' bloom, and the racer outline
 * and halo.
 */
export const compositeFragment = `${header}
in vec2 uv;
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform vec2 texel;
uniform float width;
uniform float strength;
uniform vec3 ink;
uniform vec3 halo;
uniform mat4 inverseViewProjection;
uniform mat4 previousViewProjection;
uniform float blur;
uniform vec3 eye;
uniform vec3 sunDir;
uniform vec3 shadowColor;
uniform float fogDensity;
uniform int casterCount;
uniform vec4 casters[16];
uniform sampler2D shadowAtlas;
uniform int racerCount;
uniform vec4 racerBoxes[${MAX_RACER_BOXES}];
uniform sampler2D bloomTexture;
uniform vec2 bloomTexel;
uniform float bloom;
uniform float vignette;
uniform vec2 bend;
out vec4 outColor;${gradeGlsl}${maskRingGlsl}vec3 worldAt(vec2 q, float d) {
  vec4 w = inverseViewProjection * vec4(q * 2.0 - 1.0, d * 2.0 - 1.0, 1.0);
  vec3 p = w.xyz / w.w;
  vec2 r = (p.xz - eye.xz) / max(bend.y, 1e-6);
  return vec3(p.x, p.y + (bend.y > 0.0 ? bend.x * bend.y * bend.y * (1.0 - exp(-dot(r, r))) : 0.0), p.z);
}
const vec2 taps[12] = vec2[12](vec2(0.19, 0.07), vec2(-0.12, 0.33), vec2(-0.41, -0.05), vec2(0.08, -0.47),
  vec2(0.56, -0.2), vec2(-0.3, 0.58), vec2(-0.68, -0.36), vec2(0.39, 0.68), vec2(0.84, 0.25), vec2(-0.05, -0.88),
  vec2(-0.93, 0.26), vec2(0.66, -0.72));
float casterShadow(vec3 p) {
  float s = 0.0;
  vec3 su = normalize(cross(sunDir, vec3(0.0, 0.0, 1.0)));
  vec3 sv = cross(sunDir, su);
  float tile = 0.25;
  float spin = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) * 6.2831853;
  mat2 turn = mat2(cos(spin), sin(spin), -sin(spin), cos(spin));
  for (int i = 0; i < 16; i++) {
    if (i >= casterCount) break;
    float h = casters[i].w;
    vec3 r = p - casters[i].xyz;
    vec2 xy = vec2(dot(r, su), dot(r, sv)) / h * 0.5 + 0.5;
    float toward = -dot(r, sunDir);
    if (toward <= -h || any(lessThan(xy, vec2(-0.1))) || any(greaterThan(xy, vec2(1.1)))) continue;
    float depth = toward / h * 0.25 + 0.5 - 0.004;
    vec2 corner = vec2(mod(float(i), 4.0), floor(float(i) / 4.0)) * tile;
    float search = 0.02 + max(toward, 0.0) / h * 0.005;
    float blockers = 0.0, found = 0.0;
    for (int k = 0; k < 12; k++) {
      vec2 local = clamp(xy + turn * taps[k] * search, 0.0, 1.0);
      float stored = texture(shadowAtlas, corner + local * tile).r;
      if (stored < 0.9999 && depth > stored) {
        blockers += stored;
        found += 1.0;
      }
    }
    if (found == 0.0) continue;
    float gap = (depth - blockers / found) * 2.0;
    float soft = 0.003 + gap * 0.007;
    float hit = 0.0;
    for (int k = 0; k < 12; k++) {
      vec2 local = clamp(xy + turn * taps[k] * soft, 0.0, 1.0);
      float stored = texture(shadowAtlas, corner + local * tile).r;
      if (stored < 0.9999 && depth > stored) hit += 1.0;
    }
    s = max(s, hit / 12.0 * 0.9);
  }
  return s;
}
void main() {
  vec4 base = texture(colorTexture, uv);
  vec3 c = base.rgb;
  float m = base.a;
  float depth = texture(depthTexture, uv).r;
  vec3 world = worldAt(uv, depth);
  if (blur > 0.0 && m < 0.5) {
    vec4 prev = previousViewProjection * vec4(world, 1.0);
    if (prev.w > 0.0) {
      vec2 v = (uv - (prev.xy / prev.w * 0.5 + 0.5)) * blur;
      float len = length(v);
      if (len > 0.06) v *= 0.06 / len;
      if (length(v / texel) > 1.5) {
        vec3 sum = c;
        float total = 1.0;
        for (int i = 0; i < 12; i++) {
          vec2 q = uv + v * (float(i) / 11.0 - 0.5);
          vec4 s = texture(colorTexture, q);
          float w = 1.0 - s.a;
          sum += s.rgb * w;
          total += w;
        }
        c = sum / total;
      }
    }
  }
  if (m < 0.5 && depth < 1.0 && casterCount > 0) {
    float shade = casterShadow(world) * exp(-length(world - eye) * fogDensity * 1.3);
    c = mix(c, c * shadowColor * 2.6, shade * 0.62);
  }
  c = grade(c);
  if (bloom > 0.0) {
    vec2 o = bloomTexel, q = vec2(bloomTexel.x, -bloomTexel.y);
    vec3 b = texture(bloomTexture, uv + o).rgb + texture(bloomTexture, uv - o).rgb + texture(bloomTexture, uv + q).rgb + texture(bloomTexture, uv - q).rgb;
    c = 1.0 - (1.0 - c) * (1.0 - clamp(b * 0.25 * bloom, 0.0, 1.0));
  }
  bool edge = false;
  for (int i = 0; i < ${MAX_RACER_BOXES}; i++) {
    if (i >= racerCount) break;
    vec4 b = racerBoxes[i];
    if (uv.x >= b.x && uv.y >= b.y && uv.x <= b.z && uv.y <= b.w) edge = true;
  }
  vec2 ring = edge ? maskRing(m) : vec2(m);
  c = mix(c, halo, clamp(ring.y - ring.x, 0.0, 1.0) * 0.4 * strength);
  c = mix(c, ink, clamp(ring.x - m, 0.0, 1.0) * strength);
  vec2 p = uv - 0.5;
  c *= 1.0 - dot(p, p) * vignette;
  outColor = vec4(c, 1.0);
}`;
