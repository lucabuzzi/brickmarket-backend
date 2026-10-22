/**
 * scryfallCards.js — maps a raw Scryfall Magic card to our generic master_cards row shape. Pure (no DB, no network),
 * so both the catalog (scryfall.js) and the card recognition (recognition/magic.js) can use it.
 */

const RARITY_LABELS = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', mythic: 'Mythic Rare', special: 'Special', bonus: 'Bonus' };
const rarityLabel = (r) => (r ? RARITY_LABELS[r] || r.charAt(0).toUpperCase() + r.slice(1) : null);

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
    rarity: rarityLabel(card.rarity),
    img_url: imgUrl,
    details: {
      localId: card.collector_number ?? null,
      detailed: true,
      mana_cost: card.mana_cost || face?.mana_cost || null,
      type_line: card.type_line || face?.type_line || null,
      oracle_text: card.oracle_text || face?.oracle_text || null,
      cmc: card.cmc ?? null,
      priceEur: card.prices?.eur || card.prices?.usd || null,
    },
  };
}

module.exports = { mapScryfallCard, rarityLabel, RARITY_LABELS };
