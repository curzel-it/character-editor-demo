import { palette, tint } from "../palette.js";
import { hairCap } from "./riderHeadFrame.js";

const add = (a, b) => a.map((v, i) => v + b[i]);
const scale = (a, k) => a.map((v) => v * k);
const unit = (a) => scale(a, 1 / (Math.hypot(...a) || 1));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const sides = [-1, 1];

/** A point on the hair's cap seen from its centre at `yaw` round the head (0 the face) and `pitch` up from the ear line. */
function onCap(yaw, pitch, lift = 0) {
  const [rx, ry, rz] = hairCap.radii.map((r) => r + lift);
  return add(hairCap.centre, [rx * Math.cos(pitch) * Math.cos(yaw), ry * Math.sin(pitch), rz * Math.cos(pitch) * Math.sin(yaw)]);
}

/** A braid of shrinking beads from `from` along `fall`, closed by a tie. */
function braid(head, id, from, fall, count, rgb) {
  for (let k = 0; k < count; k++) head.shape(`${id}-${k}`, "ellipsoid", add(from, scale(fall, 0.02 + k * 0.05)), scale([0.03, 0.03, 0.03], 1 - k * 0.06), rgb);
  head.shape(`${id}-tie`, "ellipsoid", add(from, scale(fall, 0.02 + count * 0.05 - 0.02)), [0.02, 0.02, 0.02], palette.dark);
}

/**
 * Hair over the skull in its style: the cap and what hangs below it always, the fringes, crests and
 * crowns only when `covered` is false, since headwear would swallow them. Loose hair falls along the pose's `trail`.
 * @param {ReturnType<import("./riderHeadFrame.js").headFrame>} head
 */
export function riderHair(head, style, rgb, trail, covered) {
  if (style === "bald") return;
  const fall = unit(head.local(trail));
  const crown = !covered;
  if (style === "buzz" || style === "mohawk") head.shape("hair-cap", "ellipsoid", hairCap.centre, hairCap.radii.map((r) => r * 0.98), style === "buzz" ? rgb : mix(rgb, tint(rgb, 1.4), 0.4));
  else if (style === "curly") head.shape("hair-cap", "ellipsoid", hairCap.centre, hairCap.radii.map((r) => r * 1.03), rgb);
  else head.shape("hair-cap", "ellipsoid", hairCap.centre, hairCap.radii, rgb);
  const nape = [-0.1, -0.03, 0];
  if (style !== "buzz" && style !== "mohawk") head.shape("hair-nape", "ellipsoid", [-0.04, -0.03, 0], [0.078, 0.07, 0.092], rgb);

  if (style === "short" && crown) head.shape("hair-fringe", "ellipsoid", [0.082, 0.078, 0.018], [0.032, 0.03, 0.072], rgb, [0.1, 0, -0.55]);
  if (style === "quiff" && crown) {
    head.shape("hair-quiff", "ellipsoid", [0.05, 0.112, 0.006], [0.07, 0.045, 0.07], rgb, [0, 0, 0.3]);
    head.shape("hair-quiff-tip", "ellipsoid", [0.1, 0.11, 0.01], [0.035, 0.032, 0.05], rgb, [0, 0, -0.2]);
  }
  if (style === "curly")
    for (const [yaw, pitch] of [[0.5, 0.75], [-0.5, 0.75], [1.2, 0.5], [-1.2, 0.5], [2, 0.45], [-2, 0.45], [2.8, 0.4], [-2.8, 0.4], [Math.PI, 0.1], [2.4, -0.05], [-2.4, -0.05], [0, 1.15], [1.6, 1], [-1.6, 1]])
      if (crown || pitch < 0.3) head.shape(`hair-curl-${yaw}-${pitch}`, "ellipsoid", onCap(yaw, pitch, 0.004), [0.034, 0.034, 0.034], rgb);
  if (style === "spiky" && crown)
    for (const [yaw, pitch] of [[0.4, 0.7], [-0.4, 0.7], [0, 1.2], [1.4, 0.6], [-1.4, 0.6], [2.4, 0.5], [-2.4, 0.5], [Math.PI, 0.7], [2, 1.1], [-2, 1.1]]) {
      const root = onCap(yaw, pitch, -0.01);
      const out = unit(add(scale(unit(root.map((v, k) => v - hairCap.centre[k])), 1), [-0.3, 0.5, 0]));
      head.rigid(`hair-spike-${yaw}-${pitch}`, [{ p: root, r: 0.032 }, { p: add(root, scale(out, 0.075)), r: 0.003 }], { segments: 5, color: () => rgb });
    }
  if (style === "mohawk" && crown) {
    const crest = [0.6, 0.95, 1.3, 1.65, 2, 2.35, 2.7].map((a) => onCap(0, a, -0.015));
    crest.forEach((root, k) => {
      const out = unit(root.map((v, i) => v - hairCap.centre[i]));
      const height = 0.05 + 0.03 * Math.sin((k / (crest.length - 1)) * Math.PI);
      head.rigid(`hair-crest-${k}`, [{ p: root, r: [0.04, 0.016] }, { p: add(root, scale(add(out, [-0.35, 0, 0]), height)), r: [0.006, 0.004] }], { segments: 5, up: [1, 0, 0], color: () => rgb });
    });
  }
  if (style === "bob") {
    head.shape("hair-bob", "ellipsoid", [-0.024, -0.016, 0], [0.12, 0.122, 0.112], rgb);
    if (crown) head.shape("hair-fringe", "ellipsoid", [0.07, 0.07, 0], [0.04, 0.034, 0.094], rgb, [0, 0, -0.35]);
  }
  if (style === "ponytail") {
    const root = covered ? [-0.12, -0.01, 0] : [-0.116, 0.07, 0];
    head.shape("hair-tie", "ellipsoid", root, [0.022, 0.026, 0.026], palette.dark);
    const flow = unit(add(fall, [0, -0.2, 0]));
    head.rigid("hair-tail", [
      { p: add(root, [-0.01, 0, 0]), r: 0.03 },
      { p: add(root, scale(flow, 0.1)), r: 0.042 },
      { p: add(root, scale(flow, 0.22)), r: 0.034 },
      { p: add(root, scale(flow, 0.34)), r: 0.004 },
    ], { segments: 7, color: () => rgb });
  }
  if (style === "braid") braid(head, "hair-braid", nape, fall, 6, rgb);
  if (style === "pigtails")
    for (const s of sides) {
      const root = [-0.06, -0.04, 0.095 * s];
      head.shape(`hair-tie-${s}`, "ellipsoid", root, [0.02, 0.02, 0.02], palette.dark);
      braid(head, `hair-pigtail-${s}`, add(root, [-0.01, -0.02, 0.012 * s]), unit(add(fall, [0, -0.6, 0.35 * s])), 4, rgb);
    }
  if (style === "bun") head.shape("hair-bun", "ellipsoid", covered ? [-0.13, -0.03, 0] : [-0.11, 0.1, 0], [0.05, 0.05, 0.05], rgb);
  if (style === "topknot" && crown) {
    head.shape("hair-knot", "ellipsoid", [-0.02, 0.165, 0], [0.04, 0.04, 0.04], rgb);
    head.shape("hair-knot-tie", "ellipsoid", [-0.016, 0.13, 0], [0.026, 0.012, 0.026], palette.gold);
  }
  if (style === "long") {
    head.shape("hair-mane", "ellipsoid", [-0.04, -0.02, 0], [0.105, 0.115, 0.108], rgb);
    head.rigid("hair-long", [
      { p: add(nape, [0.02, 0.04, 0]), r: [0.05, 0.1] },
      { p: add(nape, scale(fall, 0.14)), r: [0.04, 0.11] },
      { p: add(nape, scale(fall, 0.3)), r: [0.028, 0.09] },
      { p: add(nape, scale(fall, 0.38)), r: [0.01, 0.06] },
    ], { segments: 8, color: () => rgb, up: [1, 0, 0] });
  }
  if (style === "afro") {
    if (crown) head.shape("hair-afro", "ellipsoid", [-0.06, 0.05, 0], [0.128, 0.128, 0.136], rgb);
    else head.shape("hair-afro", "ellipsoid", [-0.07, -0.03, 0], [0.09, 0.08, 0.13], rgb);
  }
}
