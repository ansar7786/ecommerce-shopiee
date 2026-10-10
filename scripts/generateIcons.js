const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = 0 ^ (-1);
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ (-1)) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'binary');
  const crcBuf = Buffer.alloc(4);
  const crc = crc32(Buffer.concat([typeBuf, data]));
  crcBuf.writeUInt32BE(crc, 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createPng(size, isMaskable) {
  const rgba = Buffer.alloc(size * size * 4);
  const bgR = 21, bgG = 128, bgB = 61; // #15803D
  const fgR = 255, fgG = 255, fgB = 255; // White

  const radius = isMaskable ? 0 : size * 0.2;
  const cx = size / 2;
  const cy = size / 2;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      let inBg = true;
      if (!isMaskable) {
        const dx = Math.max(Math.abs(x - cx) - (cx - radius), 0);
        const dy = Math.max(Math.abs(y - cy) - (cy - radius), 0);
        if (dx * dx + dy * dy > radius * radius) {
          inBg = false;
        }
      }

      if (!inBg) {
        rgba[idx] = 0;
        rgba[idx + 1] = 0;
        rgba[idx + 2] = 0;
        rgba[idx + 3] = 0;
        continue;
      }

      let r = bgR, g = bgG, b = bgB, a = 255;

      const nx = x / size;
      const ny = y / size;

      let inK = false;
      // Stem of K
      if (nx >= 0.30 && nx <= 0.42 && ny >= 0.24 && ny <= 0.76) {
        inK = true;
      }
      // Top diagonal
      const x1 = 0.36, y1 = 0.50, x2 = 0.69, y2 = 0.24;
      const lineLenSq1 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
      const t1 = Math.max(0, Math.min(1, ((nx - x1) * (x2 - x1) + (ny - y1) * (y2 - y1)) / lineLenSq1));
      const projX1 = x1 + t1 * (x2 - x1);
      const projY1 = y1 + t1 * (y2 - y1);
      if (Math.hypot(nx - projX1, ny - projY1) <= 0.065 && ny >= 0.23 && nx >= 0.35) {
        inK = true;
      }

      // Bottom diagonal
      const x3 = 0.40, y3 = 0.46, x4 = 0.70, y4 = 0.76;
      const lineLenSq2 = (x4 - x3) ** 2 + (y4 - y3) ** 2;
      const t2 = Math.max(0, Math.min(1, ((nx - x3) * (x4 - x3) + (ny - y3) * (y4 - y3)) / lineLenSq2));
      const projX2 = x3 + t2 * (x4 - x3);
      const projY2 = y3 + t2 * (y4 - y3);
      if (Math.hypot(nx - projX2, ny - projY2) <= 0.065 && ny <= 0.77 && nx >= 0.36) {
        inK = true;
      }

      if (inK) {
        r = fgR; g = fgG; b = fgB;
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }

  const scanlines = Buffer.alloc(size * (size * 4 + 1));
  let offset = 0;
  for (let y = 0; y < size; y++) {
    scanlines[offset++] = 0;
    for (let x = 0; x < size * 4; x++) {
      scanlines[offset++] = rgba[y * size * 4 + x];
    }
  }

  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdrData);

  const compressed = zlib.deflateSync(scanlines, { level: 9 });
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

const dir = path.join(__dirname, '..', 'client', 'public', 'icons');
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

fs.writeFileSync(path.join(dir, 'icon-192x192.png'), createPng(192, false));
fs.writeFileSync(path.join(dir, 'icon-512x512.png'), createPng(512, false));
fs.writeFileSync(path.join(dir, 'icon-maskable-192x192.png'), createPng(192, true));
fs.writeFileSync(path.join(dir, 'icon-maskable-512x512.png'), createPng(512, true));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="102" fill="#15803D"/>
  <path d="M 160 120 L 220 120 L 220 392 L 160 392 Z M 215 260 L 320 120 L 390 120 L 275 270 L 395 392 L 325 392 L 215 255 Z" fill="#FFFFFF"/>
</svg>`;
fs.writeFileSync(path.join(dir, 'icon.svg'), svg);

// Also copy or write to favicon.ico/png
fs.writeFileSync(path.join(__dirname, '..', 'client', 'public', 'favicon.ico'), createPng(192, false));

console.log('All PWA icons created successfully!');
