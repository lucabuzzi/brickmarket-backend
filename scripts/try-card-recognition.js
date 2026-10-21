#!/usr/bin/env node
/**
 * try-card-recognition.js — measures the One Piece card recognition (src/services/cardRecognition.js) on real photos
 * before it is wired into the sell page. No database access: only the vision model and the public optcgapi.com.
 *
 *   node scripts/try-card-recognition.js <photo|folder>...          your phone photos
 *   node scripts/try-card-recognition.js --synthetic OP01-077 ...    official images made photo-like (tilt, blur, noise)
 *   options: --save <dir>  keep the synthetic images; --model <id>  another Gemini model
 *
 * Name a photo after the print it shows ("OP01-077_p1.jpg", "EB01-012 my copy.jpg") and the script scores it:
 * code read right, and whether that print is among the ones offered to the seller.
 * Photos are sent to the Gemini API: on the free tier Google may use them, so use your own cards only.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { recognizeOnePiece, geminiReader, DEFAULT_MODEL } = require('../src/services/cardRecognition');
const { fetchPrintsByCode } = require('../src/services/onepiecePrints');
const { normalizeCode } = require('../src/services/onepieceCode');

// USD per 1M tokens of gemini-3.1-flash-lite, paid tier (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-21)
const PRICE_IN = 0.25;
const PRICE_OUT = 1.5;
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

function parseArgs(argv) {
  const opts = { inputs: [], synthetic: [], save: null, model: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--synthetic') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.synthetic.push(argv[++i]); }
    else if (a === '--save') opts.save = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else opts.inputs.push(a);
  }
  return opts;
}

/** "OP01-077_p1 front.jpg" -> { code: 'OP01-077', print: 'OP01-077_p1' }; no code in the name -> null. */
function expectedFromName(file) {
  const base = path.basename(file).replace(IMAGE_EXT, '');
  const code = normalizeCode(base.split(/\s/)[0]);
  if (!code) return null;
  const m = /^[A-Z0-9-]+_([pr]\d+)/i.exec(base);
  return { code, print: m ? `${code}_${m[1].toLowerCase()}` : code };
}

function listPhotos(inputs) {
  const files = [];
  for (const p of inputs) {
    if (!fs.existsSync(p)) { console.error(`Not found: ${p}`); continue; }
    if (fs.statSync(p).isDirectory()) {
      for (const f of fs.readdirSync(p).sort()) if (IMAGE_EXT.test(f)) files.push(path.join(p, f));
    } else files.push(p);
  }
  return files;
}

/** The official image of a print, made to look like a quick phone photo: tilted, on a noisy table, soft, low quality. */
async function syntheticPhoto(imageUrl, seed) {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`image HTTP ${res.status}`);
  const card = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width: 520 }).toBuffer();
  const angle = [-8, 5, -3, 9, -6, 4][seed % 6];
  const tilted = await sharp(card).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(tilted).metadata();
  const table = await sharp({
    create: { width: 900, height: 1200, channels: 3, background: { r: 120 + (seed * 17) % 60, g: 96, b: 70 }, noise: { type: 'gaussian', mean: 110, sigma: 30 } },
  }).png().toBuffer();
  return sharp(table)
    .composite([{ input: tilted, left: Math.round((900 - meta.width) / 2 + 20), top: Math.round((1200 - meta.height) / 2 - 30) }])
    .blur(1.1)
    .modulate({ brightness: 0.85 + (seed % 3) * 0.1 })
    .jpeg({ quality: 55 })
    .toBuffer();
}

async function syntheticCases(prints, saveDir) {
  const cases = [];
  let seed = 0;
  for (const wanted of prints) {
    const code = normalizeCode(wanted);
    const rows = code ? await fetchPrintsByCode(code) : [];
    const row = rows.find((r) => (r.card_image_id || r.card_set_id).toLowerCase() === wanted.toLowerCase()) || rows[0];
    if (!row || !row.card_image) { console.error(`No official image for ${wanted}`); continue; }
    const buffer = await syntheticPhoto(row.card_image, seed++);
    const print = row.card_image_id || row.card_set_id;
    if (saveDir) {
      fs.mkdirSync(saveDir, { recursive: true });
      fs.writeFileSync(path.join(saveDir, `${print}.jpg`), buffer);
    }
    cases.push({ label: `synthetic ${print}`, buffer, expected: { code, print } });
  }
  return cases;
}

const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is missing from .env'); process.exit(1); }
  const cases = [
    ...listPhotos(opts.inputs).map((f) => ({ label: path.basename(f), buffer: fs.readFileSync(f), expected: expectedFromName(f) })),
    ...(await syntheticCases(opts.synthetic, opts.save)),
  ];
  if (!cases.length) {
    console.error('Usage: node scripts/try-card-recognition.js <photo|folder>... [--synthetic OP01-077 ...] [--save dir] [--model id]');
    process.exit(1);
  }
  const reader = geminiReader(opts.model ? { model: opts.model } : {});
  console.log(`Model: ${opts.model || process.env.GEMINI_VISION_MODEL || DEFAULT_MODEL} — ${cases.length} photo(s)\n`);
  console.log(`${pad('photo', 28)} ${pad('status', 11)} ${pad('code read', 12)} ${pad('name read', 22)} ${pad('lang', 4)} ${pad('prints', 6)} ${pad('ok', 9)} ms`);

  const stats = { n: 0, scored: 0, codeOk: 0, printOffered: 0, matched: 0, ms: 0, tin: 0, tout: 0 };
  for (const c of cases) {
    const t0 = Date.now();
    let r;
    try {
      r = await recognizeOnePiece(c.buffer, { reader });
    } catch (err) {
      console.log(`${pad(c.label, 28)} ERROR ${err.code || ''} ${err.message}`);
      continue;
    }
    const ms = Date.now() - t0;
    stats.n++; stats.ms += ms;
    stats.tin += r.usage?.inputTokens || 0; stats.tout += r.usage?.outputTokens || 0;
    if (r.status === 'matched') stats.matched++;
    let verdict = '';
    if (c.expected) {
      stats.scored++;
      const codeOk = r.reading?.code === c.expected.code;
      const offered = r.prints.some((p) => p.external_id.toLowerCase() === c.expected.print.toLowerCase());
      if (codeOk) stats.codeOk++;
      if (offered) stats.printOffered++;
      verdict = codeOk && offered ? 'OK' : codeOk ? 'code only' : 'WRONG';
    }
    const name = r.reading?.name ? `${r.reading.name}${r.nameMatches === false ? ' (≠)' : ''}` : '';
    console.log(`${pad(c.label, 28)} ${pad(r.status, 11)} ${pad(r.reading?.code || r.reading?.rawCode, 12)} ${pad(name, 22)} ${pad(r.reading?.language, 4)} ${pad(r.prints.length, 6)} ${pad(verdict, 9)} ${ms}`);
  }

  if (!stats.n) return;
  const cost = (stats.tin * PRICE_IN + stats.tout * PRICE_OUT) / 1e6;
  console.log('\nSummary');
  console.log(`  recognised (code exists):   ${stats.matched}/${stats.n}`);
  if (stats.scored) {
    console.log(`  code read right:            ${stats.codeOk}/${stats.scored}`);
    console.log(`  exact print offered:        ${stats.printOffered}/${stats.scored}`);
  }
  console.log(`  average time:               ${Math.round(stats.ms / stats.n)} ms (photo -> prints)`);
  console.log(`  average tokens:             ${Math.round(stats.tin / stats.n)} in / ${Math.round(stats.tout / stats.n)} out`);
  console.log(`  paid-tier cost:             $${(cost / stats.n).toFixed(5)} per photo ≈ $${((cost / stats.n) * 1000).toFixed(2)} per 1000`);
}

main().catch((err) => { console.error(err); process.exit(1); });
