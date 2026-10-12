// The static, publicly indexable pages of the site, kept in sync with the route table in client/src/App.jsx.
// A module of its own (no database import) so scripts can read the list without opening a connection.
// /privacy and /cookie-policy join the sitemap only once their texts are final (see legalPages.json's _comment).
const legalPages = require('../../client/src/config/legalPages.json');
const { resolveLocalizedPath, URL_LOCALES } = require('./localizedRoutes');

/**
 * Canonical (Italian) path of every static, publicly indexable page - kept in sync with the route table
 * in client/src/App.jsx. This is what sitemapLastmod.js and pageMeta.js match on; it never has a /it or
 * /en prefix. Deliberately NOT every structural page in localizedRoutes.json: search/query pages
 * (/catalog/*\/search, /search-results) and the per-expansion pages (handled live by seoSetPages.js,
 * only listed when they have something to show) are excluded as thin or duplicate content.
 */
const CANONICAL_STATIC_PATHS = [
  '/',
  '/catalog',
  '/catalog/lego',
  '/catalog/magic',
  '/catalog/yugioh',
  '/catalog/lorcana',
  '/catalog/pokemon',
  '/catalog/onepiece',
  '/catalog/dragonball',
  '/catalog/funko',
  '/annunci',
  '/annunci/lego',
  '/annunci/funko',
  '/annunci/carte-collezionabili',
  '/annunci/carte-collezionabili/pokemon',
  '/annunci/carte-collezionabili/magic',
  '/annunci/carte-collezionabili/lorcana',
  '/annunci/carte-collezionabili/yugioh',
  '/annunci/carte-collezionabili/onepiece',
  '/annunci/carte-collezionabili/dragonball',
  '/aste',
  '/aste/lego',
  '/aste/funko',
  '/aste/carte-collezionabili',
  '/aste/carte-collezionabili/pokemon',
  '/aste/carte-collezionabili/magic',
  '/aste/carte-collezionabili/lorcana',
  '/aste/carte-collezionabili/yugioh',
  '/aste/carte-collezionabili/onepiece',
  '/aste/carte-collezionabili/dragonball',
  '/come-funziona',
  '/skill-zone',
  '/faq',
  '/help',
  '/norme-legali',
  '/ricerca-utente',
  ...(legalPages.published ? ['/privacy', '/cookie-policy'] : []),
  ...(legalPages.accessibilityPublished ? ['/accessibilita'] : []),
];

/** Each canonical path resolved to both /it and /en - the actual indexable URLs listed in sitemap.xml. */
const STATIC_PATHS = CANONICAL_STATIC_PATHS.flatMap((p) => URL_LOCALES.map((locale) => resolveLocalizedPath(p, locale)));

module.exports = { STATIC_PATHS, CANONICAL_STATIC_PATHS };
