/**
 * GET /api/sets/lookup/:setNum
 *
 * Looks up a LEGO set by number using the Rebrickable API (with local DB cache).
 * Returns normalized set data for auto-completing the "Sell" listing form.
 *
 * Responses:
 *   200 — { set_num, name, year, theme_id, num_parts, img_url, rebrickable_url, source }
 *   404 — { error: "Set not found" } — user should enter data manually
 *   429 — { error: "Rate limited" }  — Rebrickable throttled us
 *   500 — { error: "..." }           — unexpected server error
 *
 * No auth required — this is a read-only lookup used on the Sell page.
 */
const express = require('express');
const router = express.Router();
const { lookupSet, normalizeSetNum } = require('../services/rebrickable');
const { computeMarketValue, CONDITION_MULTIPLIERS } = require('../services/marketValue');

// Simple in-memory rate limiter: max 10 lookups per IP per minute
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 60_000;
const RATE_MAX = 10;

function isRateLimited(ip) {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };
  if (now - record.start > RATE_WINDOW_MS) {
    // Reset window
    rateLimitMap.set(ip, { count: 1, start: now });
    return false;
  }
  record.count++;
  rateLimitMap.set(ip, record);
  return record.count > RATE_MAX;
}

router.get('/lookup/:setNum', async (req, res) => {
  const { setNum } = req.params;

  // Basic input validation
  if (!setNum || typeof setNum !== 'string' || setNum.length > 30) {
    return res.status(400).json({ error: 'Numero set non valido.' });
  }
  if (!/^[\w-]+$/.test(setNum)) {
    return res.status(400).json({ error: 'Il numero set contiene caratteri non validi.' });
  }

  // Rate limiting
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: 'Troppe richieste. Riprova tra un minuto.' });
  }

  const normalizedNum = normalizeSetNum(setNum);
  console.info(`[Sets Lookup] Request for "${setNum}" → normalized to "${normalizedNum}"`);

  try {
    const setData = await lookupSet(normalizedNum);

    if (!setData) {
      return res.status(404).json({
        error: `Set "${normalizedNum}" non trovato. Verifica il numero o inserisci i dati manualmente.`,
        set_num: normalizedNum,
      });
    }

    // Mark whether the result came from cache or live API (for debugging/QA)
    const source = setData.fetched_at ? 'cache' : 'api';

    // Compute market value estimate
    const pricing = computeMarketValue(setData);

    return res.json({
      set_num: setData.set_num,
      name: setData.name,
      year: setData.year,
      theme_id: setData.theme_id,
      num_parts: setData.num_parts,
      img_url: setData.img_url,
      rebrickable_url: setData.rebrickable_url,
      source,
      // Pricing data
      pricing: {
        retailPrice: pricing.retailPrice,
        marketValue: pricing.marketValue,
        low: pricing.low,
        high: pricing.high,
        isRetired: pricing.isRetired,
        appreciationPct: pricing.appreciationPct,
        isTrending: pricing.isTrending,
        pricingSource: pricing.source,
        conditionMultipliers: CONDITION_MULTIPLIERS,
      },
    });
  } catch (err) {
    console.error('[Sets Lookup] Unexpected error:', err);
    return res.status(500).json({ error: 'Errore interno durante la ricerca del set.' });
  }
});

module.exports = router;
