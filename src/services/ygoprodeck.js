/**
 * ygoprodeck.js — Yu-Gi-Oh! card lookup via the free YGOPRODeck API.
 * No API key required. See https://ygoprodeck.com/api-guide/
 */

const cardCatalog = require('./cardCatalog');

const YGO_BASE = 'https://db.ygoprodeck.com/api/v7';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[YGOPRODeck] Network error:', err.message);
    return null;
  }
}

/**
 * Maps a raw YGOPRODeck card object to our generic master_cards row shape.
 */
function mapYugiohCard(card) {
  const firstSet = card.card_sets?.[0];

  return {
    external_id: String(card.id),
    name: card.name,
    set_code: firstSet?.set_code || null,
    set_name: firstSet?.set_name || null,
    rarity: firstSet?.set_rarity || null,
    img_url: card.card_images?.[0]?.image_url || null,
    details: {
      type: card.type || null,
      race: card.race || null,
      attribute: card.attribute || null,
      level: card.level ?? null,
      atk: card.atk ?? null,
      def: card.def ?? null,
      desc: card.desc || null,
    },
  };
}

/**
 * Looks up a single card by YGOPRODeck numeric ID, using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('yugioh', externalId);
  if (cached) return cached;

  const data = await fetchJson(`${YGO_BASE}/cardinfo.php?id=${encodeURIComponent(externalId)}`);
  const card = data?.data?.[0];
  if (!card) return null;

  return cardCatalog.upsertCard('yugioh', mapYugiohCard(card));
}

/**
 * Fuzzy name search against YGOPRODeck (the `fname` param does partial matching),
 * upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${YGO_BASE}/cardinfo.php?fname=${encodeURIComponent(q)}`);
  const cards = Array.isArray(data?.data) ? data.data : [];

  const mapped = cards.slice(0, limit).map(mapYugiohCard);
  return cardCatalog.bulkUpsertCards('yugioh', mapped);
}

module.exports = { lookupCard, searchCardsExternal };
