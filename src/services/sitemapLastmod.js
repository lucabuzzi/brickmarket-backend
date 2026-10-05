// <lastmod> for the static pages of sitemap.xml. Google ignores a lastmod it cannot trust, so each date has to
// mean "the content really changed":
//   - the TEXT of a page (what the content shell renders without live data) -> a fingerprint of that text is kept in
//     src/config/sitemapLastmod.json together with the day it last changed; `npm run sitemap:lastmod` refreshes the
//     file and a test fails when the text changed but the file was not refreshed
//   - the LIVE part (listings in a category, entries of a catalog) -> the newest row that feeds the page
// A page's lastmod is the later of the two.
const crypto = require('crypto');
const { pageFor } = require('./seoContent/pages');
const stored = require('../config/sitemapLastmod.json');

/** Short fingerprint of what a page says by itself (headline, intro, body, links, breadcrumbs), live blocks excluded. */
function pageFingerprint(path) {
  const def = pageFor(path);
  const material = def ? JSON.stringify([def.h1, def.lead, def.body, def.tail, def.crumbs]) : `no-content:${path}`;
  return crypto.createHash('sha1').update(material).digest('hex').slice(0, 16);
}

/** { path: { hash, date } } for `paths`: dates are kept while the text is unchanged, set to `today` for new or changed pages. */
function refreshStored(paths, today, previous = stored) {
  const next = {};
  for (const p of paths) {
    const hash = pageFingerprint(p);
    const old = previous[p];
    next[p] = old && old.hash === hash ? old : { hash, date: today };
  }
  return next;
}

const MARKET = /^\/(annunci|aste)(?:\/(lego|funko|carte-collezionabili)(?:\/([a-z]+))?)?$/;
const later = (a, b) => (a && b ? (new Date(a) > new Date(b) ? a : b) : a || b || null);
const maxOf = (dates) => dates.reduce((m, d) => later(m, d), null);

/**
 * The newest date among the live rows that feed `path`, or null when the page has none.
 * `data.groups`: [{ auction, product_type, game, m }] (newest updated_at of active listings per group)
 * `data.catalog`: { lego: date, pokemon: date, ... } (newest fetched_at per catalog)
 */
function dataDateFor(path, data = {}) {
  const groups = data.groups || [];
  const catalog = data.catalog || {};
  if (path === '/') return maxOf(groups.map((g) => g.m));
  if (path === '/catalog') return maxOf(Object.values(catalog));
  const cat = path.match(/^\/catalog\/([a-z]+)$/);
  if (cat) return catalog[cat[1]] || null;

  const m = path.match(MARKET);
  if (!m) return null;
  const [, mode, kind, game] = m;
  const auction = mode === 'aste';
  const productType = kind === 'carte-collezionabili' ? 'tcg' : kind || null;
  return maxOf(groups
    .filter((g) => Boolean(g.auction) === auction)
    .filter((g) => !productType || g.product_type === productType)
    .filter((g) => !game || g.game === game)
    .map((g) => g.m));
}

/** Final lastmod (Date | string | null) for a static path. */
function lastmodFor(path, data, source = stored) {
  const own = source[path] ? source[path].date : null;
  return later(own, dataDateFor(path, data));
}

module.exports = { pageFingerprint, refreshStored, dataDateFor, lastmodFor };
