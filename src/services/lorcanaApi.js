/**
 * lorcanaApi.js — Disney Lorcana card lookup via the free lorcana-api.com API.
 * No API key required. See https://lorcana-api.com/How-To.html
 */

const cardCatalog = require('./cardCatalog');

const LORCANA_BASE = 'https://api.lorcana-api.com';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[Lorcana] Network error:', err.message);
    return null;
  }
}

/**
 * Maps a raw lorcana-api.com card object to our generic master_cards row shape.
 */
function mapLorcanaCard(card) {
  return {
    external_id: card.Unique_ID,
    name: card.Name,
    set_code: card.Set_ID || null,
    set_name: card.Set_Name || null,
    rarity: card.Rarity || null,
    img_url: card.Image || null,
    details: {
      type: card.Type || null,
      color: card.Color || null,
      cost: card.Cost ?? null,
      strength: card.Strength ?? null,
      willpower: card.Willpower ?? null,
      lore: card.Lore ?? null,
      body_text: card.Body_Text || null,
      flavor_text: card.Flavor_Text || null,
    },
  };
}

/**
 * Looks up a single card by its Unique_ID (e.g. "TFC-041"), using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('lorcana', externalId);
  if (cached) return cached;

  const data = await fetchJson(`${LORCANA_BASE}/cards/fetch?search=unique_id~${encodeURIComponent(externalId)}`);
  const card = Array.isArray(data) ? data[0] : null;
  if (!card) return null;

  return cardCatalog.upsertCard('lorcana', mapLorcanaCard(card));
}

/**
 * Searches lorcana-api.com by (partial) name, upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${LORCANA_BASE}/cards/fetch?search=name~${encodeURIComponent(q)}`);
  const cards = Array.isArray(data) ? data : [];

  const mapped = cards.slice(0, limit).map(mapLorcanaCard);
  return cardCatalog.bulkUpsertCards('lorcana', mapped);
}

module.exports = { lookupCard, searchCardsExternal };
