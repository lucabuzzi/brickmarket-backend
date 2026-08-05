/**
 * dragonballApi.js — Dragon Ball Super Card Game: Fusion World lookup via the
 * apitcg.com API. Requires a free API key (register at
 * https://apitcg.com/register, get the key at https://apitcg.com/platform/api-key)
 * set as APITCG_API_KEY. Without it, lookups gracefully return null/empty,
 * same fallback behavior as rebrickable.js when REBRICKABLE_API_KEY is unset.
 */

const cardCatalog = require('./cardCatalog');

const APITCG_BASE = 'https://www.apitcg.com/api';
const TCG_SLUG = 'dragon-ball-super-fusion-world';

async function fetchJson(url) {
  const apiKey = process.env.APITCG_API_KEY;
  if (!apiKey) {
    console.warn('[DragonBallAPI] APITCG_API_KEY is not set — skipping external lookup.');
    return null;
  }

  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'x-api-key': apiKey },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('[DragonBallAPI] Network error:', err.message);
    return null;
  }
}

/**
 * Maps a raw apitcg.com product object to our generic master_cards row shape.
 */
function mapDragonBallCard(product) {
  const image = product.images?.[0];
  const setName = typeof product.set === 'object' ? product.set?.name : product.set;

  return {
    external_id: String(product._id),
    name: product.name,
    set_code: product.code || null,
    set_name: setName || null,
    rarity: product.attributes?.Rarity || null,
    img_url: image?.large || image?.medium || image?.small || null,
    details: {
      color: product.attributes?.Color || null,
      power: product.attributes?.Power || null,
      card_number: product.cardNumber || null,
      priceEur: product.markets?.tcgplayer?.prices?.market ?? null,
    },
  };
}

/**
 * Looks up a single card by its apitcg.com numeric product ID.
 */
async function lookupCard(externalId) {
  const cached = await cardCatalog.getCachedCard('dragonball', externalId);
  if (cached) return cached;

  const data = await fetchJson(`${APITCG_BASE}/products/${encodeURIComponent(externalId)}?populate=set`);
  if (!data || !data.success || !data.data) return null;

  return cardCatalog.upsertCard('dragonball', mapDragonBallCard(data.data));
}

/**
 * Searches apitcg.com by (partial) name for the Dragon Ball Fusion World TCG,
 * upserting all matches into the cache.
 */
async function searchCardsExternal(q, limit = 10) {
  const data = await fetchJson(
    `${APITCG_BASE}/products?tcg=${TCG_SLUG}&type=card&name=${encodeURIComponent(q)}&limit=${limit}&populate=set`
  );
  const products = Array.isArray(data?.data) ? data.data : [];

  const mapped = products.slice(0, limit).map(mapDragonBallCard);
  return cardCatalog.bulkUpsertCards('dragonball', mapped);
}

module.exports = { lookupCard, searchCardsExternal };
