/**
 * onepieceCards.js — maps a raw optcgapi.com One Piece card to our generic master_cards row shape. Pure (no DB, no
 * network), so both the catalog (onepieceApi.js) and the card recognition (cardRecognition.js) can use it.
 */

const RARITY_LABELS = { C: 'Common', UC: 'Uncommon', R: 'Rare', SR: 'Super Rare', SEC: 'Secret Rare', L: 'Leader', SP: 'Special', P: 'Promo', PR: 'Promo', TR: 'Treasure Rare' };
const rarityLabel = (r) => (r ? RARITY_LABELS[String(r).toUpperCase()] || r : null);

/** "OP01-077_p2" -> "2" (second alternative print); the base card -> null. */
const variantOf = (cardImageId) => {
  const m = /_p(\d+)$/i.exec(String(cardImageId || ''));
  return m ? m[1] : null;
};

/**
 * Maps a raw optcgapi.com card object to our generic master_cards row shape.
 */
function mapOnePieceCard(card) {
  return {
    external_id: card.card_image_id || card.card_set_id,
    name: card.card_name,
    set_code: card.set_id || null,
    set_name: card.set_name || null,
    rarity: rarityLabel(card.rarity),
    img_url: card.card_image || null,
    details: {
      localId: card.card_set_id || null,
      variant: variantOf(card.card_image_id),
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

module.exports = { mapOnePieceCard, variantOf, rarityLabel, RARITY_LABELS };
