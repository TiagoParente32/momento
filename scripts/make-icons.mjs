// Generates PNG icons (gradient circle with a soft "sun over horizon" mark) with zero deps.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
const lerp = (a, b, t) => a + (b - a) * t;

function icon(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size / 2;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const i = y * (size * 4 + 1) + 1 + x * 4;
      const dx = x + 0.5 - r, dy = y + 0.5 - r;
      const d = Math.sqrt(dx * dx + dy * dy);
      const edge = Math.max(0, Math.min(1, r - d));
      const t = y / size;
      // dusk gradient: indigo -> coral
      let R = lerp(79, 251, t), G = lerp(70, 146, t), B = lerp(229, 120, t);
      // sun
      const sx = x + 0.5 - r, sy = y + 0.5 - size * 0.58;
      const sd = Math.sqrt(sx * sx + sy * sy);
      if (sd < size * 0.2 && y < size * 0.62) { R = 255; G = 244; B = 222; }
      // horizon band
      if (y >= size * 0.62 && y < size * 0.66) { R = 255; G = 244; B = 222; }
      raw[i] = R; raw[i + 1] = G; raw[i + 2] = B; raw[i + 3] = Math.round(255 * edge);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}
mkdirSync('public/icons', { recursive: true });
for (const s of [16, 32, 48, 128]) writeFileSync(`public/icons/icon-${s}.png`, icon(s));
console.log('icons written');
