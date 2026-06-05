/**
 * generate-screenshots.js
 *
 * Generates the four manifest screenshots:
 *   public/screenshot-mobile-home.png    (540 x 1170, "narrow")
 *   public/screenshot-mobile-tasks.png   (540 x 1170, "narrow")
 *   public/screenshot-wide-home.png      (1280 x 720, "wide")
 *   public/screenshot-wide-tasks.png     (1280 x 720, "wide")
 *
 * Uses only Node.js built-ins (zlib) — no canvas or image library required.
 * Output is stylised UI mock-ups in the dark brand theme, suitable for Chrome
 * on Android's rich install banner.
 */
const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

// ── CRC32 + PNG chunk helpers (same as generate-icons.js) ───────────────────
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
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  const crcVal = Buffer.alloc(4);
  crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
  return Buffer.concat([len, t, data, crcVal]);
}

// ── Canvas: simple RGB framebuffer with rect / rounded-rect / gradient ──────
function Canvas(width, height) {
  const buf = Buffer.alloc(width * height * 3);
  function px(x, y, r, g, b) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const i = (y * width + x) * 3;
    buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
  }
  function fill(r, g, b) {
    for (let i = 0; i < buf.length; i += 3) {
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b;
    }
  }
  function rect(x, y, w, h, r, g, b) {
    const x2 = Math.min(width, x + w);
    const y2 = Math.min(height, y + h);
    for (let yy = Math.max(0, y); yy < y2; yy++) {
      for (let xx = Math.max(0, x); xx < x2; xx++) px(xx, yy, r, g, b);
    }
  }
  function roundedRect(x, y, w, h, radius, r, g, b) {
    const rr = Math.min(radius, Math.floor(Math.min(w, h) / 2));
    rect(x + rr, y,      w - 2 * rr, h, r, g, b);
    rect(x,      y + rr, w,          h - 2 * rr, r, g, b);
    // Four rounded corners
    for (let dy = 0; dy < rr; dy++) {
      for (let dx = 0; dx < rr; dx++) {
        if (dx * dx + dy * dy <= rr * rr) {
          px(x + rr - dx - 1, y + rr - dy - 1, r, g, b);
          px(x + w - rr + dx, y + rr - dy - 1, r, g, b);
          px(x + rr - dx - 1, y + h - rr + dy, r, g, b);
          px(x + w - rr + dx, y + h - rr + dy, r, g, b);
        }
      }
    }
  }
  function gradientV(x, y, w, h, r1, g1, b1, r2, g2, b2) {
    for (let yy = 0; yy < h; yy++) {
      const t = yy / Math.max(1, h - 1);
      const r = Math.round(r1 + (r2 - r1) * t);
      const g = Math.round(g1 + (g2 - g1) * t);
      const b = Math.round(b1 + (b2 - b1) * t);
      rect(x, y + yy, w, 1, r, g, b);
    }
  }
  function circle(cx, cy, radius, r, g, b) {
    for (let yy = -radius; yy <= radius; yy++) {
      for (let xx = -radius; xx <= radius; xx++) {
        if (xx * xx + yy * yy <= radius * radius) px(cx + xx, cy + yy, r, g, b);
      }
    }
  }
  function toPNG() {
    // Encode as PNG (RGB, 8-bit, no alpha — same approach as icon generator)
    const rowBytes = 1 + width * 3;
    const raw = Buffer.alloc(rowBytes * height);
    for (let yy = 0; yy < height; yy++) {
      raw[yy * rowBytes] = 0;
      buf.copy(raw, yy * rowBytes + 1, yy * width * 3, (yy + 1) * width * 3);
    }
    const compressed = zlib.deflateSync(raw, { level: 9 });
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", ihdr),
      chunk("IDAT", compressed),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
  return { fill, rect, roundedRect, gradientV, circle, toPNG };
}

// ── Brand palette ───────────────────────────────────────────────────────────
const BG      = [13, 13, 13];      // #0d0d0d
const PANEL   = [26, 26, 30];      // #1a1a1e
const CARD    = [33, 33, 38];      // #212126
const BORDER  = [55, 55, 60];      // subtle border
const TEXT    = [240, 240, 245];   // bright
const SUBTLE  = [120, 120, 130];   // muted
const VIOLET  = [167, 139, 250];   // #a78bfa
const VIOLET2 = [124, 58, 237];    // #7c3aed
const GREEN   = [74, 222, 128];    // success
const ORANGE  = [251, 146, 60];    // streak

// ── Helpers for common mock UI elements ─────────────────────────────────────
function drawIconChip(c, x, y, size) {
  c.gradientV(x, y, size, size, 26, 26, 30, 13, 13, 13);
  // Subtle violet glow + T glyph (mirrors the real icon)
  const cx = x + size / 2, cy = y + size / 2;
  const tw = Math.max(2, Math.round(size * 0.13));
  c.rect(x + Math.round(size * 0.27), y + Math.round(size * 0.30), Math.round(size * 0.46), tw, ...VIOLET);
  c.rect(cx - Math.floor(tw / 2), y + Math.round(size * 0.30) + tw, tw, Math.round(size * 0.34), ...VIOLET);
}

function drawTextBar(c, x, y, w, h, colour) {
  c.roundedRect(x, y, w, h, Math.max(2, Math.floor(h / 2)), ...colour);
}

function drawCard(c, x, y, w, h, opts = {}) {
  c.roundedRect(x, y, w, h, 16, ...CARD);
  // 1px border using BORDER on the perimeter
  c.rect(x, y, w, 1, ...BORDER);
  c.rect(x, y + h - 1, w, 1, ...BORDER);
  c.rect(x, y, 1, h, ...BORDER);
  c.rect(x + w - 1, y, 1, h, ...BORDER);
  if (opts.dotColour) {
    c.circle(x + 18, y + h / 2, 4, ...opts.dotColour);
  }
}

// ── MOBILE: HOME SCREEN MOCKUP (540 × 1170) ─────────────────────────────────
function mobileHome() {
  const W = 540, H = 1170;
  const c = Canvas(W, H);
  c.fill(...BG);

  // Status bar
  c.rect(0, 0, W, 48, ...PANEL);
  c.roundedRect(450, 14, 70, 20, 10, ...SUBTLE);

  // Top bar
  drawIconChip(c, 28, 70, 48);
  drawTextBar(c, 92, 80, 200, 14, TEXT);
  drawTextBar(c, 92, 102, 130, 10, SUBTLE);
  // Brain button
  c.roundedRect(W - 80, 76, 48, 48, 16, ...VIOLET);

  // Streak chip
  c.roundedRect(28, 152, 100, 36, 12, ...ORANGE);
  drawTextBar(c, 50, 165, 60, 10, [255, 255, 255]);

  // Quick capture card
  drawCard(c, 28, 210, W - 56, 110);
  drawTextBar(c, 50, 232, 260, 12, SUBTLE);
  drawTextBar(c, 50, 254, 180, 12, SUBTLE);
  // Sparkle button in corner
  c.roundedRect(W - 84, 286, 32, 32, 10, ...VIOLET);

  // Today's focus header
  drawTextBar(c, 28, 360, 160, 14, VIOLET);

  // Three task cards
  let cardY = 396;
  for (let i = 0; i < 3; i++) {
    drawCard(c, 28, cardY, W - 56, 78, { dotColour: i === 0 ? ORANGE : i === 1 ? VIOLET : GREEN });
    c.roundedRect(38, cardY + 22, 26, 26, 13, ...PANEL);   // checkbox
    drawTextBar(c, 76, cardY + 24, 280, 12, TEXT);
    drawTextBar(c, 76, cardY + 48, 160, 9, SUBTLE);
    cardY += 92;
  }

  // Today's schedule header
  drawTextBar(c, 28, cardY + 24, 180, 14, VIOLET);
  drawCard(c, 28, cardY + 60, W - 56, 70);
  drawTextBar(c, 48, cardY + 80, 60, 11, SUBTLE);
  drawTextBar(c, 120, cardY + 80, 200, 12, TEXT);
  drawTextBar(c, 120, cardY + 100, 100, 9, SUBTLE);

  // Bottom mock nav (mostly hidden)
  c.rect(0, H - 90, W, 90, ...PANEL);
  for (let i = 0; i < 4; i++) {
    c.circle(70 + i * 130, H - 45, 14, ...(i === 0 ? VIOLET : SUBTLE));
  }

  return c.toPNG();
}

// ── MOBILE: TASKS SCREEN MOCKUP (540 × 1170) ────────────────────────────────
function mobileTasks() {
  const W = 540, H = 1170;
  const c = Canvas(W, H);
  c.fill(...BG);
  c.rect(0, 0, W, 48, ...PANEL);
  c.roundedRect(450, 14, 70, 20, 10, ...SUBTLE);

  // Header
  drawTextBar(c, 28, 80, 140, 22, TEXT);
  drawTextBar(c, 28, 116, 220, 11, SUBTLE);
  // Add button
  c.roundedRect(W - 80, 78, 48, 48, 14, ...VIOLET);

  // Search bar
  drawCard(c, 28, 170, W - 56, 48);
  drawTextBar(c, 48, 192, 200, 11, SUBTLE);

  // Filter chips
  const chips = [VIOLET, SUBTLE, SUBTLE, SUBTLE];
  let chipX = 28;
  for (const col of chips) {
    c.roundedRect(chipX, 240, 90, 32, 14, ...col);
    chipX += 100;
  }

  // Section header "Today"
  drawTextBar(c, 28, 308, 100, 14, ORANGE);

  // Task rows
  let y = 348;
  const dotCols = [ORANGE, VIOLET2, GREEN, SUBTLE];
  for (let i = 0; i < 5; i++) {
    drawCard(c, 28, y, W - 56, 84, { dotColour: dotCols[i % 4] });
    c.roundedRect(40, y + 26, 30, 30, 15, ...PANEL);
    drawTextBar(c, 84, y + 26, 240 + (i % 2 ? 40 : 0), 13, TEXT);
    drawTextBar(c, 84, y + 52, 140, 10, SUBTLE);
    // Right-side time chip
    c.roundedRect(W - 110, y + 30, 70, 24, 10, ...PANEL);
    y += 98;
  }

  // "Upcoming" header
  drawTextBar(c, 28, y + 16, 130, 14, VIOLET);
  drawCard(c, 28, y + 56, W - 56, 84, { dotColour: GREEN });
  drawTextBar(c, 84, y + 82, 220, 13, TEXT);
  drawTextBar(c, 84, y + 108, 100, 10, SUBTLE);

  return c.toPNG();
}

// ── WIDE: HOME SCREEN MOCKUP (1280 × 720) ───────────────────────────────────
function wideHome() {
  const W = 1280, H = 720;
  const c = Canvas(W, H);
  c.fill(...BG);

  // Sidebar
  c.rect(0, 0, 240, H, ...PANEL);
  drawIconChip(c, 24, 24, 40);
  drawTextBar(c, 72, 36, 110, 14, TEXT);
  // Nav items
  const navY = [96, 144, 192, 240, 288, 336];
  for (let i = 0; i < navY.length; i++) {
    if (i === 0) c.roundedRect(16, navY[i], 208, 36, 10, ...CARD);
    c.circle(36, navY[i] + 18, 8, ...(i === 0 ? VIOLET : SUBTLE));
    drawTextBar(c, 56, navY[i] + 13, 120, 11, i === 0 ? TEXT : SUBTLE);
  }

  // Main content padding
  const mx = 280;

  // Greeting
  drawTextBar(c, mx, 36, 90, 11, SUBTLE);
  drawTextBar(c, mx, 56, 320, 22, TEXT);

  // Streak chip
  c.roundedRect(W - 200, 40, 80, 36, 12, ...ORANGE);
  // Brain button
  c.roundedRect(W - 92, 32, 52, 52, 16, ...VIOLET);

  // Three top cards row
  const cardW = 240, cardH = 110, gap = 20;
  for (let i = 0; i < 3; i++) {
    drawCard(c, mx + i * (cardW + gap), 130, cardW, cardH);
    drawTextBar(c, mx + i * (cardW + gap) + 20, 152, 100, 10, SUBTLE);
    drawTextBar(c, mx + i * (cardW + gap) + 20, 176, 160, 18, TEXT);
    drawTextBar(c, mx + i * (cardW + gap) + 20, 210, 80, 10, SUBTLE);
  }

  // Today's focus header
  drawTextBar(c, mx, 280, 160, 14, VIOLET);

  // Task list
  let ty = 316;
  const dotCols = [ORANGE, VIOLET2, GREEN];
  for (let i = 0; i < 4; i++) {
    drawCard(c, mx, ty, 760, 64, { dotColour: dotCols[i % 3] });
    c.roundedRect(mx + 14, ty + 18, 28, 28, 14, ...PANEL);
    drawTextBar(c, mx + 58, ty + 22, 360 + (i * 20 % 80), 12, TEXT);
    drawTextBar(c, mx + 58, ty + 44, 180, 9, SUBTLE);
    c.roundedRect(mx + 660, ty + 20, 80, 24, 10, ...PANEL);
    ty += 78;
  }

  return c.toPNG();
}

// ── WIDE: TASKS SCREEN MOCKUP (1280 × 720) ──────────────────────────────────
function wideTasks() {
  const W = 1280, H = 720;
  const c = Canvas(W, H);
  c.fill(...BG);

  // Sidebar (same as home, but with Tasks highlighted)
  c.rect(0, 0, 240, H, ...PANEL);
  drawIconChip(c, 24, 24, 40);
  drawTextBar(c, 72, 36, 110, 14, TEXT);
  const navY = [96, 144, 192, 240, 288, 336];
  for (let i = 0; i < navY.length; i++) {
    if (i === 1) c.roundedRect(16, navY[i], 208, 36, 10, ...CARD);
    c.circle(36, navY[i] + 18, 8, ...(i === 1 ? VIOLET : SUBTLE));
    drawTextBar(c, 56, navY[i] + 13, 120, 11, i === 1 ? TEXT : SUBTLE);
  }

  const mx = 280;

  // Header + search
  drawTextBar(c, mx, 36, 120, 22, TEXT);
  drawTextBar(c, mx, 70, 220, 11, SUBTLE);
  drawCard(c, mx, 100, 560, 44);
  drawTextBar(c, mx + 20, 120, 220, 10, SUBTLE);

  // Filter chips
  let chipX = mx;
  const chips = [VIOLET, SUBTLE, SUBTLE, SUBTLE, SUBTLE];
  for (const col of chips) {
    c.roundedRect(chipX, 168, 90, 32, 14, ...col);
    chipX += 100;
  }

  // Tasks list (8 rows)
  let ty = 230;
  const dotCols = [ORANGE, VIOLET2, GREEN, SUBTLE, ORANGE, VIOLET2];
  for (let i = 0; i < 5; i++) {
    drawCard(c, mx, ty, 760, 76, { dotColour: dotCols[i % dotCols.length] });
    c.roundedRect(mx + 14, ty + 22, 32, 32, 16, ...PANEL);
    drawTextBar(c, mx + 64, ty + 26, 340, 13, TEXT);
    drawTextBar(c, mx + 64, ty + 52, 200, 10, SUBTLE);
    // Subtask pill on some rows
    if (i % 2 === 0) c.roundedRect(mx + 540, ty + 26, 80, 22, 10, ...PANEL);
    c.roundedRect(mx + 640, ty + 26, 100, 24, 10, ...PANEL);
    ty += 90;
  }

  // Right side — stat / detail panel
  const rx = mx + 780;
  drawCard(c, rx, 100, 220, 240);
  drawTextBar(c, rx + 20, 122, 90, 11, SUBTLE);
  drawTextBar(c, rx + 20, 144, 140, 22, TEXT);
  drawTextBar(c, rx + 20, 178, 180, 10, SUBTLE);
  drawTextBar(c, rx + 20, 198, 160, 10, SUBTLE);

  drawCard(c, rx, 360, 220, 220);
  drawTextBar(c, rx + 20, 384, 90, 11, VIOLET);
  // Mini bar chart
  for (let i = 0; i < 6; i++) {
    const h = 20 + (i * 17) % 70;
    c.roundedRect(rx + 20 + i * 32, 540 - h, 22, h, 6, ...VIOLET);
  }

  return c.toPNG();
}

// ── Write everything ────────────────────────────────────────────────────────
const out = path.join(__dirname, "..", "public");
fs.writeFileSync(path.join(out, "screenshot-mobile-home.png"),  mobileHome());
fs.writeFileSync(path.join(out, "screenshot-mobile-tasks.png"), mobileTasks());
fs.writeFileSync(path.join(out, "screenshot-wide-home.png"),    wideHome());
fs.writeFileSync(path.join(out, "screenshot-wide-tasks.png"),   wideTasks());
console.log("✓ 4 manifest screenshots created in public/");
