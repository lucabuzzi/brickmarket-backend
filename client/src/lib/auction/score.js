// "Completezza dell'asta": same idea as lib/sell/score.js, with the starting bid standing in for the price
// (the duration choice itself always has a value, so it earns no separate weight).
import { isPositive, selectedCarriers } from './form.js';

export const WEIGHTS = { title: 15, category: 10, condition: 10, price: 15, shipping: 10, photos: 25, description: 15 };

const PHOTO_SHARE = [0, 0.6, 0.8, 1];
const WIZARD_ORDER = ['title', 'category', 'photos', 'condition', 'price', 'shipping', 'description'];
const DESCRIPTION_FULL = 40;

export function completeness(form, { photoCount = 0 } = {}) {
  const title = String(form.title || '').trim();
  const description = String(form.description || '').trim();

  const share = {
    title: title.length >= 5 ? 1 : 0,
    category: form.productType === 'lego' ? (form.mainCategory ? 1 : 0) : form.productType === 'tcg' ? (form.game ? 1 : 0) : 1,
    condition: form.condition ? 1 : 0,
    price: isPositive(form.startingBid) ? 1 : 0,
    shipping: selectedCarriers(form.shippingOptions).length > 0 ? 1 : 0,
    photos: PHOTO_SHARE[Math.min(Math.max(photoCount, 0), 3)],
    description: description.length >= DESCRIPTION_FULL ? 1 : description.length > 0 ? 0.5 : 0,
  };

  const parts = {};
  let total = 0;
  for (const key of Object.keys(WEIGHTS)) {
    const earned = Math.round(WEIGHTS[key] * share[key]);
    parts[key] = { weight: WEIGHTS[key], earned };
    total += earned;
  }

  const missing = WIZARD_ORDER.filter((k) => parts[k].earned < parts[k].weight);
  return { percent: Math.min(100, total), parts, missing, hint: hintFor(missing[0], form, parts) };
}

function hintFor(key, form, parts) {
  switch (key) {
    case undefined: return null;
    case 'category': return form.productType === 'tcg' ? 'game' : 'category';
    case 'photos': return parts.photos.earned > 0 ? 'photos_more' : 'photos';
    case 'description': return parts.description.earned > 0 ? 'description_more' : 'description';
    default: return key; // title | condition | price | shipping
  }
}
