// Contact sheets of characters for review, drawn by the engine's studio renderer.
//   node tools/checks/characterEvidence.mjs [--url http://127.0.0.1:8120] [--out shots/character] [--sheet name ...]
// Sheets: turnaround, faces, hair, headwear, outfits, builds, eyes, expressions, extras. --tiles '<json>' draws
// ad-hoc tiles: [{ label, spec, focus, yaw, pose }].
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { launch, evaluate, waitFor, watchErrors } from "../cdp.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const base = option("--url", "http://127.0.0.1:8120");
const root = fileURLToPath(new URL("../../", import.meta.url));
const out = resolve(root, option("--out", "shots/character"));
const wanted = args.flatMap((a, i) => (args[i - 1] === "--sheet" ? [a] : []));
const tiles = option("--tiles", null);

const session = await launch({ url: "about:blank", width: 1200, height: 900 });
try {
  const errors = await watchErrors(session);
  await session.send("Page.enable");
  await session.send("Page.navigate", { url: new URL("/tools/checks/check.html", base).href });
  if (!(await waitFor(session, "window.__checks", 10000))) throw new Error(`Check page did not load: ${errors.join("\n")}`);
  const images = await evaluate(session, `(${capture.toString()})(${JSON.stringify(wanted)}, ${tiles ?? "null"})`);
  if (errors.length) throw new Error(errors.join("\n"));
  await mkdir(out, { recursive: true });
  for (const image of images) {
    const path = resolve(out, `${image.name}.png`);
    await writeFile(path, Buffer.from(image.png.split(",")[1], "base64"));
    console.log(path, image.note ?? "");
  }
} finally {
  await session.close();
}

async function capture(wanted, adhoc) {
  const [{ createRenderer }, { createCharacter }, { defaultSpec, fields }, { characterPose }] = await Promise.all([
    import("/src/render.js"),
    import("/src/character/characterAnatomy.js"),
    import("/src/character/characterSpec.js"),
    import("/src/character/characterPose.js"),
  ]);
  const W = 360,
    H = 480;
  const canvas = Object.assign(document.createElement("canvas"), { width: W, height: H });
  const renderer = createRenderer(canvas);
  const background = [0.86, 0.9, 0.86];
  const front = -Math.PI / 2 + 0.0001;
  const draw = ({ spec, focus = "full", yaw = front + 0.45, pitch = 0.08, pose = null, time = 1.2 }) => {
    const anatomy = createCharacter({ ...defaultSpec(), ...spec });
    const frame = anatomy.rig.focus[focus];
    const posed = pose ? characterPose(anatomy, time, pose) : characterPose(anatomy, time, { still: true });
    renderer.render({ ...anatomy, bounds: { center: frame.center, radius: frame.radius } }, posed, { yaw, pitch, background });
  };
  const sheet = (name, list, columns = 6) => {
    const label = 22;
    const outCanvas = Object.assign(document.createElement("canvas"), { width: W * columns, height: (H + label) * Math.ceil(list.length / columns) });
    const context = outCanvas.getContext("2d");
    context.fillStyle = "#1c2230";
    context.fillRect(0, 0, outCanvas.width, outCanvas.height);
    context.font = "14px system-ui";
    context.fillStyle = "#f2efe6";
    list.forEach((tile, index) => {
      draw(tile);
      const x = (index % columns) * W,
        y = Math.floor(index / columns) * (H + label);
      context.drawImage(canvas, x, y);
      context.fillText(tile.label ?? "", x + 8, y + H + 16);
    });
    return { name, png: outCanvas.toDataURL("image/png") };
  };
  const choice = (key) => fields.find((f) => f.key === key).options.map((o) => o.id);
  const views = [["front", front], ["3/4", front + 0.6], ["side", 0.0001], ["back 3/4", Math.PI / 2 + 0.6], ["back", Math.PI / 2 - 0.0001]];
  const people = [
    {},
    { skin: "#6f4128", hair: "afro", hairColor: "#1d1716", top: "hoodie", topColor: "#cf3236", bottom: "jeans", bottomColor: "#25386b", shoes: "sneakers", eyes: "classic", build: 0.6, muscle: 0.6 },
    { skin: "#f7dccb", hair: "long", hairColor: "#e6c47d", top: "dress", topColor: "#b9a2dc", topAccent: "#f6f2e9", shoes: "shoes", eyes: "big", chest: 0.6, hips: 0.6, lashes: "long", height: 0.35 },
    { skin: "#c98f5c", hair: "ponytail", hairColor: "#3a2518", top: "silks", pattern: "hoops", topColor: "#25386b", topAccent: "#f2cf4a", bottom: "breeches", bottomColor: "#f6f2e9", shoes: "tallBoots", shoesColor: "#1f2433", hat: "helmet", hatColor: "#25386b", gloves: "gloves" },
  ];
  const sheets = {
    turnaround: () => sheet("turnaround", people.flatMap((spec, i) => views.map(([label, yaw]) => ({ label: `${i} ${label}`, spec, yaw })) ), 5),
    faces: () => sheet("faces", people.flatMap((spec, i) => [["front", front], ["3/4", front + 0.6], ["side", 0.0001]].map(([label, yaw]) => ({ label: `${i} ${label}`, spec: { ...spec, hat: "none" }, yaw, focus: "head" }))), 6),
    hair: () => sheet("hair", choice("hair").flatMap((hair) => [front + 0.35, Math.PI / 2 + 0.5].map((yaw) => ({ label: hair, spec: { hair, hairTips: "none" }, yaw, focus: "head" }))), 6),
    headwear: () => sheet("headwear", choice("hat").map((hat) => ({ label: hat, spec: { hat, hair: "shag" }, yaw: front + 0.5, focus: "head" })), 7),
    outfits: () => sheet("outfits", choice("top").flatMap((top, i) => [{ label: top, spec: { top, bottom: choice("bottom")[i % 8], shoes: choice("shoes")[i % 7], pattern: choice("pattern")[i % 9] } }]), 5),
    bottoms: () => sheet("bottoms", choice("bottom").map((bottom, i) => ({ label: `${bottom} / ${choice("shoes")[i % 7]}`, spec: { bottom, shoes: choice("shoes")[i % 7], top: "tee" }, focus: "lower" })), 4),
    builds: () => sheet("builds", [[0, 0, 0.2], [0.2, 0.3, 0.2], [0.5, 0.4, 0.35], [0.8, 0.5, 0.8], [1, 1, 0.5], [0.3, 0.9, 0.2], [0.5, 0.2, 1], [0.1, 0.6, 0]].map(([height, build, muscle]) => ({ label: `h${height} b${build} m${muscle}`, spec: { height, build, muscle } })), 4),
    eyes: () => sheet("eyes", choice("eyes").map((eyes) => ({ label: eyes, spec: { eyes }, focus: "face", yaw: front + 0.25 })), 4),
    noses: () => sheet("noses", choice("nose").map((nose) => ({ label: nose, spec: { nose }, focus: "face", yaw: front + 0.9 })), 4),
    mouths: () => sheet("mouths", choice("mouth").map((mouth) => ({ label: mouth, spec: { mouth }, focus: "face", yaw: front + 0.2 })), 4),
    facial: () => sheet("facial", choice("facialHair").map((facialHair) => ({ label: facialHair, spec: { facialHair, hair: "crop" }, focus: "head", yaw: front + 0.5 })), 4),
    extras: () => sheet("extras", [...choice("glasses").map((glasses) => ({ label: glasses, spec: { glasses }, focus: "face", yaw: front + 0.4 })), ...choice("neck").map((neck) => ({ label: neck, spec: { neck }, focus: "upper", yaw: front + 0.4 })), ...choice("back").map((back) => ({ label: back, spec: { back }, focus: "full", yaw: Math.PI / 2 + 0.7 }))], 5),
    expressions: () => sheet("expressions", ["neutral", "happy", "laugh", "surprised", "angry", "sad", "sleepy", "wink"].map((expression) => ({ label: expression, spec: {}, focus: "face", yaw: front + 0.3, pose: { expression, expressionAt: 0 }, time: 2 })), 4),
  };
  if (adhoc) return [sheet("adhoc", adhoc, Math.min(adhoc.length, 5))];
  const names = wanted.length ? wanted : ["turnaround", "faces"];
  return names.map((name) => sheets[name]());
}
