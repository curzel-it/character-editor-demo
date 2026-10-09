// The next-gate arrow, drawn over the finished frame (crisp, ungraded) but hidden wherever the scene's
// depth is nearer, so racers and terrain in front of the gate cover it.
import { bendGlsl } from "./worldBend.js";

const header = `#version 300 es
precision highp float;
`;

export const markerVertex = `${header}
layout(location=0) in vec3 position;
uniform mat4 viewProjection;${bendGlsl}
void main() {
  gl_Position = viewProjection * vec4(bent(position), 1.0);
}`;

export const markerFragment = `${header}
uniform sampler2D depthTexture;
uniform vec3 color;
out vec4 outColor;
void main() {
  if (texelFetch(depthTexture, ivec2(gl_FragCoord.xy), 0).r < gl_FragCoord.z) discard;
  outColor = vec4(color, 1.0);
}`;

// The UI's up arrow (`icons.arrowUp`) on its 32-unit grid: the head, then the shaft as two triangles.
const ARROW = [
  [16, 3.5], [4.5, 16], [27.5, 16],
  [12, 16], [20, 16], [20, 28.5],
  [12, 16], [20, 28.5], [12, 28.5],
];
// The drop shadow under the arrow, as the UI draws it: 2 px down on a 30 px icon.
const SHADOW = 2 / 30;

/**
 * The arrow over `position` pointing down at it, facing the lens of view-projection `m` and `size`
 * of the frame height tall: `{ arrow, shadow }` as flat triangle positions, the shadow shifted down.
 * @returns {{ arrow: Float32Array, shadow: Float32Array } | null} null when the point is behind the lens
 */
export function gateMarker(position, m, size) {
  const w = m[3] * position[0] + m[7] * position[1] + m[11] * position[2] + m[15];
  if (w <= 0) return null;
  const right = [m[0], m[4], m[8]],
    up = [m[1], m[5], m[9]];
  const scale = Math.hypot(...up);
  const unit = (v) => v.map((c) => c / Math.hypot(...v));
  const [r, u] = [unit(right), unit(up)];
  // `size` of the frame is 2·size in clip space, which at depth w spans this much of the world.
  const tall = (2 * size * w) / scale;
  const build = (drop) => {
    const out = new Float32Array(ARROW.length * 3);
    ARROW.forEach(([x, y], i) => {
      const across = ((x - 16) / 32) * tall,
        along = ((y - 16) / 32 - drop) * tall;
      for (let k = 0; k < 3; k++) out[i * 3 + k] = position[k] + r[k] * across + u[k] * along;
    });
    return out;
  };
  return { arrow: build(0), shadow: build(SHADOW) };
}
