// "Completezza dell'annuncio": an honest checklist-as-a-meter, not a promise about sales. It only says how
// much of the listing is filled in, and what to do next. Weights add up to 100.
import { isPositive, selectedCarriers } from './form.js';

export const WEIGHTS = { title: 15, category: 10, condition: 10, price: 15, shipping: 10, photos: 25, description: 15 };

/** Fraction of the weight earned by the number of photos: 1 photo is the essential, 3 show the piece well. */
const PHOTO_SHARE = [0, 0.6, 0.8, 1];
// the order in which the wizard asks for things: what it is, photos, condition, price + shipping, description
const WIZARD_ORDER = ['title', 'category', 'photos', 'condition', 'price', 'shipping', 'description'];
const DESCRIPTION_FULL = 40; // characters for the full score; a shorter note still counts a little

export function completeness(form, { photoCount = 0 } = {}) {
  const title = String(form.title || '').trim();
  const description = String(form.description || '').trim();

  const share = {
    title: title.length >= 5 ? 1 : 0,
    category: form.productType === 'lego' ? (form.mainCategory ? 1 : 0) : form.productType === 'tcg' ? (form.game ? 1 : 0) : 1,
    condition: form.condition ? 1 : 0,
    price: isPositive(form.price) ? 1 : 0,
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

  // What is still missing, in the order the wizard asks for it, so the hint is always the next natural step.
  const missing = WIZARD_ORDER.filter((k) => parts[k].earned < parts[k].weight);

  return { percent: Math.min(100, total), parts, missing, hint: hintFor(missing[0], form, parts) };
}

/** The i18n id of the next best thing to do (UI: t(`sell.ui.hint.${hint}`)), or null when complete. */
function hintFor(key, form, parts) {
  switch (key) {
    case undefined: return null;
    case 'category': return form.productType === 'tcg' ? 'game' : 'category';
    case 'photos': return parts.photos.earned > 0 ? 'photos_more' : 'photos';
    case 'description': return parts.description.earned > 0 ? 'description_more' : 'description';
    default: return key; // title | condition | price | shipping
  }
}
