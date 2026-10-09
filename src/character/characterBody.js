import { meshPart, tubeSurface, add, lerp, mix, scale, sub, unit, smooth, cross } from "./surface.js";
import { rgbOf, shade, mixRgb } from "./characterColors.js";

/** @typedef {ReturnType<import("./characterOutfit.js").outfitOf>} Outfit */

const catmull = (p0, p1, p2, p3, t) => {
  const t2 = t * t,
    t3 = t2 * t;
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
};

/** Values of `key` sampled smoothly through `stations` (sorted by `at`) at `at`. */
function profile(stations, key, at) {
  const n = stations.length;
  let k = 0;
  while (k < n - 2 && stations[k + 1].at < at) k++;
  const a = stations[k],
    b = stations[k + 1];
  const t = Math.max(0, Math.min(1, (at - a.at) / (b.at - a.at || 1)));
  const v = (i) => stations[Math.max(0, Math.min(n - 1, i))][key];
  return catmull(v(k - 1), v(k), v(k + 1), v(k + 2), t);
}

/** Sample positions from `from` to `to` about every `step`, plus a pair either side of each break so painted and stepped edges stay crisp. */
function samples(from, to, step, breaks = []) {
  const out = new Set();
  const count = Math.max(2, Math.ceil(Math.abs(to - from) / step));
  for (let k = 0; k <= count; k++) out.add(mix(from, to, k / count));
  for (const b of breaks)
    if ((b - from) * (b - to) < 0)
      for (const d of [-0.0012, 0.0012]) {
        const v = b + d * Math.sign(to - from);
        if ((v - from) * (v - to) <= 0) out.add(v);
      }
  return [...out].sort((a, b) => (a - b) * Math.sign(to - from));
}

const between = (y, a, b) => Math.max(0, Math.min(1, (y - a) / (b - a)));

/** The torso's cross-sections from the crotch up into the head: height, centre and the two radii. */
function torsoStations(j, m, marks) {
  const { s, girth, hips, waist, belly, chest, muscle } = m;
  const g = Math.pow(girth, 0.85);
  const shoulderW = m.shoulders - 0.03 * s;
  return [
    { at: marks.crotchY, cx: 0.0, rx: 0.088 * g, rz: 0.11 * hips * g },
    { at: j.thighL[1] - 0.02 * s, cx: 0.0, rx: 0.1 * g, rz: 0.14 * hips * g },
    { at: j.thighL[1] + 0.03 * s, cx: 0.0, rx: 0.105 * g, rz: 0.158 * hips * Math.pow(girth, 0.75) },
    { at: marks.pelvisTopY, cx: 0.004, rx: (0.098 + belly * 0.022) * g, rz: 0.15 * mix(hips, waist, 0.4) * Math.pow(girth, 0.7) },
    { at: marks.waistY, cx: 0.006, rx: (0.088 + belly * 0.04) * g, rz: 0.126 * waist * Math.pow(girth, 0.6) },
    { at: j.chest[1] - 0.025 * s, cx: 0.006, rx: (0.097 + belly * 0.024 + chest * 0.012) * g, rz: mix(0.138 * waist * Math.pow(girth, 0.5), shoulderW * 0.85, 0.5) },
    { at: j.chest[1] + 0.055 * s, cx: 0.004 + chest * 0.006, rx: (0.104 + chest * 0.014 + muscle * 0.008) * Math.pow(girth, 0.7), rz: shoulderW * 0.93 },
    { at: j.upperArmL[1] - 0.005 * s, cx: -0.004, rx: 0.085 * Math.pow(girth, 0.6), rz: shoulderW * 1.0 + 0.022 },
    { at: j.upperArmL[1] + 0.03 * s, cx: 0.0, rx: 0.068 * Math.pow(girth, 0.5), rz: shoulderW * 0.82 + 0.01 },
    { at: marks.neckBaseY, cx: j.neck[0] * 0.6, rx: 0.054 * mix(1, girth, 0.4), rz: 0.06 * mix(1, girth, 0.45) },
    { at: j.neck[1] + 0.025 * s, cx: j.neck[0], rx: 0.048 * mix(1, girth, 0.35), rz: 0.05 * mix(1, girth, 0.4) },
    { at: j.head[1] + 0.02 * s, cx: j.head[0], rx: 0.047 * mix(1, girth, 0.3), rz: 0.049 * mix(1, girth, 0.35) },
    { at: j.head[1] + 0.06 * s, cx: j.head[0] + 0.004, rx: 0.044, rz: 0.044 },
  ];
}

/**
 * The torso and neck as one skinned tube from the crotch up into the head, painted with the top
 * and bottom and swollen by their cloth.
 */
function torso(j, m, outfit, skin, marks) {
  const { s, girth, hips, waist, belly, chest, muscle } = m;
  const g = Math.pow(girth, 0.85);
  const top = outfit.top,
    bottom = outfit.bottom;
  const shoulderW = m.shoulders - 0.03 * s;
  const stations = torsoStations(j, m, marks);
  const bustAt = j.chest[1] + 0.045 * s;
  const neckline = (angle) => top.neck - top.scoop * Math.max(0, Math.cos(angle)) ** 2 - (top.vee ?? 0) * Math.max(0, 1 - Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle))) / 0.42);
  const breaks = [top.hem, top.neck, bottom.waist, top.neck - top.scoop, top.hemBand ? top.hem + 0.03 * s : null, top.belt ? marks.waistY - 0.016 * s : null, top.belt ? marks.waistY + 0.016 * s : null].filter((b) => b !== null && b !== undefined);
  const ys = samples(marks.crotchY, j.head[1] + 0.06 * s, top.fine ? 0.0065 : 0.011, breaks);
  const covered = (y) => {
    let t = 0;
    if (y >= top.hem && y <= top.neck - top.scoop) t = top.thick;
    if (y <= bottom.waist) t = Math.max(t, bottom.thick) + (y >= top.hem ? 0.002 : 0);
    if (top.hemBand && y >= top.hem && y <= top.hem + 0.03 * s) t += 0.003;
    return t;
  };
  const weights = (y) => {
    if (y < j.hips[1]) return { joints: ["hips", "hips"], weight: 1 };
    if (y < j.spine[1]) return { joints: ["hips", "spine"], weight: 1 - between(y, j.hips[1], j.spine[1]) };
    if (y < j.chest[1]) return { joints: ["spine", "chest"], weight: 1 - between(y, j.spine[1], j.chest[1]) };
    if (y < j.neck[1] - 0.01) return { joints: ["chest", "chest"], weight: 1 };
    if (y < j.head[1]) return { joints: ["neck", "chest"], weight: Math.min(1, 0.5 + between(y, j.neck[1] - 0.01, j.head[1])) };
    return { joints: ["head", "neck"], weight: Math.min(1, 0.5 + between(y, j.head[1], j.head[1] + 0.04)) };
  };
  const drapeFrom = j.thighL[1] + 0.055 * s;
  const legOut = Math.abs(j.thighL[2]) + 0.096 * m.thigh + 0.006;
  const drape = [Math.max(profile(stations, "rx", drapeFrom), 0.092 * m.thigh * 1.32 + 0.006), Math.max(profile(stations, "rz", drapeFrom), legOut + 0.004)];
  const rings = ys.map((y) => {
    const t = covered(y);
    const hangs = !top.tucked && y < drapeFrom && y >= top.hem;
    const bust = chest * 0.3 * Math.exp(-(((y - bustAt) / (0.07 * s)) ** 2));
    const tummy = belly * 0.18 * Math.exp(-(((y - marks.waistY + 0.02 * s) / (0.09 * s)) ** 2));
    const seat = 0.2 * mix(0.6, 1.3, (hips - 0.86) / 0.36) * Math.exp(-(((y - j.thighL[1] - 0.01 * s) / (0.07 * s)) ** 2));
    const shoulderBlade = 0.06 * Math.exp(-(((y - j.chest[1] - 0.05 * s) / (0.06 * s)) ** 2));
    return {
      p: [profile(stations, "cx", y), y, 0],
      r: hangs ? [Math.max(profile(stations, "rx", y), drape[0]) + t, Math.max(profile(stations, "rz", y), drape[1] * (1 + 0.02 * (drapeFrom - y) / s)) + t] : [profile(stations, "rx", y) + t, profile(stations, "rz", y) + t],
      skin: weights(y),
      shape: (angle) => {
        const c = Math.cos(angle),
          sn = Math.sin(angle);
        const front = Math.max(0, c);
        const twin = 0.55 + 0.45 * Math.min(1, Math.abs(sn) * 2.2);
        return 1 + bust * front ** 2.2 * twin + tummy * front ** 2 + (hangs ? seat * 0.6 : seat) * Math.max(0, -c) ** 2 + shoulderBlade * Math.max(0, -c) ** 3;
      },
    };
  });
  const pattern = top.pattern;
  const darker = shade(top.main, 0.82);
  const color = (ring, seg, angle, centre) => {
    const y = centre[1],
      z = centre[2],
      front = Math.cos(angle) > 0;
    const a = Math.abs(Math.atan2(Math.sin(angle), Math.cos(angle)));
    if (y > neckline(angle)) {
      if (top.vee && top.inner && y < top.neck + 0.005 && front) return top.inner;
      return skin;
    }
    if (top.bareShoulders && y > j.chest[1] + (front ? 0.03 : 0.07) * s) return skin;
    if (bottom.bib && a < 0.62 && y < j.chest[1] + 0.05 * s && y >= bottom.waist - 0.01) return y > j.chest[1] + 0.035 * s ? shade(bottom.rgb, 0.85) : bottom.rgb;
    if (bottom.bib && y > j.chest[1] + 0.02 * s && Math.abs(a - 0.55) < 0.08) return shade(bottom.rgb, 0.9);
    if (y >= top.hem) {
      if (top.belt && Math.abs(y - marks.waistY) < 0.016 * s) return a < 0.16 ? rgbOf("#e8b54a") : top.belt;
      if (top.open && a < 0.3) return top.inner;
      if (top.open && a < 0.46) return darker;
      if (top.hemBand && y < top.hem + 0.03 * s) return top.hemBand;
      if (top.pocket && a < 0.62 && y > top.hem + 0.04 * s && y < top.hem + 0.12 * s) return shade(top.main, 0.9);
      return pattern(y - marks.waistY, angle) ? top.accent : top.main;
    }
    if (y <= bottom.waist) return bottom.rgb;
    return skin;
  };
  return meshPart("body-torso", "hips", tubeSurface(rings, { around: top.fine ? 72 : 40, color }));
}

/** An arm from inside the shoulder to the wrist, painted with the sleeve. */
function arm(side, j, m, outfit, skin) {
  const { s } = m;
  const k = m.arm;
  const top = outfit.top;
  const shoulder = j[`upperArm${side}`],
    elbow = j[`forearm${side}`],
    wrist = j[`hand${side}`];
  const z = Math.sign(shoulder[2]);
  const start = add(shoulder, [0, -0.012 * s, -z * 0.07 * s]);
  const stations = [
    { at: 0, p: start, r: 0.04 * k },
    { at: 0.06, p: lerp(start, shoulder, 0.75), r: 0.047 * k },
    { at: 0.16, p: lerp(shoulder, elbow, 0.14), r: 0.05 * k },
    { at: 0.32, p: lerp(shoulder, elbow, 0.5), r: 0.047 * k * mix(1, 1.08, m.muscle) },
    { at: 0.5, p: elbow, r: 0.039 * k },
    { at: 0.66, p: lerp(elbow, wrist, 0.32), r: 0.04 * k * mix(1, 1.06, m.muscle) },
    { at: 0.86, p: lerp(elbow, wrist, 0.72), r: 0.033 * Math.pow(k, 0.7) },
    { at: 1, p: wrist, r: 0.028 * Math.pow(k, 0.6) },
  ];
  const sleeve = top.bareShoulders ? 0 : top.sleeve;
  const gauntlet = outfit.gloves?.kind === "gauntlets";
  const breaks = [sleeve * 0.9 + 0.05, sleeve - 0.07, gauntlet ? 0.74 : null].filter((b) => b !== null);
  const ts = samples(0, 1, 0.045, breaks);
  const covered = (t) => t <= sleeve * 0.9 + 0.05 && sleeve > 0;
  const rings = ts.map((t) => {
    const p = [0, 1, 2].map((d) => profile(stations.map((st) => ({ at: st.at, v: st.p[d] })), "v", t));
    const puff = top.sleevePuff ? top.sleevePuff * Math.sin(Math.PI * Math.min(1, t / (sleeve * 0.9 + 0.05))) : 0;
    const r = profile(stations, "r", t) + (covered(t) ? top.thick * (t > 0.05 ? 1 : 0.6) + puff : 0) + (gauntlet && t > 0.74 ? 0.008 : 0);
    let skinW;
    if (t < 0.1) skinW = { joints: [`upperArm${side}`, "chest"], weight: mix(0.45, 0.9, t / 0.1) };
    else if (t < 0.42) skinW = { joints: [`upperArm${side}`, `upperArm${side}`], weight: 1 };
    else if (t < 0.58) skinW = { joints: [`upperArm${side}`, `forearm${side}`], weight: 1 - (t - 0.42) / 0.16 };
    else if (t < 0.93) skinW = { joints: [`forearm${side}`, `forearm${side}`], weight: 1 };
    else skinW = { joints: [`forearm${side}`, `hand${side}`], weight: 0.75 };
    return { p, r, skin: skinW };
  });
  const color = (ring) => {
    const t = (ts[ring] + ts[Math.min(ts.length - 1, ring + 1)]) / 2;
    if (gauntlet && t > 0.74) return outfit.gloves.rgb;
    if (covered(t)) {
      if (top.cuff && t > sleeve * 0.9 + 0.05 - (sleeve === 1 ? 0.08 : 0.05)) return top.cuff;
      return top.sleeveRgb ?? top.main;
    }
    return skin;
  };
  return meshPart(`body-arm-${side}`, `upperArm${side}`, tubeSurface(rings, { around: 14, color, up: [1, 0, 0] }));
}

/** A relaxed hand on the hand bone: palm and fingers as one mitten with a thumb, bare or gloved. */
function hand(side, j, m, outfit, skin) {
  const { s } = m;
  const wrist = j[`hand${side}`],
    elbow = j[`forearm${side}`];
  const z = Math.sign(wrist[2]);
  const down = unit(sub(wrist, elbow));
  const forward = unit(sub([1, 0, 0], scale(down, down[0])));
  const inward = cross(down, forward).map((v) => v * z);
  const size = s * mix(0.84, 0.98, m.build);
  const gloves = outfit.gloves;
  const along = (d, f = 0, i = 0) => add(add(add(wrist, scale(down, d * size)), scale(forward, f * size)), scale(inward, i * size));
  const palmRgb = gloves ? gloves.rgb : skin;
  const fingerRgb = gloves && gloves.kind !== "mitts" ? gloves.rgb : skin;
  const rings = [
    { p: along(-0.012), r: [0.027 * size, 0.019 * size] },
    { p: along(0.02), r: [0.034 * size, 0.02 * size] },
    { p: along(0.055, 0.002), r: [0.039 * size, 0.019 * size] },
    { p: along(0.085, 0.004, 0.004), r: [0.038 * size, 0.017 * size] },
    { p: along(0.115, 0.004, 0.012), r: [0.034 * size, 0.015 * size] },
    { p: along(0.138, 0.002, 0.022), r: [0.024 * size, 0.012 * size] },
    { p: along(0.146, 0.0, 0.028), r: [0.01 * size, 0.008 * size] },
  ];
  const mitten = tubeSurface(rings, { around: 12, up: forward, color: (ring) => (ring >= 3 ? fingerRgb : palmRgb) });
  const thumb = tubeSurface(
    [
      { p: along(0.025, 0.022, 0.006), r: 0.013 * size },
      { p: along(0.055, 0.036, 0.016), r: 0.012 * size },
      { p: along(0.082, 0.04, 0.026), r: 0.01 * size },
      { p: along(0.094, 0.036, 0.03), r: 0.005 * size },
    ],
    { around: 8, color: () => fingerRgb },
  );
  const parts = [meshPart(`body-hand-${side}`, `hand${side}`, mitten), meshPart(`body-thumb-${side}`, `hand${side}`, thumb)];
  if (gloves && gloves.kind !== "gauntlets")
    parts.push(meshPart(`glove-cuff-${side}`, `hand${side}`, tubeSurface([{ p: along(-0.03), r: [0.032 * size, 0.026 * size] }, { p: along(0.0), r: [0.033 * size, 0.026 * size] }], { around: 12, up: forward, color: () => shade(gloves.rgb, 0.85) })));
  return parts;
}

/** A leg from inside the hip to the ankle, painted with the bottom and the shoe's shaft. */
function leg(side, j, m, outfit, skin) {
  const { s } = m;
  const hip = j[`thigh${side}`],
    knee = j[`shin${side}`],
    ankle = j[`foot${side}`];
  const z = Math.sign(hip[2]);
  const k = m.thigh;
  const start = add(hip, [0.0, 0.045 * s, -z * 0.03 * s]);
  const bottom = outfit.bottom,
    shoes = outfit.shoes;
  const stations = [
    { at: 0, p: start, r: 0.072 * k },
    { at: 0.07, p: lerp(start, hip, 0.9), r: 0.092 * k },
    { at: 0.2, p: lerp(hip, knee, 0.24), r: 0.083 * k },
    { at: 0.36, p: lerp(hip, knee, 0.62), r: 0.066 * Math.pow(k, 0.9) },
    { at: 0.52, p: knee, r: 0.052 * Math.pow(k, 0.7) },
    { at: 0.66, p: lerp(knee, ankle, 0.27), r: 0.056 * Math.pow(k, 0.75) * mix(1, 1.08, m.muscle) },
    { at: 0.84, p: lerp(knee, ankle, 0.66), r: 0.042 * Math.pow(k, 0.5) },
    { at: 1, p: add(ankle, [0, -0.012 * s, 0]), r: 0.034 * Math.pow(k, 0.4) },
  ];
  const shaftFrom = 1 - shoes.shaft * 0.48;
  const breaks = [bottom.length, shaftFrom, bottom.cuff ? bottom.length - 0.05 : null].filter((b) => b !== null && b > 0 && b < 1);
  const ts = samples(0, 1, 0.03, breaks);
  const covered = (t) => t <= bottom.length && bottom.length > 0;
  const boot = (t) => shoes.shaft > 0 && t >= shaftFrom;
  const rings = ts.map((t) => {
    const p = [0, 1, 2].map((d) => profile(stations.map((st) => ({ at: st.at, v: st.p[d] })), "v", t));
    let r = profile(stations, "r", t);
    if (covered(t)) r += bottom.thick + bottom.flare * smooth(bottom.length - 0.25, bottom.length, t);
    if (boot(t)) r = Math.max(r, profile(stations, "r", Math.max(t, 0.86)) * 0.55 + r * 0.45) + 0.011 + (t < shaftFrom + 0.04 ? 0.003 : 0);
    let skinW;
    if (t < 0.08) skinW = { joints: [`thigh${side}`, "hips"], weight: mix(0.55, 1, t / 0.08) };
    else if (t < 0.44) skinW = { joints: [`thigh${side}`, `thigh${side}`], weight: 1 };
    else if (t < 0.6) skinW = { joints: [`thigh${side}`, `shin${side}`], weight: 1 - (t - 0.44) / 0.16 };
    else if (t < 0.95) skinW = { joints: [`shin${side}`, `shin${side}`], weight: 1 };
    else skinW = { joints: [`shin${side}`, `foot${side}`], weight: 0.7 };
    const jodhpur = bottom.jodhpur && covered(t) ? bottom.jodhpur * Math.sin(Math.PI * between(t, 0.04, 0.42)) : 0;
    return { p, r, skin: skinW, shape: jodhpur ? (a) => 1 + (jodhpur / r) * Math.max(0, -Math.sin(a) * z) ** 1.5 : undefined };
  });
  const color = (ring) => {
    const t = (ts[ring] + ts[Math.min(ts.length - 1, ring + 1)]) / 2;
    if (boot(t)) return shoes.cuff && t < shaftFrom + 0.04 ? shoes.cuff : shoes.rgb;
    if (covered(t)) return bottom.cuff && t > bottom.length - 0.05 ? bottom.cuff : bottom.rgb;
    return skin;
  };
  return meshPart(`body-leg-${side}`, `thigh${side}`, tubeSurface(rings, { around: 16, color, up: [1, 0, 0] }));
}

/** A shoe on the foot bone, its toe on the toe bone: sole, body and the trim of its kind. */
function shoe(side, j, m, outfit, skin) {
  const { s } = m;
  const sh = outfit.shoes;
  const ankle = j[`foot${side}`];
  const z = ankle[2];
  const w = sh.width * s * mix(0.96, 1.1, m.build);
  const lift = sh.soleHeight;
  const at = (x, y) => [x * s, y * s + lift * 0.5, z];
  const rings = [
    { p: at(-0.068, 0.045), r: [0.012 * w, 0.02 * w] },
    { p: at(-0.055, 0.045), r: [0.04 * w, 0.034 * w] },
    { p: at(-0.02, 0.048), r: [0.046 * w, 0.039 * w] },
    { p: at(0.03, 0.04), r: [0.038 * w, 0.042 * w] },
    { p: at(0.09, 0.032), r: [0.032 * w * (sh.puff ? 1.2 : 1), 0.045 * w * sh.toe] },
    { p: at(0.135, 0.03), r: [0.028 * w * (sh.puff ? 1.15 : 1), 0.042 * w * sh.toe] },
    { p: at(0.165, 0.03), r: [0.018 * w, 0.03 * w * sh.toe] },
    { p: at(0.176, 0.03), r: [0.004 * w, 0.01 * w] },
  ].map((ring, k) => ({ ...ring, skin: k >= 4 ? { joints: [`toe${side}`, `foot${side}`], weight: k === 4 ? 0.5 : 1 } : { joints: [`foot${side}`, `foot${side}`], weight: 1 } }));
  const color = (ring, seg, angle, centre) => {
    const up = Math.cos(angle);
    if (centre[1] < lift + 0.008 * s || up < -0.6) return sh.sole;
    if (sh.open) {
      const band = (ring === 2 || ring === 4) && up > -0.3;
      return band ? sh.rgb : ring >= 1 && up > -0.2 ? skin : sh.sole;
    }
    if (sh.laces && ring >= 2 && ring <= 4 && up > 0.75) return sh.laces;
    if (sh.stripe && ring >= 1 && ring <= 3 && Math.abs(up) < 0.25) return sh.stripe;
    return sh.rgb;
  };
  return meshPart(`shoe-${side}`, `foot${side}`, tubeSurface(rings, { around: 16, color, up: [0, 1, 0] }));
}

/**
 * A skirt or a tunic's tails: a cone from the waist past the hips to its hem, wide enough to clear the
 * thighs, its lower rings following the legs.
 */
function skirt(skirtWear, j, m, rgb, trim, marks, id) {
  const { s } = m;
  const legLength = j.thighL[1] - j.footL[1];
  const fromY = skirtWear.from === "waist" ? marks.waistY : marks.pelvisTopY;
  const hemY = j.thighL[1] - skirtWear.length * legLength;
  const hipOut = Math.abs(j.thighL[2]);
  const thigh = 0.092 * m.thigh;
  const ys = samples(fromY, hemY, 0.02, [hemY + 0.025 * s]);
  const torsoAt = (y) => {
    const t = between(y, j.thighL[1] - 0.02 * s, marks.waistY);
    return [mix(0.1, 0.09, t) * Math.pow(m.girth, 0.85), mix(0.158 * m.hips, 0.126 * m.waist, t) * Math.pow(m.girth, 0.7)];
  };
  const rings = ys.map((y) => {
    const below = between(y, fromY, hemY);
    const [tx, tz] = torsoAt(Math.max(y, j.thighL[1] - 0.02 * s));
    const legOut = hipOut + thigh;
    const clear = y < j.thighL[1] + 0.02 * s ? Math.max(tz, legOut + 0.012) : tz;
    const rz = Math.max(tz, clear) + 0.01 + skirtWear.flare * below ** 1.4;
    const rx = Math.max(tx, thigh + 0.01) + 0.012 + skirtWear.flare * 0.8 * below ** 1.4;
    const weight = 1 - 0.55 * smooth(0.3, 1, below);
    return { p: [0.004, y, 0], r: [rx, rz], skin: { joints: ["hips", "hips"], weight: 1 }, below, weight };
  });
  const mesh = tubeSurface(rings, { around: 32, color: (ring) => (trim && ring >= rings.length - 2 ? trim : rgb), caps: false });
  const count = mesh.vertices.length / 3;
  for (let v = 0; v < count; v++) {
    const vz = mesh.vertices[v * 3 + 2],
      vy = mesh.vertices[v * 3 + 1];
    const below = between(vy, fromY, hemY);
    const weight = 1 - 0.6 * smooth(0.25, 1, below) * Math.min(1, Math.abs(vz) / (hipOut * 1.2));
    mesh.skin.joints[v] = ["hips", vz < 0 ? "thighL" : "thighR"];
    mesh.skin.weights[v] = weight;
  }
  const inner = tubeSurface(rings.map((r) => ({ ...r, r: r.r.map((v) => v - 0.003) })), { around: 32, color: () => shade(rgb, 0.82), caps: false });
  const innerCount = inner.vertices.length / 3;
  for (let v = 0; v < innerCount; v++) {
    inner.skin.joints[v] = mesh.skin.joints[v];
    inner.skin.weights[v] = mesh.skin.weights[v];
  }
  return [meshPart(id, "hips", mesh), meshPart(`${id}-inside`, "hips", inner)];
}

/** Bands and trims that sit off the body: belts, collars, a hood, drawstrings, lapels. */
function trims(j, m, outfit, marks) {
  const { s } = m;
  const stations = torsoStations(j, m, marks);
  const top = outfit.top;
  const parts = [];
  const loopAt = (id, y, rx, rz, thickness, rgb, cx = 0.006, bone = "spine") => {
    const rings = Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      return { p: [cx + Math.cos(a) * rx, y, Math.sin(a) * rz], r: thickness };
    });
    parts.push(meshPart(id, bone, tubeSurface(rings, { around: 6, closed: true, color: () => rgb })));
  };
  const g = Math.pow(m.girth, 0.85);
  if (top.collar && !top.hood) {
    const y = top.neck - 0.006 * s;
    const rx = 0.058 * mix(1, m.girth, 0.4) + top.thick,
      rz = 0.063 * mix(1, m.girth, 0.45) + top.thick;
    loopAt("collar", y, rx, rz, [0.012 * s, 0.006 * s], top.collar, j.neck[0] * 0.6, "chest");
  }
  if (top.hood) {
    const y = marks.neckBaseY - 0.005 * s;
    const rings = Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      const back = Math.max(0, -Math.cos(a));
      const rx = 0.07 + 0.02 * back,
        rz = 0.08 + 0.012 * back;
      return { p: [j.neck[0] * 0.6 + Math.cos(a) * rx - 0.012 * back, y + 0.02 * back * s, Math.sin(a) * rz], r: [mix(0.016, 0.05, back ** 1.5) * s, mix(0.02, 0.04, back) * s] };
    });
    parts.push(meshPart("hood", "chest", tubeSurface(rings, { around: 10, closed: true, color: (ring, seg, angle) => (Math.cos(angle) > 0.6 && ring > 6 && ring < 18 ? shade(top.main, 0.75) : top.main) })));
    for (const zs of [-1, 1]) {
      const from = [0.07 * s, marks.neckBaseY - 0.01 * s, zs * 0.03 * s];
      parts.push(meshPart(`drawstring-${zs}`, "chest", tubeSurface([{ p: from, r: 0.004 * s }, { p: add(from, [0.012 * s, -0.08 * s, zs * 0.004]), r: 0.004 * s }, { p: add(from, [0.013 * s, -0.095 * s, zs * 0.004]), r: 0.007 * s }], { around: 6, color: () => top.buttons ?? top.accent })));
    }
  }
  if (top.open) {
    for (const zs of [-1, 1]) {
      const y = marks.neckBaseY - 0.05 * s;
      parts.push({ id: `lapel-${zs}`, bone: "chest", shape: "ellipsoid", segments: 10, position: [0.075 * s * g, y, zs * (top.open + 0.02 * s)], rotation: [zs * 0.5, 0, -0.25], scale: [0.006 * s, 0.05 * s, 0.022 * s], color: shade(top.main, 0.88) });
    }
  }
  if (top.bareShoulders)
    for (const side of [-1, 1]) {
      const z = side * 0.068 * s;
      const path = [];
      const yTop = (() => {
        let y = j.chest[1];
        while (y < j.neck[1] && profile(stations, "rz", y) > Math.abs(z) + 0.012) y += 0.004;
        return y;
      })();
      const surface = (y, sign) => {
        const rx = profile(stations, "rx", y) + 0.008,
          rz = profile(stations, "rz", y) + 0.008;
        return [profile(stations, "cx", y) + sign * rx * Math.sqrt(Math.max(0.02, 1 - (z / rz) ** 2)), y, z];
      };
      const from = j.chest[1] + 0.02 * s,
        back = j.chest[1] + 0.06 * s;
      for (let k = 0; k <= 6; k++) path.push(surface(mix(from, yTop, k / 6), 1));
      for (let k = 6; k >= 0; k--) path.push(surface(mix(back, yTop, k / 6), -1));
      parts.push(meshPart(`strap-${side}`, "chest", tubeSurface(path.map((p) => ({ p, r: [0.004 * s, 0.011 * s] })), { around: 6, up: [0, 0, 1], color: () => top.main })));
    }
  if (top.buttons && top.vee)
    for (let k = 0; k < 4; k++) {
      const y = top.hem + (0.035 + k * 0.045) * s;
      if (y > top.neck - top.vee - 0.01) break;
      const rx = profile(stations, "rx", y) + top.thick;
      parts.push({ id: `button-${k}`, bone: "spine", shape: "ellipsoid", segments: 10, position: [profile(stations, "cx", y) + rx + 0.002, y, 0], rotation: [0, 0, 0], scale: [0.004 * s, 0.0065 * s, 0.0065 * s], color: top.buttons });
    }
  if (top.belt) loopAt("belt", marks.waistY, (0.088 + m.belly * 0.04) * g + top.thick + 0.004, 0.126 * m.waist * Math.pow(m.girth, 0.6) + top.thick + 0.004, [0.017 * s, 0.004], top.belt, 0.006, "spine");
  return parts;
}

/**
 * The whole body: torso with neck, arms, hands, legs, shoes and the cloth that sits off it.
 * @param {Record<string, number[]>} j joints
 * @param {ReturnType<import("./characterRig.js").bodyMeasures>} m
 * @param {Outfit} outfit
 * @param {import("./characterSpec.js").CharacterSpec} spec
 * @param {{ crotchY: number, waistY: number, pelvisTopY: number, neckBaseY: number }} marks
 */
export function characterBody(j, m, outfit, spec, marks) {
  const skin = rgbOf(spec.skin);
  const parts = [torso(j, m, outfit, skin, marks)];
  for (const side of ["L", "R"]) {
    parts.push(arm(side, j, m, outfit, skin), ...hand(side, j, m, outfit, skin), leg(side, j, m, outfit, skin), shoe(side, j, m, outfit, skin));
  }
  const top = outfit.top;
  if (top.skirt) parts.push(...skirt(top.skirt, j, m, top.main, top.accent, marks, "tunic"));
  if (outfit.bottom.skirt) parts.push(...skirt(outfit.bottom.skirt, j, m, outfit.bottom.rgb, null, marks, "skirt"));
  parts.push(...trims(j, m, outfit, marks));
  return parts;
}

void mixRgb;
