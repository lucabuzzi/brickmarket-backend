const express = require('express');
const router = express.Router();
const { lookupCountry } = require('../services/geoip');

const SUPPORTED_LANGUAGES = ['it', 'en', 'de', 'es', 'fr'];

// Best-effort country -> UI language mapping. Not exhaustive: anything not
// listed here (or not resolvable) falls back to no suggestion, leaving the
// existing localStorage/navigator detection in i18n.js untouched.
const COUNTRY_LANGUAGE_MAP = {
  IT: 'it', SM: 'it', VA: 'it',
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', UY: 'es',
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
  GB: 'en', US: 'en', IE: 'en', AU: 'en', CA: 'en', NZ: 'en',
};

/**
 * GET /api/geo/suggest-language
 * Public, no auth, no cookies set. Purely a one-shot best-effort suggestion —
 * the frontend decides whether/how to surface it and never auto-switches.
 */
router.get('/suggest-language', (req, res) => {
  const country = lookupCountry(req);
  const suggested = country ? COUNTRY_LANGUAGE_MAP[country] : null;

  res.json({
    country: country || null,
    suggestedLanguage: SUPPORTED_LANGUAGES.includes(suggested) ? suggested : null,
  });
});

module.exports = router;
