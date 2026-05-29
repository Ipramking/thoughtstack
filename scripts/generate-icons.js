/**
 * generate-icons.js
 * Creates public/icon-192.png and public/icon-512.png using only Node.js built-ins.
 * No external packages needed.
 */
const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

// ── CRC32 ───────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const t   = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcVal]);
}

// ── PNG builder ─────────────────────────────────────────────────────────────
// Draws a rounded-square icon with a gradient-ish look (two-tone blended per row)
function buildPNG(size) {
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Brand colours: top = #7c3aed (purple-600), bottom = #4f46e5 (indigo-600)
  const topR = 124, topG = 58,  topB = 237;
  const botR = 79,  botG = 70,  botB = 229;
  // Letter "T" foreground
  const fgR = 255, fgG = 255, fgB = 255;

  // Corner radius
  const R = Math.round(size * 0.22);

  function isInsideRoundedRect(x, y) {
    const cx = x - size / 2 + 0.5;
    const cy = y - size / 2 + 0.5;
    const hw = size / 2 - R;
    const hh = size / 2 - R;
    const dx = Math.max(0, Math.abs(cx) - hw);
    const dy = Math.max(0, Math.abs(cy) - hh);
    return dx * dx + dy * dy <= R * R;
  }

  // "T" glyph (thick stem, simple strokes)
  const thick = Math.max(2, Math.round(size * 0.10));
  const barY  = Math.round(size * 0.26);
  const barH  = thick;
  const barX1 = Math.round(size * 0.22);
  const barX2 = Math.round(size * 0.78);
  const stemX1 = Math.round(size / 2 - thick / 2);
  const stemX2 = Math.round(size / 2 + thick / 2);
  const stemY1 = barY + barH;
  const stemY2 = Math.round(size * 0.76);

  function isGlyph(x, y) {
    if (y >= barY && y < barY + barH && x >= barX1 && x < barX2) return true;
    if (y >= stemY1 && y < stemY2 && x >= stemX1 && x < stemX2) return true;
    return false;
  }

  // Build raw RGBA rows
  const rowBytes = 1 + size * 4; // filter + RGBA per pixel
  const raw = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter: None
    const t = y / (size - 1);
    const bgR = Math.round(topR + (botR - topR) * t);
    const bgG = Math.round(topG + (botG - topG) * t);
    const bgB = Math.round(topB + (botB - topB) * t);

    for (let x = 0; x < size; x++) {
      const off = y * rowBytes + 1 + x * 4;
      if (!isInsideRoundedRect(x, y)) {
        raw[off] = raw[off+1] = raw[off+2] = 0; raw[off+3] = 0; // transparent
      } else if (isGlyph(x, y)) {
        raw[off] = fgR; raw[off+1] = fgG; raw[off+2] = fgB; raw[off+3] = 255;
      } else {
        raw[off] = bgR; raw[off+1] = bgG; raw[off+2] = bgB; raw[off+3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    SIGNATURE,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ── Write files ─────────────────────────────────────────────────────────────
const out = path.join(__dirname, "..", "public");
fs.writeFileSync(path.join(out, "icon-192.png"), buildPNG(192));
fs.writeFileSync(path.join(out, "icon-512.png"), buildPNG(512));
console.log("✓ public/icon-192.png and public/icon-512.png created");
