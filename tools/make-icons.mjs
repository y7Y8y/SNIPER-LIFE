/* Génère les icônes PNG du jeu (identité : croix de visée olive sur nuit) sans dépendance. */
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';

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
  const out = Buffer.alloc(8 + data.length + 4);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), Buffer.from(data)])), 8 + data.length);
  return out;
}

function writePng(path, w, h, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
  writeFileSync(path, png);
}

function drawIcon(size, maskable) {
  const px = Buffer.alloc(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const safe = maskable ? size * 0.36 : size * 0.5; // rayon utilisable
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const d = Math.hypot(dx, dy);
      // fond : nuit olive avec halo central sombre
      let r = 0x0d, g = 0x12, b = 0x0d, a = 255;
      const halo = Math.max(0, 1 - d / safe);
      r += halo * 0x04; g += halo * 0x06; b += halo * 0x04;
      // anneau de lunette
      const ring = Math.abs(d - safe * 0.82);
      if (ring < size * 0.02) { r = 0x8a; g = 0x9a; b = 0x6f; }
      // réticule : croix fine avec trou central
      const lw = Math.max(1, size / 96);
      const gap = safe * 0.16;
      const cross = (Math.abs(dx) < lw && Math.abs(dy) < safe * 0.78) ||
                    (Math.abs(dy) < lw && Math.abs(dx) < safe * 0.78);
      const inGap = Math.abs(dx) < gap && Math.abs(dy) < gap && d > gap * 1.4;
      if (cross && !inGap) { r = 0xd0; g = 0xd6; b = 0xbc; }
      // point central
      if (d < lw * 1.2) { r = 0xd0; g = 0xd6; b = 0xbc; }
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
    }
  }
  return px;
}

mkdirSync('public/icons', { recursive: true });
for (const [name, size, maskable] of [
  ['icon-180.png', 180, false],
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['icon-maskable-512.png', 512, true]
]) {
  writePng(`public/icons/${name}`, size, size, drawIcon(size, maskable));
  console.log('icône écrite :', name);
}
