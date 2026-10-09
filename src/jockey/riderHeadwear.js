import { palette } from "../palette.js";
import { loop } from "./riderMesh.js";
import { leather } from "./tackColors.js";
import { capPaint } from "./silksPattern.js";

const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map((v) => v * k);
const unit = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const fleece = [0.93, 0.88, 0.78];

/** Headwear that covers the crown, so the hair's fringes and crests stay under it. */
export const coveringHats = new Set(["cap", "aviator", "bandana", "pointed", "horned"]);

/** How far the headwear sits out from the head's centre where goggles pushed up would rest on it. */
const reach = { cap: 0.122, aviator: 0.122, bandana: 0.114, pointed: 0.122, horned: 0.122 };

/** A dome over the crown of `radius`, its rim tipped back by `lean` so it sits above the brow and low at the nape. */
function dome(head, id, { radius, lean = 0.25, centre = [-0.014, 0.034, 0], drop = 0.015, color }) {
  const up = [-Math.sin(lean), Math.cos(lean), 0];
  const rings = [];
  for (let k = 0; k <= 5; k++) {
    const phi = (k / 5) * (Math.PI / 2);
    rings.push({ p: add(centre, scale(up, -drop + (radius + drop) * Math.sin(phi))), r: radius * Math.cos(phi) + 0.004 });
  }
  head.rigid(id, rings, { segments: 12, up: [1, 0, 0], color });
  return { up, centre, front: add(add(centre, scale([Math.cos(lean), Math.sin(lean), 0], radius)), scale(up, -drop)) };
}

function chinStrap(head) {
  head.rigid("chin-strap", [[-0.02, 0.0, -0.096], [0.02, -0.07, -0.084], [0.06, -0.125, 0], [0.02, -0.07, 0.084], [-0.02, 0.0, 0.096]].map((p) => ({ p, r: 0.0045 })), { segments: 4, color: () => palette.dark });
}

/** The goggles: two lenses in a dark frame on a strap, over the eyes or pushed up onto the forehead or headwear. */
function goggles(head, lens, hat, down) {
  const lift = down ? 0 : 0.072;
  const out = down ? 0.103 : (reach[hat] ?? 0.104) * Math.cos(0.45) + 0.01;
  const pitch = down ? 0 : 0.75;
  const centre = [out, -0.002 + lift, 0];
  head.shape("goggles", "box", add(centre, [-0.004, 0.002, 0]), [0.006, 0.006, 0.012], palette.dark, [0, 0, pitch]);
  for (const s of [-1, 1]) {
    head.shape(`goggle-frame-${s}`, "ellipsoid", add(centre, [-0.006, 0, 0.038 * s]), [0.014, 0.024, 0.03], palette.dark, [0, -0.32 * s, pitch]);
    head.shape(`goggle-lens-${s}`, "ellipsoid", add(centre, [0.002, 0, 0.038 * s]), [0.01, 0.019, 0.024], lens, [0, -0.32 * s, pitch]);
  }
  const band = down ? [0.112, 0.103] : [(reach[hat] ?? 0.106) + 0.006, (reach[hat] ?? 0.1) + 0.004];
  head.rigid("goggle-strap", loop([-0.012, lift - 0.006, 0], [1, 0, 0], [0, 0, 1], ...band, 14).map((p) => ({ p, r: [0.012, 0.006] })), { segments: 4, closed: true, color: () => palette.dark });
}

/**
 * Headwear on the head in its frame: the silks cap with its peak and pompom, a leather flying cap
 * with fleece-lined flaps, a bandana knotted at the back, a gold circlet, a pointed hat or a horned
 * helm; then the goggles, `down` over the eyes or pushed up.
 * @param {ReturnType<import("./riderHeadFrame.js").headFrame>} head
 */
export function riderHeadwear(head, look, colors, pattern, trail, down) {
  const { hat } = look;
  if (hat === "cap") {
    const paint = capPaint(pattern, colors);
    const { front } = dome(head, "helmet", { radius: 0.124, color: (band, _, angle) => paint(band / 4, angle) });
    head.shape("peak", "box", add(front, [0.035, 0.002, 0]), [0.045, 0.007, 0.075], colors.cap, [0, 0, -0.08]);
    head.shape("pompom", "ellipsoid", [-0.045, 0.165, 0], [0.032, 0.028, 0.032], colors.accent);
    chinStrap(head);
  } else if (hat === "aviator") {
    dome(head, "aviator", { radius: 0.122, lean: 0.35, drop: 0.035, color: () => leather });
    head.rigid("aviator-trim", loop([-0.02, 0.022, 0], [Math.cos(0.35), Math.sin(0.35), 0], [0, 0, 1], 0.12, 0.118, 14).map((p) => ({ p, r: 0.014 })), { segments: 5, closed: true, color: () => fleece });
    for (const s of [-1, 1]) {
      head.shape(`aviator-flap-${s}`, "ellipsoid", [-0.02, -0.045, 0.094 * s], [0.04, 0.06, 0.022], leather, [0, 0, 0.15]);
      head.shape(`aviator-fleece-${s}`, "ellipsoid", [-0.02, -0.098, 0.09 * s], [0.03, 0.016, 0.024], fleece);
    }
    chinStrap(head);
  } else if (hat === "bandana") {
    dome(head, "bandana", { radius: 0.115, lean: 0.3, color: (band) => (band === 0 ? colors.accent : colors.body) });
    const knot = [-0.125, 0.02, 0];
    head.shape("bandana-knot", "ellipsoid", knot, [0.025, 0.028, 0.034], colors.body);
    const fall = unit(add(head.local(trail), [0, -0.4, 0]));
    for (const s of [-1, 1])
      head.rigid(`bandana-tail-${s}`, [
        { p: knot, r: [0.006, 0.026] },
        { p: add(add(knot, scale(fall, 0.09)), [0, 0, 0.025 * s]), r: [0.005, 0.022] },
        { p: add(add(knot, scale(fall, 0.15)), [0, 0, 0.04 * s]), r: [0.004, 0.006] },
      ], { segments: 4, up: [1, 0, 0], color: () => colors.body });
  } else if (hat === "circlet") {
    head.rigid("circlet", loop([-0.012, 0.055, 0], [Math.cos(0.2), Math.sin(0.2), 0], [0, 0, 1], 0.118, 0.106, 16).map((p) => ({ p, r: 0.007 })), { segments: 5, closed: true, color: () => palette.gold });
    head.shape("circlet-gem", "ellipsoid", [0.108, 0.078, 0], [0.01, 0.016, 0.012], colors.accent);
  } else if (hat === "pointed") {
    const brim = [-0.012, 0.045, 0];
    head.rigid("hat-brim", [{ p: add(brim, [0, -0.006, 0]), r: 0.2 }, { p: add(brim, [0, 0.006, 0]), r: 0.2 }], { segments: 12, up: [1, 0, 0], color: () => colors.cap });
    const back = unit([head.local(trail)[0], 0, head.local(trail)[2]]);
    const cone = [0, 0.06, 0.16, 0.28, 0.36].map((h, k) => ({ p: add(add(brim, [0, h, 0]), scale(back, 0.12 * (h / 0.36) ** 2)), r: [0.118, 0.1, 0.07, 0.035, 0.006][k] }));
    head.rigid("hat-cone", cone, { segments: 10, up: [1, 0, 0], color: (band) => (band === 0 ? colors.accent : colors.cap) });
  } else if (hat === "horned") {
    dome(head, "helmet", { radius: 0.124, color: () => palette.steel });
    head.rigid("helm-rim", loop([-0.014, 0.022, 0], [Math.cos(0.25), Math.sin(0.25), 0], [0, 0, 1], 0.128, 0.128, 16).map((p) => ({ p, r: 0.012 })), { segments: 5, closed: true, color: () => palette.gold });
    for (const s of [-1, 1]) {
      const root = [-0.03, 0.1, 0.1 * s];
      head.rigid(`helm-horn-${s}`, [
        { p: root, r: 0.035 },
        { p: add(root, [0, 0.03, 0.07 * s]), r: 0.03 },
        { p: add(root, [0.02, 0.1, 0.11 * s]), r: 0.018 },
        { p: add(root, [0.05, 0.17, 0.1 * s]), r: 0.004 },
      ], { segments: 6, color: () => palette.ivory });
    }
    chinStrap(head);
  }
  goggles(head, look.lens, hat, down);
}
