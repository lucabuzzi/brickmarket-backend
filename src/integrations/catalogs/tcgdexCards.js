/**
 * tcgdexCards.js — maps raw TCGdex Pokémon cards to our generic master_cards row shape. Pure (no DB, no network), so
 * both the catalog (tcgdex.js) and the card recognition (recognition/pokemon.js) can use it.
 */

/** TCGdex gives an image base URL; the actual file is `<base>/high.webp`. */
const imageUrl = (base) => (base ? `${base}/high.webp` : null);

/** "30th-001" + "001" -> "30th" ; "sv3pt5-12" + "12" -> "sv3pt5". */
function setIdOfCard(cardId, localId) {
  const suffix = `-${localId}`;
  if (localId && cardId.endsWith(suffix)) return cardId.slice(0, -suffix.length);
  return cardId.replace(/-[^-]*$/, '');
}

/** A full card (GET /cards/:id) -> master_cards row shape. Prices are not copied. */
function mapCardDetail(card) {
  return {
    external_id: card.id,
    name: card.name,
    set_code: card.set?.id || setIdOfCard(card.id, card.localId),
    set_name: card.set?.name || null,
    rarity: card.rarity || null,
    img_url: imageUrl(card.image),
    details: {
      localId: card.localId ?? null,
      category: card.category || null,
      hp: card.hp ?? null,
      types: (card.types || []).join(', ') || null,
      illustrator: card.illustrator || null,
      detailed: true,
    },
  };
}

module.exports = { imageUrl, setIdOfCard, mapCardDetail };
