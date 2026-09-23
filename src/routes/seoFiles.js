const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { buildLlmsTxt, buildLlmsFullTxt } = require('../services/llmsTxt');
const { getKey } = require('../services/indexnow');

const BASE_URL = 'https://cardbrix.com';

function sendText(res, body) {
  res.set('Content-Type', 'text/plain; charset=UTF-8');
  res.set('Cache-Control', 'public, max-age=3600');
  res.send(body);
}

// Markdown map of the site for AI assistants / answer engines (https://llmstxt.org)
router.get('/llms.txt', (req, res) => sendText(res, buildLlmsTxt({ baseUrl: BASE_URL })));

router.get('/llms-full.txt', async (req, res) => {
  let listings = [];
  try {
    const { rows } = await query(
      `SELECT id, title, type, price, current_bid, auction_start
       FROM listings WHERE status = 'active' ORDER BY updated_at DESC LIMIT 50`
    );
    listings = rows;
  } catch (err) {
    // Same policy as sitemap.xml: if the DB is down, still answer with the static part.
    console.error('llms-full.txt: errore nel recupero degli annunci attivi:', err.message);
  }
  sendText(res, buildLlmsFullTxt({ baseUrl: BASE_URL, listings }));
});

// IndexNow ownership proof: /<INDEXNOW_KEY>.txt must return the key. Anything else falls through
// to the rest of the app (and to the SPA), so this is a no-op when INDEXNOW_KEY is not configured.
router.get(/^\/([A-Za-z0-9-]{8,128})\.txt$/, (req, res, next) => {
  const key = getKey();
  if (!key || req.params[0] !== key) return next();
  return sendText(res, key);
});

module.exports = router;
