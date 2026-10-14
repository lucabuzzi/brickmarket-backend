// Database reads behind the expansion pages and the "expansions" list of the catalog hubs. Read-only, cached
// 5 minutes (cache.js) so crawler traffic cannot hammer the database; a failed or slow read yields null and the
// caller leaves that part of the page out (the shell never throws).
const { query } = require('../../db');
const { cached } = require('./cache');
const { esc, list, section } = require('./html');

const TTL_MS = 5 * 60 * 1000;

/**
 * { set, others } for one expansion page (see pages.setPageDef), or null when the id is unknown or the read failed.
 * `others` = other expansions of the same game that have active listings: the only ones worth linking to, since
 * linking to expansions with nothing to show would just add thin pages to the crawl.
 */
async function fetchSetData({ game, id }) {
  return cached(`setpage:${game}:${String(id).toLowerCase()}`, TTL_MS, async () => {
    const { rows } = await query(
      `SELECT id, name, name_en, series_name, series_name_en, card_count_total, release_date
       FROM card_sets WHERE game = $1 AND lower(id) = lower($2)`,
      [game, id]
    );
    if (!rows[0]) return null;
    const others = await query(
      `SELECT cs.id, cs.name, cs.name_en
       FROM card_sets cs
       WHERE cs.game = $1 AND lower(cs.id) <> lower($2)
         AND lower(cs.id) IN (SELECT lower(l.card_set_id) FROM listings l
                              WHERE l.status = 'active' AND l.game = $1 AND l.card_set_id IS NOT NULL)
       ORDER BY cs.sort_order, cs.id
       LIMIT 12`,
      [game, id]
    );
    return { set: rows[0], others: others.rows };
  });
}

/** { game, heading, limit? } -> "<section><h2>…</h2><ul>…</ul></section>" with expansion NAMES as plain text, or ''. */
async function setsListBlock({ game, heading, limit = 30 }, locale = 'it') {
  const rows = await cached(`setlist:${game}:${limit}`, TTL_MS, async () => (await query(
    `SELECT name, name_en FROM card_sets WHERE game = $1
     ORDER BY release_date DESC NULLS LAST, sort_order, id LIMIT $2`,
    [game, limit]
  )).rows);
  if (!rows || rows.length === 0) return '';
  const names = rows.map((r) => (locale === 'en' ? r.name_en || r.name : r.name || r.name_en)).filter(Boolean);
  return section(heading, list(names.map(esc)));
}

module.exports = { fetchSetData, setsListBlock };
