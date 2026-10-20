// Builds the character skins of "CardBrix the game" from the artwork sheets.
//   node scripts/build-game-skins.js
//
// Source: client/brand-src/game/<look>.jpg.jpeg (or .jpg/.png) for each look (uomo_base, uomo_cyber, donna_base,
// donna_cyber): 1024x1024 sheets, 4 columns x 3 rows (rows: down, up, right). Output (client/src/assets/game/skins):
//   <look>.png        4x4 cells of 48x56: rows down / up / right / left (left = right mirrored), columns = walk frames
//   <look>-mask.png   same size; the R channel says which colour region each pixel belongs to (see skinPipeline.js)
//   manifest.json     frame size, row order, idle frames and, per look, the reference colours of every region
// The creator recolours the regions (skin, hair, jacket, details, trousers) at runtime with the mask.
// Does not touch the database, so it does not need scripts/run-db-script.js.
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const P = require('./lib/skinPipeline');

const ROOT = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT, 'client', 'brand-src', 'game');
const OUT_DIR = path.join(ROOT, 'client', 'src', 'assets', 'game', 'skins');

const LOOKS = ['uomo_base', 'uomo_cyber', 'donna_base', 'donna_cyber'];
const FRAME = { w: 48, h: 56 };
const TARGET_H = 48; // the character's height in the cell (the idle front frame)
const SRC_COLS = 4;
const SRC_ROWS = 3;
// Which source column goes in which output column (the artwork's down/up rows hold standing poses plus one
// stepping pose, so they are re-ordered into a gentle walk cycle; the right row is a real walk).
const ORDER = { down: [0, 1, 2, 1], up: [0, 2, 1, 3], right: [0, 1, 2, 3] };
const OUT_ROWS = ['down', 'up', 'right', 'left'];
const IDLE = { down: 1, up: 0, right: 1, left: 1 };

function findSource(look) {
  const hit = fs.readdirSync(SRC_DIR).find((f) => f.startsWith(`${look}.`));
  if (!hit) throw new Error(`Missing source sheet for "${look}" in ${SRC_DIR}`);
  return path.join(SRC_DIR, hit);
}

/** Keeps the character: the biggest blob plus nearby specks (detached goggles, hair tips); drops neighbours' slivers. */
function keepMainBlob(data, w, h) {
  const label = new Int32Array(w * h).fill(-1);
  const blobs = [];
  for (let s = 0; s < w * h; s++) {
    if (label[s] !== -1 || !data[s * 4 + 3]) continue;
    const id = blobs.length;
    const b = { id, n: 0, left: w, right: 0, top: h, bottom: 0 };
    const st = [s];
    label[s] = id;
    while (st.length) {
      const k = st.pop();
      const x = k % w;
      const y = (k / w) | 0;
      b.n++;
      if (x < b.left) b.left = x; if (x > b.right) b.right = x; if (y < b.top) b.top = y; if (y > b.bottom) b.bottom = y;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const nk = ny * w + nx;
        if (label[nk] === -1 && data[nk * 4 + 3]) { label[nk] = id; st.push(nk); }
      }
    }
    blobs.push(b);
  }
  if (!blobs.length) return;
  const main = blobs.reduce((a, b) => (b.n > a.n ? b : a));
  const keep = new Set(blobs.filter((b) => b.id === main.id || (b.n >= 25
    && b.left >= main.left - 18 && b.right <= main.right + 18 && b.top >= main.top - 18 && b.bottom <= main.bottom + 18)).map((b) => b.id));
  for (let k = 0; k < w * h; k++) if (label[k] !== -1 && !keep.has(label[k])) data[k * 4 + 3] = 0;
}

async function loadCell(file, col, row) {
  const meta = await sharp(file).metadata();
  const cw = Math.floor(meta.width / SRC_COLS);
  const ch = Math.floor(meta.height / SRC_ROWS);
  const pad = 8; // look a little outside the cell so nothing is clipped; neighbours are filtered out afterwards
  const left = Math.max(0, col * cw - pad);
  const top = Math.max(0, row * ch - pad);
  const width = Math.min(meta.width - left, cw + 2 * pad);
  const height = Math.min(meta.height - top, ch + 2 * pad);
  const { data, info } = await sharp(file).extract({ left, top, width, height }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  P.removeBackground(data, info.width, info.height);
  P.defringe(data, info.width, info.height);
  keepMainBlob(data, info.width, info.height);
  const b = P.opaqueBounds(data, info.width, info.height);
  if (!b) throw new Error(`Empty frame in ${file} (col ${col}, row ${row})`);
  return { data, w: info.width, h: info.height, bounds: b };
}

async function buildLook(look) {
  const file = findSource(look);
  const cells = {}; // `${row}:${col}` -> cleaned source cell
  for (let r = 0; r < SRC_ROWS; r++) for (let c = 0; c < SRC_COLS; c++) cells[`${r}:${c}`] = await loadCell(file, c, r);

  // one scale for the whole look, from the standing front pose, so heights stay consistent between frames
  const ref = cells['0:1'].bounds;
  const scale = TARGET_H / (ref.bottom - ref.top + 1);

  const W = FRAME.w * SRC_COLS;
  const H = FRAME.h * OUT_ROWS.length;
  const sheet = new Uint8Array(W * H * 4);
  const mask = new Uint8Array(W * H); // region id per pixel
  const statFrames = [];

  const place = async (outRow, outCol, src) => {
    const { data, w, h, bounds } = src;
    const cw = bounds.right - bounds.left + 1;
    const chh = bounds.bottom - bounds.top + 1;
    const nw = Math.max(1, Math.round(cw * scale));
    const nh = Math.max(1, Math.round(chh * scale));
    const crop = await sharp(data, { raw: { width: w, height: h, channels: 4 } })
      .extract({ left: bounds.left, top: bounds.top, width: cw, height: chh })
      .resize({ width: nw, height: nh, kernel: 'nearest' }).raw().toBuffer();
    const small = new Uint8Array(crop);
    const sb = P.opaqueBounds(small, nw, nh);
    const centre = P.torsoCentre(small, nw, sb);
    let ox = Math.round(FRAME.w / 2 - centre);
    ox = Math.max(-sb.left, Math.min(FRAME.w - 1 - sb.right, ox));
    const oy = FRAME.h - 2 - (sb.bottom + 1); // soles two pixels above the cell bottom
    const frameData = new Uint8Array(FRAME.w * FRAME.h * 4);
    const frameMask = new Uint8Array(FRAME.w * FRAME.h);
    for (let y = sb.top; y <= sb.bottom; y++) {
      for (let x = sb.left; x <= sb.right; x++) {
        const si = (y * nw + x) * 4;
        if (!small[si + 3]) continue;
        const tx = x + ox;
        const ty = y + oy;
        if (tx < 0 || ty < 0 || tx >= FRAME.w || ty >= FRAME.h) continue;
        const ti = (ty * FRAME.w + tx) * 4;
        frameData[ti] = small[si]; frameData[ti + 1] = small[si + 1]; frameData[ti + 2] = small[si + 2]; frameData[ti + 3] = 255;
        const [hh, ss, vv] = P.rgbToHsv(small[si], small[si + 1], small[si + 2]);
        const ry = (y - sb.top) / Math.max(1, sb.bottom - sb.top);
        frameMask[ty * FRAME.w + tx] = P.classifyPixel(look, hh, ss, vv, ry);
      }
    }
    return { frameData, frameMask };
  };

  const blit = (outRow, outCol, f, flip) => {
    for (let y = 0; y < FRAME.h; y++) {
      for (let x = 0; x < FRAME.w; x++) {
        const sx = flip ? FRAME.w - 1 - x : x;
        const si = (y * FRAME.w + sx) * 4;
        const di = ((outRow * FRAME.h + y) * W + outCol * FRAME.w + x) * 4;
        sheet[di] = f.frameData[si]; sheet[di + 1] = f.frameData[si + 1]; sheet[di + 2] = f.frameData[si + 2]; sheet[di + 3] = f.frameData[si + 3];
        mask[(outRow * FRAME.h + y) * W + outCol * FRAME.w + x] = f.frameMask[y * FRAME.w + sx];
      }
    }
  };

  const srcRowOf = { down: 0, up: 1, right: 2 };
  for (const dir of ['down', 'up', 'right']) {
    for (let outCol = 0; outCol < SRC_COLS; outCol++) {
      const f = await place(OUT_ROWS.indexOf(dir), outCol, cells[`${srcRowOf[dir]}:${ORDER[dir][outCol]}`]);
      blit(OUT_ROWS.indexOf(dir), outCol, f, false);
      if (dir === 'right') blit(OUT_ROWS.indexOf('left'), outCol, f, true); // the left walk is the right walk mirrored
      statFrames.push({ data: f.frameData, mask: f.frameMask });
    }
  }

  const maskRgba = Buffer.alloc(W * H * 4);
  for (let k = 0; k < W * H; k++) { maskRgba[k * 4] = mask[k]; maskRgba[k * 4 + 3] = 255; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await sharp(Buffer.from(sheet), { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, `${look}.png`));
  await sharp(maskRgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(path.join(OUT_DIR, `${look}-mask.png`));
  return { scale: +scale.toFixed(4), regions: P.regionStats(statFrames) };
}

async function main() {
  const manifest = { frame: FRAME, cols: SRC_COLS, rows: OUT_ROWS, idle: IDLE, looks: {} };
  for (const look of LOOKS) {
    manifest.looks[look] = await buildLook(look);
    console.log(`ok ${look}`, JSON.stringify(manifest.looks[look]));
  }
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${LOOKS.length} skins to ${path.relative(ROOT, OUT_DIR)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
