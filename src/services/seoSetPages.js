// Server-side SEO for the expansion pages of every game that has an expansion catalog:
// /annunci/carte-collezionabili/<game>/:espansione and the auction twin /aste/... — their own title/description
// (crawlers and link previews do not run the client JS), a real 404 for an expansion id that does not exist, and the
// pages worth listing in the sitemap.
const { query } = require('../db');

const BASE_URL = 'https://cardbrix.com';

/** Games with an expansion catalog: label used in titles, and the module that fills their card_sets rows. */
const GAMES = Object.freeze({
  pokemon: { label: 'Pokémon', provider: () => require('./tcgdex') },
  magic: { label: 'Magic', provider: () => require('./scryfall') },
  onepiece: { label: 'One Piece', provider: () => require('./onepieceApi') },
  yugioh: { label: 'Yu-Gi-Oh!', provider: () => require('./ygoprodeck') },
  lorcana: { label: 'Lorcana', provider: () => require('./lorcanaApi') },
});
const CATALOG_GAME_SLUGS = Object.keys(GAMES);

const PATH_RE = new RegExp(`^/(annunci|aste)/carte-collezionabili/(${CATALOG_GAME_SLUGS.join('|')})/([A-Za-z0-9._-]{1,60})/?$`);

/** "/annunci/carte-collezionabili/magic/blb" -> { mode: 'annunci', game: 'magic', id: 'blb' }, or null when it is not such a path. */
function parseSetPath(reqPath) {
  const m = PATH_RE.exec(reqPath || '');
  return m ? { mode: m[1], game: m[2], id: m[3] } : null;
}

/** Title and description for one expansion page. Pure: `set` is a card_sets row, `mode` 'annunci' | 'aste'. */
function buildSetMeta(set, mode, game = 'pokemon') {
  const label = GAMES[game] ? GAMES[game].label : game;
  const name = set.name || set.name_en || set.id;
  const series = set.series_name || set.series_name_en || '';
  const cards = set.card_count_total ? ` Espansione da ${set.card_count_total} carte${series ? ` (${series})` : ''}.` : '';
  if (mode === 'aste') {
    return {
      title: `Aste carte ${label} ${name} | CardBrix`,
      description: `Rilancia nelle aste live di carte ${label} dell'espansione ${name} su CardBrix.${cards}`.slice(0, 300),
    };
  }
  return {
    title: `Carte ${label} ${name} in vendita | CardBrix`,
    description: `Compra e vendi carte ${label} dell'espansione ${name} su CardBrix, tra collezionisti.${cards}`.slice(0, 300),
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
     FROM card_sets WHERE game = $2 AND lower(id) = lower($1)`,
    [parsed.id, parsed.game]
  );
  let { rows } = await find();
  if (!rows[0]) {
    // The table fills itself on first use: a crawler asking for an expansion page before anyone opened the game's
    // page would otherwise get a 404 for a real expansion. Make sure it is filled, then look once more.
    await GAMES[parsed.game].provider().ensureSets().catch((err) => console.error('seoSetPages: ensureSets failed:', err.message));
    ({ rows } = await find());
  }
  return rows[0] ? buildSetMeta(rows[0], parsed.mode, parsed.game) : null;
}

/** Expansion pages with at least one active listing (annunci) or auction (aste): [{ path, lastmod }]. */
async function listSetSitemapPaths() {
  const { rows } = await query(
    `SELECT game, card_set_id AS id,
            (type = 'auction' OR COALESCE(is_auction, false)) AS auction,
            MAX(updated_at) AS lastmod
     FROM listings
     WHERE status = 'active' AND game = ANY($1) AND card_set_id IS NOT NULL
     GROUP BY 1, 2, 3`,
    [CATALOG_GAME_SLUGS]
  );
  return rows.map((r) => ({
    path: `/${r.auction ? 'aste' : 'annunci'}/carte-collezionabili/${r.game}/${String(r.id).toLowerCase()}`,
    lastmod: r.lastmod,
  }));
}

module.exports = { parseSetPath, buildSetMeta, fetchSetPageMeta, listSetSitemapPaths, CATALOG_GAME_SLUGS, BASE_URL };
