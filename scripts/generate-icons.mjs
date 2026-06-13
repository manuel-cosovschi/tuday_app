// Genera íconos PNG (fondo índigo + check blanco) sin dependencias externas.
// Uso: node scripts/generate-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/icons');
mkdirSync(OUT, { recursive: true });

// ---- CRC32 ----
const crcTable = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const body = Buffer.concat([typeBuf, data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function distToSegment(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

function makePNG(size) {
  const bg = [79, 70, 229]; // #4f46e5 indigo
  const radius = size * 0.22;
  const thickness = size * 0.085;

  // Check: dos segmentos en coordenadas normalizadas.
  const seg = [
    [0.3, 0.52, 0.44, 0.66],
    [0.44, 0.66, 0.72, 0.36],
  ].map((s) => s.map((v) => v * size));

  const raw = Buffer.alloc((size * 4 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filtro none
    for (let x = 0; x < size; x++) {
      // esquinas redondeadas (alfa fuera del radio)
      let inside = true;
      const corners = [
        [radius, radius],
        [size - radius, radius],
        [radius, size - radius],
        [size - radius, size - radius],
      ];
      if (x < radius && y < radius) inside = Math.hypot(x - corners[0][0], y - corners[0][1]) <= radius;
      else if (x > size - radius && y < radius) inside = Math.hypot(x - corners[1][0], y - corners[1][1]) <= radius;
      else if (x < radius && y > size - radius) inside = Math.hypot(x - corners[2][0], y - corners[2][1]) <= radius;
      else if (x > size - radius && y > size - radius) inside = Math.hypot(x - corners[3][0], y - corners[3][1]) <= radius;

      const dCheck = Math.min(
        distToSegment(x, y, seg[0][0], seg[0][1], seg[0][2], seg[0][3]),
        distToSegment(x, y, seg[1][0], seg[1][1], seg[1][2], seg[1][3])
      );
      const isCheck = dCheck <= thickness;

      let r, g, b, a;
      if (!inside) {
        r = g = b = a = 0;
      } else if (isCheck) {
        r = g = b = 255;
        a = 255;
      } else {
        [r, g, b] = bg;
        a = 255;
      }
      raw[o++] = r;
      raw[o++] = g;
      raw[o++] = b;
      raw[o++] = a;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const targets = [
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],
  ['badge.png', 96],
];

for (const [name, size] of targets) {
  writeFileSync(resolve(OUT, name), makePNG(size));
  console.log('✓', name, `(${size}px)`);
}
console.log('Íconos generados en public/icons');
