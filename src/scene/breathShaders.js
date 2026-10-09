// Shaders for breath plumes: camera-facing quads built on the CPU, lit by their own glow.
import { bendGlsl } from "./worldBend.js";

const header = `#version 300 es
precision highp float;
`;

/** Position, then (across, along) in -1..1, colour with alpha, glow and particle kind. */
export const breathVertex = `${header}
layout(location=0) in vec3 position;
layout(location=1) in vec2 shape;
layout(location=2) in vec4 color;
layout(location=3) in vec2 look;
uniform mat4 viewProjection;${bendGlsl}
out vec2 vShape;
out vec4 vColor;
out vec2 vLook;
out vec3 vWorld;
void main() {
  vShape = shape;
  vColor = color;
  vLook = look;
  vWorld = position;
  gl_Position = viewProjection * vec4(bent(position), 1.0);
}`;

/**
 * Kind 0 is a hexagonal puff, 1 a faceted diamond shard, 2 a line for sparks and bolts, 3 a four-point
 * glint, 4 a round glow, 5 a solid bead with a crisp edge, 6 a solid band across its width, as for a
 * jet of water, and 7 a flame tongue, round at its foot and pointed at its tip. Output is premultiplied: glow 1 adds light, glow 0 covers like smoke. With
 * `bloomPass` it writes only the light, for the bloom source.
 */
export const breathFragment = `${header}
in vec2 vShape;
in vec4 vColor;
in vec2 vLook;
in vec3 vWorld;
uniform vec3 eye;
uniform float fogDensity;
uniform int bloomPass;
out vec4 outColor;
void main() {
  float glow = vLook.x;
  int kind = int(vLook.y + 0.5);
  vec2 s = abs(vShape);
  float a = vColor.a;
  vec3 color = vColor.rgb;
  if (kind == 0) {
    float d = max(s.x * 0.866 + s.y * 0.5, s.y);
    a *= 1.0 - smoothstep(0.9, 1.0, d);
    color *= 0.86 + 0.14 * step(0.0, vShape.x + vShape.y) + 0.1 * step(d, 0.45);
  } else if (kind == 1) {
    float d = s.x + s.y;
    a *= step(d, 1.0);
    color *= vShape.x > 0.0 ? 1.0 : 0.78;
  } else if (kind == 3) {
    vec2 r = sqrt(s);
    float star = r.x + r.y;
    float core = length(s);
    a *= clamp(pow(max(0.0, 1.0 - star), 1.4) * 1.6 + pow(max(0.0, 1.0 - core * 2.2), 2.0), 0.0, 1.0);
    color = mix(color, vec3(1.0), (1.0 - smoothstep(0.0, 0.45, core)) * 0.7 * glow);
  } else if (kind == 4) {
    float d = length(vShape);
    a *= pow(max(0.0, 1.0 - d), 2.2);
    color = mix(color, vec3(1.0), pow(max(0.0, 1.0 - d * 1.6), 2.0) * 0.35);
  } else if (kind == 5) {
    float d = length(vShape);
    a *= 1.0 - smoothstep(1.0 - 1.5 * fwidth(d), 1.0, d);
    color *= 1.0 - 0.22 * smoothstep(0.45, 1.0, d);
    color = mix(color, vec3(1.0), (1.0 - smoothstep(0.0, 0.42, length(vShape - vec2(-0.3, 0.3)))) * 0.6);
  } else if (kind == 6) {
    a *= 1.0 - smoothstep(1.0 - 1.5 * fwidth(s.x), 1.0, s.x);
    float shine = 1.0 - smoothstep(0.0, 0.25, abs(vShape.x + 0.35));
    color = mix(color * (1.0 - 0.18 * smoothstep(0.5, 1.0, s.x)), vec3(1.0), shine * 0.55);
  } else if (kind == 7) {
    float y = vShape.y;
    float w = y < -0.4 ? sqrt(max(0.0, 0.36 - (y + 0.4) * (y + 0.4))) / 0.6 : pow(max(0.0, (1.0 - y) / 1.4), 0.85);
    float d = s.x / max(w, 1e-3);
    a *= (1.0 - smoothstep(0.55, 1.0, d)) * smoothstep(-1.0, -0.85, y);
    color = mix(color, vec3(1.0), (1.0 - smoothstep(0.0, 0.6, d)) * (1.0 - smoothstep(-0.6, 0.4, y)) * 0.4 * glow);
  } else {
    float end = 1.0 - smoothstep(0.7, 1.0, s.y);
    a *= pow(1.0 - s.x, 1.6) * end;
    color = mix(color, vec3(1.0), (1.0 - s.x) * 0.5 * glow);
  }
  a *= exp(-length(vWorld - eye) * fogDensity * 2.0);
  if (a < 0.004) discard;
  if (bloomPass == 1) outColor = vec4(color * a * glow * 0.4, 1.0);
  else outColor = vec4(color * a, a * (1.0 - glow));
}`;
