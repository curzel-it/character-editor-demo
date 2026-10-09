const aces = (x) => Math.min(1, Math.max(0, (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14)));

/** The `tone` uniform of `gradeGlsl` for an environment's grade: exposure, curve, saturation and white point. */
export const toneOf = ({ exposure, curve, saturation }) => [exposure, curve, saturation, 1 / aces(exposure)];

/** The filmic colour grade every final pass applies: a blended ACES curve, saturation, warm highlights and cool shadows. */
export const gradeGlsl = `
uniform vec4 tone;
uniform vec3 warm;
uniform vec3 cool;
vec3 aces(vec3 x) {
  return clamp(x * (2.51 * x + 0.03) / (x * (2.43 * x + 0.59) + 0.14), 0.0, 1.0);
}
vec3 grade(vec3 c) {
  vec3 t = pow(aces(pow(c, vec3(2.2)) * tone.x) * tone.w, vec3(1.0 / 2.2));
  c = mix(c, t, tone.y);
  float l = dot(c, vec3(0.3, 0.55, 0.15));
  c = mix(vec3(l), c, tone.z);
  return clamp(c + warm * smoothstep(0.45, 0.95, l) + cool * (1.0 - smoothstep(0.05, 0.5, l)), 0.0, 1.0);
}
`;
