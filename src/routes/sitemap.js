const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { resolveImageUrl } = require('../services/seoMeta');

const { STATIC_PATHS, CANONICAL_STATIC_PATHS } = require('../services/sitemapPaths');
const { lastmodFor } = require('../services/sitemapLastmod');
const { cached } = require('../services/seoContent/cache');
const { listSetSitemapPaths } = require('../services/seoSetPages');
const { resolveLocalizedPath, URL_LOCALES } = require('../services/localizedRoutes');

const BASE_URL = 'https://cardbrix.com';

function xmlEscape(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function urlTag(loc, lastmod, images = []) {
  const lastmodTag = lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : '';
  const imageTags = images.map((src) => `<image:image><image:loc>${xmlEscape(src)}</image:loc></image:image>`).join('');
  return `<url><loc>${xmlEscape(loc)}</loc>${lastmodTag}${imageTags}</url>`;
}

const LASTMOD_TTL_MS = 10 * 60 * 1000;

/**
 * The newest rows that feed the live part of each static page: active listings per kind/category and the latest
 * entry of each catalog. Any read that fails is simply left out (that page then keeps the date of its own text).
 */
async function loadLastmodData() {
  const data = { groups: [], catalog: {} };
  try {
    const { rows } = await query(
      `SELECT (COALESCE(type = 'auction', false) OR COALESCE(is_auction, false)) AS auction, product_type, game, MAX(updated_at) AS m
       FROM listings WHERE status = 'active' GROUP BY 1, 2, 3`
    );
    data.groups = rows;
  } catch (err) {
    console.error('sitemap.xml: date degli annunci non disponibili:', err.message);
  }
  try {
    const { rows } = await query('SELECT game, MAX(fetched_at) AS m FROM master_cards GROUP BY game');
    rows.forEach((r) => { data.catalog[r.game] = r.m; });
    const sets = await query('SELECT MAX(fetched_at) AS m FROM master_sets');
    if (sets.rows[0] && sets.rows[0].m) data.catalog.lego = sets.rows[0].m;
  } catch (err) {
    console.error('sitemap.xml: date del catalogo non disponibili:', err.message);
  }
  return data;
}

router.get('/sitemap.xml', async (req, res) => {

  let listingUrls = [];
  try {
    const { rows } = await query(
      `SELECT id, updated_at, images FROM listings WHERE status = 'active' ORDER BY updated_at DESC LIMIT 5000`
    );
    listingUrls = rows.map((r) => {
      const images = (Array.isArray(r.images) ? r.images : []).slice(0, 3).map(resolveImageUrl);
      return urlTag(`${BASE_URL}/product/${r.id}`, r.updated_at, images);
    });
  } catch (err) {
    // Se il DB non risponde, pubblichiamo comunque le pagine statiche invece di rispondere 500.
    console.error('sitemap.xml: errore nel recupero degli annunci attivi:', err.message);
  }

  const lastmodData = (await cached('sitemap:lastmod', LASTMOD_TTL_MS, loadLastmodData, { timeoutMs: 3000 })) || { groups: [], catalog: {} };

  // lastmod is computed from the canonical (Italian) path - that's what sitemapLastmod.js's text
  // fingerprint and live-data matching understand - then applied to both the /it and /en URL.
  const staticUrls = CANONICAL_STATIC_PATHS.flatMap((p) => {
    const lastmod = lastmodFor(p, lastmodData);
    return URL_LOCALES.map((locale) => urlTag(`${BASE_URL}${resolveLocalizedPath(p, locale)}`, lastmod));
  });
  // Expansion pages (Pokémon, Magic, ...) that have something to show (an empty one would be a thin page).
  // Structural, like the other static pages above: listed at both their /it and /en URL.
  let setUrls = [];
  try {
    setUrls = (await listSetSitemapPaths()).flatMap((s) => URL_LOCALES.map((locale) => urlTag(`${BASE_URL}${resolveLocalizedPath(s.path, locale)}`, s.lastmod)));
  } catch (err) {
    console.error('sitemap.xml: espansioni non disponibili:', err.message);
  }
  const body = [...staticUrls, ...setUrls, ...listingUrls].join('');

  res.set('Content-Type', 'application/xml; charset=UTF-8');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${body}</urlset>`);
});

module.exports = router;
module.exports.STATIC_PATHS = STATIC_PATHS; // exposed so tests can prove every listed page has its own meta
