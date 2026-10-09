// Shaders for the speed cues: air motes streaked by camera motion, and wingtip vortex ribbons.
import { bendGlsl } from "./worldBend.js";

const header = `#version 300 es
precision highp float;
`;

/**
 * Motes live in a toroidal box that wraps around the eye, so they are fixed in the world yet
 * always surround the camera. Each is drawn from its current position to where the previous
 * camera saw it, extrapolated over the exposure, so the streak follows the screen motion.
 */
export const streakVertex = `${header}
uniform mat4 viewProjection;
uniform mat4 previousViewProjection;
uniform vec3 eye;
uniform float box;
uniform float exposure;
uniform vec2 viewport;
uniform float lineWidth;
out float vAlpha;
out float vAcross;
vec3 hash3(float n) {
  return fract(sin(vec3(n * 12.9898, n * 78.233, n * 37.719)) * vec3(43758.5453, 22578.1459, 19642.3490));
}
void main() {
  int corner = gl_VertexID % 6;
  vec3 h = hash3(float(gl_InstanceID) + 0.5);
  vec3 p = eye + (fract(h - eye / box) - 0.5) * box;
  vec4 a = viewProjection * vec4(p, 1.0);
  vec4 b = previousViewProjection * vec4(p, 1.0);
  float dist = length(p - eye);
  if (a.w < 2.0 || b.w < 2.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    vAlpha = 0.0;
    vAcross = 0.0;
    return;
  }
  vec2 sa = a.xy / a.w, sb = b.xy / b.w;
  vec2 trail = (sb - sa) * exposure;
  vec2 pixels = trail * viewport * 0.5;
  float len = length(pixels);
  float cap = min(1.0, viewport.y * 0.35 / max(len, 1e-3));
  trail *= cap;
  pixels *= cap;
  len *= cap;
  vec2 dir = len > 1e-3 ? pixels / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x) * lineWidth / viewport;
  vec2 ends[6] = vec2[6](vec2(0, -1), vec2(1, -1), vec2(1, 1), vec2(0, -1), vec2(1, 1), vec2(0, 1));
  vec2 e = ends[corner];
  vec2 s = sa + trail * e.x + normal * e.y;
  gl_Position = vec4(s * a.w, a.z, a.w);
  float fade = smoothstep(box * 0.5, box * 0.22, dist) * smoothstep(box * 0.015, box * 0.06, dist);
  vAlpha = fade * smoothstep(4.0, 40.0, len) * (0.55 + 0.45 * h.z);
  vAcross = e.y;
}`;

export const streakFragment = `${header}
in float vAlpha;
in float vAcross;
uniform vec3 color;
uniform float strength;
out vec4 outColor;
void main() {
  float a = vAlpha * strength;
  a *= 1.0 - abs(vAcross);
  if (a < 0.004) discard;
  outColor = vec4(color, a);
}`;

/** Camera-facing ribbons built on the CPU: position, then (across, alpha). */
export const trailVertex = `${header}
layout(location=0) in vec3 position;
layout(location=1) in vec2 shape;
uniform mat4 viewProjection;${bendGlsl}
out vec2 vShape;
out vec3 vWorld;
void main() {
  vShape = shape;
  vWorld = position;
  gl_Position = viewProjection * vec4(bent(position), 1.0);
}`;

export const trailFragment = `${header}
in vec2 vShape;
in vec3 vWorld;
uniform vec3 eye;
uniform vec3 color;
uniform float fogDensity;
out vec4 outColor;
void main() {
  float a = vShape.y;
  a *= pow(1.0 - abs(vShape.x), 1.5);
  a *= exp(-length(vWorld - eye) * fogDensity * 2.0);
  if (a < 0.004) discard;
  outColor = vec4(color, a);
}`;
