// Builds the multipart fields the API expects for POST /api/listings (auctions), as a plain list of
// [name, value] pairs (photos are appended by the caller). Mirrors lib/sell/payload.js, but sends
// `auctionStart`/`auctionEnd` (type: 'auction') instead of a fixed `price`.
import { auctionEndDate, selectedCarriers } from './form.js';
import { hasCatalog } from '../sell/catalog.js';

const LEGO_CONDITION_MAP = { new: 'new', used: 'used', complete: 'complete', parts: 'parts' };

/**
 * @param {object} form  wizard state (see form.js)
 * @param {'draft'|'publish'} mode
 * @param {{isPro?: boolean, editing?: boolean}} [opts]
 * @returns {Array<[string, string]>}
 */
export function buildAuctionFields(form, mode, { isPro = false, editing = false } = {}) {
  const isLego = form.productType === 'lego';
  const isTcg = form.productType === 'tcg';
  const fields = [];
  const add = (name, value) => fields.push([name, value]);

  add('title', String(form.title).trim());
  add('productType', form.productType);
  if (isTcg && form.game) add('game', form.game);
  if (isLego && form.setNumber) add('setNumber', String(form.setNumber).trim());
  add('category', isLego ? form.mainCategory || (mode === 'draft' ? 'sets' : '') : 'sets');
  if (form.category) add('theme', form.category);
  if (isLego && form.year) add('year', String(form.year));

  // The server's draft schema doesn't accept type:'auction' (only used/sealed/moc) — a draft is saved
  // without it (defaults to 'used' server-side) and only becomes a real auction on publish.
  if (mode !== 'draft') add('type', 'auction');
  if (isTcg) {
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

  const bid = parseFloat(String(form.startingBid).replace(',', '.'));
  if (!Number.isNaN(bid) && bid > 0) add('auctionStart', String(bid));
  const end = auctionEndDate(form);
  if (end) add('auctionEnd', end.toISOString());

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
  if (isTcg && hasCatalog(form.game)) {
    const link = [['cardSetId', form.cardSetId], ['cardNumber', String(form.cardNumber || '').trim()], ['cardExternalId', form.cardExternalId]];
    for (const [name, value] of link) if (value || editing) add(name, value || '');
  }
  add('status', mode === 'draft' ? 'draft' : 'active');
  return fields;
}
