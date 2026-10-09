// Field-level validation for the sell wizard. Mirrors what the server enforces (src/routes/listings.js,
// validateDraftListing / validatePublishListing) so mistakes are caught on the field, not after the whole
// wizard: publish needs a title of 5+ characters, a price > 0, a year in 1900-2100, and so on.
//
// Errors are CODES (not texts): the page translates them with t(`sell.ui.err.${code}`).
// Modes:
//   'next'    moving forward in the wizard: the step's required fields must be valid
//   'publish' like 'next', plus: a new listing needs at least one photo
//   'draft'   only what the server needs to store a draft: a title, and a game for cards
import { MAX_PHOTOS, isPositive, parseDecimal, selectedCarriers } from './form.js';
import { CARD_GRADE_MAX, CARD_RARITY_MAX, CARD_REQUIRED_SHOTS, gradingError } from './cards.js';

export const STEP_IDS = ['what', 'photos', 'condition', 'price', 'review']; // 'review' has no fields of its own: it summarises the others

export const FIELD_STEP = {
  title: 'what',
  mainCategory: 'what',
  game: 'what',
  setNumber: 'what',
  year: 'what',
  photos: 'photos',
  condition: 'condition',
  cardLanguage: 'condition',
  cardRarity: 'condition',
  gradingCompany: 'condition',
  cardGrade: 'condition',
  price: 'price',
  shipping: 'price',
  weightKg: 'price',
  lengthCm: 'price',
  widthCm: 'price',
  heightCm: 'price',
  description: 'price',
  proNotes: 'price',
};

export const LIMITS = { titleMin: 5, titleMax: 300, setNumberMax: 20, descriptionMax: 10000, proNotesMax: 2000, yearMin: 1900, yearMax: 2100 };

const DIMENSION_FIELDS = ['weightKg', 'lengthCm', 'widthCm', 'heightCm'];

function validateWhat(form, mode) {
  const errors = {};
  const title = String(form.title || '').trim();
  if (!title) errors.title = 'title_required';
  else if (title.length > LIMITS.titleMax) errors.title = 'title_long';
  else if (mode !== 'draft' && title.length < LIMITS.titleMin) errors.title = 'title_short';

  if (form.productType === 'lego' && mode !== 'draft' && !form.mainCategory) errors.mainCategory = 'main_category_required';
  if (form.productType === 'tcg' && !form.game) errors.game = 'game_required';

  if (form.productType === 'lego') {
    if (String(form.setNumber || '').trim().length > LIMITS.setNumberMax) errors.setNumber = 'set_number_long';
    if (String(form.year ?? '').trim() !== '') {
      const y = Number(form.year);
      if (!Number.isInteger(y) || y < LIMITS.yearMin || y > LIMITS.yearMax) errors.year = 'year_invalid';
    }
  }
  return errors;
}

function validatePhotos(ctx, mode) {
  const { photoCount = 0, editing = false, guidedCards = false } = ctx;
  if (mode === 'publish' && !editing && photoCount === 0) return { photos: 'photo_required' };
  if (mode === 'publish' && !editing && guidedCards && photoCount < CARD_REQUIRED_SHOTS) return { photos: 'card_photos_required' };
  if (photoCount > MAX_PHOTOS) return { photos: 'photo_too_many' };
  return {};
}

function validateCondition(form, mode) {
  const errors = {};
  if (form.productType === 'tcg') {
    // the server rejects half a grading (company without grade or the other way round), drafts included
    const g = gradingError(form);
    if (g) errors[g.field] = g.code;
    else if (String(form.cardGrade || '').trim().length > CARD_GRADE_MAX) errors.cardGrade = 'grade_long';
    if (String(form.cardRarity || '').trim().length > CARD_RARITY_MAX) errors.cardRarity = 'rarity_long';
  }
  if (mode !== 'draft' && !form.condition) errors.condition = 'condition_required';
  return errors;
}

function validatePrice(form, mode, { isPro = false } = {}) {
  const errors = {};
  if (mode !== 'draft') {
    if (String(form.price ?? '').trim() === '') errors.price = 'price_required';
    else if (!isPositive(form.price)) errors.price = 'price_invalid';
    if (selectedCarriers(form.shippingOptions).length === 0) errors.shipping = 'shipping_required';
  }
  if (form.productType !== 'tcg') {
    for (const f of DIMENSION_FIELDS) {
      if (String(form[f] ?? '').trim() !== '' && !isPositive(form[f])) errors[f] = 'dimension_invalid';
    }
  }
  if (String(form.description || '').length > LIMITS.descriptionMax) errors.description = 'description_long';
  if (isPro && String(form.proNotes || '').length > LIMITS.proNotesMax) errors.proNotes = 'pro_notes_long';
  return errors;
}

/** Errors of one step as { [field]: code } (empty object = the step is fine). */
export function validateStep(stepId, form, ctx = {}, mode = 'next') {
  switch (stepId) {
    case 'what': return validateWhat(form, mode);
    case 'photos': return validatePhotos(ctx, mode);
    case 'condition': return validateCondition(form, mode);
    case 'price': return validatePrice(form, mode, ctx);
    default: return {};
  }
}

/**
 * Validates the whole form in wizard order.
 * -> { errors, firstStep }  where firstStep is the first step that has an error (null when valid).
 */
export function validateAll(form, ctx = {}, mode = 'publish') {
  const errors = {};
  let firstStep = null;
  for (const id of STEP_IDS) {
    const stepErrors = validateStep(id, form, ctx, mode);
    if (Object.keys(stepErrors).length && firstStep === null) firstStep = id;
    Object.assign(errors, stepErrors);
  }
  return { errors, firstStep };
}

/** Which of the fields that exist on a step has an error, in on-screen order (used to focus the first one). */
export function firstErrorField(stepId, errors) {
  return Object.keys(FIELD_STEP).find((f) => FIELD_STEP[f] === stepId && errors[f]) || null;
}

export { parseDecimal };
