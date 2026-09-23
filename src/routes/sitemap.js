const express = require('express');
const router = express.Router();
const { query } = require('../db');
const { resolveImageUrl } = require('../services/seoMeta');

const BASE_URL = 'https://cardbrix.com';

/** Static, publicly indexable pages — kept in sync with the route table in client/src/App.jsx */
const STATIC_PATHS = [
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
];

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

  const staticUrls = STATIC_PATHS.map((p) => urlTag(`${BASE_URL}${p}`, null));
  const body = [...staticUrls, ...listingUrls].join('');

  res.set('Content-Type', 'application/xml; charset=UTF-8');
  res.send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">${body}</urlset>`);
});

module.exports = router;
