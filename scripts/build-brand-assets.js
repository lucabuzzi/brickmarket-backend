// Regenerates every derived brand image from the single source logo.
//   node scripts/build-brand-assets.js
//
// Source: client/brand-src/cardbrix-logo-dark.jpg (2000x1091, opaque dark background).
// When a truly transparent PNG becomes available, drop it in as
// client/brand-src/cardbrix-logo.png and set USE_TRANSPARENT = true below; nothing else changes.
// Does not touch the database, so it does not need scripts/run-db-script.js.
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'client', 'brand-src');
const OUT_ASSETS = path.join(ROOT, 'client', 'src', 'assets', 'brand');
const OUT_PUBLIC = path.join(ROOT, 'client', 'public');

const USE_TRANSPARENT = false;
const SOURCE = path.join(SRC_DIR, USE_TRANSPARENT ? 'cardbrix-logo.png' : 'cardbrix-logo-dark.jpg');

// The brick "C" inside the full logo (source pixel coords): a square window centred on the letter.
const C_MARK = { left: 1060, top: 335, width: 350, height: 350 };

// Card + bricks illustration without the lettering (hero atmosphere layer behind the card fan).
const ART = { left: 330, top: 0, width: 1340, height: 790 };

const roundedMask = (size, radiusPct) => {
  const r = Math.round(size * radiusPct);
  return Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`
  );
};

async function cMark(size) {
  return sharp(SOURCE)
    .extract(C_MARK)
    .resize(size, size)
    .composite([{ input: roundedMask(size, 0.22), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function main() {
  // Full logo for the hero backdrop / first-visit reveal / footer signature.
  await sharp(SOURCE).resize({ width: 1600 }).webp({ quality: 82 }).toFile(path.join(OUT_ASSETS, 'logo-1600.webp'));
  await sharp(SOURCE).resize({ width: 800 }).webp({ quality: 80 }).toFile(path.join(OUT_ASSETS, 'logo-800.webp'));

  await sharp(SOURCE).extract(ART).resize({ width: 1100 }).webp({ quality: 80 }).toFile(path.join(OUT_ASSETS, 'art-1100.webp'));

  // "C" mark: header (displayed ~36px and flown from ~175px in the intro, so 256px), plus icon set.
  await sharp(await cMark(256)).webp({ quality: 90 }).toFile(path.join(OUT_ASSETS, 'cmark-256.webp'));
  for (const [name, size] of [['favicon-32.png', 32], ['favicon-48.png', 48], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
    await sharp(await cMark(size)).png({ compressionLevel: 9 }).toFile(path.join(OUT_PUBLIC, name));
  }

  // Social card: 1200x630, cover-fit from the 1.83:1 source.
  await sharp(SOURCE).resize(1200, 630, { fit: 'cover', position: 'centre' }).jpeg({ quality: 80, mozjpeg: true }).toFile(path.join(OUT_PUBLIC, 'og-image.jpg'));

  console.log('brand assets written to', OUT_ASSETS, 'and', OUT_PUBLIC);
}

main().catch((err) => { console.error(err); process.exit(1); });
