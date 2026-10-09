import { meshPart, tubeSurface, add, mix, scale, sub, unit } from "./surface.js";
import { rgbOf, shade, mixRgb } from "./characterColors.js";
import { aim } from "./characterEyes.js";

const INK = [0.13, 0.08, 0.08];
const MOUTH = [0.36, 0.12, 0.14];
const TEETH = [0.98, 0.97, 0.93];
const TONGUE = [0.86, 0.42, 0.45];
const LIP = [0.78, 0.26, 0.3];

/** Brow shapes: thickness at the inner end, the middle and the outer end (in eye radii), the arch's rise, and the span. */
const browStyles = {
  soft: { widths: [0.28, 0.24, 0.12], arch: 0.06, span: 0.26 },
  thick: { widths: [0.42, 0.38, 0.2], arch: 0.04, span: 0.27 },
  thin: { widths: [0.15, 0.13, 0.07], arch: 0.07, span: 0.26 },
  arched: { widths: [0.24, 0.2, 0.08], arch: 0.14, span: 0.27 },
  straight: { widths: [0.3, 0.26, 0.18], arch: 0, span: 0.27 },
  bushy: { widths: [0.5, 0.5, 0.32], arch: 0.05, span: 0.28, bushy: true },
};

/** Brows on their bones above the eyes, in the hair's colour; dots are two round marks. */
function brows(head, spec, eyeRadius, hair) {
  const parts = [];
  const joints = {};
  const style = spec.brows;
  const raise = mix(0.2, 0.38, Number(spec.browHeight));
  for (const [name, s] of [["L", -1], ["R", 1]]) {
    const centreYaw = s * head.eye.yaw * 1.02,
      centrePitch = head.eye.pitch + raise;
    const centre = head.offset(centreYaw, centrePitch, 0.002);
    joints[`brow${name}`] = centre;
    if (style === "none") continue;
    if (style === "dots") {
      const at = head.offset(s * (head.eye.yaw - 0.06), centrePitch, 0.001);
      const n = head.normal(s * (head.eye.yaw - 0.06), centrePitch);
      parts.push({ id: `brow-${name}`, bone: `brow${name}`, shape: "ellipsoid", segments: 10, position: at, rotation: aim(n), scale: [eyeRadius * 0.12, eyeRadius * 0.28, eyeRadius * 0.36], color: hair });
      continue;
    }
    const b = browStyles[style] ?? browStyles.soft;
    const count = 8;
    const rings = [];
    for (let k = 0; k <= count; k++) {
      const t = k / count;
      const yaw = s * (head.eye.yaw - b.span * 0.55 + b.span * t);
      const pitch = centrePitch + b.arch * Math.sin(Math.PI * Math.min(1, t * 1.15)) - 0.03 * t;
      const w = t < 0.5 ? mix(b.widths[0], b.widths[1], t * 2) : mix(b.widths[1], b.widths[2], (t - 0.5) * 2);
      const r = eyeRadius * w * 0.5;
      rings.push({ p: head.offset(yaw, pitch, r * 0.2), r: [r * 0.55, r] });
    }
    const up = head.normal(centreYaw, centrePitch);
    parts.push(meshPart(`brow-${name}`, `brow${name}`, tubeSurface(rings, { around: 8, up, color: () => (b.bushy ? shade(hair, 1.05) : hair) })));
  }
  return { parts, joints };
}

/** The resting mouth: the line's half-width in radians of yaw, its curve (corners up when positive), an asymmetry, and how open it rests. */
const mouthStyles = {
  smile: { width: 0.27, curve: 0.07, open: 0 },
  grin: { width: 0.32, curve: 0.08, open: 0.7 },
  soft: { width: 0.17, curve: 0.04, open: 0 },
  smirk: { width: 0.25, curve: 0.02, tilt: 0.06, open: 0 },
  neutral: { width: 0.22, curve: 0.0, open: 0 },
  cat: { width: 0.24, curve: 0.04, cat: true, open: 0 },
  open: { width: 0.24, curve: 0.06, open: 1 },
  pout: { width: 0.11, curve: -0.01, open: 0.25, round: true },
};

/**
 * The mouth: a line whose ends hang on the corner bones, so expressions curl them, over an inner
 * mouth with teeth and tongue on the `mouthOpen` bone that slides out through the face to open it.
 */
function mouth(head, spec, skin) {
  const style = mouthStyles[spec.mouth] ?? mouthStyles.smile;
  const size = head.size;
  const pitch0 = head.mouth.pitch;
  const tint = Number(spec.lips);
  const line = mixRgb(mixRgb(INK, shade(skin, 0.45), 0.35), LIP, tint * 0.7);
  const parts = [];
  const centre = head.offset(0, pitch0, 0);
  const normal = head.normal(0, pitch0);
  const corner = (s) => head.offset(s * style.width, pitch0 + style.curve + (style.tilt ?? 0) * (s > 0 ? 1 : -0.4), 0);
  const joints = {
    mouthL: corner(-1),
    mouthR: corner(1),
    mouthOpen: sub(centre, scale(normal, 0.018 * size)),
  };
  const count = style.cat ? 16 : 10;
  const rings = [];
  for (let k = 0; k <= count; k++) {
    const t = (k / count) * 2 - 1;
    let lift = style.curve * t * t + (style.tilt ?? 0) * Math.max(0, t) - (style.tilt ?? 0) * 0.4 * Math.max(0, -t);
    if (style.cat) lift = style.curve * t * t + 0.035 * (1 - Math.abs(Math.sin(t * Math.PI))) - 0.035;
    const yaw = t * style.width;
    const w = 0.0034 * size * (0.55 + 0.45 * Math.cos(t * Math.PI * 0.5)) * mix(1, 1.5, tint);
    const p = head.offset(yaw, pitch0 + lift, w * 0.15);
    const side = t < 0 ? "mouthL" : "mouthR";
    const weight = Math.min(1, Math.max(0, (Math.abs(t) - 0.15) / 0.7));
    rings.push({ p, r: [w * 0.6, w], skin: { joints: [side, "head"], weight } });
  }
  if (!style.round)
    parts.push({ ...meshPart("mouth-line", "head", tubeSurface(rings, { around: 6, up: normal, color: () => line })) });
  const open = style.open;
  const inner = joints.mouthOpen;
  const local = (p) => p;
  const width = style.width * 0.1 * size * (style.round ? 2.2 : 1);
  const depth = 0.018 * size;
  const turn = aim(normal);
  const innerAt = add(inner, scale(normal, 0));
  parts.push({ id: "mouth-inner", bone: "mouthOpen", shape: "ellipsoid", segments: 14, position: local(innerAt), rotation: turn, scale: [depth * 1.02, 0.012 * size * (style.round ? 1.1 : 1), width], color: MOUTH });
  parts.push({ id: "mouth-teeth", bone: "mouthOpen", shape: "ellipsoid", segments: 12, position: local(add(innerAt, add(scale(normal, -0.0025 * size), [0, 0.0062 * size, 0]))), rotation: turn, scale: [depth, 0.0048 * size, width * 0.8], color: TEETH });
  parts.push({ id: "mouth-tongue", bone: "mouthOpen", shape: "ellipsoid", segments: 12, position: local(add(innerAt, add(scale(normal, -0.004 * size), [0, -0.007 * size, 0]))), rotation: turn, scale: [depth, 0.006 * size, width * 0.62], color: mixRgb(TONGUE, LIP, tint * 0.3) });
  if (style.round)
    parts.push({ id: "mouth-pucker", bone: "mouthOpen", shape: "ellipsoid", segments: 14, position: local(add(innerAt, scale(normal, 0.0))), rotation: turn, scale: [depth * 1.05, 0.016 * size, width * 1.12], color: mixRgb(shade(skin, 0.86), LIP, 0.25 + tint * 0.5) });
  return { parts, joints, open };
}

/** The nose in its style, sized by the slider, in the skin's colour. */
function nose(head, spec, skin) {
  const size = head.size * mix(0.75, 1.35, Number(spec.noseSize));
  const pitch = head.nose.pitch;
  const tip = head.point(0, pitch);
  const n = head.normal(0, pitch);
  const rgb = shade(skin, 0.985);
  const shapeAt = (id, offset, radii, rot = aim(n)) => ({ id, bone: "head", shape: "ellipsoid", segments: 14, position: add(tip, scale(n, offset * size)), rotation: rot, scale: radii.map((r) => r * size), color: rgb });
  const bridge = (from, out, radius, end) => {
    const rings = [];
    for (let k = 0; k <= 6; k++) {
      const t = k / 6;
      const p = head.offset(0, pitch + from * (1 - t), (out * t ** 1.4 + 0.001) * size);
      rings.push({ p: add(p, [0, -end * size * t * t, 0]), r: radius(t) * size });
    }
    return meshPart("nose", "head", tubeSurface(rings, { around: 10, up: [0, 1, 0], color: () => rgb }));
  };
  switch (spec.nose) {
    case "dot":
      return [shapeAt("nose", 0.0, [0.006, 0.006, 0.008])];
    case "round":
      return [shapeAt("nose", 0.002, [0.014, 0.014, 0.017])];
    case "broad":
      return [shapeAt("nose", 0.0, [0.012, 0.012, 0.022]), shapeAt("nose-tip", 0.006, [0.008, 0.009, 0.01])];
    case "snub":
      return [shapeAt("nose", 0.002, [0.011, 0.01, 0.013], aim(unit(add(n, [0, 0.6, 0]))))];
    case "straight":
      return [bridge(0.3, 0.016, (t) => mix(0.004, 0.009, t), 0.001), shapeAt("nose-tip", 0.013, [0.007, 0.008, 0.009])];
    case "pointed":
      return [bridge(0.28, 0.024, (t) => mix(0.005, 0.006, t) * (1 - 0.5 * t * t), -0.004)];
    case "hooked":
      return [bridge(0.32, 0.02, (t) => mix(0.004, 0.009, Math.sin(t * 2.6) * 0.6 + t * 0.4), 0.006), shapeAt("nose-tip", 0.011, [0.007, 0.009, 0.008])];
    default:
      return [shapeAt("nose", 0.0, [0.01, 0.01, 0.013])];
  }
}

/**
 * The face's features: brows, nose and mouth, with each bone's joint and the mouth's resting
 * openness for the pose.
 * @param {import("./headShape.js").HeadShape} head
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {number} eyeRadius
 */
export function characterFace(head, spec, eyeRadius) {
  const skin = rgbOf(spec.skin);
  const hair = rgbOf(spec.hairColor);
  const b = brows(head, spec, eyeRadius, shade(hair, spec.hair === "bald" ? 0.7 : 0.88));
  const m = mouth(head, spec, skin);
  return {
    parts: [...b.parts, ...nose(head, spec, skin), ...m.parts],
    joints: { ...b.joints, ...m.joints },
    mouthOpen: m.open,
  };
}
