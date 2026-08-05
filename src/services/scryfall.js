/**
 * scryfall.js — Magic: The Gathering card lookup via the free Scryfall API.
 * No API key required. Scryfall asks integrations to send a descriptive
 * User-Agent and Accept header — see https://scryfall.com/docs/api
 */

const cardCatalog = require('./cardCatalog');

const SCRYFALL_BASE = 'https://api.scryfall.com';
const USER_AGENT = 'BrickMarket/1.0 (BrickMarket collectible catalog)';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[Scryfall] Network error:', err.message);
    return null;
  }
}

/**
 * Maps a raw Scryfall card object to our generic master_cards row shape.
 */
function mapScryfallCard(card) {
  const face = card.card_faces?.[0];
  const imgUrl = card.image_uris?.normal || face?.image_uris?.normal || null;

  return {
    external_id: card.id,
    name: card.name,
    set_code: card.set ? card.set.toUpperCase() : null,
    set_name: card.set_name || null,
    rarity: card.rarity || null,
    img_url: imgUrl,
    details: {
      mana_cost: card.mana_cost || face?.mana_cost || null,
      type_line: card.type_line || face?.type_line || null,
      oracle_text: card.oracle_text || face?.oracle_text || null,
      cmc: card.cmc ?? null,
      priceEur: card.prices?.eur || card.prices?.usd || null,
    },
  };
}

/**
 * Looks up a single card by Scryfall ID, using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('magic', externalId);
  if (cached) return cached;

  const data = await fetchJson(`${SCRYFALL_BASE}/cards/${encodeURIComponent(externalId)}`);
  if (!data || data.object === 'error') return null;

  return cardCatalog.upsertCard('magic', mapScryfallCard(data));
}

/**
 * Searches Scryfall directly for a name query, upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${SCRYFALL_BASE}/cards/search?q=${encodeURIComponent(q)}&order=name`);
  if (!data || !Array.isArray(data.data)) return [];

  const mapped = data.data.slice(0, limit).map(mapScryfallCard);
  return cardCatalog.bulkUpsertCards('magic', mapped);
}

module.exports = { lookupCard, searchCardsExternal };
