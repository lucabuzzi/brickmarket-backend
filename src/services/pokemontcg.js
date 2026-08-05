/**
 * pokemontcg.js — Pokémon card lookup via the free Pokémon TCG API (pokemontcg.io).
 * Works unauthenticated with lower rate limits; set POKEMONTCG_API_KEY to raise
 * them (sent via the X-Api-Key header). See https://docs.pokemontcg.io/
 */

const cardCatalog = require('./cardCatalog');

const POKEMONTCG_BASE = 'https://api.pokemontcg.io/v2';

async function fetchJson(url) {
  const apiKey = process.env.POKEMONTCG_API_KEY;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...(apiKey ? { 'X-Api-Key': apiKey } : {}),
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[PokemonTCG] Network error:', err.message);
    return null;
  }
}

/**
 * Maps a raw pokemontcg.io card object to our generic master_cards row shape.
 */
function mapPokemonCard(card) {
  return {
    external_id: card.id,
    name: card.name,
    set_code: card.set?.id || null,
    set_name: card.set?.name || null,
    rarity: card.rarity || null,
    img_url: card.images?.large || card.images?.small || null,
    details: {
      supertype: card.supertype || null,
      types: (card.types || []).join(', ') || null,
      hp: card.hp || null,
      priceEur: card.cardmarket?.prices?.averageSellPrice ?? null,
    },
  };
}

/**
 * Looks up a single card by pokemontcg.io ID (e.g. "gym2-2"), using the DB cache as primary source.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('pokemon', externalId);
  if (cached) return cached;

  const data = await fetchJson(`${POKEMONTCG_BASE}/cards/${encodeURIComponent(externalId)}`);
  if (!data || !data.data) return null;

  return cardCatalog.upsertCard('pokemon', mapPokemonCard(data.data));
}

/**
 * Searches pokemontcg.io by (partial) name, upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(`${POKEMONTCG_BASE}/cards?q=name:${encodeURIComponent(`*${q}*`)}&pageSize=${limit}`);
  const cards = Array.isArray(data?.data) ? data.data : [];

  const mapped = cards.slice(0, limit).map(mapPokemonCard);
  return cardCatalog.bulkUpsertCards('pokemon', mapped);
}

module.exports = { lookupCard, searchCardsExternal };
