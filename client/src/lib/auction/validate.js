// Field-level validation for the auction wizard. Same shape as lib/sell/validate.js: the 'what', 'photos'
// and 'condition' steps are identical to a listing's, so their checks are reused unchanged. Only the step
// that used to be "price" becomes "the auction itself" (starting bid, duration, shipping, dimensions).
import { isPositive, selectedCarriers } from './form.js';
import { validateWhat, validatePhotos, validateCondition, LIMITS } from '../sell/validate.js';

export const STEP_IDS = ['what', 'photos', 'condition', 'price', 'review'];

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
  startingBid: 'price',
  durationMode: 'price',
  customEndDate: 'price',
  shipping: 'price',
  weightKg: 'price',
  lengthCm: 'price',
  widthCm: 'price',
  heightCm: 'price',
  description: 'price',
  proNotes: 'price',
};

const DIMENSION_FIELDS = ['weightKg', 'lengthCm', 'widthCm', 'heightCm'];

function validateAuction(form, mode, { isPro = false, bidLocked = false } = {}) {
  const errors = {};
  // Once an auction is published its starting bid and duration are immutable (the server ignores
  // both after that point) — bidLocked means the wizard shows them read-only, so nothing to validate.
  if (mode !== 'draft' && !bidLocked) {
    if (String(form.startingBid ?? '').trim() === '') errors.startingBid = 'starting_bid_required';
    else if (!isPositive(form.startingBid)) errors.startingBid = 'starting_bid_invalid';

    if (form.durationMode === 'custom') {
      const raw = String(form.customEndDate ?? '').trim();
      if (!raw) errors.customEndDate = 'end_date_required';
      else {
        const d = new Date(raw);
        if (Number.isNaN(d.getTime())) errors.customEndDate = 'end_date_invalid';
        else if (d.getTime() <= Date.now()) errors.customEndDate = 'end_date_past';
      }
    }
  }
  if (mode !== 'draft' && selectedCarriers(form.shippingOptions).length === 0) errors.shipping = 'shipping_required';
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
    case 'price': return validateAuction(form, mode, ctx);
    default: return {};
  }
}

/** Validates the whole form in wizard order. -> { errors, firstStep } (firstStep is null when valid). */
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
