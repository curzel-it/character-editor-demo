import { gridSurface, meshPart, tubeSurface, add, mix, scale, smooth } from "./surface.js";
import { rgbOf, shade, mixRgb } from "./characterColors.js";

/** The beard's top edge: under the lip at the front, up the cheeks and into the sideburns. */
const beardTop = (head) => (yaw) => {
  const a = Math.abs(yaw);
  const front = head.mouth.pitch - 0.1,
    cheek = head.mouth.pitch + 0.2,
    side = head.ear.pitch + 0.05;
  if (a < 0.35) return mix(front, cheek, smooth(0.12, 0.35, a));
  return mix(cheek, side, smooth(0.35, 1.35, a));
};

/** How each style covers the lower face: thickness, and which band of the beard region it keeps. */
const styles = {
  stubble: { paint: 0.4 },
  moustache: { tache: "plain" },
  handlebar: { tache: "handlebar" },
  goatee: { tache: "plain", shell: { thick: 0.008, keep: (yaw) => Math.abs(yaw) < 0.34, top: (head) => head.mouth.pitch - 0.08 } },
  chinstrap: { shell: { thick: 0.005, keep: (yaw, pitch, top) => pitch < top - 0.32 || Math.abs(yaw) > 1.15 } },
  beard: { tache: "plain", paint: 0.25, shell: { thick: 0.011 } },
  fullBeard: { tache: "plain", shell: { thick: 0.022, drop: 0.07 } },
};

/**
 * Facial hair in the hair's colour: stubble painted on the skin, shells over the jaw for beards,
 * and a moustache over the lip. `paint(yaw, pitch)` is handed to the head's skin.
 * @param {import("./headShape.js").HeadShape} head
 * @param {import("./characterSpec.js").CharacterSpec} spec
 */
export function facialHair(head, spec) {
  const style = styles[spec.facialHair];
  if (!style) return { parts: [], paint: null };
  const size = head.size;
  const hair = shade(rgbOf(spec.hairColor), 0.92);
  const skin = rgbOf(spec.skin);
  const topOf = beardTop(head);
  const parts = [];
  const inRegion = (yaw, pitch) => Math.abs(yaw) < 1.7 && pitch < topOf(yaw) && pitch > -1.42;
  const paint = style.paint
    ? (yaw, pitch) => (inRegion(yaw, pitch) || (Math.abs(yaw) < 0.3 && Math.abs(pitch - head.mouth.pitch - 0.12) < 0.06) ? mixRgb(skin, hair, style.paint) : null)
    : null;
  if (style.shell) {
    const shell = style.shell;
    const columns = 72,
      rows = 30;
    const top = shell.top ? () => shell.top(head) : topOf;
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const pitch = mix(head.ear.pitch + 0.15, -1.45, r / rows);
      const row = [];
      for (let i = 0; i <= columns; i++) {
        const yaw = mix(-1.75, 1.75, i / columns);
        const edge = top(yaw);
        const m = smooth(edge + 0.04, edge - 0.06, pitch) * smooth(1.72, 1.55, Math.abs(yaw)) * (shell.keep ? (shell.keep(yaw, pitch, edge) ? 1 : 0) : 1);
        const chin = shell.drop ? shell.drop * size * Math.exp(-((yaw / 0.55) ** 2)) * smooth(head.mouth.pitch - 0.2, -1.2, pitch) : 0;
        const out = m * (shell.thick * size + chin) - (1 - m) * 0.002 * size;
        row.push(add(head.offset(yaw, pitch, out), [0, -chin * 0.7, 0]));
      }
      grid.push(row);
    }
    parts.push(meshPart("beard", "head", gridSurface(grid, { wrap: false, color: (r, i) => ((r + i) % 7 === 0 ? shade(hair, 0.9) : hair) })));
  }
  if (style.tache) {
    for (const s of [-1, 1]) {
      const curl = style.tache === "handlebar";
      const path = [];
      const count = curl ? 8 : 6;
      for (let k = 0; k <= count; k++) {
        const t = k / count;
        const yaw = s * mix(0.02, curl ? 0.42 : 0.3, t);
        const pitch = head.mouth.pitch + 0.1 - 0.06 * t * t + (curl ? 0.2 * smooth(0.65, 1, t) : 0);
        path.push(head.offset(yaw, pitch, 0.004 * size + (curl ? 0.012 * size * smooth(0.6, 1, t) : 0)));
      }
      const width = (t) => size * (curl ? 0.011 * (1 - t * 0.75) : 0.012 * Math.sin(Math.PI * (0.25 + 0.6 * t))) + 0.001;
      parts.push(
        meshPart(
          `moustache-${s}`,
          "head",
          tubeSurface(
            path.map((p, k) => ({ p, r: [width(k / count) * 0.55, width(k / count)] })),
            { around: 8, up: head.normal(0, head.mouth.pitch + 0.1), color: () => hair },
          ),
        ),
      );
    }
  }
  return { parts, paint };
}

void scale;
