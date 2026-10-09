// Server-side SEO for the Pokémon expansion pages: /annunci/carte-collezionabili/pokemon/:espansione and the
// auction twin /aste/... — their own title/description (crawlers and link previews do not run the client JS),
// a real 404 for an expansion id that does not exist, and the pages worth listing in the sitemap.
const { query } = require('../db');
const tcgdex = require('./tcgdex');

const BASE_URL = 'https://cardbrix.com';
const PATH_RE = /^\/(annunci|aste)\/carte-collezionabili\/pokemon\/([A-Za-z0-9._-]{1,60})\/?$/;

/** "/annunci/carte-collezionabili/pokemon/30th" -> { mode: 'annunci', id: '30th' }, or null when it is not such a path. */
function parseSetPath(reqPath) {
  const m = PATH_RE.exec(reqPath || '');
  return m ? { mode: m[1], id: m[2] } : null;
}

/** Title and description for one expansion page. Pure: `set` is a card_sets row, `mode` 'annunci' | 'aste'. */
function buildSetMeta(set, mode) {
  const name = set.name || set.name_en || set.id;
  const series = set.series_name || set.series_name_en || '';
  const cards = set.card_count_total ? ` Espansione da ${set.card_count_total} carte${series ? ` della serie ${series}` : ''}.` : '';
  if (mode === 'aste') {
    return {
      title: `Aste carte Pokémon ${name} | CardBrix`,
      description: `Rilancia nelle aste live di carte Pokémon dell'espansione ${name} su CardBrix.${cards}`.slice(0, 300),
    };
  }
  return {
    title: `Carte Pokémon ${name} in vendita | CardBrix`,
    description: `Compra e vendi carte Pokémon dell'espansione ${name} su CardBrix, tra collezionisti.${cards}`.slice(0, 300),
  };
}

/**
 * Meta for an expansion page, or null when the id is not a known expansion (the caller answers 404).
 * A database error is NOT "unknown": it throws, so the caller can keep serving the page.
 */
async function fetchSetPageMeta(reqPath) {
  const parsed = parseSetPath(reqPath);
  if (!parsed) return null;
  const find = () => query(
    `SELECT id, name, name_en, series_name, series_name_en, card_count_total
     FROM card_sets WHERE game = 'pokemon' AND lower(id) = lower($1)`,
    [parsed.id]
  );
  let { rows } = await find();
  if (!rows[0]) {
    // The table fills itself on first use: a crawler asking for an expansion page before anyone opened the Pokémon
    // page would otherwise get a 404 for a real expansion. Make sure it is filled, then look once more.
    await tcgdex.ensureSets().catch((err) => console.error('seoSetPages: ensureSets failed:', err.message));
    ({ rows } = await find());
  }
  return rows[0] ? buildSetMeta(rows[0], parsed.mode) : null;
}

/** Expansion pages with at least one active listing (annunci) or auction (aste): [{ path, lastmod }]. */
async function listSetSitemapPaths() {
  const { rows } = await query(
    `SELECT card_set_id AS id,
            (type = 'auction' OR COALESCE(is_auction, false)) AS auction,
            MAX(updated_at) AS lastmod
     FROM listings
     WHERE status = 'active' AND game = 'pokemon' AND card_set_id IS NOT NULL
     GROUP BY 1, 2`
  );
  return rows.map((r) => ({
    path: `/${r.auction ? 'aste' : 'annunci'}/carte-collezionabili/pokemon/${String(r.id).toLowerCase()}`,
    lastmod: r.lastmod,
  }));
}

module.exports = { parseSetPath, buildSetMeta, fetchSetPageMeta, listSetSitemapPaths, BASE_URL };
