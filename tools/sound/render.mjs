#!/usr/bin/env node

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { raceRenders } from "../../src/sound/raceSounds.js";
import { stableRenders } from "../../src/sound/stableSounds.js";
import { uiRenders } from "../../src/sound/uiSounds.js";

const rate = 48000;
const outIndex = process.argv.indexOf("--out");
const out = outIndex > 0 ? process.argv[outIndex + 1] : "/Volumes/SLEEPTUBE/dragons-sound";

/** @param {Float32Array} samples */
function wav(samples) {
  const bytes = Buffer.alloc(44 + samples.length * 2);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + samples.length * 2, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(rate, 24);
  bytes.writeUInt32LE(rate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((sample, index) => bytes.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2));
  return bytes;
}

mkdirSync(out, { recursive: true });
for (const [group, renders] of Object.entries({ ui: uiRenders, race: raceRenders, stable: stableRenders })) {
  for (const [name, render] of Object.entries(renders)) {
    const samples = render(rate);
    writeFileSync(join(out, `${group}-${name}.wav`), wav(samples));
    console.log(`${group}-${name}.wav ${(samples.length / rate).toFixed(2)} s`);
  }
}
