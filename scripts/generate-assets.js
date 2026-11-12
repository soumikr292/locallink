const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

// CRC32 table for valid PNG chunks
const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crcBuf = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, combined, crcBuf]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4 + 1;
  const raw = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * stride] = 0; // filter none
    rgba.copy(raw, y * stride + 1, y * width * 4, (y + 1) * width * 4);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", compressed),
    pngChunk("IEND", Buffer.alloc(0))
  ]);
}

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function drawRoundedRectAlpha(nx, ny, halfW, halfH, radius) {
  const ax = Math.abs(nx) - (halfW - radius);
  const ay = Math.abs(ny) - (halfH - radius);
  const dx = Math.max(ax, 0);
  const dy = Math.max(ay, 0);
  const dist = Math.sqrt(dx * dx + dy * dy) + Math.min(Math.max(ax, ay), 0) - radius;
  return clamp(0.5 - dist * 160, 0, 1);
}

function drawEmblemOnBuffer(buf, width, height, iconScale = 1.0, bgColor = [2, 6, 23, 255]) {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height) * iconScale;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const nx = (x - cx) / minDim; // normalized [-0.5, 0.5] inside icon box
      const ny = (y - cy) / minDim;

      let r = bgColor[0];
      let g = bgColor[1];
      let b = bgColor[2];
      let a = bgColor[3];

      // Outer emerald-teal gradient rounded square badge
      const boxAlpha = drawRoundedRectAlpha(nx, ny, 0.44, 0.44, 0.11);
      if (boxAlpha > 0) {
        const t = clamp((nx + ny + 0.88) / 1.76, 0, 1);
        const gr = Math.round(5 + t * 20);
        const gg = Math.round(150 + t * 26);
        const gb = Math.round(105 + t * 55);
        r = Math.round(r * (1 - boxAlpha) + gr * boxAlpha);
        g = Math.round(g * (1 - boxAlpha) + gg * boxAlpha);
        b = Math.round(b * (1 - boxAlpha) + gb * boxAlpha);
        a = Math.max(a, Math.round(255 * boxAlpha));
      }

      // Inner dark ring shadow
      const innerShadow = drawRoundedRectAlpha(nx, ny, 0.36, 0.36, 0.08);
      if (innerShadow > 0) {
        const sr = 2, sg = 6, sb = 23;
        r = Math.round(r * (1 - innerShadow * 0.22) + sr * innerShadow * 0.22);
        g = Math.round(g * (1 - innerShadow * 0.22) + sg * innerShadow * 0.22);
        b = Math.round(b * (1 - innerShadow * 0.22) + sb * innerShadow * 0.22);
      }

      // Stylized white Location Pin + Shop Roof inside badge
      // 1. Awning / Roof trapezoid bar
      const roofTop = -0.17;
      const roofBot = -0.06;
      if (ny >= roofTop && ny <= roofBot) {
        const progress = (ny - roofTop) / (roofBot - roofTop);
        const halfSpan = 0.17 + progress * 0.06;
        if (Math.abs(nx) <= halfSpan) {
          r = 255; g = 255; b = 255; a = 255;
        }
      }

      // 2. Scallop stripes under awning
      if (ny > -0.06 && ny <= -0.015) {
        const dx1 = Math.abs(nx + 0.14);
        const dx2 = Math.abs(nx);
        const dx3 = Math.abs(nx - 0.14);
        if (dx1 < 0.055 || dx2 < 0.055 || dx3 < 0.055) {
          r = 236; g = 253; b = 245; a = 255;
        }
      }

      // 3. Shop body / Market stall frame
      const bodyAlpha = drawRoundedRectAlpha(nx, ny - 0.10, 0.17, 0.11, 0.025);
      if (bodyAlpha > 0) {
        r = Math.round(r * (1 - bodyAlpha) + 255 * bodyAlpha);
        g = Math.round(g * (1 - bodyAlpha) + 255 * bodyAlpha);
        b = Math.round(b * (1 - bodyAlpha) + 255 * bodyAlpha);
        a = Math.max(a, Math.round(255 * bodyAlpha));
      }

      // 4. Emerald location pin cutout inside shop body
      const pinDist = Math.sqrt(nx * nx + (ny - 0.09) * (ny - 0.09));
      if (pinDist < 0.065) {
        r = 6; g = 95; b = 70; a = 255;
      }
      if (pinDist < 0.026) {
        r = 52; g = 211; b = 153; a = 255;
      }

      buf[idx] = r;
      buf[idx + 1] = g;
      buf[idx + 2] = b;
      buf[idx + 3] = a;
    }
  }
}

function generateIcon(outPath, size, transparentBg = false) {
  const buf = Buffer.alloc(size * size * 4);
  const bg = transparentBg ? [2, 6, 23, 0] : [2, 6, 23, 255];
  drawEmblemOnBuffer(buf, size, size, transparentBg ? 1.0 : 1.0, bg);
  const png = encodePNG(size, size, buf);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log("Generated icon:", outPath, `(${size}x${size})`);
}

function generateSplash(outPath, size) {
  const buf = Buffer.alloc(size * size * 4);
  // Fill dark slate #020617 fast first, then draw badge only in center bounding box!
  for (let i = 0; i < size * size; i++) {
    buf[i * 4] = 2;
    buf[i * 4 + 1] = 6;
    buf[i * 4 + 2] = 23;
    buf[i * 4 + 3] = 255;
  }
  const badgeSize = Math.round(size * 0.28);
  const badgeBuf = Buffer.alloc(badgeSize * badgeSize * 4);
  drawEmblemOnBuffer(badgeBuf, badgeSize, badgeSize, 1.0, [2, 6, 23, 255]);

  const startX = Math.floor((size - badgeSize) / 2);
  const startY = Math.floor((size - badgeSize) / 2);
  for (let y = 0; y < badgeSize; y++) {
    for (let x = 0; x < badgeSize; x++) {
      const srcIdx = (y * badgeSize + x) * 4;
      const dstIdx = ((startY + y) * size + (startX + x)) * 4;
      buf[dstIdx] = badgeBuf[srcIdx];
      buf[dstIdx + 1] = badgeBuf[srcIdx + 1];
      buf[dstIdx + 2] = badgeBuf[srcIdx + 2];
      buf[dstIdx + 3] = badgeBuf[srcIdx + 3];
    }
  }

  const png = encodePNG(size, size, buf);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, png);
  console.log("Generated splash:", outPath, `(${size}x${size})`);
}

const rootDir = path.join(__dirname, "..");

// PWA Icons in frontend/icons/
generateIcon(path.join(rootDir, "frontend/icons/icon-192.png"), 192, false);
generateIcon(path.join(rootDir, "frontend/icons/icon-512.png"), 512, false);

// Capacitor Native Assets in assets/
generateIcon(path.join(rootDir, "assets/icon-only.png"), 1024, false);
generateIcon(path.join(rootDir, "assets/icon-foreground.png"), 1024, true);
generateIcon(path.join(rootDir, "assets/icon.png"), 1024, false);
generateSplash(path.join(rootDir, "assets/splash.png"), 2732);
generateSplash(path.join(rootDir, "assets/splash-dark.png"), 2732);
