// Records trailer 001, for TikTok: 1080×1920 at 30 fps, no audio, ending where it starts so it loops.
// Every frame is drawn on a virtual clock, so the same game code gives the same footage on any machine.
// The scene clips and their cut lists go to --temp, the finished trailer.mp4 to --out.
//   node tools/trailer/001/trailer.mjs [--out /Volumes/SLEEPTUBE/dragons-trailer/001] [--temp <out>/temp]
//     [--url http://127.0.0.1:8094] [--only yard,races,edit] [--stop inspect|teen]
import { mkdir, writeFile } from "node:fs/promises";
import { openPhone } from "./recorder.mjs";
import { recordYard } from "./yardScenes.mjs";
import { recordRaces } from "./raceScenes.mjs";
import { edit } from "./edit.mjs";

const args = process.argv.slice(2);
const option = (name, fallback) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : fallback);
const out = option("out", "/Volumes/SLEEPTUBE/dragons-trailer/001");
const dir = option("temp", `${out}/temp`);
const base = option("url", "http://127.0.0.1:8094");
const parts = option("only", "yard,races,edit").split(",");
const stopAfter = option("stop");
await mkdir(dir, { recursive: true });
await mkdir(out, { recursive: true });

if (parts.includes("yard")) {
  const { session, errors } = await openPhone();
  try {
    const cuts = await recordYard({ session, errors, base, dir, stopAfter });
    await writeFile(`${dir}/yard.json`, JSON.stringify(cuts, null, 2));
    console.log(cuts);
  } finally {
    await session.close();
  }
}

if (parts.includes("races")) {
  const { session, errors } = await openPhone();
  try {
    const cuts = await recordRaces({ session, errors, base, dir });
    await writeFile(`${dir}/races.json`, JSON.stringify(cuts, null, 2));
    console.log(cuts);
  } finally {
    await session.close();
  }
}

if (parts.includes("edit")) console.log(`${out}/trailer.mp4`, `${(await edit(dir, `${out}/trailer.mp4`)).toFixed(1)} s`);
