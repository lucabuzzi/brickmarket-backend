#!/usr/bin/env node
/**
 * try-card-recognition.js — measures the card recognition (src/services/cardRecognition.js) on real photos before a
 * game is opened on the sell page. No database access: only the vision model and the games' public databases.
 *
 *   node scripts/try-card-recognition.js --game <game> <photo|folder>...     your phone photos
 *   node scripts/try-card-recognition.js --game <game> --synthetic KEY ...   official images made photo-like
 *   options: --save <dir>  keep the synthetic images; --model <id>  another Gemini model; --width <px>  synthetic card size
 *   games: onepiece (default), magic, pokemon, yugioh, lorcana
 *
 * Name a photo after the print it shows and the script scores it (is that print among the ones offered?):
 *   onepiece "OP01-077_p1.jpg"   magic "mkm-123.jpg" (set-number)   pokemon "sv01-063.jpg" (TCGdex id)
 *   yugioh "LOB-EN001.jpg"       lorcana "SSK-123.jpg"
 * Anything after a space is ignored ("LOB-EN001 my copy.jpg"). The same keys work with --synthetic.
 * Photos are sent to the Gemini API: use your own cards only.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { recognizeCard, geminiReader, DEFAULT_MODEL, GAMES } = require('../src/services/cardRecognition');
const { adapterFor } = require('../src/services/recognition');

// USD per 1M tokens of gemini-3.1-flash-lite, paid tier (ai.google.dev/gemini-api/docs/pricing, checked 2026-10-21)
const PRICE_IN = 0.25;
const PRICE_OUT = 1.5;
const IMAGE_EXT = /\.(jpe?g|png|webp|heic|heif)$/i;

function parseArgs(argv) {
  const opts = { game: 'onepiece', inputs: [], synthetic: [], save: null, model: null, width: 600 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--synthetic') { while (argv[i + 1] && !argv[i + 1].startsWith('--')) opts.synthetic.push(argv[++i]); }
    else if (a === '--game') opts.game = argv[++i];
    else if (a === '--save') opts.save = argv[++i];
    else if (a === '--model') opts.model = argv[++i];
    else if (a === '--width') opts.width = Number(argv[++i]) || opts.width;
    else opts.inputs.push(a);
  }
  return opts;
}

/** "LOB-EN001 my copy.jpg" -> "LOB-EN001"; the key the offered prints are scored against. */
const keyFromName = (file) => path.basename(file).replace(IMAGE_EXT, '').split(/\s/)[0] || null;

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
async function syntheticPhoto(imageUrl, seed, width) {
  const res = await fetch(imageUrl, { signal: AbortSignal.timeout(15000), headers: { 'User-Agent': 'CardBrix/1.0 (card recognition trial)' } });
  if (!res.ok) throw new Error(`image HTTP ${res.status}`);
  const card = await sharp(Buffer.from(await res.arrayBuffer())).resize({ width }).toBuffer();
  const angle = [-8, 5, -3, 9, -6, 4][seed % 6];
  const tilted = await sharp(card).rotate(angle, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const meta = await sharp(tilted).metadata();
  const tw = Math.round(width * 1.73);
  const th = Math.round(width * 2.3);
  const table = await sharp({
    create: { width: tw, height: th, channels: 3, background: { r: 120 + (seed * 17) % 60, g: 96, b: 70 }, noise: { type: 'gaussian', mean: 110, sigma: 30 } },
  }).png().toBuffer();
  return sharp(table)
    .composite([{ input: tilted, left: Math.max(0, Math.round((tw - meta.width) / 2 + 20)), top: Math.max(0, Math.round((th - meta.height) / 2 - 30)) }])
    .blur(1.1)
    .modulate({ brightness: 0.85 + (seed % 3) * 0.1 })
    .jpeg({ quality: 55 })
    .toBuffer();
}

async function syntheticCases(adapter, keys, { save, width }) {
  const cases = [];
  let seed = 0;
  for (const key of keys) {
    const row = await adapter.sample(key);
    if (!row || !row.img_url) { console.error(`No official image for ${key}`); continue; }
    let buffer;
    try {
      buffer = await syntheticPhoto(row.img_url, seed++, width);
    } catch (err) {
      console.error(`${key}: ${err.message}`);
      continue;
    }
    if (save) {
      fs.mkdirSync(save, { recursive: true });
      fs.writeFileSync(path.join(save, `${key}.jpg`), buffer);
    }
    cases.push({ label: `synthetic ${key}`, buffer, key });
  }
  return cases;
}

const pad = (s, n) => String(s ?? '').padEnd(n).slice(0, n);
const shown = (r) => [r.reading?.code || r.reading?.rawCode, r.reading?.setCode, r.reading?.number].filter(Boolean).join(' ');

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const adapter = adapterFor(opts.game);
  if (!adapter) { console.error(`Unknown game "${opts.game}" (${GAMES.join(', ')})`); process.exit(1); }
  if (!process.env.GEMINI_API_KEY) { console.error('GEMINI_API_KEY is missing from .env'); process.exit(1); }
  const cases = [
    ...listPhotos(opts.inputs).map((f) => ({ label: path.basename(f), buffer: fs.readFileSync(f), key: keyFromName(f) })),
    ...(await syntheticCases(adapter, opts.synthetic, opts)),
  ];
  if (!cases.length) {
    console.error('Usage: node scripts/try-card-recognition.js --game <game> <photo|folder>... [--synthetic KEY ...] [--save dir] [--model id]');
    process.exit(1);
  }
  const reader = geminiReader(opts.model ? { model: opts.model } : {});
  console.log(`${adapter.title} — model ${opts.model || process.env.GEMINI_VISION_MODEL || DEFAULT_MODEL} — ${cases.length} photo(s)\n`);
  console.log(`${pad('photo', 28)} ${pad('status', 10)} ${pad('read', 18)} ${pad('name read', 24)} ${pad('lang', 4)} ${pad('prints', 6)} ${pad('ok', 6)} ms`);

  const stats = { n: 0, scored: 0, offered: 0, first: 0, matched: 0, ms: 0, tin: 0, tout: 0 };
  for (const c of cases) {
    const t0 = Date.now();
    let r;
    try {
      r = await recognizeCard(opts.game, c.buffer, { reader });
    } catch (err) {
      console.log(`${pad(c.label, 28)} ERROR ${err.code || ''} ${err.message}`);
      continue;
    }
    const ms = Date.now() - t0;
    stats.n++; stats.ms += ms;
    stats.tin += r.usage?.inputTokens || 0; stats.tout += r.usage?.outputTokens || 0;
    if (r.status === 'matched') stats.matched++;
    let verdict = '';
    if (c.key) {
      stats.scored++;
      const hit = (p) => adapter.keysOf(p).some((k) => String(k).toLowerCase() === c.key.toLowerCase());
      const at = r.prints.findIndex(hit);
      if (at >= 0) stats.offered++;
      if (at === 0) stats.first++;
      verdict = at === 0 ? 'OK' : at > 0 ? `OK #${at + 1}` : 'WRONG';
    }
    const name = r.reading?.name ? `${r.reading.name}${r.nameMatches === false ? ' (≠)' : ''}` : '';
    console.log(`${pad(c.label, 28)} ${pad(r.status, 10)} ${pad(shown(r), 18)} ${pad(name, 24)} ${pad(r.reading?.language, 4)} ${pad(r.prints.length, 6)} ${pad(verdict, 6)} ${ms}`);
  }

  if (!stats.n) return;
  const cost = (stats.tin * PRICE_IN + stats.tout * PRICE_OUT) / 1e6;
  console.log('\nSummary');
  console.log(`  recognised (card exists):   ${stats.matched}/${stats.n}`);
  if (stats.scored) {
    console.log(`  right print offered:        ${stats.offered}/${stats.scored}`);
    console.log(`  right print offered first:  ${stats.first}/${stats.scored}`);
  }
  console.log(`  average time:               ${Math.round(stats.ms / stats.n)} ms (photo -> prints)`);
  console.log(`  average tokens:             ${Math.round(stats.tin / stats.n)} in / ${Math.round(stats.tout / stats.n)} out`);
  console.log(`  paid-tier cost:             $${(cost / stats.n).toFixed(5)} per photo ≈ $${((cost / stats.n) * 1000).toFixed(2)} per 1000`);
}

main().catch((err) => { console.error(err); process.exit(1); });
