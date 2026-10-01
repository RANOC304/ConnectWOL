// Generates the PWA / favicon icons from the brand mark. Run with: npm run icons
//
// Dependency-free on purpose: the mark is simple geometry, so it is rasterised here with signed
// distance fields (4x4 supersampling for anti-aliasing) and written as PNG with node:zlib. The
// generated files are committed; re-run this only when the logo changes.
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'icons');

/* ---------- the mark, in a 48x48 design space (keep in sync with src/components/Logo.tsx) ---------- */

const STOPS = [
  [0, [0xff, 0xbe, 0x62]],
  [0.5, [0xff, 0x7a, 0x3d]],
  [1, [0xff, 0x4f, 0x6d]],
];
const INK = [0x1d, 0x10, 0x08];

const gradient = (x, y) => {
  const t = Math.min(1, Math.max(0, (x - 4 + (y - 4)) / 80));
  const [[t0, c0], [t1, c1]] = t < 0.5 ? [STOPS[0], STOPS[1]] : [STOPS[1], STOPS[2]];
  const f = (t - t0) / (t1 - t0);
  return c0.map((v, i) => v + (c1[i] - v) * f);
};

const roundedRectSdf = (x, y, size, r) => {
  const cx = Math.abs(x - size / 2) - (size / 2 - r);
  const cy = Math.abs(y - size / 2) - (size / 2 - r);
  return Math.hypot(Math.max(cx, 0), Math.max(cy, 0)) + Math.min(Math.max(cx, cy), 0) - r;
};

const capsuleSdf = (px, py, ax, ay, bx, by) => {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.min(1, Math.max(0, (pax * bax + pay * bay) / (bax * bax + bay * bay)));
  return Math.hypot(pax - bax * h, pay - bay * h);
};

// ring: centre (24, 24.657), radius 12.5, open at the top between -132.2deg and -47.8deg
const RING = { cx: 24, cy: 24.657, r: 12.5 };
const GAP_START = Math.atan2(15.4 - RING.cy, 15.6 - 24); // left end of the arc
const GAP_END = Math.atan2(15.4 - RING.cy, 32.4 - 24); // right end of the arc
const ringSdf = (x, y) => {
  const dx = x - RING.cx;
  const dy = y - RING.cy;
  const angle = Math.atan2(dy, dx);
  const inGap = angle > GAP_START && angle < GAP_END; // the top opening (SVG y points down)
  if (!inGap) return Math.abs(Math.hypot(dx, dy) - RING.r);
  const ends = [GAP_START, GAP_END].map((a) => [RING.cx + Math.cos(a) * RING.r, RING.cy + Math.sin(a) * RING.r]);
  return Math.min(...ends.map(([ex, ey]) => Math.hypot(x - ex, y - ey)));
};

/** Colour (premultiplied-free RGBA, 0..1 alpha) of the mark at design-space point (x, y). */
function sample(x, y, mode) {
  // background tile
  let alpha = 0;
  let rgb = [0, 0, 0];
  if (mode === 'rounded') alpha = roundedRectSdf(x, y, 48, 14) <= 0 ? 1 : 0;
  else alpha = x >= 0 && x <= 48 && y >= 0 && y <= 48 ? 1 : 0;
  if (alpha === 0) return [0, 0, 0, 0];
  rgb = gradient(x, y);

  // glyph (shrunk into the safe zone for maskable icons)
  const gx = mode === 'maskable' ? (x - 4.8) / 0.8 : x;
  const gy = mode === 'maskable' ? (y - 4.8) / 0.8 : y;
  const half = 1.8; // stroke width 3.6
  const onGlyph = capsuleSdf(gx, gy, 24, 10.5, 24, 22.5) <= half || ringSdf(gx, gy) <= half;
  if (onGlyph) rgb = INK;
  else if (Math.hypot(gx - 36.5, gy - 11.5) <= 2.1) rgb = rgb.map((v, i) => v * 0.15 + INK[i] * 0.85);
  return [rgb[0], rgb[1], rgb[2], alpha];
}

/* ---------- rasteriser + PNG encoder ---------- */

function render(size, mode) {
  const SS = 4;
  const pixels = Buffer.alloc(size * size * 4);
  const scale = 48 / size;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [cr, cg, cb, ca] = sample((px + (sx + 0.5) / SS) * scale, (py + (sy + 0.5) / SS) * scale, mode);
          r += cr * ca; g += cg * ca; b += cb * ca; a += ca;
        }
      }
      const o = (py * size + px) * 4;
      if (a > 0) {
        pixels[o] = Math.round(r / a);
        pixels[o + 1] = Math.round(g / a);
        pixels[o + 2] = Math.round(b / a);
        pixels[o + 3] = Math.round((a / (SS * SS)) * 255);
      }
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function png(size, mode) {
  const rgba = render(size, mode);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

/** An .ico may embed PNG data directly (every current browser and Windows since Vista). */
function ico(pngBuffer, size) {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(1, 4); // image count
  header[6] = size;
  header[7] = size;
  header.writeUInt16LE(1, 10); // colour planes
  header.writeUInt16LE(32, 12); // bits per pixel
  header.writeUInt32LE(pngBuffer.length, 14);
  header.writeUInt32LE(22, 18); // data offset
  return Buffer.concat([header, pngBuffer]);
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
  <defs><linearGradient id="g" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#ffbe62"/><stop offset="0.5" stop-color="#ff7a3d"/><stop offset="1" stop-color="#ff4f6d"/></linearGradient></defs>
  <rect width="48" height="48" rx="14" fill="url(#g)"/>
  <g fill="none" stroke="#1d1008" stroke-width="3.6" stroke-linecap="round"><path d="M24 10.5v12"/><path d="M15.6 15.4a12.5 12.5 0 1 0 16.8 0"/></g>
  <circle cx="36.5" cy="11.5" r="2.1" fill="#1d1008" opacity="0.85"/>
</svg>
`;

await mkdir(out, { recursive: true });
await writeFile(join(out, 'icon.svg'), svg);
await writeFile(join(out, 'icon-192.png'), png(192, 'rounded'));
await writeFile(join(out, 'icon-512.png'), png(512, 'rounded'));
await writeFile(join(out, 'maskable-512.png'), png(512, 'maskable'));
await writeFile(join(out, 'apple-touch-icon.png'), png(180, 'square'));
await writeFile(join(root, 'public', 'favicon.ico'), ico(png(48, 'rounded'), 48));
console.log('icons written to public/icons');
