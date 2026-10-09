import { crc32, deflateSync } from "node:zlib";

const chunk = (type, data) => {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const head = Buffer.alloc(4);
  head.writeUInt32BE(data.length);
  const tail = Buffer.alloc(4);
  tail.writeUInt32BE(crc32(body));
  return Buffer.concat([head, body, tail]);
};

/**
 * Encodes 8-bit pixels as a PNG; the app stores want the iOS icon with no alpha channel at all.
 * @param {{width: number, height: number, rgba: Uint8Array, alpha: boolean}} image
 */
export function encodePng({ width, height, rgba, alpha }) {
  const channels = alpha ? 4 : 3;
  const rows = Buffer.alloc((width * channels + 1) * height);
  for (let y = 0; y < height; y++) {
    const at = y * (width * channels + 1);
    for (let x = 0; x < width; x++)
      for (let c = 0; c < channels; c++) rows[at + 1 + x * channels + c] = rgba[(y * width + x) * 4 + c];
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, alpha ? 6 : 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
