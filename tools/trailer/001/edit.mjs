import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { FPS } from "./recorder.mjs";

/**
 * The cut: each scene by name, trimmed by `head` and `tail` seconds. It runs egg to fire, as the
 * story goes; the first and last frames fade through white so the end flows back into the start.
 */
const CUT = [
  { name: "hatch", head: 0.2, tail: 0.3 },
  { name: "inspect" },
  { name: "takeoff", head: 1 },
  { name: "nose", head: 0.5, tail: 0.5 },
  { name: "teen" },
  { name: "stick", tail: 1.2 },
  { name: "adult" },
  { name: "log", tail: 1 },
  { name: "fire" },
];
const FLASH = 0.35;

/** Joins the scenes recorded in `dir` into the video `file`; resolves to its length in seconds. */
export async function edit(dir, file) {
  const scenes = [...JSON.parse(await readFile(`${dir}/yard.json`, "utf8")).map((s) => ({ ...s, file: "yard.mp4" })), ...JSON.parse(await readFile(`${dir}/races.json`, "utf8"))];
  const files = [...new Set(scenes.map((s) => s.file))];
  const parts = CUT.map(({ name, head = 0, tail = 0 }) => {
    const scene = scenes.find((s) => s.name === name);
    if (!scene) throw new Error(`No scene ${name} in ${dir}`);
    return { input: files.indexOf(scene.file), from: scene.from + Math.round(head * FPS), to: scene.to - Math.round(tail * FPS) };
  });
  const seconds = parts.reduce((sum, p) => sum + (p.to - p.from) / FPS, 0);
  const filter = [
    ...parts.map((p, i) => `[${p.input}:v]trim=start_frame=${p.from}:end_frame=${p.to},setpts=PTS-STARTPTS[p${i}]`),
    `${parts.map((_, i) => `[p${i}]`).join("")}concat=n=${parts.length}:v=1:a=0,fade=t=in:st=0:d=${FLASH}:color=white,fade=t=out:st=${(seconds - FLASH).toFixed(3)}:d=${FLASH}:color=white[out]`,
  ].join(";");
  const args = ["-y", "-loglevel", "error", ...files.flatMap((f) => ["-i", `${dir}/${f}`]), "-filter_complex", filter, "-map", "[out]", "-an", "-c:v", "libx264", "-preset", "slow", "-crf", "16", "-pix_fmt", "yuv420p", "-r", String(FPS), "-movflags", "+faststart", file];
  await new Promise((done, fail) => spawn("ffmpeg", args, { stdio: "inherit" }).on("exit", (code) => (code ? fail(new Error(`ffmpeg exited ${code}`)) : done())));
  return seconds;
}
