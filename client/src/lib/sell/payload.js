// Builds the multipart fields the API expects for POST /api/listings and PATCH /api/listings/:id, as a plain
// list of [name, value] pairs (photos are appended by the caller). This is a straight port of what the page
// always sent; tests/sell-logic.test.js compares it with a copy of the previous implementation so the API
// contract cannot drift unnoticed.
import { selectedCarriers } from './form.js';

const LEGO_CONDITION_MAP = { new: 'new', used: 'used', complete: 'complete', parts: 'parts' };

/**
 * @param {object} form  wizard state (see form.js)
 * @param {'draft'|'publish'} mode
 * @param {{isPro?: boolean, editing?: boolean}} [opts]  editing: also send blank card details, so they can be cleared
 * @returns {Array<[string, string]>}
 */
export function buildListingFields(form, mode, { isPro = false, editing = false } = {}) {
  const isLego = form.productType === 'lego';
  const isTcg = form.productType === 'tcg';
  const fields = [];
  const add = (name, value) => fields.push([name, value]);

  add('title', String(form.title).trim());
  add('productType', form.productType);
  if (isTcg && form.game) add('game', form.game);
  if (isLego && form.setNumber) add('setNumber', String(form.setNumber).trim());
  // A draft can now be saved from any step, before the LEGO category was picked: the server's draft schema
  // defaults to 'sets', so send that instead of an empty string (which it would reject).
  add('category', isLego ? form.mainCategory || (mode === 'draft' ? 'sets' : '') : 'sets');
  if (form.category) add('theme', form.category);
  if (isLego && form.year) add('year', String(form.year));

  add('type', form.condition === 'new' ? 'sealed' : 'used');
  if (isTcg) {
    // card grades are stored verbatim; a draft without one simply omits the field (the server allows null)
    if (form.condition) add('condition', form.condition);
  } else {
    add('condition', LEGO_CONDITION_MAP[form.condition] || 'used');
  }
  if (isLego && form.boxCondition) add('boxCondition', form.boxCondition);
  if (isLego && form.instructions) add('instructions', form.instructions);
  if (isLego) add('isComplete', String(form.isComplete));

  if (form.description) add('description', String(form.description).trim());
  if (isPro && form.proNotes) add('proNotes', String(form.proNotes).trim());

  add('shippingOptions', JSON.stringify(selectedCarriers(form.shippingOptions).map((carrier) => ({ carrier }))));

  if (!isTcg) {
    if (form.weightKg) add('weightKg', String(form.weightKg));
    if (form.lengthCm) add('lengthCm', String(form.lengthCm));
    if (form.widthCm) add('widthCm', String(form.widthCm));
    if (form.heightCm) add('heightCm', String(form.heightCm));
  }
  add('shippingCost', '0');

  const p = parseFloat(String(form.price).replace(',', '.'));
  if (!Number.isNaN(p) && p > 0) add('price', String(p));
  if (form.imageOrientation) add('imageOrientation', form.imageOrientation);
  if (isTcg) {
    const card = [
      ['cardLanguage', form.cardLanguage],
      ['cardRarity', String(form.cardRarity || '').trim()],
      ['cardGradingCompany', form.gradingCompany],
      ['cardGrade', String(form.cardGrade || '').trim()],
    ];
    for (const [name, value] of card) if (value || editing) add(name, value || '');
  }
  add('status', mode === 'draft' ? 'draft' : 'active');
  return fields;
}
