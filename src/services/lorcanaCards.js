/**
 * lorcanaCards.js — maps a raw lorcana-api.com Disney Lorcana card to our generic master_cards row shape. Pure (no
 * DB, no network), so both the catalog (lorcanaApi.js) and the card recognition (recognition/lorcana.js) can use it.
 */

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
      localId: card.Unique_ID || null,
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

module.exports = { mapLorcanaCard };
