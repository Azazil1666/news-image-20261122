// main.ts - Newspaper front page renderer for Sunday 22 November 2026
// Uses only Node built-ins: fs, path, zlib

import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ============================================================
// CONSTANTS
// ============================================================
const WIDTH = 1024;
const HEIGHT = 1024;
const CHANNELS = 3; // RGB
const BUFFER_SIZE = WIDTH * HEIGHT * CHANNELS;

// Colour palette (RGB)
const COLORS = {
  paper: [0xf2, 0xed, 0xe3],      // #f2ede3
  ink: [0x1e, 0x2a, 0x32],        // #1e2a32
  darkTeal: [0x24, 0x42, 0x4e],   // #24424e
  red: [0xb3, 0x40, 0x2e],        // #b3402e
  mutedGreen: [0x7f, 0xa0, 0x8a], // #7fa08a
  brown: [0x6b, 0x4a, 0x2f],      // #6b4a2f
  light: [0xdc, 0xe8, 0xe4],      // #dce8e4
};

// ============================================================
// PIXEL BUFFER
// ============================================================
const buffer = new Uint8Array(BUFFER_SIZE);

function setPixel(x: number, y: number, r: number, g: number, b: number): void {
  if (x < 0 || x >= WIDTH || y < 0 || y >= HEIGHT) return;
  const idx = (y * WIDTH + x) * CHANNELS;
  buffer[idx] = r;
  buffer[idx + 1] = g;
  buffer[idx + 2] = b;
}

function fillRect(x: number, y: number, w: number, h: number, color: number[]): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      setPixel(xx, yy, color[0], color[1], color[2]);
    }
  }
}

function drawLine(x0: number, y0: number, x1: number, y1: number, color: number[]): void {
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = (dx > dy ? dx : -dy) / 2;
  let x = x0, y = y0;

  while (true) {
    setPixel(x, y, color[0], color[1], color[2]);
    if (x === x1 && y === y1) break;
    const e2 = err;
    if (e2 > -dx) { err -= dy; x += sx; }
    if (e2 < dy) { err += dx; y += sy; }
  }
}

// ============================================================
// 5x7 BITMAP FONT
// ============================================================
// Each glyph: 7 rows, 5 columns. 1 = ink, 0 = background.
// Stored as array of 7 strings of '1' and '0' characters.
const FONT: Record<string, string[]> = {
  'A': ['01110','10001','10001','11111','10001','10001','10001'],
  'B': ['11110','10001','10001','11110','10001','10001','11110'],
  'C': ['01110','10001','10000','10000','10000','10001','01110'],
  'D': ['11110','10001','10001','10001','10001','10001','11110'],
  'E': ['11111','10000','10000','11110','10000','10000','11111'],
  'F': ['11111','10000','10000','11110','10000','10000','10000'],
  'G': ['01110','10001','10000','10111','10001','10001','01110'],
  'H': ['10001','10001','10001','11111','10001','10001','10001'],
  'I': ['11111','00100','00100','00100','00100','00100','11111'],
  'J': ['01111','00010','00010','00010','00010','10010','01100'],
  'K': ['10001','10010','10100','11000','10100','10010','10001'],
  'L': ['10000','10000','10000','10000','10000','10000','11111'],
  'M': ['10001','11011','10101','10101','10001','10001','10001'],
  'N': ['10001','11001','10101','10011','10001','10001','10001'],
  'O': ['01110','10001','10001','10001','10001','10001','01110'],
  'P': ['11110','10001','10001','11110','10000','10000','10000'],
  'Q': ['01110','10001','10001','10001','10101','10010','01101'],
  'R': ['11110','10001','10001','11110','10100','10010','10001'],
  'S': ['01110','10001','10000','01110','00001','10001','01110'],
  'T': ['11111','00100','00100','00100','00100','00100','00100'],
  'U': ['10001','10001','10001','10001','10001','10001','01110'],
  'V': ['10001','10001','10001','10001','10001','01010','00100'],
  'W': ['10001','10001','10001','10101','10101','11011','10001'],
  'X': ['10001','10001','01010','00100','01010','10001','10001'],
  'Y': ['10001','10001','01010','00100','00100','00100','00100'],
  'Z': ['11111','00001','00010','00100','01000','10000','11111'],
  '0': ['01110','10011','10101','11001','10001','10001','01110'],
  '1': ['00100','01100','00100','00100','00100','00100','01110'],
  '2': ['01110','10001','00001','00010','00100','01000','11111'],
  '3': ['01110','10001','00001','00110','00001','10001','01110'],
  '4': ['00010','00110','01010','10010','11111','00010','00010'],
  '5': ['11111','10000','10000','11110','00001','10001','01110'],
  '6': ['01110','10001','10000','11110','10001','10001','01110'],
  '7': ['11111','00001','00010','00100','01000','01000','01000'],
  '8': ['01110','10001','10001','01110','10001','10001','01110'],
  '9': ['01110','10001','10001','01111','00001','00010','01100'],
  '.': ['00000','00000','00000','00000','00000','00100','00100'],
  ',': ['00000','00000','00000','00000','00100','00100','01000'],
  ':': ['00000','00100','00100','00000','00100','00100','00000'],
  ';': ['00000','00100','00100','00000','00100','00100','01000'],
  "'": ['00100','00100','00000','00000','00000','00000','00000'],
  '"': ['01010','01010','00000','00000','00000','00000','00000'],
  '-': ['00000','00000','00000','01110','00000','00000','00000'],
  '/': ['00001','00010','00100','01000','10000','00000','00000'],
  '%': ['10001','10010','00100','01000','10010','01001','10001'],
  '$': ['00100','01110','10100','01110','00101','01110','00100'],
  '(': ['00110','01000','01000','01000','01000','01000','00110'],
  ')': ['01100','00010','00010','00010','00010','00010','01100'],
  '&': ['01110','10011','10101','01010','10101','10011','01110'],
  '!': ['00100','00100','00100','00100','00000','00100','00100'],
  '?': ['01110','10001','00010','00100','00000','00100','00000'],
  ' ': ['00000','00000','00000','00000','00000','00000','00000'],
};

const FONT_WIDTH = 5;
const FONT_HEIGHT = 7;

function drawChar(x: number, y: number, ch: string, scale: number, color: number[]): void {
  const glyph = FONT[ch.toUpperCase()];
  if (!glyph) return;
  for (let row = 0; row < FONT_HEIGHT; row++) {
    const line = glyph[row];
    for (let col = 0; col < FONT_WIDTH; col++) {
      if (line[col] === '1') {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            setPixel(x + col * scale + sx, y + row * scale + sy, color[0], color[1], color[2]);
          }
        }
      }
    }
  }
}

function drawText(x: number, y: number, text: string, scale: number, color: number[]): void {
  let cx = x;
  for (let i = 0; i < text.length; i++) {
    drawChar(cx, y, text[i], scale, color);
    cx += (FONT_WIDTH + 1) * scale; // 1 pixel spacing between chars
  }
}

function textWidth(text: string, scale: number): number {
  return text.length * (FONT_WIDTH + 1) * scale - scale; // subtract last spacing
}

function drawTextWrapped(x: number, y: number, maxWidth: number, text: string, scale: number, color: number[], lineHeight: number): number {
  const words = text.split(' ');
  let line = '';
  let cy = y;
  for (const word of words) {
    const testLine = line + (line ? ' ' : '') + word;
    if (textWidth(testLine, scale) > maxWidth && line) {
      drawText(x, cy, line, scale, color);
      cy += lineHeight;
      line = word;
    } else {
      line = testLine;
    }
  }
  if (line) {
    drawText(x, cy, line, scale, color);
    cy += lineHeight;
  }
  return cy - y;
}

// ============================================================
// PNG ENCODER
// ============================================================
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint32BE(arr: Uint8Array, offset: number, value: number): void {
  arr[offset] = (value >>> 24) & 0xff;
  arr[offset + 1] = (value >>> 16) & 0xff;
  arr[offset + 2] = (value >>> 8) & 0xff;
  arr[offset + 3] = value & 0xff;
}

function createChunk(type: string, data: Uint8Array): Uint8Array {
  const chunk = new Uint8Array(12 + data.length);
  writeUint32BE(chunk, 0, data.length);
  chunk[4] = type.charCodeAt(0);
  chunk[5] = type.charCodeAt(1);
  chunk[6] = type.charCodeAt(2);
  chunk[7] = type.charCodeAt(3);
  chunk.set(data, 8);
  const crcData = new Uint8Array(4 + data.length);
  crcData.set(chunk.slice(4, 8));
  crcData.set(data, 4);
  const crc = crc32(crcData);
  writeUint32BE(chunk, 8 + data.length, crc);
  return chunk;
}

function encodePNG(rgb: Uint8Array, width: number, height: number): Uint8Array {
  // Build raw scanlines with filter byte 0 (none)
  const stride = width * CHANNELS;
  const raw = new Uint8Array(height * (stride + 1));
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter type 0
    raw.set(rgb.slice(y * stride, (y + 1) * stride), y * (stride + 1) + 1);
  }

  // Compress with zlib
  const compressed = deflateSync(raw);

  // IHDR chunk
  const ihdrData = new Uint8Array(13);
  writeUint32BE(ihdrData, 0, width);
  writeUint32BE(ihdrData, 4, height);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // colour type 2 (RGB)
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace
  const ihdr = createChunk('IHDR', ihdrData);

  // IDAT chunk
  const idat = createChunk('IDAT', compressed);

  // IEND chunk
  const iend = createChunk('IEND', new Uint8Array(0));

  // PNG signature
  const signature = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

  // Combine
  const png = new Uint8Array(signature.length + ihdr.length + idat.length + iend.length);
  let offset = 0;
  png.set(signature, offset); offset += signature.length;
  png.set(ihdr, offset); offset += ihdr.length;
  png.set(idat, offset); offset += idat.length;
  png.set(iend, offset);
  return png;
}

// ============================================================
// DRAWING HELPERS
// ============================================================
function drawRectBorder(x: number, y: number, w: number, h: number, color: number[], thickness = 1): void {
  for (let t = 0; t < thickness; t++) {
    fillRect(x + t, y + t, w - 2 * t, 1, color); // top
    fillRect(x + t, y + h - 1 - t, w - 2 * t, 1, color); // bottom
    fillRect(x + t, y + t, 1, h - 2 * t, color); // left
    fillRect(x + w - 1 - t, y + t, 1, h - 2 * t, color); // right
  }
}

function drawHorizontalLine(x: number, y: number, w: number, color: number[]): void {
  fillRect(x, y, w, 1, color);
}

function drawVerticalLine(x: number, y: number, h: number, color: number[]): void {
  fillRect(x, y, 1, h, color);
}

// ============================================================
// MAIN RENDERER
// ============================================================
function render(): void {
  // Fill background with paper color
  fillRect(0, 0, WIDTH, HEIGHT, COLORS.paper);

  // Outer border (dark teal, 4px)
  drawRectBorder(0, 0, WIDTH, HEIGHT, COLORS.darkTeal, 4);

  let y = 24; // Start after top border

  // ========== MASTHEAD ==========
  const mastheadText = 'THE WORLD LEDGER';
  const mastheadScale = 4;
  const mw = textWidth(mastheadText, mastheadScale);
  drawText((WIDTH - mw) / 2, y, mastheadText, mastheadScale, COLORS.ink);
  y += FONT_HEIGHT * mastheadScale + 8;

  // Date line
  const dateText = 'SUNDAY 22 NOVEMBER 2026';
  const dateScale = 2;
  const dw = textWidth(dateText, dateScale);
  drawText((WIDTH - dw) / 2, y, dateText, dateScale, COLORS.darkTeal);
  y += FONT_HEIGHT * dateScale + 6;

  // Thin rule
  drawHorizontalLine(60, y, WIDTH - 120, COLORS.ink);
  y += 4;

  // Front page label (left) and section tags (right)
  const frontLabel = 'FRONT PAGE';
  const sectionsLabel = 'MARKETS • DIPLOMACY • CLIMATE • WORLD';
  drawText(60, y, frontLabel, 1, COLORS.ink);
  const sw = textWidth(sectionsLabel, 1);
  drawText(WIDTH - 60 - sw, y, sectionsLabel, 1, COLORS.mutedGreen);
  y += FONT_HEIGHT + 16;

  // ========== LEAD PANELS ==========
  const panelY = y;
  const panelHeight = 220;
  const panelWidth = (WIDTH - 140) / 2;
  const leftX = 60;
  const rightX = 60 + panelWidth + 20;

  // --- LEFT PANEL: GLOBAL / MARKETS ---
  drawRectBorder(leftX, panelY, panelWidth, panelHeight, COLORS.darkTeal, 2);
  fillRect(leftX + 2, panelY + 2, panelWidth - 4, 28, COLORS.darkTeal);
  drawText(leftX + 10, panelY + 6, 'GLOBAL / MARKETS', 2, COLORS.paper);

  // Stock chart area
  const chartX = leftX + 15;
  const chartY = panelY + 40;
  const chartW = panelWidth - 30;
  const chartH = 120;

  // Chart background
  fillRect(chartX, chartY, chartW, chartH, COLORS.light);

  // Grid lines
  for (let i = 1; i < 5; i++) {
    const gy = chartY + (chartH * i) / 5;
    drawHorizontalLine(chartX, gy, chartW, [0xb0, 0xc8, 0xc0]);
  }
  for (let i = 1; i < 6; i++) {
    const gx = chartX + (chartW * i) / 6;
    drawVerticalLine(gx, chartY, chartH, [0xb0, 0xc8, 0xc0]);
  }

  // Falling line data (S&P 500 weekly correction - 7 days down)
  // Normalized to chart height: start high, end low
  const points = [
    0.15, 0.22, 0.28, 0.38, 0.50, 0.65, 0.85
  ];
  for (let i = 0; i < points.length - 1; i++) {
    const x0 = chartX + (chartW * i) / (points.length - 1);
    const y0 = chartY + chartH * points[i];
    const x1 = chartX + (chartW * (i + 1)) / (points.length - 1);
    const y1 = chartY + chartH * points[i + 1];
    drawLine(Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1), COLORS.red);
  }
  // Markers
  for (let i = 0; i < points.length; i++) {
    const x = chartX + (chartW * i) / (points.length - 1);
    const y = chartY + chartH * points[i];
    fillRect(Math.round(x) - 2, Math.round(y) - 2, 5, 5, COLORS.red);
  }

  // Chart caption
  const caption = 'S&P 500 WEEKLY CORRECTION';
  const cw = textWidth(caption, 1);
  drawText(chartX + (chartW - cw) / 2, chartY + chartH + 8, caption, 1, COLORS.ink);

  // Headline (red)
  const headline1 = 'WALL STREET IN CORRECTION AS AI SELLOFF WIPES $4 TRILLION';
  const h1y = panelY + panelHeight + 8;
  drawTextWrapped(leftX, h1y, panelWidth, headline1, 2, COLORS.red, FONT_HEIGHT * 2 + 4);

  // Deck
  const deck1 = 'S&P 500 -3.7% TO 6910 | NASDAQ -5.3% TO 22618 | NVIDIA -14% | VIX 35.9 | 7TH STRAIGHT DECLINE | DOW 48147 | ANTHROPIC IPO TO $89';
  const deck1y = h1y + (FONT_HEIGHT * 2 + 4) * 3 + 4;
  drawTextWrapped(leftX, deck1y, panelWidth, deck1, 1, COLORS.ink, FONT_HEIGHT + 2);

  // --- RIGHT PANEL: ASIA / DIPLOMACY ---
  drawRectBorder(rightX, panelY, panelWidth, panelHeight, COLORS.darkTeal, 2);
  fillRect(rightX + 2, panelY + 2, panelWidth - 4, 28, COLORS.darkTeal);
  drawText(rightX + 10, panelY + 6, 'ASIA / DIPLOMACY', 2, COLORS.paper);

  // Nuclear banner
  const bannerY = panelY + 40;
  const bannerH = 36;
  fillRect(rightX + 10, bannerY, panelWidth - 20, bannerH, COLORS.ink);
  const nuclearText = 'NUCLEAR WAR MUST NEVER BE FOUGHT';
  const ntW = textWidth(nuclearText, 2);
  drawText(rightX + 10 + (panelWidth - 20 - ntW) / 2, bannerY + 6, nuclearText, 2, COLORS.paper);

  // Three flags on poles
  const flagY = bannerY + bannerH + 20;
  const flagSpacing = (panelWidth - 40) / 3;
  const flagColors = [
    [[0xff, 0x00, 0x00], [0xff, 0xff, 0xff], [0x00, 0x00, 0xff]], // Russia-ish
    [[0xde, 0x29, 0x10], [0xff, 0xde, 0x00]], // China-ish
    [[0x00, 0x28, 0x68], [0xff, 0xff, 0xff], [0xbf, 0x0a, 0x30]], // US-ish
  ];
  for (let i = 0; i < 3; i++) {
    const fx = rightX + 20 + i * flagSpacing;
    const poleX = fx + 5;
    // Pole
    drawVerticalLine(poleX, flagY, 60, COLORS.brown);
    // Flag (3 stripes)
    const stripeH = 12;
    for (let s = 0; s < flagColors[i].length; s++) {
      fillRect(poleX, flagY + s * stripeH, 20, stripeH, flagColors[i][s]);
    }
  }

  // Headline (red)
  const headline2 = 'TRUMP XI AND PUTIN MEET IN SHENZHEN VOW NUCLEAR WAR MUST NEVER BE FOUGHT';
  const h2y = panelY + panelHeight + 8;
  drawTextWrapped(rightX, h2y, panelWidth, headline2, 2, COLORS.red, FONT_HEIGHT * 2 + 4);

  // Deck
  const deck2 = 'FIRST TRILATERAL SUMMIT AT KYLIN VILLA | 90% OF NUCLEAR ARMS | NEW START EXPIRED FEB 2026 | UN REFORM AGREED | NO BREAKTHROUGH ON UKRAINE IRAN';
  const deck2y = h2y + (FONT_HEIGHT * 2 + 4) * 3 + 4;
  drawTextWrapped(rightX, deck2y, panelWidth, deck2, 1, COLORS.ink, FONT_HEIGHT + 2);

  // ========== DIVIDER ==========
  const dividerY = Math.max(deck1y, deck2y) + 20;
  drawHorizontalLine(60, dividerY, WIDTH - 120, COLORS.darkTeal);
  drawHorizontalLine(60, dividerY + 2, WIDTH - 120, COLORS.darkTeal);

  // ========== AROUND THE WORLD SECTION ==========
  const sectionY = dividerY + 12;
  drawText(60, sectionY, 'AROUND THE WORLD', 3, COLORS.ink);
  const cardsY = sectionY + FONT_HEIGHT * 3 + 8;

  // 6 brief cards in 2 rows of 3
  const briefs = [
    { cat: 'CLIMATE', head: 'COP31 DEADLOCK TALKS INTO OVERTIME OVER FOSSIL FUELS', note: 'Antalya summit enters second day of overtime with no new text agreed' },
    { cat: 'MIDDLE EAST', head: 'IRAN STRIKES BAHRAIN SITE GULF TENSIONS FLARE', note: 'Two tankers hit near Hormuz three Houthi missiles intercepted over Riyadh' },
    { cat: 'AMERICAS', head: 'MEXICO CAPTURES EL CHAPO ISIDRO 11 DEAD IN AFTERMATH', note: 'FBI most-wanted cartel boss seized in Sinaloa violence erupts' },
    { cat: 'DISASTER', head: 'MAGNITUDE 6.7 QUAKE SHAKES PERU ANDES LIMA FLEES', note: 'Epicentre near Junin depth 108km 170 homes affected no tsunami threat' },
    { cat: 'TRADE', head: 'EU AND INDONESIA SIGN LANDMARK DEAL AFTER TEN YEARS', note: 'CEPA and IPA signed further steps remain before effect' },
    { cat: 'DISASTER', head: 'INDONESIA FACTORY FIRE KILLS THREE 36 STILL MISSING', note: 'Fonusa Agung Mulia confectionery plant in Cikande Banten' },
  ];

  const cardW = (WIDTH - 140) / 3;
  const cardH = 160;
  const cardGap = 10;

  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 3; col++) {
      const idx = row * 3 + col;
      const bx = 60 + col * (cardW + cardGap);
      const by = cardsY + row * (cardH + cardGap);
      const b = briefs[idx];

      // Card border
      drawRectBorder(bx, by, cardW, cardH, COLORS.darkTeal, 1);

      // Category label (red background)
      const catW = textWidth(b.cat, 1) + 8;
      fillRect(bx + 4, by + 4, catW, FONT_HEIGHT + 4, COLORS.red);
      drawText(bx + 8, by + 6, b.cat, 1, COLORS.paper);

      // Headline
      const hx = bx + 8;
      const hy = by + FONT_HEIGHT + 16;
      drawTextWrapped(hx, hy, cardW - 16, b.head, 1, COLORS.ink, FONT_HEIGHT + 2);

      // Note
      const noteY = hy + (FONT_HEIGHT + 2) * 3 + 4;
      drawTextWrapped(hx, noteY, cardW - 16, b.note, 1, COLORS.mutedGreen, FONT_HEIGHT + 2);
    }
  }

  // ========== FOOTER ==========
  const footerY = HEIGHT - 40;
  const leftFooter = 'THE WORLD LEDGER • SUNDAY 22 NOVEMBER 2026 • A VISUAL SUMMARY OF THE DAY’S REPORTED NEWS';
  const rightFooter = 'NEWS IMAGE EDITION';
  drawText(60, footerY, leftFooter, 1, COLORS.ink);
  const rfw = textWidth(rightFooter, 1);
  drawText(WIDTH - 60 - rfw, footerY, rightFooter, 1, COLORS.mutedGreen);
}

// ============================================================
// ENTRY POINT
// ============================================================
function main(): void {
  render();

  const png = encodePNG(buffer, WIDTH, HEIGHT);

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || 'out';
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }
  const outPath = join(outDir, 'entry.png');
  writeFileSync(outPath, png);

  // Verify size constraint
  if (png.length > 1048576) {
    console.error(`ERROR: PNG size ${png.length} bytes exceeds 1 MiB limit`);
    process.exit(1);
  }

  console.log(`Written ${png.length} bytes to ${outPath}`);
  process.exit(0);
}

main();