/**
 * onepieceApi.js — One Piece Card Game lookup via the free optcgapi.com API.
 * No API key required. See https://optcgapi.com/documentation
 */

const cardCatalog = require('./cardCatalog');

const OPTCG_BASE = 'https://optcgapi.com/api';

async function fetchJson(url) {
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[OPTCG] Network error:', err.message);
    return null;
  }
}

/**
 * Maps a raw optcgapi.com card object to our generic master_cards row shape.
 */
function mapOnePieceCard(card) {
  return {
    external_id: card.card_image_id || card.card_set_id,
    name: card.card_name,
    set_code: card.set_id || null,
    set_name: card.set_name || null,
    rarity: card.rarity || null,
    img_url: card.card_image || null,
    details: {
      type: card.card_type || null,
      color: card.card_color || null,
      cost: card.card_cost ?? null,
      power: card.card_power ?? null,
      life: card.life ?? null,
      attribute: card.attribute || null,
      sub_types: card.sub_types || null,
      card_text: card.card_text || null,
    },
  };
}

/**
 * Looks up a single card by its card_image_id (e.g. "OP01-024" or "OP01-024_p1"),
 * using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('onepiece', externalId);
  if (cached) return cached;

  // optcgapi's per-card endpoint is keyed on the base card_set_id (no parallel suffix)
  const baseId = externalId.replace(/_p\d+$/, '');
  const data = await fetchJson(`${OPTCG_BASE}/sets/card/${encodeURIComponent(baseId)}/`);
  const variants = Array.isArray(data) ? data : [];
  const card = variants.find((v) => v.card_image_id === externalId) || variants[0];
  if (!card) return null;

  return cardCatalog.upsertCard('onepiece', mapOnePieceCard(card));
}

/**
 * Searches optcgapi.com by (partial) name, upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${OPTCG_BASE}/sets/filtered/?card_name=${encodeURIComponent(q)}`);
  const cards = Array.isArray(data) ? data : [];

  const mapped = cards.slice(0, limit).map(mapOnePieceCard);
  return cardCatalog.bulkUpsertCards('onepiece', mapped);
}

module.exports = { lookupCard, searchCardsExternal };
