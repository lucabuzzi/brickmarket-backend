// Pure helpers for the "sell a listing" wizard (pages/Sell.jsx): form shape, defaults and the rules for
// switching product type. No React, no browser globals: these modules are also imported by the Jest suite
// (see the "transform" entry in the root package.json), so keep them framework-free and write exports as
// plain `export const` / `export function`.

export const PRODUCT_TYPES = ['lego', 'tcg', 'funko'];
export const MAIN_CATEGORIES = ['sets', 'mocs', 'minifigures'];
export const LEGO_CONDITIONS = ['new', 'used', 'complete', 'parts'];
// Condition codes for trading cards; LEGO/Funko use LEGO_CONDITIONS.
export const TCG_CONDITIONS = ['near_mint', 'slightly_played', 'moderately_played', 'heavy_played', 'poor_damaged'];
export const MAX_PHOTOS = 5;

export const INITIAL_FORM = Object.freeze({
  productType: 'lego',
  game: '', // only when productType === 'tcg'
  title: '',
  setNumber: '',
  mainCategory: '', // LEGO only: sets | mocs | minifigures
  category: '', // stored as "theme": LEGO theme / Funko series / TCG game name
  year: '',
  condition: '',
  boxCondition: '',
  instructions: '',
  isComplete: false,
  price: '',
  shippingOptions: {}, // { [carrierId]: { selected: boolean } }
  weightKg: '',
  lengthCm: '',
  widthCm: '',
  heightCm: '',
  description: '',
  proNotes: '',
  // Trading cards only (see lib/sell/cards.js). '' = not specified / not graded.
  cardLanguage: '',
  cardRarity: '',
  gradingCompany: '',
  cardGrade: '',
  imageOrientation: '', // '' = not chosen yet -> defaultImageOrientation(productType)
});

export const IMAGE_ORIENTATIONS = ['portrait', 'landscape'];

/** Cards are shot upright, everything else is usually wider than tall. The server applies the same default. */
export const defaultImageOrientation = (productType) => (productType === 'tcg' ? 'portrait' : 'landscape');

/** "12,5" / "12.5" -> 12.5 ; anything else (including '') -> NaN. */
export function parseDecimal(value) {
  const s = String(value ?? '').trim().replace(',', '.');
  if (s === '') return NaN;
  return /^\d*\.?\d+$|^\d+\.$/.test(s) ? parseFloat(s) : NaN;
}

export const isPositive = (value) => {
  const n = parseDecimal(value);
  return Number.isFinite(n) && n > 0;
};

/**
 * Switching the type of product clears what no longer applies (the same resets the page always did).
 * Choosing the type that is already selected changes nothing, so re-clicking a tile never wipes the
 * condition the seller already picked.
 */
export function changeProductType(form, next) {
  if (!PRODUCT_TYPES.includes(next) || next === form.productType) return form;
  return {
    ...form,
    productType: next,
    condition: '',
    game: next === 'tcg' ? form.game : '',
    mainCategory: next === 'lego' ? form.mainCategory : '',
    setNumber: next === 'lego' ? form.setNumber : '',
    year: next === 'lego' ? form.year : '',
    imageOrientation: '', // follows the new type's default again
    cardLanguage: '',
    cardRarity: '',
    gradingCompany: '',
    cardGrade: '',
    category: '', // the old theme/series no longer applies; picking a card game fills it again (selectGame)
  };
}

/** Picking a card game also fills the generic "theme" field with the game's display name. */
export function selectGame(form, slug, gameName) {
  return { ...form, game: slug, category: gameName || form.category };
}

/** Number of carriers the seller ticked. */
export const selectedCarriers = (shippingOptions) =>
  Object.entries(shippingOptions || {}).filter(([, o]) => o && o.selected).map(([id]) => id);
