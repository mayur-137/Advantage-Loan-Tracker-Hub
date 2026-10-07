// Draws the app icons (white house on the tracker's green) as PNGs, with no image library.
// Run: node make-icons.js  -> public/icon-192.png, icon-512.png, icon-180.png (Apple), icon-maskable-512.png
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const GREEN = [29, 107, 82], WHITE = [255, 255, 255], LIGHT = [216, 235, 226];

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// House in unit coordinates (0..1), centred; `scale` shrinks it for the maskable safe zone.
function houseAt(u, v, scale) {
  const x = (u - 0.5) / scale + 0.5, y = (v - 0.5) / scale + 0.5;
  const roof = y >= 0.22 && y <= 0.48 && Math.abs(x - 0.5) <= (y - 0.22) / 0.26 * 0.32;
  const body = x >= 0.28 && x <= 0.72 && y >= 0.46 && y <= 0.78;
  const door = x >= 0.45 && x <= 0.55 && y >= 0.6 && y <= 0.78;
  if (door) return LIGHT;
  if (roof || body) return WHITE;
  return null;
}
function draw(size, { rounded, scale }) {
  const r = rounded ? size * 0.22 : 0;
  return png(size, (px, py) => {
    if (rounded) {
      const cx = Math.min(Math.max(px, r), size - r), cy = Math.min(Math.max(py, r), size - r);
      if (Math.hypot(px - cx, py - cy) > r) return [0, 0, 0, 0];
    }
    const c = houseAt(px / size, py / size, scale) || GREEN;
    return [c[0], c[1], c[2], 255];
  });
}

const out = path.join(__dirname, "public");
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, "icon-192.png"), draw(192, { rounded: true, scale: 1 }));
fs.writeFileSync(path.join(out, "icon-512.png"), draw(512, { rounded: true, scale: 1 }));
fs.writeFileSync(path.join(out, "icon-180.png"), draw(180, { rounded: false, scale: 0.9 }));
fs.writeFileSync(path.join(out, "icon-maskable-512.png"), draw(512, { rounded: false, scale: 0.7 }));
console.log("icons written to", out);
