/**
 * generate-icons.js
 *
 * Creates public/icon-192.png and public/icon-512.png.
 *
 * IMPORTANT — maskable safe zone:
 *   Android's adaptive icon system can crop the icon into a circle, squircle,
 *   rounded square, etc. To guarantee the brand mark survives any mask, we:
 *     1. Fill the entire square with the gradient (NO transparent corners).
 *     2. Keep the "T" glyph inside the inner 60% of the canvas (~20% padding).
 *   This way the icon works for both `purpose: "any"` and `purpose: "maskable"`.
 *
 * Uses only Node.js built-ins (zlib) — no external image library needed.
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
function buildPNG(size) {
  const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR — 8-bit RGB (no alpha, opaque corners for maskable safety)
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB (color type 2)
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // ── Palette ───────────────────────────────────────────────────────────────
  // Background: the "Iris ink" brand gradient (violet → purple), matching the
  // .brand-gradient utility and the in-app generated icons.
  const topR = 116, topG = 84,  topB = 212;    // #7454d4 (brand-from)
  const botR = 162, botG = 79,  botB = 220;    // #a24fdc (brand-to)

  // T glyph: white — sits on the saturated gradient.
  const fgR  = 255, fgG  = 255, fgB  = 255;    // #ffffff

  // Subtle radial glow behind the T for depth — lift towards a lighter iris.
  const glowR = 196, glowG = 168, glowB = 255; // #c4a8ff

  // ── Glyph: bold "T" centred in the inner 60% (maskable safe zone) ─────────
  const thick = Math.max(2, Math.round(size * 0.13));
  const barY  = Math.round(size * 0.30);
  const barH  = thick;
  const barX1 = Math.round(size * 0.27);
  const barX2 = Math.round(size * 0.73);
  const stemX1 = Math.round(size / 2 - thick / 2);
  const stemX2 = Math.round(size / 2 + thick / 2);
  const stemY1 = barY + barH;
  const stemY2 = Math.round(size * 0.73);

  function isGlyph(x, y) {
    if (y >= barY && y < barY + barH && x >= barX1 && x < barX2) return true;
    if (y >= stemY1 && y < stemY2 && x >= stemX1 && x < stemX2) return true;
    return false;
  }

  // Radial glow strength at (x, y) — peaks at the centre, fades out.
  const cx = size / 2, cy = size / 2;
  const glowRadius = size * 0.4;
  function glowAt(x, y) {
    const dx = x - cx, dy = y - cy;
    const d  = Math.sqrt(dx * dx + dy * dy);
    if (d >= glowRadius) return 0;
    // Quadratic falloff, max 0.18 (subtle)
    const t = 1 - d / glowRadius;
    return t * t * 0.18;
  }

  // ── Build raw RGB rows (no alpha) ─────────────────────────────────────────
  const rowBytes = 1 + size * 3;
  const raw = Buffer.alloc(rowBytes * size);

  for (let y = 0; y < size; y++) {
    raw[y * rowBytes] = 0; // filter type: None
    const ty = y / (size - 1);
    const bgR = Math.round(topR + (botR - topR) * ty);
    const bgG = Math.round(topG + (botG - topG) * ty);
    const bgB = Math.round(topB + (botB - topB) * ty);

    for (let x = 0; x < size; x++) {
      const off = y * rowBytes + 1 + x * 3;

      if (isGlyph(x, y)) {
        raw[off] = fgR; raw[off + 1] = fgG; raw[off + 2] = fgB;
        continue;
      }

      // Mix in a subtle violet glow at the centre
      const g = glowAt(x, y);
      raw[off]     = Math.round(bgR + (glowR - bgR) * g);
      raw[off + 1] = Math.round(bgG + (glowG - bgG) * g);
      raw[off + 2] = Math.round(bgB + (glowB - bgB) * g);
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
console.log("✓ icon-192.png and icon-512.png created (maskable-safe, full-area fill)");
