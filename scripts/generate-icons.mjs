/**
 * Draws the ZeroSteak mark — a slashed zero (Ø) in chip gold on graphite —
 * and writes the app icon, adaptive-icon layers, splash and favicon as PNGs.
 * No image tooling needed: shapes are rasterised here with 4×4 supersampling.
 *
 *   node scripts/generate-icons.mjs
 */
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "images");
const BG = [0x14, 0x13, 0x12]; // graphite
const FG = [0xff, 0xc2, 0x1a]; // chip gold

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};

/** RGBA PNG from a coverage function cov(x, y) ∈ [0, 1] (1 = white mark). */
function png(size, cov, { transparent = false, fg = FG } = {}) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const SS = 4;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let a = 0;
      for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) a += cov((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
      a /= SS * SS;
      const i = y * (size * 4 + 1) + 1 + x * 4;
      if (transparent) {
        [raw[i], raw[i + 1], raw[i + 2]] = fg;
        raw[i + 3] = Math.round(a * 255);
      } else {
        for (let c = 0; c < 3; c++) raw[i + c] = Math.round(BG[c] + (FG[c] - BG[c]) * a);
        raw[i + 3] = 255;
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** Slashed zero: an elliptical ring plus a diagonal bar, scaled by `s` around the centre. */
const mark = (s) => (u, v) => {
  const x = (u - 0.5) / s;
  const y = (v - 0.5) / s;
  const rx = 0.26;
  const ry = 0.36;
  const t = 0.085;
  const outer = (x / rx) ** 2 + (y / ry) ** 2 <= 1;
  const inner = (x / (rx - t)) ** 2 + (y / (ry - t)) ** 2 <= 1;
  const ring = outer && !inner;
  // Diagonal slash from lower-left to upper-right, extending past the ring.
  const d = Math.abs(x * 0.81 + y * 0.59) / 1;
  const along = Math.abs(-x * 0.59 + y * 0.81);
  const slash = d <= t / 2 && along <= ry + 0.06;
  return ring || slash ? 1 : 0;
};

writeFileSync(join(out, "icon.png"), png(1024, mark(1)));
writeFileSync(join(out, "android-icon-foreground.png"), png(512, mark(0.62), { transparent: true }));
writeFileSync(join(out, "android-icon-monochrome.png"), png(432, mark(0.62), { transparent: true }));
// Splash sits on the white page, so the mark is graphite there.
writeFileSync(join(out, "splash-icon.png"), png(512, mark(1), { transparent: true, fg: BG }));
writeFileSync(join(out, "favicon.png"), png(48, mark(1)));
console.log("icons written to assets/images");
