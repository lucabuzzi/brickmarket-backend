// Italian labels and formatting shared by everything that describes a listing in words (the <title> and
// meta description in listingMeta.js, and the crawler-readable page text in seoContent/listings.js).
// Pure module: no DB, no network.
const { SHORT } = require('./pageMeta');

const eur = (v) => {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(n) : null;
};

const CONDITION_LABELS = {
  new: 'Nuovo', used: 'Usato', 'like new': 'Come nuovo', damaged: 'Danneggiato',
  near_mint: 'Near Mint', slightly_played: 'Leggermente giocata', moderately_played: 'Moderatamente giocata',
  heavy_played: 'Molto giocata', poor_damaged: 'Danneggiata',
};
const conditionLabel = (c) => (c ? CONDITION_LABELS[String(c).trim().toLowerCase()] || null : null);

const TYPE_LABELS = { lego: 'LEGO', funko: 'Funko', tcg: 'Carte collezionabili' };

/** What kind of item a listing is, in a few words ("LEGO", "Funko", "carta Pokémon"); null when unknown. */
function descriptorFor(listing) {
  if (listing.product_type === 'lego') return 'LEGO';
  if (listing.product_type === 'funko') return 'Funko';
  if (listing.product_type === 'tcg') {
    const game = SHORT[String(listing.game || '').toLowerCase()];
    return game ? `carta ${game}` : 'carta collezionabile';
  }
  return null;
}

module.exports = { eur, conditionLabel, TYPE_LABELS, CONDITION_LABELS, descriptorFor };
